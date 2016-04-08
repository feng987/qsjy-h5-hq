//import Kline from './Kline.js';
//import Min from './Min.js';

//import KlineDataProvider from './KlineDataProvider.js';
//import {yunLocal} from 'yunlocal';
import Canvas from './Canvas.js';
import KlineChart from './KlineChart.js';
import MinChart from './MinChart.js';

import DataProvider from './DataProvider.js';

//console.log(new Kline(document.body, {
//  hideVolume: true,
//  dataProvider: new KlineDataProvider({
//    obj: 'SH000001',//'DIDZH0001',//'SH000001',
//    period: '1day'
//  })
//}));

//let klineChart;
////window.showKline = (obj, period) => {
////  if (klineChart) {
////    klineChart.reset({
////      dataProvider: new DataProvider({
////        obj: obj,
////        period: period
////      })
////    });
////  } else {
////    klineChart = new Kline(document.body, {
////      //hideVolume: true,
////      dataProvider: new DataProvider({
////        obj: obj,
////        period: period
////      })
////    });
////  }
////};
//window.showKline = (obj, period) => {
//  let canvas = new Canvas();
//  let klineChart = new KlineChart(new DataProvider({
//    obj: obj,
//    period: period
//  }));
//  canvas.show(klineChart);
//};
//
//let minChart;
////window.showMin = (obj) => {
////  if (minChart) {
////    minChart.reset({
////      dataProvider: new DataProvider({
////        obj: obj
////      })
////    });
////  } else {
////    minChart = new Min(document.body, {
////      dataProvider: new DataProvider({
////        obj: obj
////      })
////    });
////  }
////};
//window.showMin = (obj) => {
//  let canvas = new Canvas();
//  let minChart = new MinChart(new DataProvider({
//    obj: obj
//  }));
//  canvas.show(minChart);
//};
//
////window.setToken = (token) => {
////  window.token = token;
////  console.log(token);
////};
//
//window.init = DataProvider.init;
//
//window.addEventListener('resize', () => {
//  klineChart && klineChart.redraw();
//  minChart && minChart.redraw();
//});
//
//window.reset = () => {
//  (new Canvas()).reset();
//};

//document.body.style.height = document.documentElement.clientHeight + 'px';
//window.addEventListener('resize', () => {
//
//  // 修补body高度
//  document.body.style.height = 0;
//  console.log(document.body.style.height = document.documentElement.clientHeight + 'px');
//});
window.Canvas = Canvas;
window.KlineChart = KlineChart;
window.MinChart = MinChart;
window.DataProvider = DataProvider;
