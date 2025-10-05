let CONFIG = {
    latitude: 60.65000, // Koski Tl
    longitude: 23.15000,

    panelTilt: 22, // panle tilt 1:2,5
    peakPower:  8100, // Peak power of the panel in watts
    panelEfficiency: 1.00, // Assume the panel efficiency is 90%

    url_forecast_tomorrow: "https://terovirtanen.arkku.net/forecast_tomorrow.php",
	url_forecast_power: "https://terovirtanen.arkku.net/forecast_power.php",

	forecast_power_max: "FORECAST_POWER_MAX",
	forecast_power: "FORECAST_POWER",
	forecast_store_datetime: "FORECAST_STORETIME",

    debug: false,
    
};

let timerhandle = null;
let stopCounter = 0;

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
};

// store 3 kvs value and exit script
function stop() {
	stopCounter++;
	if (stopCounter > 2) {
		debugPrint("Stop script!");
		Shelly.call('Script.Stop', {id: Shelly.getCurrentScriptId()});
	}
};
//
// A remote Shelly abstraction Call an RPC method on the remote Shelly
let ForecastTomorrow = {
	_cb: function (result, error_code, error_message, callback) {
        // debugPrint("ForecastTomorrow _cb");
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
			url: CONFIG.url_forecast_tomorrow
		};
        // debugPrint("ForecastTomorrow call");
		Shelly.call("HTTP.GET", getData, ForecastTomorrow._cb, callback);
	},
	getInstance: function () {
		let rs = Object.create(this);
		// remove static method
		rs.getInstance = null;
		return rs;
	},
};

let ForecastPower = {
	_cb: function (result, error_code, error_message, callback) {
        // debugPrint("ForecastPower _cb");
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
			url: CONFIG.url_forecast_power
		};
        // debugPrint("ForecastPower call");
		Shelly.call("HTTP.GET", getData, ForecastPower._cb, callback);
	},
	getInstance: function () {
		let rs = Object.create(this);
		// remove static method
		rs.getInstance = null;
		return rs;
	},
};

function setTotal(key, value) {
	Shelly.call(
		"KVS.Set",
		{ "key": key, "value": value },
		function (result, error_code, error_message, user_data) {
			// print(result);
			stop();
		},
		null
	);
};
function datetimeNowToString() {
	let now = Date(Date.now());
	let datetime = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + 'T' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();

	return datetime;
};

let Forecast = (function () {
    function getForecast() {
        let forecastTomorrow = ForecastTomorrow.getInstance();
    
        forecastTomorrow.call(
            function (body, code, message) {
                debugPrint(body);
				let data = JSON.parse (body);
                debugPrint(data.powerMax);
                debugPrint(data.powerForecast);
                // debugPrint(code);
                // debugPrint(message);
				
				setTotal(CONFIG.forecast_power_max, data.powerMax);
				setTotal(CONFIG.forecast_power, data.powerForecast);
				setTotal(CONFIG.forecast_store_datetime, datetimeNowToString());
            }
        );
    };
    function getPower() {
        let forecastPower = ForecastPower.getInstance();
        forecastPower.call(
            function (body, code, message) {
                // debugPrint(body);
                // debugPrint(code);
                // debugPrint(message);
            }
        );

    };

    return { // public interface
		run: function () {
			getPower();
			getForecast();
		},
		runGetForcast: function () {
			getForecast();
		},
		runGetPower: function () {
			getPower();
		},
	};
})();

function setTimer() {
	// msec, stop after 120s
	let timercount = 120 * 1000;

	Timer.clear(timerhandle);

	return Timer.set(
		timercount,
		false,
		function (user_data) {
			stopCounter = 10;
			stop();
		},
		null
	)

}

Forecast.run();
timerhandle = setTimer();

//Cron Time Format, "* * * * * *" --> 1.*=second 2.*=minute 3.*=hour 4.*=day_Of_month 5.*=month 6.*=day_of_week
//Cron Time Format, * = all, 1-4 --> from 1 to 4, /15 --> every 15, SUN-SAT support for day_of_week, JAN-DEC support for month
//Cron Time Format Examples:
// "*/15 * 1-4 * * *" --> Run every 15 seconds from 1 to 4 hours;
// "0 */2 1-4 * * *" --> Run every two minutes from 1 to 4 hours;
// "0 0 7 * * MON-FRI" --> Run at 7:00 every working day;
// "0 30 23 30 * *" --> Run at 23:30 every 30th day of month.
// let script_id = Shelly.getCurrentScriptId();
// // print('Your Script ID is: ',script_id);
// // Shelly.call('Schedule.DeleteAll');
// Shelly.call('Schedule.Create', {enable: true, timespec: "0 0 23 * * *", calls: 
// 	[
// 	  {method:"Script.Start", params:{id:script_id}}, 
// 	]});

