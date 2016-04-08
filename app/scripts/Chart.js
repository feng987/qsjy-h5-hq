/**
 * Created by jiagang on 16/2/17.
 */

export default class Chart {

  /**
   * 格式化文本，将输入的数字参数格式化为指定精度的字符串
   * @param {!number|string|null} data      需要格式化的数字，可以是数字，字符串或者null对象
   * @param {?number} precision             保留小数精度，null则默认取2位小数
   * @param {?''|'K'|'M'|'K/M'|'%'} unit    单位，按自定的单位格式化数据，null则为''为不加单位
   * @param {boolean|string=} useDefault    是否使用默认值，默认显示--，字符串类型表示需要显示的默认值
   * @returns {string}
   */
  static formatNumber(data, precision, unit, useDefault) {
    if (data == null) {
      data = 0;
    }

    let n = Number(data);
    if ((n === 0 || isNaN(n)) && useDefault !== false) {
      return useDefault || '--';
    }

    unit = unit || '';
    precision = precision != null ? precision : 2;

    if (unit === 'K/M') {
      if (n >= 10 * 1000 * 1000) {
        unit = 'M';
      } else if (n >= 10 * 1000) {
        unit = 'K';
      } else {
        unit = '';
      }
    }

    switch(unit) {
      case '%': n = n * 100; break;
      case 'K': n = n / 1000; break;
      case 'M': n = n / (1000 * 1000); break;
      case 100: n = n / 100; unit = ''; break;
    }
    return n.toFixed(precision) + unit;
  }

  static formatDate(date, format) {
    let d, k, o;
    o = {
      'M+': date.getMonth() + 1,
      'd+': date.getDate(),
      'h+': date.getHours(),
      'm+': date.getMinutes(),
      's+': date.getSeconds(),
      'q+': Math.floor((date.getMonth() + 3) / 3),
      'S': date.getMilliseconds()
    };
    if (/(y+)/.test(format)) {
      format = format.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (k in o) {
      d = o[k];
      if (new RegExp('(' + k + ')').test(format)) {
        format = format.replace(RegExp.$1, RegExp.$1.length === 1 ? d : ('00' + d).substr(('' + d).length));
      }
    }
    return format;
  }

  constructor(dataProvider, options = {}) {
    this.dataProvider = dataProvider;
    this._options = options;

    //// 初始化数据
    //this.initData();
  }

  initData() {

    // 图表通用参数配置
    this.hasVolume = this._options.hasVolume || true;
    this.fontSize = this._options.fontSize || 10;
    this.upColor = this._options.upColor || 'red';
    this.downColor = this._options.downColor || 'green';

    // 时间轴的高度为fontSize + 4
    this.timeAxisHeight = this.fontSize + 4;

    // 间隙宽度默认1
    this.separatorWidth = 1;

    this.gridLineWidth = 0.5;
    this.gridLineColor = '#ddd';
    this.tickColor = '#555';
    this.tickBackgroundColor = '#eee';

    this.pointerLineColor = '#999';
  }

  setCanvas(canvas) {
    if (!this.canvas) {

      // 初始数据
      this.canvas = canvas;
      this.initData();
    }
  }

  show() {
    this.canvas && this.canvas.show(this);
  }

  remove() {
    this.canvas && this.canvas.remove(this);
  }

  redraw() {
    if (this.canvas && this.canvas.getCurrentChart() === this && this.canvas.canvasWidth && this.canvas.canvasHeight) {
      this.canvas.clear();
      this.initChart();
      this.drawBackground();
      this.drawChart();
      this.drawAxisTicks();
      this.canvas && this.canvas.toggleMask(false);
    }
  }

  initChart() {
    this._yAxisTicks = [];
    let timeAxisHeight = this.timeAxisHeight;
    let hasVolume = this.hasVolume;

    // 默认主图和量图的比例为7 : 3
    let height = this.canvas.canvasHeight - timeAxisHeight;
    if (hasVolume) {
      this.mainChartHeight = height * 0.7;
      this.volumeChartHeight = height * 0.3;
    } else {
      this.mainChartHeight = height;
      this.volumeChartHeight = 0;
    }
  }

  drawBackground() {
    console.warn('not implemented');
  }

  drawChart() {
    console.warn('not implemented');
  }

  drawAxisTicks() {
    let yAxisTicks = this._yAxisTicks;
    if (yAxisTicks) {
      let canvas = this.canvas;
      let fontSize = this.fontSize;
      let tickBackgroundColor = this.tickBackgroundColor;
      yAxisTicks.forEach(eachTick => {
        canvas.drawText(eachTick.text, eachTick.x, eachTick.y, fontSize, eachTick.tickColor, eachTick.withBackground && tickBackgroundColor);
      });
    }
  }

  formatYAxisLabel(text) {
    return Chart.formatNumber(text, 2, 'K/M', false);
  }

  formatXAxisLabel(text) {
    return text;
  }

  getColor(isUp) {
    return isUp ? this.upColor : this.downColor;
  }

  drawYAxisGridLine(y, text, color = this.gridLineColor, position = 'top', withBackground = false, tickColor = this.tickColor) {
    this.canvas.drawLine(0, y, this.canvas.canvasWidth, y, this.gridLineWidth, color);
    if (text) {

      // 记录Y轴坐标位置
      let yAxisTicks = this._yAxisTicks;
      yAxisTicks.push({
        text: this.formatYAxisLabel(text),
        x: 0,
        y: (position === 'top' ? y - 2 : y + this.fontSize + 2),
        tickColor: tickColor,
        withBackground: withBackground
      });
      //let fontSize = this.fontSize;
      //this.canvas.drawText(this.formatYAxisLabel(text), 0, (position === 'top' ? y - 2 : y + fontSize + 2), fontSize, tickColor, withBackground && this.tickBackgroundColor);
    }
  }

  drawXAxisGridLine(x, text, color = this.gridLineColor, position = 'middle', withBackground = false, full = false, tickColor = this.tickColor) {
    this.canvas.drawLine(x, 0, x, full ? this.canvas.canvasHeight : this.mainChartHeight, this.gridLineWidth, color);
    if (text) {
      let textWidth = this.canvas.measureText(text);
      let fontSize = this.fontSize;
      let textX = position === 'middle' ? x - (textWidth) / 2 : x;
      let textY = this.mainChartHeight + fontSize + 2;

      this.canvas.drawText(text, textX, textY, fontSize, tickColor, withBackground && this.tickBackgroundColor);
    }
  }

  /*eslint no-unused-vars: 0*/
  panMove(pressed, x, y, deltaX) {
  }

  /*eslint no-unused-vars: 0*/
  pinchMove(scale) {
  }
}
