/**
 * Created by jiagang on 16/1/26.
 */
/*eslint no-unused-vars: 0*/
import Hammer from '../../bower_components/hammerjs/hammer.js';

export default class Kline {

  hasMoreData = true;
  pixelRadio = (() => {
    let ctx = document.createElement('canvas').getContext('2d');
    let dpr = window.devicePixelRatio || 1;
    let bsr = ctx.webkitBackingStorePixelRatio ||
      ctx.mozBackingStorePixelRatio ||
      ctx.msBackingStorePixelRatio ||
      ctx.oBackingStorePixelRatio ||
      ctx.backingStorePixelRatio || 1;

    return dpr / bsr;
  })();

  constructor(container, options = {}) {
    this._container = container;
    this._options = options;
    this.dataProvider = options.dataProvider;

    // 初始化数据
    this.initData();
  }

  initData() {

    // 初始化数据,取options中data字段作为初始数据
    this.data = this._options.data || [];
    this.cache = [].concat(this.data);

    // 最大显示条数(理论数值,不能大于重画时计算出的最大条数)
    this.maxCount = this._options.maxCount || Number.MAX_VALUE;

    // 最小显示条数
    this.minCount = this._options.minCount || 10;

    // 最大预加载数据条数,默认100,预加载数据条数取当前显示条数和最大预加载数据条数中较大的一个值
    this.maxPreLoadCount = this._options.maxPreLoadCount || 100;

    // 位置表示显示数据在缓存中开始位置
    this.position = 0;

    // 初始需要展示的数据条数,默认80
    this.reCalculate(0, this._options.initCount || 80);

    // 订阅K线数据变化(更新最新的数据)
    //this.dataProvider.onKlineUpdate()
  }

  bindEvent() {

    // 绑定事件,hammer相关
    var mc = new Hammer.Manager(this.canvas, {});
    mc.add(new Hammer.Pan({threshold: 10, direction: Hammer.DIRECTION_ALL}));
    mc.add(new Hammer.Press({time: 500}));
    mc.add(new Hammer.Pinch());

    var lastDeltaX = 0;
    let lastScale = 1;

    mc.on('panstart', (event) => {
      //console.log('panstart', event);
    });

    mc.on('panmove', (event) => {

      //console.log('panmove', event);

      // 加载数据时直接停止移动
      if (this._loading) {
        lastDeltaX = 0;
        mc.stop();
        return;
      }

      if (this.pressed) {
        this.pressPoint = Object.assign({}, event.center);
        this.redraw();
        return;
      }

      var deltaX = event.deltaX - lastDeltaX;
      var size = parseInt(deltaX / (this.pixelPer + 1));
      if (size !== 0) {
        //console.log(deltaX, size);
        this.reCalculate(size);
        lastDeltaX = lastDeltaX + (size * (this.pixelPer + 1));
      }
    });

    mc.on('panend', (event) => {
      //console.log('panend', event);
      lastDeltaX = 0;
      if (this.pressed) {
        this.pressed = false;
        this.redraw();
      }
    });

    mc.on('press', (event) => {
      //console.log('press', event);

      // 显示十字坐标和坐标位置的数据
      this.pressed = true;
      this.pressPoint = Object.assign({}, event.center);
      this.redraw();
    });

    mc.on('pressup', (event) => {
      //console.log('pressup', event);

      this.pressed = false;
      this.redraw();
    });

    mc.on('pinchstart', (event) => {
      //console.log('pinchstart', event);
      if (this.pressed) {
        return;
      }
      lastScale = 1;
    });

    mc.on('pinchmove', (event) => {
      //console.log('pinchmove', event);
      if (!this._loading && !this.pressed) {
        let deltaX = this.canvasWidth * (lastScale - event.scale);
        let offsetCount = parseInt(deltaX / (this.pixelPer + 1));
        if (Math.abs(offsetCount) > 1) {
          this.reCalculate(0, this.data.length + offsetCount);
          lastScale = event.scale;
        }
      }
    });
  }

  initCanvas() {

    // canvas不存在则创建出canvas
    let canvas = this.canvas;
    let ctx = this.ctx;
    if (!canvas) {
      canvas = this.canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.top = 0;
      canvas.style.left = 0;
      this._container.appendChild(canvas);
      ctx = this.ctx = canvas.getContext('2d');

      this.bindEvent();
    }

    // 设置canvas宽高,占满整个容器大小
    let {canvasWidth, canvasHeight} = this._options;
    canvasWidth = this.canvasWidth = canvasWidth || this._container.clientWidth;
    canvasHeight = this.canvasHeight = canvasHeight || this._container.clientHeight;

    let ratio = this.pixelRadio;
    canvas.width = canvasWidth * ratio;
    canvas.height = canvasHeight * ratio;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    ctx.scale(ratio, ratio);

    //// 坐标变换,坐标原点移动到左下角
    //ctx.translate(0, canvas.height);
    //ctx.scale(1, -1);

    this.initChart();

    // 清空canvas(重置大小时会清空canvas,因此不再重复做clearRect)
    //ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  /**
   * 设置画图参数(K线相关)
   */
  initChart() {

    // K线烛图和量图之间横坐标高度固定为14像数,烛图占70%,量图占30%
    var candleChartHeight = this.candleChartHeight = (this.canvasHeight - 14) * (this._options.hideVolume ? 1 : 0.7);
    var volumeChartHeight = this.volumeChartHeight = (this.canvasHeight - 14) * (this._options.hideVolume ? 0 : 0.3);

    // 根据画板宽度调整显示数据个数,最多显示1像数显示一条数据(单条数据小于1像数时,需要调整显示个数),间隙和影线宽度都是固定的1像数
    let count = this.data.length;

    // FIXME count = 0
    let pixelPer = this.canvasWidth / count - 1;
    if (pixelPer < 1) {
      count = parseInt(this.canvasWidth / 2);
      this.data = this.data.slice(0, count);
      pixelPer = 1;
      this.maxCount = count;
    }

    this.pixelPer = pixelPer;

    // 计算最大和最小值
    let MAX_VALUE = Number.MAX_VALUE;
    let MIN_VALUE = Number.MIN_VALUE;
    let min = MAX_VALUE;
    let max = 0;
    let maxVolume = 0;
    this.data.forEach(function(eachData) {
      max = Math.max(max, eachData.ZuiGaoJia || MIN_VALUE, eachData.MA5 || MIN_VALUE, eachData.MA10 || MIN_VALUE, eachData.MA20 || MIN_VALUE, eachData.MA30 || MIN_VALUE);
      min = Math.min(min, eachData.ZuiDiJia || MAX_VALUE, eachData.MA5 || MAX_VALUE, eachData.MA10 || MAX_VALUE, eachData.MA20 || MAX_VALUE, eachData.MA30 || MAX_VALUE);
      maxVolume = Math.max(maxVolume, eachData.ChengJiaoLiang);
    });

    // 最大值和最小值范围增加10%
    this.max = max > min ? max + (max - min) * 0.1 : max * 1.1;
    this.min = max > min ? min - (max - min) * 0.1 : max * 0.9;
    this.maxVolume = maxVolume;

    this.candleYPixelRadio = candleChartHeight / (this.max - this.min);
    this.volumeYPixelRadio = volumeChartHeight / maxVolume;
  }

  reCalculate(move, count) {

    // 重新计算显示数据在缓存数据中的左偏移位置和长度
    let requestCount = 0;
    let currentCount = this.data.length;
    let cacheCount = this.cache.length;
    let leftPosition = this.position;

    // 如果move为正数,表示向左移动,判断缓存数据是否存在,缓存数据不足则加载更多数据,负数表示向右移动直接从缓存中取得数据
    if (move > 0) {
      if (leftPosition < move) {
        if (this.hasMoreData) {
          requestCount = move - leftPosition;
        } else {
          leftPosition = 0;
        }
      } else {
        leftPosition = leftPosition - move;
      }
    } else if (move < 0) {
      let restCount = cacheCount - leftPosition - currentCount;
      if (restCount > -move) {
        leftPosition = leftPosition + (-move);
      } else {
        leftPosition = leftPosition + restCount;
      }
    }

    // count 重设显示数据个数(先重新计算左偏移,再重设count)
    // 限制最小个数
    if (count) {
      count = Math.max(count, this.minCount);
    }

    // 如果count比当前个数小,则直接左偏移向右移动count/2
    if (count < currentCount) {

      leftPosition += parseInt((currentCount - count) / 2);
      currentCount = count;
    } else if (count > currentCount) {

      // 限制显示的最大个数
      count = Math.min(count, this.maxCount);
      let leftOffsetCount = parseInt((count - currentCount) / 2);

      leftOffsetCount += Math.max(leftOffsetCount - (cacheCount - leftPosition - currentCount), 0);

      // 如果缓存数据不足则加载更多数据
      if (leftPosition < leftOffsetCount && this.hasMoreData) {
        requestCount = leftOffsetCount - leftPosition;
      } else {
        leftPosition = Math.max(leftPosition - leftOffsetCount, 0);
        currentCount = count;
      }
    }

    // requestCount不为零则加载数据后再做reCalculate
    if (requestCount > 0) {

      // 计算请求数据的start和count,count需要加上预加载个数(默认等于当前显示的数据个数,但不能超过限制的最大值)
      requestCount = requestCount + Math.min(currentCount || Number.MAX_VALUE, this.maxPreLoadCount);
      let start = -(requestCount + cacheCount);
      this.loadMoreData(start, requestCount).then(() => {
        this.reCalculate(move, count);
      });
      return;
    }

    // 根据新的左偏移位置和新的数据个数重设显示数据data后重画图形
    this.data = this.cache.slice(leftPosition, leftPosition + currentCount);
    this.position = leftPosition;
    this.redraw();
  }

  /**
   * 动态加载数据,添加到缓存cache中并且修改当前位置
   */
  loadMoreData(start, count) {
    this.toggleMask(true);
    let lastDataProvider = this.dataProvider;
    return this.dataProvider.getKline(start, count).then((data) => {
      if (data && lastDataProvider === this.dataProvider) {

        // 合并数据到缓存中,判断是否还有更多数据(请求到的数据长度小于count大小或者请求到的数据的时间在cache中已经存在)
        if (data.length < count) {
          this.hasMoreData = false;
        }
        let cacheStartTime = this.cache[0] ? this.cache[0].ShiJian : Number.MAX_VALUE;
        let eachData;
        for (let i = data.length; i > 0; i--) {
          eachData = data[i - 1];
          if (eachData.ShiJian < cacheStartTime) {
            this.cache.unshift(eachData);
            this.position++;
          } else {
            this.hasMoreData = false;
            break;
          }
        }
      }
      this.toggleMask(false);
    });
  }

  /**
   * 显示和隐藏mask层
   */
  toggleMask(show) {

    this._loading = show;

    // 如果mask不存在则创建
    let mask = this._mask;
    if (!mask) {
      mask = this._mask = document.createElement('div');
      mask.class = 'load-mask';
      let style = mask.style;
      style.position = 'absolute';
      style.top = style.left = style.right = style.bottom = 0;
      style.zIndex = 100;
      style.backgroundColor = 'rgba(255,255,255,0.5)';
      this._container.appendChild(mask);
    }
    mask.style.display = (show ? 'block' : 'none');
  }

  redraw() {
    this.initCanvas();

    let lastLabel, currentLabel, lastDrawIndex;
    let maPoints = [[], [], [], []];

    this.drawBackground();

    // 画出每根k线和量
    this.data.forEach((eachData, index) => {
      let lastClose = eachData.lastClose;
      if (!lastClose) {
        eachData.lastClose = lastClose = index > 0 ? this.data[index - 1].ShouPanJia : (this.lastClose || 0);
      }
      this.currentIndex = index;

      currentLabel = this._getXAxisLabel(eachData);

      if (!lastLabel) {
        lastLabel = currentLabel;
        lastDrawIndex = index;
      }

      // 满足条件画x轴坐标(类似雪球跨月的第一交易日并且两个坐标点之间的距离不小于指定大小)
      if (currentLabel !== lastLabel) {
        lastLabel = currentLabel;
        if ((index - lastDrawIndex) * (this.pixelPer + 1) > 50) {
          this.drawXAxisGridLine((this.pixelPer + 1) * index + this.pixelPer / 2, currentLabel, '#ddd');
          lastDrawIndex = index;
        }
      }
      this.drawCandle(eachData.KaiPanJia, eachData.ShouPanJia, eachData.ZuiGaoJia, eachData.ZuiDiJia, lastClose);
      if (!this._options.hideVolume) {
        this.drawVolume(eachData.ChengJiaoLiang, eachData.KaiPanJia, eachData.ShouPanJia, lastClose);
      }

      // MA
      if (eachData.MA5) {
        let x = (this.pixelPer + 1) * index + this.pixelPer / 2;
        if (index === 0) {
          x -= this.pixelPer / 2;
        } else if (index === this.data.length - 1) {
          x += this.pixelPer / 2;
        }
        maPoints[0].push([x, this.candleYPixelRadio * (this.max - eachData.MA5)]);
        maPoints[1].push([x, this.candleYPixelRadio * (this.max - eachData.MA10)]);
        maPoints[2].push([x, this.candleYPixelRadio * (this.max - eachData.MA20)]);
        maPoints[3].push([x, this.candleYPixelRadio * (this.max - eachData.MA30)]);
      }
    });

    let color = ['#FFD11E', '#F77BFC', '#39C2FD', '#B7B7B7'];
    maPoints.forEach((eachPoints, index) => {
      this.drawPath(eachPoints, color[index]);
    });

    // 按压时显示十字光标
    if (this.pressed) {
      let {x, y} = this.pressPoint;
      let index = parseInt(x / (this.pixelPer + 1));
      let data = this.data[index] || {};

      // x
      this.drawXAxisGridLine((this.pixelPer + 1) * index + this.pixelPer / 2, this._getXAxisLabel(data, true), null, true);

      // y
      if (y < this.candleChartHeight && y > 0) {
        this.drawYAxisGridLine(y, this.max - y / this.candleYPixelRadio, null, (y > this.candleChartHeight / 2) ? 'top' : 'bottom', true);
      } else if (y > this.candleChartHeight + 14 && y < this.canvasHeight) {
        this.drawYAxisGridLine(y, this.maxVolume - (y - this.candleChartHeight - 14) / this.volumeYPixelRadio, null, (y > this.candleChartHeight + 14 + this.volumeChartHeight / 2) ? 'top' : 'bottom', true);
      }

      // 显示详细信息
      this.drawTooltip(data);
    }
  }

  drawTooltip(data) {

    // 显示日活的显示信息
    this.drawText(this._getXAxisLabel(data, true), 30, 12, 10, '#555'); // 日期
    this.drawText(data.ShouPanJia, 90, 12, 10, this.getColor(this.isUp(data.KaiPanJia, data.ShouPanJia, data.lastClose))); // 当前值
    this.drawText(`MA5: ${data.MA5.toFixed(1)}`, 120, 12, 10, '#FFD11E');
    this.drawText(`MA10: ${data.MA10.toFixed(1)}`, 180, 12, 10, '#F77BFC');
    this.drawText(`MA20: ${data.MA20.toFixed(1)}`, 240, 12, 10, '#39C2FD');
    this.drawText(`MA30: ${data.MA30.toFixed(1)}`, 300, 12, 10, '#B7B7B7');
  }

  // x轴坐标标签(默认年月)
  _getXAxisLabel(eachData, hasDay = false) {
    if (eachData && eachData.ShiJian) {
      let date = new Date(eachData.ShiJian * 1000);
      if (!hasDay) {
        return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}`;
      } else {
        return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + (date.getDate())).slice(-2)}`;
      }
    }
  }

  isUp(open, close, lastClose) {

    // FIXME 还需要考虑当天收盘和昨收相同的情况
    return open !== close ? close > open : close > lastClose;
  }

  getColor(up) {
    return up ? 'red' : 'green';
  }

  drawCandle(open, close, top, low, lastClose) {
    let ctx = this.ctx;
    let pixelPer = this.pixelPer;
    let x = (pixelPer + 1) * this.currentIndex;
    let y = this.candleYPixelRadio * (this.max - open);
    let width = pixelPer;
    let height = open === close ? 1 : this.candleYPixelRadio * (this.max - close) - y;
    height = Math.abs(height) < 1 ? Math.sign(height) : height;

    let color = this.getColor(this.isUp(open, close, lastClose));
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);

    // 上下影线
    let x1 = x + width / 2;
    let y1 = this.candleYPixelRadio * (this.max - top);
    let y2 = this.candleYPixelRadio * (this.max - low);

    this.drawLine(x1, y1, x1, y2, 1, color);
  }

  drawVolume(volumn, open, close, lastClose) {
    let ctx = this.ctx;
    let pixelPer = this.pixelPer;
    let x = (pixelPer + 1) * this.currentIndex;
    let y = this.canvasHeight;
    let width = pixelPer;
    let height = -this.volumeYPixelRadio * volumn;

    ctx.fillStyle = this.getColor(this.isUp(open, close, lastClose));
    ctx.fillRect(x, y, width, height);
  }

  drawBackground() {

    // 画出纵坐标和网格线
    this.drawYAxisGridLine(0, this.max, null, 'bottom');
    this.drawYAxisGridLine(this.candleChartHeight, this.min);

    this.drawYAxisGridLine(this.candleChartHeight / 2, this.max - (this.max - this.min) / 2, '#ddd');
    this.drawYAxisGridLine(this.candleChartHeight / 4, this.max - (this.max - this.min) / 4, '#ddd');
    this.drawYAxisGridLine(this.candleChartHeight * 3 / 4, this.max - (this.max - this.min) * 3 / 4, '#ddd');

    this.drawYAxisGridLine(0);
    this.drawYAxisGridLine(this.canvasHeight - this.volumeChartHeight, this.maxVolume, null, 'bottom');
  }

  drawYAxisGridLine(y, text, color, position = 'top', withBackground) {
    this.drawLine(0, y, this.canvasWidth, y, 0.5, color || '#999');
    if (text) {
      this.drawText(text, 0, (position === 'top' ? y - 2 : y + 12), 10, '#555', withBackground);
    }
  }

  drawXAxisGridLine(x, text, color, full = false, position = 'middle') {

    // 仅仅在烛图范围画网格线
    this.drawLine(x, 0, x, full ? this.canvasHeight : this.candleChartHeight, 0.5, color || '#999');

    if (text) {
      let textWidth = this.ctx.measureText(text).width;
      let textX = position === 'middle' ? x - (textWidth) / 2 : x;
      let textY = this.candleChartHeight + 12;

      this.drawText(text, textX, textY, 10, '#555', full);
    }
  }

  drawLine(x1, y1, x2, y2, lineWidth, color) {
    let ctx = this.ctx;
    ctx.beginPath();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.moveTo(this._normalizeDrawLinePoint(x1), this._normalizeDrawLinePoint(y1));
    ctx.lineTo(this._normalizeDrawLinePoint(x2), this._normalizeDrawLinePoint(y2));
    ctx.stroke();
  }

  drawText(text, x, y, fontSize, fontColor, withBackground = false) {

    // 数字保留两位小数
    if (typeof text === 'number') {
      text = text.toFixed(1);
    }
    let ctx = this.ctx;
    let textWidth = ctx.measureText(text).width;
    x = Math.min(Math.max(x, 0), this.canvasWidth - textWidth);

    if (withBackground) {

      // 外边框
      ctx.fillStyle = '#eee';
      ctx.fillRect(x - 2, y + 2, textWidth + 4, -14);
    }

    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = fontColor;
    ctx.fillText(text, x, y);
  }

  drawPath(points, color, lineWidth = 1) {
    let ctx = this.ctx;
    ctx.beginPath();
    points.forEach((eachPoint, index) => {
      if (index === 0) {
        ctx.moveTo(eachPoint[0], eachPoint[1]);
      } else {
        ctx.lineTo(eachPoint[0], eachPoint[1]);
      }
    });
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.closePath();
  }

  _normalizeDrawLinePoint(point) {
    if (this.pixelRadio === 1) {
      let intPoint = parseInt(point);
      return intPoint > point ? intPoint - 0.5 : intPoint + 0.5;
    } else {
      return point;
    }
  }

  reset(options) {
    this._options = Object.assign(this._options, options);
    this.dataProvider = this._options.dataProvider;
    this.hasMoreData = true;

    // 初始化数据
    this.initData();
  }
}
