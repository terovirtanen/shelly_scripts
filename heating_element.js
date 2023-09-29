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
	temp_heating: 3,

	debug: true,
	dryrun: true,
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
		debugPrint(result);
		debugPrint(callbackObject);

		if (result === undefined) {
			callbackObject.getEmTotalCallback(null, null, null);
		} else {
			let rpcResult = JSON.parse(result.body);
			let rpcCode = result.code;
			let rpcMessage = result.message;
			callbackObject.getEmTotalCallback(rpcResult, rpcCode, rpcMessage);
		}
	},
	composeEndpoint: function (method) {
		return "http://" + this.address + "/rpc/" + method;
	},
	call: function (rpc, data, callbackObject) {
		let postData = {
			url: this.composeEndpoint(rpc),
			body: data,
		};
		Shelly.call("HTTP.POST", postData, RemoteShelly._cb, callbackObject);
	},
	getInstance: function (address) {
		let rs = Object.create(this);
		// remove static method
		rs.getInstance = null;
		rs.address = address;
		return rs;
	},
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
	// -1 : not value exists, cannot use to switch heater
	// 0 : used more power than produced
	// 1 : produced more power than used
	function solarPower(now) {
		if (emTotalAct == null || prevEmTotalAct == null) {
			SOLAR_ACTIVATED = false;
			return -1;
		}
		// timestamp is older than 30 min, em data is outdated
		let diffsec = (now.valueOf() - prevEmDatetime.valueOf()) / 1000;
		if (diffsec > (60 * 30)) {
			SOLAR_ACTIVATED = false;
			return -1;
		}

		let powerUsed = emTotalAct - prevEmTotalAct;
		let powerRet = emTotalActRet - prevEmTotalActRet;
		let powerSummary = powerUsed - powerRet;

		if (powerSummary > CONFIG.power_limit) {
			SOLAR_ACTIVATED = false;
			return 0;
		}
		if (powerSummary < (CONFIG.power_limit * -1)) {
			return 1;
		}
		if (SOLAR_ACTIVATED) {
			return 1;
		}

		return -1;
	};
	function action() {
		let now = Date(Date.now());
		let hour = now.getHours();

		let solarStatus = solarPower(now);

		let min_temp = (hour > 17 && hour < 22) ? CONFIG.temp_min_activetime : CONFIG.temp_min;
		let max_temp = (solarStatus == 1) ? CONFIG.temp_max_solar : min_temp + CONFIG.temp_heating;

		debugPrint("action upCirculationTemperature : " + upCirculationTemperature);
		debugPrint("action min_temp : " + min_temp);
		debugPrint("action max_temp : " + max_temp);
		debugPrint("action SOLAR_ACTIVATED : " + SOLAR_ACTIVATED);
		if (upCirculationTemperature < min_temp) {
			switchVastus(true);
		}
		else if (upCirculationTemperature > max_temp) {
			switchVastus(false);
		}
		else if (solarStatus == 0) {
			SOLAR_ACTIVATED = false;
			switchVastus(false);
		}
		else if (solarStatus == 1) {
			SOLAR_ACTIVATED = true;
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
			Heater
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

