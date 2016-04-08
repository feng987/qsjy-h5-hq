/**
 * Created by jiagang on 16/2/17.
 */
import Hammer from '../../bower_components/hammerjs/hammer.js';

export default class Canvas {

  _pixelRadio = (() => {
    let ctx = document.createElement('canvas').getContext('2d');
    let dpr = window.devicePixelRatio || 1;
    let bsr = ctx.webkitBackingStorePixelRatio ||
      ctx.mozBackingStorePixelRatio ||
      ctx.msBackingStorePixelRatio ||
      ctx.oBackingStorePixelRatio ||
      ctx.backingStorePixelRatio || 1;

    return dpr / bsr;
  })();

  constructor(container = document.body, {resizable = true, width, height, eventListener} = {}) {
    this.container = container;

    if (this.container.canvas) {
      return this.container.canvas;
    }
    this.container.canvas = this;
    this._width = width;
    this._height = height;
    this._eventListener = eventListener;

    this._charts = [];
    this._currentChartIndex = 0;

    // resizable为true可以根据容器元素大小变化,width和height为固定的宽高
    if (resizable && (!width || !height)) {

      // 监听容器大小变化
      // 使用lambda表达式做循环执行requestAnimationFrame
      //const fix = f => (x => f(y => x(x)(y)))(x => f(y => x(x)(y)));
      //
      //fix(listener => () => {this.resize(); requestAnimationFrame(listener); })();
      window.onresize = () => this.resize();
    }
  }

  resize() {
    let canvasWidth = this._width || this.container.clientWidth;
    let canvasHeight = this._height;

    if (!canvasHeight) {
      canvasHeight = document.documentElement.clientHeight;
      this.container.style.height = canvasHeight + 'px';
    }

    if (canvasWidth !== this.canvasWidth || canvasHeight !== this.canvasHeight) {
      this.canvasWidth = canvasWidth;
      this.canvasHeight = canvasHeight;
      this.redraw();
    }
  }

  initCanvas() {

    // canvas不存在则创建出canvas
    let canvas = this._canvas;
    let ctx = this._ctx;
    if (!canvas) {
      canvas = this._canvas = document.createElement('canvas');//document.getElementById('canvas');//
      canvas.style.position = 'absolute';
      canvas.style.top = 0;
      canvas.style.left = 0;
      this.container.style.overflow = 'hidden';
      this.container.appendChild(canvas);
      ctx = this._ctx = canvas.getContext('2d');

      this.bindEvent();
    }

    let containerWidth = this.container.clientWidth;
    let containerHeight = this.container.clientHeight;

    if (!containerHeight) {
      containerHeight = document.documentElement.clientHeight;
      this.container.style.height = containerHeight + 'px';
    }

    if (containerWidth === 0 || containerHeight === 0) {
      return;
    }

    // 设置canvas宽高,占满整个容器大小
    let canvasWidth = this.canvasWidth = this._width || containerWidth;
    let canvasHeight = this.canvasHeight = this._height || containerHeight;

    let ratio = this._pixelRadio;
    canvas.width = canvasWidth * ratio;
    canvas.height = canvasHeight * ratio;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    ctx.scale(ratio, ratio);
  }

  redraw() {
    this.initCanvas();
    let currentChart = this.getCurrentChart();
    currentChart && currentChart.redraw();
  }

  getCurrentChart() {
    return this._charts[this._currentChartIndex];
  }

  show(chart) {
    if (chart) {
      let index = this._charts.indexOf(chart);
      if (index >= 0) {
        this._currentChartIndex = index;
      } else {
        this._currentChartIndex = this._charts.length;
        this.addChart(chart);
      }
    }
    this.redraw();
  }

  hasChart(chart) {
    return this._charts.indexOf(chart) >= 0;
  }

  addChart(chart) {
    let index = this._charts.indexOf(chart);
    if (index < 0) {
      this._charts.push(chart);
      chart.setCanvas(this);
    }
  }

  removeChart(chart) {
    let index;
    if (typeof chart === 'number') {
      index = chart;
    } else {
      index = this._charts.indexOf(chart);
    }

    if (index >= 0) {
      this.clear();
      this._currentChartIndex = 0;
      this._charts.splice(index, 1);
    }
  }

  reset() {
    this._charts = [];
    this._currentChartIndex = 0;
    this.clear();
  }

  clear() {
    this._ctx && this._ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  bindEvent() {

    // 绑定事件,hammer相关
    let mc = new Hammer.Manager(this._canvas, {});
    mc.add(new Hammer.Pan({threshold: 10, direction: Hammer.DIRECTION_ALL}));
    mc.add(new Hammer.Press({time: 500}));
    mc.add(new Hammer.Pinch());

    let lastDeltaX = 0;
    let lastScale = 1;
    let pressed = false;

    mc.on('panstart', (event) => {
      lastDeltaX = 0;
      this._eventListener && this._eventListener(event);
    });

    mc.on('panmove panend', (event) => {
      let chart = this.getCurrentChart();
      let deltaX = event.deltaX - lastDeltaX;
      if (event.type === 'panend') {
        pressed = false;
        deltaX = lastDeltaX = 0;
      }
      let result = chart && chart.panMove(pressed, event.center.x, event.center.y, deltaX);
      result && (lastDeltaX += deltaX);
      this._eventListener && this._eventListener(event);
    });

    mc.on('press pressup', (event) => {
      pressed = (event.type === 'press');
      let chart = this.getCurrentChart();
      chart && chart.panMove(pressed, event.center.x, event.center.y);
      this._eventListener && this._eventListener(event);
    });

    mc.on('pinchstart', () => {
      lastScale = 1;
      this._eventListener && this._eventListener(event);
    });

    mc.on('pinchmove', (event) => {
      if (!pressed) {
        let chart = this.getCurrentChart();
        let result = chart && chart.pinchMove(lastScale - event.scale);
        result && (lastScale = event.scale);
      }
      this._eventListener && this._eventListener(event);
    });
  }

  /**
   * 显示和隐藏mask层
   */
  toggleMask(show) {

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
      this.container.appendChild(mask);
      if ('|absolute|relative|fix'.indexOf(this.container.style.position) <= 0) {
        this.container.style.position = 'relative';
      }

      let label = document.createElement('div');
      let labelStyle = label.style;
      labelStyle.position = 'absolute';
      labelStyle.marginLeft = '-60px';
      labelStyle.top = '30%';
      labelStyle.left = '50%';
      labelStyle.fontSize = '14px';
      labelStyle.textAlign = 'center';
      labelStyle.padding = '4px 8px';
      labelStyle.border = '1px solid #333';
      labelStyle.color = '#333';
      label.innerHTML = '加载数据中,请稍后';

      mask.appendChild(label);
    }
    mask.style.display = (show ? 'block' : 'none');
  }

  drawLine(x1, y1, x2, y2, lineWidth, style) {
    let ctx = this._ctx;
    ctx.beginPath();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = style;
    ctx.moveTo(this._normalizeDrawLinePoint(x1), this._normalizeDrawLinePoint(y1));
    ctx.lineTo(this._normalizeDrawLinePoint(x2), this._normalizeDrawLinePoint(y2));
    ctx.stroke();
  }

  drawText(text, x, y, fontSize, fontStyle, backgroundStyle = null) {
    let ctx = this._ctx;
    let textWidth = this.measureText(text);
    x = Math.min(Math.max(x, 0), this.canvasWidth - textWidth);

    if (backgroundStyle) {

      // 背景边框
      ctx.fillStyle = backgroundStyle;
      ctx.fillRect(x - 2, y + 2, textWidth + 4, -(fontSize + 4));
    }

    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = fontStyle;
    ctx.fillText(text, x, y);
  }

  fillPath(points, y0, strokeColor, fillStyle, lineWidth = 1) {
    let ctx = this._ctx;
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
    ctx.lineJoin = 'round';
    ctx.stroke();

    if (points.length > 1) {
      ctx.lineWidth = 0;
      ctx.lineTo(points[points.length - 1][0], y0);
      ctx.lineTo(points[0][0], y0);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
    } else {
      ctx.closePath();
    }
  }

  drawPath(points, color, lineWidth = 1) {
    let ctx = this._ctx;
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
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.closePath();
  }

  drawRect(x, y, width, height, fillStyle) {
    let ctx = this._ctx;
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, y, width, height);
  }

  drawCircle(x, y, radius, fillStyle, lineWidth = 0, strokeStyle) {
    let ctx = this._ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeStyle;
    ctx.fill();
  }

  _normalizeDrawLinePoint(point) {
    if (this._pixelRadio === 1) {
      let intPoint = parseInt(point);
      return intPoint > point ? intPoint - 0.5 : intPoint + 0.5;
    } else {
      return point;
    }
  }

  measureText(text) {
    return this._ctx.measureText(text).width;
  }
}
