/**
 * Created by jiagang on 16/2/24.
 */
/*eslint no-unused-vars: 0*/
import Hammer from '../../bower_components/hammerjs/hammer.js';

const oneMinute = 1 * 60 * 1000;
const oneDay = 1 * 24 * 60 * oneMinute;

// 默认股票交易时间
const defaultTimeInfo = (function() {
  let now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  let day = now.getDate();
  let date = [year, month, date].join('');
  return {
    RiQi: date,
    JiaoYiShiJianDuan: [
      {
        KaiShiShiJian: '0930',
        JieShuShiJian: '1130',
        KaiShiRiQi: date,
        JieShuRiQi: date
      },
      {
        KaiShiShiJian: '1300',
        JieShuShiJian: '1500',
        KaiShiRiQi: date,
        JieShuRiQi: date
      }
    ],
    JiHeJingJiaDianShu: 15,
    ShiQu: 8,
    ZuoShou: 0
  };
})();

const getDate = function(date, hourMinute) {
  date = date + '';
  let year = parseInt(date.substr(0, 4));
  let month = parseInt(date.substr(4, 2)) - 1;
  let day = parseInt(date.substr(6, 2));
  let hour = parseInt(hourMinute / 100);
  let minute = hourMinute % 100;
  return new Date(year, month, day, hour, minute);
};

const getTime = function (date, hourMinute) {
  return getDate(date, hourMinute).getTime();
};

export default class Min {

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

  _initCache(timeInfo) {
    let times = timeInfo.JiaoYiShiJianDuan;
    this.cache = {};
    let minTimes = this.cache.minTimes = [];
    if (times && times.length > 0) {
      let lastTime = 0;
      let startTime, endTime;
      times.forEach((eachTime, index) => {
        startTime = getTime(eachTime.KaiShiRiQi, eachTime.KaiShiShiJian);
        endTime = getTime(eachTime.JieShuRiQi, eachTime.JieShuShiJian);

        // 跨天
        if (endTime < startTime) {
          endTime += oneDay;
        }
        if (startTime < lastTime) {
          startTime += oneDay;
          endTime += oneDay;
        }

        // 跳过除第一段时间的开始时间
        if (index > 0) {
          startTime += oneMinute;
        }
        while(startTime <= endTime) {
          minTimes.push(startTime);
          startTime += oneMinute;
        }
        lastTime = endTime;
      });

      // FIXME 默认包含集合进价的数据
      let prefixMinute = timeInfo.JiHeJingJiaDianShu || 0;
      startTime = minTimes[0];

      for(let i = 1; i <= prefixMinute; i++) {
        minTimes.unshift(startTime - (i * oneMinute));
      }
    }
  }

  _updateMinData(time, data) {
    let minTimes = this.cache.minTimes || [];
    let index = this.cache.minTimes.indexOf(time);
    if (index >= 0) {
      this.cache[time] = data;
    } else {

      // 没有对应时间时，认为交易日期有跨越，对应修正交易时间数据
      let date = new Date(time);
      let firstTime = minTimes[0];
      let overDays = parseInt((time - firstTime) / oneDay);
      let overTime = overDays * oneDay;
      index = minTimes.indexOf(time - overTime);

      // 找到跨越时间点将之后的数据统一修改日期到数据对应的日期
      if (index >= 0) {
        while(index < minTimes.length) {
          let oldTime = minTimes[index];
          oldTime += overTime;
          minTimes[index] = oldTime;
          index++;
        }
        this.cache[time] = data;
      }
    }
  }

  initData() {

    // 初始化数据,取options中data字段作为初始数据
    this.cache = this._options.data || null;

    // 订阅数据,有数据推送到达时重画
    this.dataProvider.subscribeMin((data) => {

      // FIXME 注意考虑断线重连后请求到重复数据

      // 清盘
      if (data.QingPan === 1) {
        this.cache = null;
      }

      // 初始缓存数据(交易时间段)
      if (!this.cache) {
        this.lastClose = data.ZuoShou;
        this._initCache(data.JiaoYiShiJianDuan ? data : defaultTimeInfo);
      }

      // 更新数据
      data = data.Data;
      if (data && data.length > 0) {
        data.forEach((eachData, index) => {
          let time = eachData.ShiJian * 1000;
          this._updateMinData(time, eachData);
        });
      }

      this.redraw();
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

    this.initChart();

    // 清空canvas(重置大小时会清空canvas,因此不再重复做clearRect)
    //ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  /**
   * 设置画图参数
   */
  initChart() {

    // K线烛图和量图之间横坐标高度固定为14像数,烛图占70%,量图占30%
    let minChartHeight = this.minChartHeight = (this.canvasHeight - 14) * (this._options.hideVolume ? 1 : 0.7);
    let volumeChartHeight = this.volumeChartHeight = (this.canvasHeight - 14) * (this._options.hideVolume ? 0 : 0.3);

    let lastClose = this.lastClose;

    // 计算最大和最小值
    let MAX_VALUE = Number.MAX_VALUE;
    let MIN_VALUE = Number.MIN_VALUE;
    let min = MAX_VALUE;
    let max = 0;
    let maxVolume = 0;
    if (lastClose) {

      // 昨收价存在,取距离昨收价最大偏移量作为最大绝对值
      let maxOffset = 0;
      let eachData;
      for (let key in this.cache) {
        eachData = this.cache[key];
        if (eachData.ChengJiaoJia) {
          maxOffset = Math.max(maxOffset, Math.abs(eachData.ChengJiaoJia - lastClose));
          maxVolume = Math.max(maxVolume, eachData.ChengJiaoLiang);
        }
      }
      max = lastClose + maxOffset;
      min = lastClose - maxOffset;
    } else {

      // 昨收价不存在时
      let eachData;
      for (let key in this.cache) {
        eachData = this.cache[key];
        max = Math.max(max, eachData.ChengJiaoJia || MIN_VALUE);
        min = Math.min(min, eachData.ChengJiaoJia || MAX_VALUE);
        maxVolume = Math.max(maxVolume, eachData.ChengJiaoLiang);
      }
    }

    // 最大值和最小值范围增加10%
    this.max = max > min ? max + (max - min) * 0.1 : max * 1.1;
    this.min = max > min ? min - (max - min) * 0.1 : max * 0.9;
    this.maxVolume = maxVolume;

    this.minYPixelRadio = minChartHeight / (this.max - this.min);
    this.volumeYPixelRadio = volumeChartHeight / maxVolume;
    this.pixelPer = (this.canvasWidth / this.cache.minTimes.length);
  }

  bindEvent() {

    // 绑定事件,hammer相关
    var mc = new Hammer.Manager(this.canvas, {});
    mc.add(new Hammer.Pan({threshold: 10, direction: Hammer.DIRECTION_ALL}));
    mc.add(new Hammer.Press({time: 500}));

    var lastDeltaX = 0;
    let lastScale = 1;

    mc.on('panstart', (event) => {
    });

    mc.on('panmove', (event) => {
      if (this.pressed) {
        this.pressPoint = Object.assign({}, event.center);
        this.redraw();
      }
    });

    mc.on('panend', (event) => {
      if (this.pressed) {
        this.pressed = false;
        this.redraw();
      }
    });

    mc.on('press', (event) => {

      // 显示十字坐标和坐标位置的数据
      this.pressed = true;
      this.pressPoint = Object.assign({}, event.center);
      this.redraw();
    });

    mc.on('pressup', (event) => {
      this.pressed = false;
      this.redraw();
    });
  }

  redraw() {
    this.initCanvas();

    // 画背景坐标
    this.drawBackground();

    let minTimes = this.cache.minTimes;
    let pixelPer = this.pixelPer;
    let pricePoints = [];
    let avgPricePoints = [];
    let lastPrice = this.lastClose;

    // 如果数据量大于300个数据则按60分间隔否则按30分间隔
    let interval = minTimes.length > 300 ? 60 : 30;
    let lastTickIndex = -100;

    minTimes.forEach((time, index) => {
      let minData = this.cache[time];
      if (minData) {
        let isUp = minData.isUp = minData.ChengJiaoJia >= lastPrice;
        let x1 = pixelPer * index;
        let x2 = x1 + pixelPer / 2;
        minData.ChengJiaoJia && pricePoints.push([x2, (this.max - minData.ChengJiaoJia) * this.minYPixelRadio]);
        minData.JunJia && avgPricePoints.push([x2, (this.max - minData.JunJia) * this.minYPixelRadio]);
        if (!this._options.hideVolume) {
          this.drawVolume(x1, minData.ChengJiaoLiang, isUp);
          lastPrice = minData.ChengJiaoJia;
        }
      }

      try {
        // 满足条件时画出时间轴
        // 不连续时间段的之前时间点
        let tickIndex;
        if (index > 0 && (time - minTimes[index - 1]) > 1 * 60 * 1000 && lastTickIndex !== (index - 1)) {
          tickIndex = index - 1;
        } else if (new Date(time).getMinutes() % interval === 0) {
          tickIndex = index;
        }
        if (tickIndex && (tickIndex - lastTickIndex) * pixelPer > 60) {
          this.drawXAxisGridLine(pixelPer * tickIndex + pixelPer / 2, this._getXAxisLabel(minTimes[tickIndex]), '#ddd');
          lastTickIndex = tickIndex;
        }
      } catch (e) {
        console.error(e);
      }
    });
    this.fillPath(pricePoints, '#0095D9', 'rgba(0, 149, 217, 0.2)');
    this.drawPath(avgPricePoints, '#EB5F15');

    // 按压时显示十字光标
    if (this.pressed) {
      let {x, y} = this.pressPoint;
      let index = parseInt(x / (pixelPer));
      let minTime = minTimes[index];
      let data = this.cache[minTime];
      if (data) {

        // x
        this.drawXAxisGridLine((pixelPer) * index + (pixelPer - 1) / 2, this._getXAxisLabel(minTime), null, true);

        // y
        if (y < this.minChartHeight && y > 0) {
          this.drawYAxisGridLine(y, this.max - y / this.minYPixelRadio, null, (y > this.minChartHeight / 2) ? 'top' : 'bottom', true);
        } else if (y > this.minChartHeight + 14 && y < this.canvasHeight) {
          this.drawYAxisGridLine(y, this.maxVolume - (y - this.minChartHeight - 14) / this.volumeYPixelRadio, null, (y > this.minChartHeight + 14 + this.volumeChartHeight / 2) ? 'top' : 'bottom', true);
        }

        // 显示详细信息
        this.drawTooltip(data);
      }
    }
  }

  drawTooltip(data) {

    // 显示日活的显示信息
    this.drawText(this._getXAxisLabel(data.ShiJian * 1000), 30, 12, 10, '#555'); // 日期
    this.drawText(`价格: ${data.ChengJiaoJia.toFixed(2)}`, 80, 12, 10, '#0095D9');
    this.drawText(`均价: ${data.JunJia.toFixed(2)}`, 160, 12, 10, '#EB5F15');
    this.drawText(`成交量: ${data.ChengJiaoLiang}`, 240, 12, 10, this.getColor(data.isUp));
  }

  // x轴坐标标签
  _getXAxisLabel(time, hasDate) {
    let date = new Date(time);
    if (!hasDate) {
      return `${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}`;
    } else {
      return `${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + (date.getDate())).slice(-2)} ${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}`;
    }
  }

  getColor(up) {
    return up ? 'red' : 'green';
  }

  drawVolume(x, volumn, up) {
    let ctx = this.ctx;
    let y = this.canvasHeight;
    let width = this.pixelPer - 1;
    let height = -this.volumeYPixelRadio * volumn;

    ctx.fillStyle = this.getColor(up);
    ctx.fillRect(x, y, width, height);
  }

  drawBackground() {
    let lastClose = this.cache.ZuoShou;

    // 画出纵坐标和网格线
    this.drawYAxisGridLine(0, this.max, null, 'bottom');
    this.drawYAxisGridLine(this.minChartHeight, this.min);

    this.drawYAxisGridLine(this.minChartHeight / 2, lastClose || (this.max - (this.max - this.min) / 2), '#ddd');
    this.drawYAxisGridLine(this.minChartHeight / 4, this.max - (this.max - this.min) / 4, '#ddd');
    this.drawYAxisGridLine(this.minChartHeight * 3 / 4, this.max - (this.max - this.min) * 3 / 4, '#ddd');

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
    this.drawLine(x, 0, x, full ? this.canvasHeight : this.minChartHeight, 0.5, color || '#999');

    if (text) {
      let textWidth = this.ctx.measureText(text).width;
      let textX = position === 'middle' ? x - (textWidth) / 2 : x;
      let textY = this.minChartHeight + 12;

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
      text = text.toFixed(2);
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

  fillPath(points, strokeColor, fillStyle, lineWidth = 1) {
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
    ctx.strokeStyle = strokeColor;
    ctx.stroke();

    if (points.length > 1) {
      ctx.lineWidth = 0;
      ctx.lineTo(points[points.length - 1][0], this.minChartHeight);
      ctx.lineTo(points[0][0], this.minChartHeight);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
    } else {
      ctx.closePath();
    }
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

    // 初始化数据
    this.initData();
  }
}
