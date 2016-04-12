/**
 * MUI扩展
 * */

//日志输入记录
var plog = {
	log:function(v){
		//console.log(pdate.currentFormatDate()+" - "+v);
	}
};

//时间对象
var pdate = {
	currentFormatDate:function() {
	    var date = new Date();
	    var seperator1 = "-";
	    var seperator2 = ":";
	    var month = date.getMonth() + 1;
	    var strDate = date.getDate();
	    if (month >= 1 && month <= 9) {
	        month = "0" + month;
	    }
	    if (strDate >= 0 && strDate <= 9) {
	        strDate = "0" + strDate;
	    }
	    var currentdate = date.getFullYear() + seperator1 + month + seperator1 + strDate
	            + " " + date.getHours() + seperator2 + date.getMinutes()
	            + seperator2 + date.getSeconds();
	    return currentdate;
	}
}

//Pine 自定义功能函数
var PineFun = {
	getRequestValue:function(key){
		//location.search是从当前URL的?号开始的字符串 例如：http://www.51job.com/viewthread.jsp?tid=22720 它的search就是?tid=22720
    	var str=window.location.search;
	    if (str.indexOf(key)!=-1){
	        var pos_start=str.indexOf(key)+key.length+1;
	        var pos_end=str.indexOf("&",pos_start);
	        if(pos_end>0){ return str.substring(pos_start,pos_end); }
	        pos_end=str.indexOf("#",pos_start);
	        if(pos_end>0){ return str.substring(pos_start,pos_end); }
	        return str.substring(pos_start);
	    }
	    return '';
	},
};

