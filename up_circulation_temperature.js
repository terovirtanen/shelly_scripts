let CONFIG = {
	heating_ip: "192.168.100.102",
	up_circulation_temperature_id: 100,
	key_up_circulation_temperature: "UP_CIRCULATION_TEMPERATURE",
	key_up_circulation_store_datetime: "UP_CIRCULATION_STORETIME",
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

function read_up_circulation_temperature() {
	let emShelly = RemoteShelly.getInstance(CONFIG.heating_ip);

	emShelly.call(
		"Temperature.GetStatus",
		{ id: CONFIG.up_circulation_temperature_id },
		function (result, error_code, message) {
			//   print(result);
			// print(result.total_act);
			// print(result.total_act_ret);
			setTotal(CONFIG.key_up_circulation_temperature, result.tC);
			setTotal(CONFIG.key_up_circulation_store_datetime, datetimeNowToString());
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
		if (event_name === "read_up_circulation_temperature") {
			read_up_circulation_temperature();
		}
	},
	null
);

function setTimer() {
	let timercount = 1000 * 60; // msec, 1min check  

	Timer.clear(timerhanlde);

	return Timer.set(
		timercount,
		false,
		function (user_data) {
			Shelly.emitEvent("read_up_circulation_temperature", {});
			timerhanlde = setTimer();
		},
		null
	)

}

Shelly.emitEvent("read_up_circulation_temperature", {});
timerhanlde = setTimer();
