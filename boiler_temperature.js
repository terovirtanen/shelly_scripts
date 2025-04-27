let CONFIG = {
	boiler_ip: "192.168.100.101",
	boiler_temperature_id: 101,
	key_boiler_temperature: "BOILER_TEMPERATURE",
	key_boiler_store_datetime: "BOILER_STORETIME",
};

let timerhanlde = null;

let stopCounter = 0;
// store 2 kvs value and exit script
function stop() {
	stopCounter++;
	if (stopCounter > 1) {
		Shelly.call('Script.Stop', {id: Shelly.getCurrentScriptId()});
	}
};
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

function read_boiler_temperature() {
	let emShelly = RemoteShelly.getInstance(CONFIG.boiler_ip);

	emShelly.call(
		"Temperature.GetStatus",
		{ id: CONFIG.boiler_temperature_id },
		function (result, error_code, message) {
			//   print(result);
			// print(result.total_act);
			// print(result.total_act_ret);
			setTotal(CONFIG.key_boiler_temperature, result.tC);
			setTotal(CONFIG.key_boiler_store_datetime, datetimeNowToString());
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
		if (event_name === "read_boiler_temperature") {
			read_boiler_temperature();
		}
	},
	null
);

function setTimer() {
	// msec, stop after 20s
	let timercount = 20 * 1000;

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

Shelly.emitEvent("read_boiler_temperature", {});
timerhanlde = setTimer();
// let script_id = Shelly.getCurrentScriptId();
// print('Your Script ID is: ',script_id);

// Shelly.call('Schedule.DeleteAll');
/*
Shelly.call('Schedule.Create', {enable: true, timespec: '0 * * * * *', calls: 
	[
	  {method:"Script.Start", params:{id:script_id}}, 
	]});
	*/