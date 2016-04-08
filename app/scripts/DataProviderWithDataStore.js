/**
 * Created by jiagang on 16/2/18.
 */

import DataStore from 'datastore';
DataStore.address = window.location.search !== '' ? 'ws://' + window.location.search.substring(1) : 'ws://10.15.144.101/ws';
DataStore.dataType = 'json';

if (typeof window.WebSocket !== 'function') {
  //var host = new URL(DataStore.address).host;
  let l = document.createElement('a');
  l.href = DataStore.address;
  DataStore.address = l.host;
}

let klineDataStore = new DataStore({
  serviceUrl: '/quote/kline',
  idProperty: ' '
});
klineDataStore.dataParser.direct = true;
let maDataStore = new DataStore({
  serviceUrl: '/indicator/calc',
  idProperty: ' ',
  otherParams: {
    name: 'MA',
    parameter: '5,10,20,30'
  }
});
maDataStore.dataParser.direct = true;
let minDataStore = new DataStore({
  serviceUrl: '/quote/min',
  idProperty: ' '
});
minDataStore.dataParser.direct = true;

export default class DataProvider {
  constructor(params) {
    this.params = params;
  }

  getKline(start, count, withMA = true) {
    return Promise.all([klineDataStore.query(Object.assign({}, this.params, {start, count})).then((data) => {
      return data[0] && data[0].Data;
    }), withMA && this.getMA(start, count)]).then(([kline, ma]) => {

      // 合并K线和MA数据
      if (kline && ma) {
        let maIndex = 0;
        let maLength = ma.length;
        kline.forEach((eachKline) => {
          let kTime = eachKline.ShiJian;
          while(maIndex < maLength) {
            let eachMA = ma[maIndex];
            let maTime = eachMA.ShiJian;
            let maResult = eachMA.JieGuo;
            if (maTime > kTime) {
              break;
            } else if (maTime === kTime) {
              Object.assign(eachKline, {MA5: maResult[0], MA10: maResult[1], MA20: maResult[2], MA30: maResult[3]});
            }
            maIndex++;
          }
        });
      }
      return kline;
    });
  }

  subscribeKline(callback) {
    let request = klineDataStore.subscribe(Object.assign({}, this.params, {start: -1}), (data) => {
      let kline = data[0] && data[0].Data;
      this.getMA(-1).then((ma) => {
        if (kline && ma && kline[0] && ma[0] && kline[0].ShiJian === ma[0].ShiJian) {
          let maResult = ma[0].JieGuo;
          Object.assign(kline[0], {MA5: maResult[0], MA10: maResult[1], MA20: maResult[2], MA30: maResult[3]});
        }
        callback(kline);
      });
    });
    request.cancel = () => {
      klineDataStore.cancel(request.qid);
    };
    return request;
  }

  getMA(start, count) {
    return maDataStore.query(Object.assign({}, this.params, {start, count})).then((data) => {
      return data[0] && data[0].ShuJu;
    }).catch(() => []);
  }

  subscribeMin(callback) {
    let request = minDataStore.subscribe(this.params, (data) => {
      if (data && !(data instanceof Error)) {
        callback(data[0]);
      }
    });
    request.cancel = () => {
      minDataStore.cancel(request.qid);
    };
    return request;
  }
}

DataProvider.init = (address, token) => {
  //alert(address);
  DataStore.address = address;
  DataStore.token = token;

  if (typeof window.WebSocket !== 'function') {
    //var host = new URL(DataStore.address).host;
    let l = document.createElement('a');
    l.href = DataStore.address;
    DataStore.address = l.host;
  }

  klineDataStore = new DataStore({
    serviceUrl: '/quote/kline',
    idProperty: ' '
  });
  klineDataStore.dataParser.direct = true;
  maDataStore = new DataStore({
    serviceUrl: '/indicator/calc',
    idProperty: ' ',
    otherParams: {
      name: 'MA',
      parameter: '5,10,20,30'
    }
  });
  maDataStore.dataParser.direct = true;
  minDataStore = new DataStore({
    serviceUrl: '/quote/min',
    idProperty: ' '
  });
  minDataStore.dataParser.direct = true;
};
