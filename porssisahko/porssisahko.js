// porsisahko
// https://porssisahko.net/api
// GET  https://api.porssisahko.net/v1/latest-prices.json

let CONFIG = {

    url_porssisahko_net: "https://api.porssisahko.net/v1/latest-prices.json",

	key_porssisahko_today: "PORSSISAHKO_TODAY",
    key_porssisahko_tomorrow: "PORSSISAHKO_TOMORROW",

    debug: false,
    
};

let timerhanlde = null;

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
};

// A remote Shelly abstraction Call an RPC method on the remote Shelly
let PorssisahkoNet = {
	_cb: function (result, error_code, error_message, callback) {
        // debugPrint("PorssisahkoNet _cb");
        // debugPrint(error_code);
        // debugPrint(error_message);
        // debugPrint(result);
		if (result === undefined) {
			return;
		}
        // debugPrint(result.code);
        // debugPrint(result.message);
		let rpcResult = result.body;
		let rpcCode = result.code;
		let rpcMessage = result.message;
		callback(rpcResult, rpcCode, rpcMessage);
	},

	call: function (callback) {
		let getData = {
			url: CONFIG.url_porssisahko_net
		};
        // debugPrint("PorssisahkoNet call");
		Shelly.call("HTTP.GET", getData, PorssisahkoNet._cb, callback);
	},
	getInstance: function () {
		let rs = Object.create(this);
		// remove static method
		rs.getInstance = null;
		return rs;
	},
};

function setKvs(key, data) {
    let value = JSON.stringify(data);
    debugPrint(value);

	Shelly.call(
		"KVS.Set",
		{ "key": key, "value": value },
		function (result, error_code, error_message, user_data) {
			// print(result);
		},
		null
	);
};


let Porssisahko = (function () {


    function readPrices(data, setTomorrow) {
        let priceData;
        priceData = {};

        let dateKey = new Date();
        if (setTomorrow) {
            dateKey = new Date(dateKey.valueOf() + 24 * 60 * 60 * 1000);
        }
        let dateInData = dateKey.getFullYear() + '-' + (dateKey.getMonth() + 1 ) + '-' + dateKey.getDate();

        priceData[dateInData] = new Array(24);

        for (let i = 0; i < data.prices.length; i++) {
            let item = data.prices[i];
            // startDate is in the UTC time, Date convert it to local time
            // "startDate": "2025-04-24T05:00:00.000Z" -> 2025-04-24 08:00:00
            let dateObj = new Date(item.startDate);
            let date = dateObj.getFullYear() + '-' + (dateObj.getMonth() + 1 ) + '-' + dateObj.getDate();
            let hour = dateObj.getHours();
            let price = Math.min(99, Math.floor(parseFloat(item.price)));

            if (date === dateInData){
                 priceData[dateInData][hour] = price.toString();
            }
        }
        setKvs(CONFIG.key_porssisahko_today, priceData);

// {"2025-4-25":{"5":"10","4":"10","3":"10","2":"10","1":"10","0":"16"}}
// lista, listan pituus on 24, 0-23
// {"2025-4-24":["10","10","10","10","10","16"]}

    };

    function getPorssisahko() {
        let porssisahkoNet = PorssisahkoNet.getInstance();
    
        porssisahkoNet.call(
            
            function (body, code, message) {
                // debugPrint(body);
				let data = JSON.parse (body);
                readPrices(data, false);
                readPrices(data, true);

            }
        );
    };


    return { // public interface
        init: function () {

        },
		run: function () {
			getPorssisahko();
		},
	};
})();

Porssisahko.init();

Shelly.addEventHandler(
	function (event, ud) {
		if (!event || !event.info) {
			return;
		}
		let event_name = event.info.event;
		//  debugPrint(event_name);
		if (event_name === "query_porssisahko") {
            Porssisahko.run();
		}

	},
	null
);

Shelly.emitEvent("query_porssisahko", {});


//Cron Time Format, "* * * * * *" --> 1.*=second 2.*=minute 3.*=hour 4.*=day_Of_month 5.*=month 6.*=day_of_week
//Cron Time Format, * = all, 1-4 --> from 1 to 4, /15 --> every 15, SUN-SAT support for day_of_week, JAN-DEC support for month
//Cron Time Format Examples:
// "*/15 * 1-4 * * *" --> Run every 15 seconds from 1 to 4 hours;
// "0 */2 1-4 * * *" --> Run every two minutes from 1 to 4 hours;
// "0 0 7 * * MON-FRI" --> Run at 7:00 every working day;
// "0 30 23 30 * *" --> Run at 23:30 every 30th day of month.
let script_id = Shelly.getCurrentScriptId();
print('Your Script ID is: ',script_id);
Shelly.call('Schedule.DeleteAll');
Shelly.call('Schedule.Create', {enable: true, timespec: "0 0 18 * * *", calls: 
	[
	  {method:"Script.Start", params:{id:script_id}}, 
	]});
Shelly.call('Schedule.Create', {enable: true, timespec: "0 2 18 * * *", calls: 
	[
	  {method:"Script.Stop", params:{id:script_id}}, 
	]});
