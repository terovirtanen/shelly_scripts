// porssisahko
// https://porssisahko.net/api
// GET  https://api.porssisahko.net/v1/latest-prices.json

let CONFIG = {

    urlBase: "https://terovirtanen.arkku.net/porssisahko_shelly.php?date=",

	key_today: "PORSSISAHKO_TODAY",
    key_tomorrow: "PORSSISAHKO_TOMORROW",

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
	if (stopCounter > 1) {
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

	call: function (day, callback) {
		var url = {url: CONFIG.urlBase + day};
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

let Porssisahko = (function () {

// {"2025-4-25":{"5":"10","4":"10","3":"10","2":"10","1":"10","0":"16"}}
// lista, listan pituus on 24, 0-23
// {"2025-4-24":["10","10","10","10","10","16"]}
    function getToday() {
        let porssisahkoNet = PNet.getInstance();
    
        porssisahkoNet.call(
            'today',
            function (body, code, message) {
				debugPrint("PNet call back");
				setKvs(CONFIG.key_today, body);
            }
        );
    };

    function getTomorrow() {
        let porssisahkoNet = PNet.getInstance();
    
        porssisahkoNet.call(
            'tomorrow',
            function (body, code, message) {
				debugPrint("PNet call back");
				setKvs(CONFIG.key_tomorrow, body);
            }
        );
    };

    return { // public interface
		run: function () {
			getToday();
			getTomorrow();
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
/*
Shelly.call('Schedule.DeleteAll');
let script_id = Shelly.getCurrentScriptId();
Shelly.call('Schedule.Create', {enable: true, timespec: "20 4 18 * * *", calls: 
	[
	  {method:"Script.Start", params:{id:script_id}}, 
	]});
*/