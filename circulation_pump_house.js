// circulation_pump_house.js
let CONFIG = {
	outside_ip: "192.168.100.20",
	outside_temperature_id: 100,

	limit: 14.0, // ulkolämpötilan raja, alle menee kierto päälle
	limitEvening: 18.0, // ulkolämpötilan raja illalla, alle menee kierto päälle
	limitNight: 5.0, // ulkolämpötilan raja yöllä, alle menee kierto päälle

	debug: false,
	dryrun: false,
};

let timerhandle = null;

let stopCounter = 0;

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
};

function isNight() {
	let now = Date(Date.now());
	if (now.getHours() < 6 || now.getHours() > 22) {
		return true;
	}
	return false;
};

function isEvening() {
	let now = Date(Date.now());
	if (now.getHours() >= 18 && now.getHours() < 20) {
		return true;
	}
	return false;
};

// store 2 kvs value and exit script
function stop() {
	stopCounter++;
	if (stopCounter > 1) {
		Shelly.call('Script.Stop', {id: Shelly.getCurrentScriptId()});
	}
};

function switchPump(activate) {
	debugPrint("activate pump " + activate);

	if (CONFIG.dryrun) {
		return;
	}

	Shelly.call(
		"Switch.Set",
		{ id: 0, on: activate },
		function (response, error_code, error_message) { }
	);
};

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

function get_outside_temperature() {
	let emShelly = RemoteShelly.getInstance(CONFIG.outside_ip);

	emShelly.call(
		"Temperature.GetStatus",
		{ id: CONFIG.outside_temperature_id },
		function (result, error_code, message) {
			// print(result);
			// print(previous_temperature);
			if (result !== undefined) {
				let outside_temperature = result.tC;
				debugPrint("outside temperature: " + outside_temperature);
				let limit = isNight() ? CONFIG.limitNight : CONFIG.limit;
				limit = isEvening() ? CONFIG.limitEvening : limit;
				if (outside_temperature < limit) {
					switchPump(true);
				}
				else {
					switchPump(false);
				}
			}			//   print(result);
			// print(result.total_act);
			// print(result.total_act_ret);
		}
	);
}

function setTimer() {
	// msec, stop after 20s
	let timercount = 20 * 1000;

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

get_outside_temperature();
timerhandle = setTimer();
/*
Shelly.call('Schedule.Create', {
	enable: true,
	timespec: '0 0 * * * *', // joka tasatunti
	calls: [
		{ method: "Script.Start", params: { id: Shelly.getCurrentScriptId() } },
	]
});
*/