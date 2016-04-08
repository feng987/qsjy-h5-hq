/**
 * Created by jiagang on 16/3/1.
 */
import Chart from './Chart.js';

export default class KlineChart extends Chart {

  initData() {
    super.initData();

    // 初始化数据,取options中data字段作为初始数据
    this.data = this._options.data || [];
    this.cache = [].concat(this.data);

    // 最大显示条数(理论数值,不能大于重画时计算出的最大条数)
    this.maxCount = this._options.maxCount || Number.MAX_VALUE;

    // 最小显示条数
    this.minCount = this._options.minCount || 10;

    // 最大预加载数据条数,默认100,预加载数据条数取当前显示条数和最大预加载数据条数中较大的一个值
    this.maxPreLoadCount = this._options.maxPreLoadCount || 200;

    // 位置表示显示数据在缓存中开始位置
    this.position = 0;

    this.hasMoreData = true;

    // 初始需要展示的数据条数,默认80
    this.reCalculate(0, this._options.initCount || 80);

    // 订阅K线数据变化(更新最新的1条数据)
    let subscribe = this.dataProvider.subscribeKline((data) => {
      // chart 移除则停止订阅
      if (!this.canvas.hasChart(this)) {
        subscribe.cancel();
        return;
      }

      if (data.length > 0) {
        data = data[0];
        //let lastData;

        if (this.cache.length > 0) {
          this.cache[this.cache.length - 1] = data;
        }
        // XXX 由于最后一条数据的时间不定,不能用时间判断
        //if (this.cache.length > 0 && (lastData = this.cache[this.cache.length - 1]) && lastData.ShiJian === data.ShiJian) {
        //  this.cache[this.cache.length - 1] = data;
        //} else {
        //  this.cache.push(data);
        //  this.position += 1;
        //}
        this.reCalculate();
      }
    });
  }

  redraw() {
    if (this.data.length > 0) {
      super.redraw();
    }
  }

  initChart() {
    super.initChart();

    // 根据画板宽度调整显示数据个数,最多1像数显示一条数据(单条数据小于1像数时,需要调整显示个数),间隙和影线宽度都是固定的1像数
    let count = this.data.length;
    let separatorWidth = this.separatorWidth;

    // FIXME count = 0
    let pixelPer = this.canvas.canvasWidth / count - separatorWidth;
    if (pixelPer < 1) {
      count = parseInt(this.canvas.canvasWidth / (1 + separatorWidth));
      this.data = this.data.slice(0, count);
      pixelPer = 1;
      this.maxCount = count;
    }

    this.pixelPer = pixelPer;
    this.pixelPerWithSeparator = pixelPer + separatorWidth;

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

    this.candleChartHeight = this.mainChartHeight;
    this.candleYPixelRadio = this.candleChartHeight / (this.max - this.min);
    this.volumeYPixelRadio = this.volumeChartHeight / maxVolume;
  }

  formatXAxisLabel(text, hasDay = false) {
    let date = new Date(text);
    return hasDay ? Chart.formatDate(date, 'yyyy-MM-dd') : Chart.formatDate(date, 'yyyy-MM');
  }

  isUp(open, close, lastClose) {

    // FIXME 还需要考虑当天收盘和昨收相同的情况
    return open !== close ? close > open : close > lastClose;
  }

  drawChart() {
    let lastLabel, currentLabel, lastDrawIndex = 0;
    let maPoints = [[], [], [], []];

    // 画出每根k线和量
    this.data.forEach((eachData, index) => {
      let lastClose = eachData.lastClose;
      if (!lastClose) {
        lastClose = eachData.lastClose = index > 0 ? this.data[index - 1].ShouPanJia : 0;
        eachData.time = eachData.ShiJian * 1000;
        eachData.isUp = this.isUp(eachData.KaiPanJia, eachData.ShouPanJia, lastClose);
        eachData.xAxisLabel = this.formatXAxisLabel(eachData.time);
      }

      currentLabel = eachData.xAxisLabel;

      // 满足条件画x轴坐标(跨月的第一交易日并且两个坐标点之间的距离不小于指定大小)
      if (currentLabel !== lastLabel) {
        lastLabel = currentLabel;
        if ((index - lastDrawIndex) * this.pixelPerWithSeparator > 50) {
          this.drawXAxisGridLine(this.pixelPerWithSeparator * index + this.pixelPer / 2, currentLabel);
          lastDrawIndex = index;
        }
      }

      this.drawCandle(index, eachData.KaiPanJia, eachData.ShouPanJia, eachData.ZuiGaoJia, eachData.ZuiDiJia, eachData.isUp);
      if (this.hasVolume) {
        this.drawVolume(index, eachData.ChengJiaoLiang, eachData.isUp);
      }

      // MA
      if (eachData.MA5) {
        let x = this.pixelPerWithSeparator * index + this.pixelPer / 2;
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
      this.canvas.drawPath(eachPoints, color[index]);
    });

    // 按压时显示十字光标
    if (this.pressPoint) {
      let {x, y} = this.pressPoint;
      let index = parseInt(x / (this.pixelPerWithSeparator));
      let data = this.data[index] || {};

      // x
      this.drawXAxisGridLine((this.pixelPerWithSeparator) * index + this.pixelPer / 2, this.formatXAxisLabel(data.time, true), this.pointerLineColor, undefined, true, true);

      // y
      if (y < this.candleChartHeight && y > 0) {
        this.drawYAxisGridLine(y, this.max - y / this.candleYPixelRadio, this.pointerLineColor, (y > this.candleChartHeight / 2) ? 'top' : 'bottom', true);
      //} else if (y > this.candleChartHeight + 14 && y < this.canvas.canvasHeight) {
      //  this.drawYAxisGridLine(y, this.maxVolume - (y - this.candleChartHeight - 14) / this.volumeYPixelRadio, this.pointerLineColor, (y > this.candleChartHeight + 14 + this.volumeChartHeight / 2) ? 'top' : 'bottom', true);
      }

      // 显示详细信息
      this.drawTooltip(data);
    }
  }

  drawTooltip(data) {
    let startX = 50;
    let fontSize = this.fontSize;
    let y = fontSize + 2;
    let color = this.getColor(this.isUp(data.KaiPanJia, data.ShouPanJia, data.lastClose));

    [
      {label: `日期:${this.formatXAxisLabel(data.time, true)}`, labelColor: '#555'},
      {label: `开:${Chart.formatNumber(data.KaiPanJia, 2)}`},
      {label: `收:${Chart.formatNumber(data.ShouPanJia, 2)}`},
      {label: `高:${Chart.formatNumber(data.ZuiGaoJia, 2)}`},
      {label: `低:${Chart.formatNumber(data.ZuiDiJia, 2)}`},
      {label: `涨跌:${Chart.formatNumber((data.ShouPanJia - data.lastClose) / data.lastClose, 2, '%')}`, labelColor: this.getColor(data.ShouPanJia >= data.lastClose)},
      {label: `量:${Chart.formatNumber(data.ChengJiaoLiang, 2, 'K/M')}`}
    ].forEach(({label, labelColor = color}) => {
      this.canvas.drawText(label, startX, y, fontSize, labelColor);
      startX += (this.canvas.measureText(label) + 10);
    });

    //data.MA5 && this.canvas.drawText(`MA5: ${data.MA5.toFixed(1)}`, 120, 12, 10, '#FFD11E');
    //data.MA10 && this.canvas.drawText(`MA10: ${data.MA10.toFixed(1)}`, 180, 12, 10, '#F77BFC');
    //data.MA20 && this.canvas.drawText(`MA20: ${data.MA20.toFixed(1)}`, 240, 12, 10, '#39C2FD');
    //data.MA30 && this.canvas.drawText(`MA30: ${data.MA30.toFixed(1)}`, 300, 12, 10, '#B7B7B7');
  }

  drawBackground() {

    // 画出纵坐标和网格线
    let max = this.max;
    let min = this.min;
    this.drawYAxisGridLine(0, max, null, 'bottom');
    this.drawYAxisGridLine(this.candleChartHeight, min);

    this.drawYAxisGridLine(this.candleChartHeight / 2, max - (max - min) / 2);
    this.drawYAxisGridLine(this.candleChartHeight / 4, max - (max - min) / 4);
    this.drawYAxisGridLine(this.candleChartHeight * 3 / 4, max - (max - min) * 3 / 4);

    this.drawYAxisGridLine(this.canvas.canvasHeight, '0');
    this.drawYAxisGridLine(this.canvas.canvasHeight - this.volumeChartHeight, this.maxVolume, null, 'bottom');
  }

  drawCandle(index, open, close, top, low, isUp) {
    let x = this.pixelPerWithSeparator * index;
    let y = this.candleYPixelRadio * (this.max - open);
    let width = this.pixelPer;
    let height = open === close ? 1 : this.candleYPixelRadio * (this.max - close) - y;
    height = Math.abs(height) < 1 ? Math.sign(height) : height;
    let color = this.getColor(isUp);

    if (width > 1) {
      this.canvas.drawRect(x, y, width, height, color);
    }

    // 上下影线
    let x1 = x + width / 2;
    let y1 = this.candleYPixelRadio * (this.max - top);
    let y2 = this.candleYPixelRadio * (this.max - low);

    this.canvas.drawLine(x1, y1, x1, y2, 1, color);
  }

  drawVolume(index, volume, isUp) {
    let x = this.pixelPerWithSeparator * index;
    let y = this.canvas.canvasHeight;
    let width = this.pixelPer;
    let height = -this.volumeYPixelRadio * volume;

    this.canvas.drawRect(x, y, width, height, this.getColor(isUp));
  }

  reCalculate(move = 0, count) {

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
    this._loading = true;
    this.canvas && this.canvas.toggleMask(true);
    let lastDataProvider = this.dataProvider;

    // 首先请求K线数据,请求到数据更新cache后再请求MA数据
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
      this._loading = false;

      // 再请求MA数据,得到数据后合并到cache后重画
      //this.dataProvider.getMA(start, count).then((maData) => {
      //
      //  // 合并K线和MA数据
      //  if (maData) {
      //    let maIndex = 0;
      //    let maLength = maData.length;
      //    this.cache.every((eachKline) => {
      //      let kTime = eachKline.ShiJian;
      //      while(maIndex < maLength) {
      //        let eachMA = maData[maIndex];
      //        let maTime = eachMA.ShiJian;
      //        let maResult = eachMA.JieGuo;
      //        if (maTime > kTime) {
      //          break;
      //        } else if (maTime === kTime) {
      //          Object.assign(eachKline, {MA5: maResult[0], MA10: maResult[1], MA20: maResult[2], MA30: maResult[3]});
      //        }
      //        maIndex++;
      //      }
      //      return maIndex < maLength;
      //    });
      //    this.redraw();
      //  }
      //})
    });
  }

  panMove(pressed, x, y, deltaX) {
    if (!this._loading) {
      if (pressed) {
        this.pressPoint = {x, y};
        this.redraw();
      } else if (this.pressPoint) {
        this.pressPoint = null;
        this.redraw();
      } else {
        let size = parseInt(deltaX / (this.pixelPerWithSeparator));
        if (size !== 0) {
          this.reCalculate(size);
          return true;
        }
      }
    }
  }

  pinchMove(scale) {
    if (!this._loading) {
      let deltaX = this.canvas.canvasWidth * scale;
      let offsetCount = parseInt(deltaX / (this.pixelPerWithSeparator));
      if (Math.abs(offsetCount) > 1) {
        this.reCalculate(0, this.data.length + offsetCount);
        return true;
      }
    }
  }
}
