/**
 * Created by jiagang on 16/2/2.
 */

/**
 * 请求和格式化K线数据(默认使用YunLocal查询接口)
 */
export default class KlineDataProvider {
  constructor(params, yunLocal) {
    this.params = params;
    this.yunLocal = yunLocal;
  }

  getKline(start, count, withMA = true) {

    return Promise.all([this.yunLocal.query('/quote/kline', Object.assign({}, this.params, {start, count})).then((data) => {
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
      //document.write(JSON.stringify(kline));
      //console.log(kline);
      return kline;
    });
  }

  getMA(start, count) {
    return this.yunLocal.query('/indicator/calc', Object.assign({}, this.params, {name: 'MA', parameter: '5,10,20,30', start, count})).then((data) => {
      return data[0] && data[0].ShuJu;
    }).catch(() => []);
  }

  onKlineUpdate() {

    // 监听数据更新(订阅查询最后一条数据)
    return this.yunLocal.subscribe('/quote/kline', Object.assign(this.params, {start: -1})).then((data) => {
      return data[0] && data[0].Data;
    });
  }
}
