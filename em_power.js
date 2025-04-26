let CONFIG = {
	em_ip: "192.168.100.100",
	key_total: "EM_TOTAL",
	key_total_ret: "EM_TOTAL_RET",
	key_total_store_datetime: "EM_STORETIME",

};

let timerhanlde = null;

//
// A remote Shelly abstraction Call an RPC method on the remote Shelly
let RemoteShelly = {
	_cb: function (result, error_code, error_message, callback) {
		if (result === undefined) {
			return;
		}
		let rpcResult = JSON.parse(result.body);
		let rpcCode = result.code;
		let rpcMessage = result.message;
		callback(rpcResult, rpcCode, rpcMessage);
	},
	composeEndpoint: function (method) {
		return "http://" + this.address + "/rpc/" + method;
	},
	call: function (rpc, data, callback) {
		let postData = {
			url: this.composeEndpoint(rpc),
			body: data,
		};
		Shelly.call("HTTP.POST", postData, RemoteShelly._cb, callback);
	},
	getInstance: function (address) {
		let rs = Object.create(this);
		// remove static method
		rs.getInstance = null;
		rs.address = address;
		return rs;
	},
};

function setTotal(key, value) {
	Shelly.call(
		"KVS.Set",
		{ "key": key, "value": value },
		function (result, error_code, error_message, user_data) {
			// print(result);
		},
		null
	);
};
function datetimeNowToString() {
	let now = Date(Date.now());
	let datetime = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + 'T' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();

	return datetime;
};

function read_em() {
	let emShelly = RemoteShelly.getInstance(CONFIG.em_ip);

	emShelly.call(
		"EMData.GetStatus",
		{ id: 0 },
		function (result, error_code, message) {
			//    print(result);
			// print(result.total_act);
			// print(result.total_act_ret);
			setTotal(CONFIG.key_total, result.total_act);
			setTotal(CONFIG.key_total_ret, result.total_act_ret);
			setTotal(CONFIG.key_total_store_datetime, datetimeNowToString());
		}
	);
}

Shelly.addEventHandler(
	function (event, ud) {
		if (!event || !event.info) {
			return;
		}
		let event_name = event.info.event;
		// print(event_name);
		if (event_name === "read_em") {
			read_em();
		}
	},
	null
);

// function setTimer() {
// 	let now = Date(Date.now());
// 	let minutes = 15 - (now.getMinutes() % 15);// 15min välein 
// 	let seconds = now.getSeconds(); // sekunnit 0:aan

// 	// msec
// 	let timercount = (minutes * 60 - seconds) * 1000;

// 	Timer.clear(timerhanlde);

// 	return Timer.set(
// 		timercount,
// 		false,
// 		function (user_data) {
// 			Shelly.emitEvent("read_em", {});
// 			timerhanlde = setTimer();
// 		},
// 		null
// 	)

// }

Shelly.emitEvent("read_em", {});
// timerhanlde = setTimer();

//Cron Time Format, "* * * * * *" --> 1.*=second 2.*=minute 3.*=hour 4.*=day_Of_month 5.*=month 6.*=day_of_week
//Cron Time Format, * = all, 1-4 --> from 1 to 4, /15 --> every 15, SUN-SAT support for day_of_week, JAN-DEC support for month
//Cron Time Format Examples:
// "*/15 * 1-4 * * *" --> Run every 15 seconds from 1 to 4 hours;
// "0 */2 1-4 * * *" --> Run every two minutes from 1 to 4 hours;
// "0 0 7 * * MON-FRI" --> Run at 7:00 every working day;
// "0 30 23 30 * *" --> Run at 23:30 every 30th day of month.
let script_id = Shelly.getCurrentScriptId();
// print('Your Script ID is: ',script_id);

// Shelly.call('Schedule.DeleteAll');
// Shelly.call('Schedule.Create', {enable: true, timespec: '0 */15 * * * *', calls: 
// 	[
// 	  {method:"Script.Start", params:{id:script_id}}, 
// 	]});
// Shelly.call('Schedule.Create', {enable: true, timespec: '30 */15 * * * *', calls: 
// 	[
// 	  {method:"Script.Stop", params:{id:script_id}}, 
// 	]});
