// porssisahko
// https://porssisahko.net/api
// GET  https://api.porssisahko.net/v2/latest-prices.json

let CONFIG = {

    urlBase: "https://terovirtanen.arkku.net/porssisahko_shelly_v2.php",

	key_base: "PORSSISAHKO_",

    debug: false,
    
};

let timerhanlde = null;
let stopCounter = 0;

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
};
// store 2 kvs value and exit script
function stop() {
	stopCounter++;
	if (stopCounter > 8) {
		debugPrint("Stop script!");
		Shelly.emitEvent("porssisahko_refresh", {});
		Shelly.call('Script.Stop', {id: Shelly.getCurrentScriptId()});
	}
};

function setKvs(key, value) {
    debugPrint(value);

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

// A remote Shelly abstraction Call an RPC method on the remote Shelly
let PNet = {
	_cb: function (result, error_code, error_message, callback) {
        // debugPrint("PNet _cb");
        // debugPrint(error_code);
        // debugPrint(error_message);
        // debugPrint(result);
		if (result === undefined) {
			return;
		};
        //  debugPrint(result.code);
        //  debugPrint(result.message);

		callback(result.body, result.code, result.message);
	},

	call: function (callback) {
		var url = {url: CONFIG.urlBase};
        // debugPrint("PNet call");
		Shelly.call("HTTP.GET", url, PNet._cb, callback);
	},
	getInstance: function () {
		let rs = Object.create(this);
		// remove static method
		rs.getInstance = null;
		return rs;
	},
};

let toKvs = {};
let Porssisahko = (function () {

//  porssisahko_shelly_v2.php return next 8 hours prices
// {"2025-10-3":{"1":[0,0,0,0],"0":[0,0,0,0]},"2025-10-2":{"23":[1,1,0,0],"22":[2,2,1,1],"21":[4,2,1,1],"20":[11,9,7,5],"19":[21,21,13,10],"18":[24,22,22,14]}}
    function getPrices() {
        let porssisahkoNet = PNet.getInstance();
    
        porssisahkoNet.call(
            function (body, code, message) {
				debugPrint("PNet call back");
    			let response = JSON.parse(body);
				// response = {"2025-10-3":{"1":[0,0,0,0],"0":[0,0,0,0]},"2025-10-2":{"23":[1,1,0,0],"22":[2,2,1,1],"21":[4,2,1,1],"20":[11,9,7,5],"19":[21,21,13,10],"18":[24,22,22,14]}}
				for (let date in response) {
					if (!response.hasOwnProperty(date)) continue;
					let hours = response[date];
					for (let hour in hours) {
						if (!hours.hasOwnProperty(hour)) continue;
						let kvValue = {};
						kvValue[date] = hours[hour];
						toKvs[CONFIG.key_base + hour] = JSON.stringify(kvValue);
						// setKvs(CONFIG.key_base + hour, JSON.stringify(kvValue));
					}
				}
				let interval = Timer.set(1000, true, function (key, value) {
					let keys = Object.keys(toKvs);
					if (keys.length === 0) {
						Timer.clear(interval);
						return;
					}
					let key = keys[0];
					let value = toKvs[key];
					delete toKvs[key];
					debugPrint("Timer interval");
					debugPrint(key);
					debugPrint(value);
					setKvs(key, value);
				}, null);
            }
        );
    };

    return { // public interface
		run: function () {
			getPrices();
		},
	};
})();

function setTimer() {
	// msec, stop after 30s
	let timercount = 30 * 1000;

	Timer.clear(timerhanlde);

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

Porssisahko.run();
timerhanlde = setTimer();

//Cron Time Format, "* * * * * *" --> 1.*=second 2.*=minute 3.*=hour 4.*=day_Of_month 5.*=month 6.*=day_of_week
//Cron Time Format, * = all, 1-4 --> from 1 to 4, /15 --> every 15, SUN-SAT support for day_of_week, JAN-DEC support for month
//Cron Time Format Examples:
// "*/15 * 1-4 * * *" --> Run every 15 seconds from 1 to 4 hours;
// "0 */2 1-4 * * *" --> Run every two minutes from 1 to 4 hours;
// "0 0 7 * * MON-FRI" --> Run at 7:00 every working day;
// "0 30 23 30 * *" --> Run at 23:30 every 30th day of month.
// print('Your Script ID is: ',script_id);
// /*
// Shelly.call('Schedule.DeleteAll');
// let script_id = Shelly.getCurrentScriptId();
// Shelly.call('Schedule.Create', {enable: true, timespec: "0 5 */6 * * *", calls: 
// 	[
// 	  {method:"Script.Start", params:{id:script_id}}, 
// 	]});
//*/