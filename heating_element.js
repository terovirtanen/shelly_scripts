let CONFIG = {
	em_ip: "192.168.100.100",
	key_total: "EM_TOTAL",
	key_total_ret: "EM_TOTAL_RET",
	key_total_store_datetime: "EM_STORETIME",

	power_limit: 100, // powerlimit 100Wh, 
	anturi_id_ylakierto: "100",
	temp_min: 50,
	temp_min_activetime: 55,
	temp_max_solar: 70,
	temp_heating_increase: 3,

	debug: false,
	dryrun: false,
};

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
}

function setTemperatureComponent() {
	Shelly.call(
		"Temperature.SetConfig",
		{
			id: CONFIG.anturi_id_ylakierto,
			config: {
				id: CONFIG.anturi_id_ylakierto,
				name: "yläkierto lämpötila",
				report_thr_C: 1.0
			}
		},
		function (response, error_code, error_message) { }
	);
};

//
// A remote Shelly abstraction Call an RPC method on the remote Shelly
let RemoteShelly = {
	_cb: function (result, error_code, error_message, callbackObject) {
		if (result === undefined) {
			callbackObject.responseCallback(null, error_code, error_message);
		} else {
			let rpcResult = JSON.parse(result.body);
			let rpcCode = result.code;
			let rpcMessage = result.message;
			callbackObject.responseCallback(rpcResult, rpcCode, rpcMessage);
		}
	},
	composeEndpoint: function (method) {
		return "http://" + this.address + "/rpc/" + method;
	},
	call: function (rpc, data, callbackObject) {
		this.responseCallback = callbackObject;
		let postData = {
			url: this.composeEndpoint(rpc),
			body: data,
		};
		Shelly.call("HTTP.POST", postData, RemoteShelly._cb, this);
	},
	getInstance: function (address) {
		let rs = Object.create(this);
		// remove static method
		rs.getInstance = null;
		rs.address = address;
		return rs;
	},
	responseCallback: function(rpcResult, rpcCode, rpcMessage) {
		debugPrint("This is default responseCallback that should override!");
	}
};

function switchVastus(activate) {
	debugPrint("activate vastus " + activate);

	if (CONFIG.dryrun) {
		return;
	}

	Shelly.call(
		"Switch.Set",
		{ id: 0, on: activate },
		function (response, error_code, error_message) { }
	);
};

let Heater = (function () {
	let upCirculationTemperature;
	let emTotalAct;
	let emTotalActRet;
	let prevEmTotalAct;
	let prevEmTotalActRet;
	let prevEmDatetime;
	let SOLAR_ACTIVATED;

	// return values
	// -1 : energy meter previous values are not exixts on outdated, cannot use to switch heater
	// 0 : used more power than produced
	// 1 : produced more power than used
	function solarPower(timeNow) {
		if (emTotalAct == null || prevEmTotalAct == null) {
			debugPrint("solarPower Error: no previous or current data!");
			SOLAR_ACTIVATED = 0;
			return -1;
		}
		let diffsec = (timeNow.valueOf() - prevEmDatetime.valueOf()) / 1000;
		// timestamp is older than 30 min, em data is outdated
		if (diffsec > (60 * 30)) {
			debugPrint("solarPower Error: previous data outdated!");
			SOLAR_ACTIVATED = 0;
			return -1;
		}

		// calculate is power used or produced
		let powerUsed = emTotalAct - prevEmTotalAct;
		let powerRet = emTotalActRet - prevEmTotalActRet;
		let powerSummary = powerUsed - powerRet;

		// used more power than produced from previous netto leveling
		if (powerSummary > CONFIG.power_limit) {
			SOLAR_ACTIVATED = 0;
			return 0;
		}
		// prouced more power than used from previous netto leveling
		if (powerSummary < (CONFIG.power_limit * -1)) {
			SOLAR_ACTIVATED = 1;
			return 1;
		}
		// return last state
		return SOLAR_ACTIVATED;
	};
	function action() {
		let now = Date(Date.now());
		let hour = now.getHours();

		let solarStatus = solarPower(now);

		// use higher temperature active time 
		let min_temp = (hour > 16 && hour < 21) ? CONFIG.temp_min_activetime : CONFIG.temp_min;
		// own produced solar power set max limit to higher
		let max_temp = (solarStatus == 1) ? CONFIG.temp_max_solar : min_temp + CONFIG.temp_heating_increase;

		debugPrint("action upCirculationTemperature : " + upCirculationTemperature);
		debugPrint("action min_temp : " + min_temp);
		debugPrint("action max_temp : " + max_temp);
		debugPrint("action SOLAR_ACTIVATED : " + SOLAR_ACTIVATED);
		// under minimum limit, set heater on
		if (upCirculationTemperature < min_temp) {
			switchVastus(true);
		}
		// over maximum limit, set heater off
		else if (upCirculationTemperature > max_temp) {
			switchVastus(false);
		}
		// no produced solar power, set heater off
		else if (solarStatus == 0) {
			switchVastus(false);
		}
		// use solar power, set heater on
		else if (solarStatus == 1) {
			switchVastus(true);
		}
	};

	function previousEmTotal() {
		Shelly.call(
			"KVS.GetMany",
			{ id: 0 },
			function (result, error_code, error_message, user_data) {
				prevEmTotalAct = result.items.EM_TOTAL.value;
				prevEmTotalActRet = result.items.EM_TOTAL_RET.value;
				prevEmDatetime = Date(result.items.EM_STORETIME.value);

				action();
			},
			null
		);

	};

	function getEmTotal() {
		let emShelly = RemoteShelly.getInstance(CONFIG.em_ip);

		emShelly.call(
			"EMData.GetStatus",
			{ id: 0 },
			Heater.getEmTotalCallback
		);
	};

	function callGetTemperature(id) {
		Shelly.call(
			"Temperature.GetStatus",
			{ "id": id },
			function (result, error_code, error_message, user_data) {
				upCirculationTemperature = result.tC;

				//		debugPrint(result);
				//		debugPrint(temp);
				getEmTotal()
			},
			null
		);
	};

	return { // public interface
		refresh: function () {
			callGetTemperature(CONFIG.anturi_id_ylakierto);
		},
		getEmTotalCallback: function (result, error_code, error_message) {
			if (result === null) {
				emTotalAct = null;
				emTotalActRet = null;
			} else {
				emTotalAct = result.total_act;
				emTotalActRet = result.total_act_ret;
			}
			// debugPrint(result);
			// debugPrint(LATEST_DATA);
			// debugPrint(user_data);

			previousEmTotal();
		},

	};
})();

Shelly.addEventHandler(
	function (event, ud) {
		if (!event || !event.info) {
			return;
		}
		let event_name = event.info.event;
		//  debugPrint(event_name);
		if (event_name === "switchHeater") {
			Heater.refresh();
		}
		// temperature has changed
		else if (event_name === "temperature_change") {
			Heater.refresh();
		}
	},
	null
);

setTemperatureComponent();

// check heater status every minute
Timer.set(
	1000 * 60, // msec, 1min check  
	true,
	function (user_data) {
		Shelly.emitEvent("switchHeater", {});
	},
	null
)
Shelly.emitEvent("switchHeater", {});

