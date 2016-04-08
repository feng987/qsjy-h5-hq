/**
 * Created by jiagang on 16/3/11.
 */
/* global escape */
import connection from 'connection';

let conn;

const LocalStorageManager = {
  _MIN_DATA_KEY: 'MIN_DATA_KEY',

  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  },

  set(key, object) {
    localStorage.setItem(key, JSON.stringify(object));
  },

  getMin(obj) {
    return (this.get(this._MIN_DATA_KEY) || []).find(eachData => eachData.obj === obj);
  },

  setMin(obj, data) {
    data.obj = obj;
    let minArr = this.get(this._MIN_DATA_KEY) || [];
    let index = minArr.findIndex(eachData => eachData.obj === obj);
    if (index >= 0) {
      minArr.splice(index, 1, data);
    } else {
      minArr.push(data);
      minArr = minArr.slice(0, 10);
    }
    this.set(this._MIN_DATA_KEY, minArr);
  }
};

const oneMinute = 1 * 60 * 1000;
const oneDay = 1 * 24 * 60 * oneMinute;

// 默认股票交易时间
const defaultTimeInfo = (function() {
  let now = new Date();
  let year = now.getFullYear();
  let month = ('0' + (now.getMonth() + 1)).slice(-2);
  let day = ('0' + now.getDate()).slice(-2);
  let date = [year, month, day].join('');
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

export default class DataProvider {
  static convertToJsonArray(input) {
    if (!input || !input.head) {
      return input;
    }

    let head = input.head;
    let data = input.data;

    return data.map((row) => {
      let rowObject = {};
      row.forEach((cell, columnIndex) => {
        rowObject[head[columnIndex]] = DataProvider.convertToJsonArray(cell);
      });
      return rowObject;
    });
  };

  static arrayBufferToString(arrayBuffer) {
    let uint8Array = new Uint8Array(arrayBuffer);
    let length = uint8Array.length;
    if (length > 65535) {
      let start = 0;
      let results = [];
      do {
        let subArray = uint8Array.subarray(start, start += 65535);
        results.push(String.fromCharCode.apply(null, subArray));
      } while (start < length);

      return decodeURIComponent(escape(results.join('')));
    } else {
      return decodeURIComponent(escape(String.fromCharCode.apply(null, uint8Array)));
    }
  };

  static _instances = [];
  static _currentQid = 0;

  constructor(params) {
    this.params = params;
    this._requests = {};

    DataProvider._instances.push(this);
  }

  //connect() {
  //  if (!this._conn) {
  //    let address = DataProvider.address;
  //    let token = DataProvider.token;
  //    if (token && address.indexOf('token') < 0) {
  //      address = [address, token].join('?token=');
  //    }
  //    this._conn = DataProvider._connMap[address] || connection(address, {}, {
  //        open: () => {
  //          console.log('open connection');
  //        },
  //        send: (message) => {
  //          console.log(`send message ${message}`);
  //        },
  //        message: (data) => {
  //          console.log('received data');
  //
  //          // 解析二进制数据成json
  //          if (data instanceof ArrayBuffer) {
  //            try {
  //              let str = DataProvider.arrayBufferToString(data);
  //              let response = JSON.parse(str);
  //              console.log(`data: ${str}`);
  //              let {Qid, Err, Data} = response;
  //              if (Qid) {
  //                this._conn._refDataProviders.some((dataProvider) => {
  //                  let request = dataProvider._requests[Qid];
  //                  if (request) {
  //                    request.callback((Err === 0) ? DataProvider.formatData(Data) : new Error(JSON.stringify(Data)));
  //                    return true;
  //                  }
  //                });
  //              }
  //            } catch (e) {
  //              console.error(e);
  //            }
  //          }
  //        }
  //      });
  //    DataProvider._connMap[address] = this._conn;
  //    this._conn._refDataProviders = this._conn._refDataProviders || [];
  //    this._conn._refDataProviders.push(this);
  //  }
  //  return this._conn;
  //  //this._connectPromise = this._connectPromise || new Promise((resolver, reject) => {
  //  //    let address = DataProvider.address;
  //  //    let token = DataProvider.token;
  //  //    if (token && address.indexOf('token') < 0) {
  //  //      address = [address, token].join('?token=');
  //  //    }
  //  //
  //  //    this._ws = new WebSocket(address);
  //  //    this._ws.binaryType = 'arraybuffer';
  //  //    this._ws.onopen = () => {
  //  //      resolver();
  //  //    };
  //  //    this._ws.onclose = this._ws.onerror = () => {
  //  //      this._connectPromise = null;
  //  //      this._ws = null;
  //  //      reject();
  //  //    };
  //  //    this._ws.onmessage = (event) => this.onMessage(event.data);
  //  //});
  //  //return this._connectPromise;
  //}

  static formatData(data) {
    if (data.JsonTbl) {
      data = DataProvider.convertToJsonArray(data.JsonTbl)[0];
      return data[Object.keys(data)[0]];
    } else if (data.hasOwnProperty('Id')) {
      delete data.Id;
      delete data.Obj;
      return data[Object.keys(data)[0]];
    } else {
      return data;
    }
  }

  //onMessage(data) {
  //
  //  // 解析二进制数据成json
  //  if (data instanceof ArrayBuffer) {
  //    try {
  //      let response = JSON.parse(DataProvider.arrayBufferToString(data));
  //      let {Qid, Err, Data} = response;
  //      if (Qid) {
  //        let request = this._requests[Qid];
  //        if (request) {
  //          request.callback((Err === 0) ? this.formatData(Data) : new Error(Data));
  //        }
  //      }
  //    } catch (e) {
  //      console.error(e);
  //    }
  //  }
  //}

  _getRequestUrl(service, data, qid, sub) {
    let params = Object.assign({ qid, sub, output: 'json' }, data);
    let keys = Object.keys(params);
    let paramsStr = keys.map((key) => {
        return [key, params[key]].join('=');
      }).join('&');

    return service + '?' + paramsStr;
  }

  request(service, params, subscribe = false, callback) {
    let qid = DataProvider._currentQid++;
    let message = this._getRequestUrl(service, params, qid, subscribe ? 1 : 0);
    let request = { qid, message, subscribe, callback, cancel: this.cancel.bind(this, qid) };
    this._requests[qid] = request;
    this.send(message);
    return request;
  }

  send(message) {
    conn.request(message);
    //this.connect().then(() => {
    //  this._ws.send(message);
    //});
  }

  cancel(qid) {
    this.send(`/cancel?qid=${qid}`);
  }

  getKline(start, count, withMA = true) {
    let klinePromise = new Promise((resolve, reject) => {
      this.request('/quote/kline', Object.assign({}, this.params, {start, count}), false, (data) => {
        (data instanceof Error) ? reject(data) : resolve(data[0] && data[0].Data);
      });
    });
    console.log('before');
    Promise.resolve(1).then((data) => console.log(data));
    Promise.all([Promise.resolve(1), Promise.resolve(2)]).then((data) => console.log(data));
    console.log('after');
    return Promise.all([klinePromise, withMA && this.getMA(start, count)]).then(([kline, ma]) => {

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
    return this.request('/quote/kline', Object.assign({}, this.params, {start: -1}), true, (data) => {
      if (!(data instanceof Error)) {
        let kline = data[0] && data[0].Data;
        this.getMA(-1).then((ma) => {
          if (kline && ma && kline[0] && ma[0] && kline[0].ShiJian === ma[0].ShiJian) {
            let maResult = ma[0].JieGuo;
            Object.assign(kline[0], {MA5: maResult[0], MA10: maResult[1], MA20: maResult[2], MA30: maResult[3]});
          }
          callback(kline);
        });
      }
    });
  }

  getMA(start, count) {
    return new Promise((resolve, reject) => {
      this.request('/indicator/calc', Object.assign({ name: 'MA', parameter: '5,10,20,30' }, this.params, {start, count}), false, (data) => {
        (data instanceof Error) ? reject(data) : resolve(data[0] && data[0].ShuJu);
      });
    });
  }

  _initMinCache(timeInfo) {
    let times = timeInfo.JiaoYiShiJianDuan;
    this.minCache = {
      lastClose: timeInfo.ZuoShou
    };
    let minTimes = this.minCache.minTimes = [];
    if (times && times.length > 0) {
      let lastTime = 0;
      let startTime;
      let endTime;
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

  _updateMinCache(time, data) {
    let minTimes = this.minCache.minTimes || [];
    let index = this.minCache.minTimes.indexOf(time);
    if (index >= 0) {
      this.minCache[time] = data;
    } else {

      // 没有对应时间时，认为交易日期有跨越，对应修正交易时间数据
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
        this.minCache[time] = data;
      }
    }
  }

  subscribeMin(callback) {

    this.minCache = null;

    // 使用localStorage缓存分时数据(最近访问的10只股票)
    let localMinData = LocalStorageManager.getMin(this.params.obj);
    if (localMinData) {

      // 同步回调无法刷新画板,所以使用定时调用回调
      setTimeout(() => callback(localMinData));
      //callback(localMinData);
    }
    return this.request('/quote/min', Object.assign({}, this.params), true, (data) => {
      if (data && !(data instanceof Error) && data.length > 0) {
        data = data[0];

        // 清盘
        if (data.QingPan === 1) {
          this.minCache = null;
        }

        // 初始缓存数据(交易时间段)
        if (!this.minCache) {
          this._initMinCache(data.JiaoYiShiJianDuan ? data : defaultTimeInfo);
        }

        // 更新数据
        data = data.Data;
        if (data && data.length > 0) {
          data.forEach((eachData) => {
            let time = eachData.ShiJian * 1000;
            this._updateMinCache(time, eachData);
          });
        }

        callback(this.minCache);
        LocalStorageManager.setMin(this.params.obj, this.minCache);
      }
    });
  }
}

DataProvider.init = (address, token) => {
  if (token && address.indexOf('token') < 0) {
    address = [address, token].join('?token=');
  }

  conn = connection(address, {}, {
    //open: () => {
    //  console.log('open connection');
    //},
    //send: (message) => {
    //  console.log(`send message ${message}`);
    //},
    message: (data) => {
      //console.log('received data');

      // 解析二进制数据成字符串
      if (data instanceof ArrayBuffer) {
        try {
          data = DataProvider.arrayBufferToString(data);
        } catch (e) {
          console.error(e);
        }
      }

      if (typeof data === 'string') {
        //console.log(`data: ${data}`);
        try {
          let response = JSON.parse(data);
          let {Qid, Err = 0, Data} = response;
          if (Qid) {
            DataProvider._instances.some((dataProvider) => {
              let request = dataProvider._requests[Qid];
              if (request) {
                request.callback((Err === 0) ? DataProvider.formatData(Data) : new Error(JSON.stringify(Data)));
                return true;
              }
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  });
};
