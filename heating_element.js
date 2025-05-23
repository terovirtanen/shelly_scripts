// Switch heating element
let CONFIG = {
	em_ip: "192.168.100.100",
	key_total: "EM_TOTAL",
	key_total_ret: "EM_TOTAL_RET",
	key_total_store_datetime: "EM_STORETIME",
	em_measurement_period: 15,  // tuntinetotus 15min osissa

	key_boiler_temperature: "BOILER_TEMPERATURE",
	key_boiler_store_datetime: "BOILER_STORETIME",

	power_limit: 100, // powerlimit 100Wh, 
	anturi_id_ylakierto: "100",
	anturi_offset: 8.0,

	temp_min: 50,
	temp_min_activetime: 55,
	temp_max_solar: 75,
	temp_heating_increase: 2,
	
	boiler_stop_temperature: 40,
	temp_boiler_increase: 10,

	// porssisahko data
	key_porssisahko_today: "PORSSISAHKO_TODAY",
    key_porssisahko_tomorrow: "PORSSISAHKO_TOMORROW",
    // price limit in cents
    price_limit: 9,

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
				report_thr_C: 1.0,
				offset_C: CONFIG.anturi_offset
			}
		},
		function (response, error_code, error_message) { }
	);
};

//
// A remote Shelly abstraction Call an RPC method on the remote Shelly
let RemoteShelly = {
	_cb: function (result, error_code, error_message, callbackObject) {
		// connection to remote failed, callback with null values
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
	responseCallback: function (rpcResult, rpcCode, rpcMessage) {
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
	let solarPowerStatus;

	let boilerTemperature;
	let boilerDatetime;

	let priceData = {};

    function getPorssisahkoKvsDateFormat() {
        let dateKey = new Date();
        let formattedDate = dateKey.getFullYear() + '-' + (dateKey.getMonth() + 1 ) + '-' + dateKey.getDate();

        return formattedDate;
    };
    function porssisahkoIsOverLimit() {
        let dateKey = getPorssisahkoKvsDateFormat();
        let hour = new Date().getHours();
		if (!priceData[dateKey]) {
            debugPrint("Error: dateKey not found in priceData.");
            return false;
        }
        let price = priceData[dateKey][hour];
        debugPrint("isUnderLimit: " + dateKey + " hour: " + hour + " price: " + price);
        if (price === undefined || price === null) {
            return false;
        }
        if (parseInt(price) > CONFIG.price_limit) {
            return true;
        }
        return false;
    };
    function getPorssisahkoData() {
        Shelly.call(
			"KVS.GetMany",
			{ id: 0, match: 'PORSSISAHKO_*' },
			function (result, error_code, error_message, user_data) {
                let val1 = {};
                let val2 = {};
                priceData = {};
                for (let i = 0; i < result.items.length; i++) {
                    let item = result.items[i];

					if (item.key === CONFIG.key_porssisahko_today) {
					    val1 = JSON.parse(item.value);
					}
					if (item.key === CONFIG.key_porssisahko_tomorrow) {
					    val2 = JSON.parse(item.value);
					}
                }
                
                priceData = Object.assign({}, val1, val2);
			},
			null
		);
    };

	function emPowerIsValidData(timeNow) {
		let validData = true;
		let diffsec = (timeNow.valueOf() - prevEmDatetime.valueOf()) / 1000;


		if (emTotalAct == null || prevEmTotalAct == null) {
			validData = false;
			debugPrint("emPower Error: no previous or current data!");
		}
		// timestamp is older than 30 min (2* em measurement period), em data is outdated
		if (diffsec > (60 * CONFIG.em_measurement_period * 2)) {
			validData = false;
			debugPrint("emPower Error: previous data outdated!");
		}

		return validData;
	};
	// calculate energy meter power balance from recent measurement period
	// return values
	//  null: cannot calculate value
	//  positive value: used more than produced
	//  negative value: produced more than used
	function emPowerUsageFromMeasurementPeriod() {
		let powerSummary = null;

		let powerUsed = emTotalAct - prevEmTotalAct;
		let powerRet = emTotalActRet - prevEmTotalActRet;

		if ( powerUsed < CONFIG.power_limit && powerRet < CONFIG.power_limit) {
			debugPrint("Not enough power used to make decision!");
			return powerSummary;
		}

		// calculate is power used or produced
		powerSummary = powerUsed - powerRet;
		return powerSummary;
	};

	// return values
	// -2 : energy meter previous values are not exists on outdated, cannot use to switch heater
	// -1 :  not enough power produced on measurement period
	// 0 : turn off, used more power than produced
	// 1,2 : turn on, produced more power than used
	// powerSummary > 0 : used more power than produced
	// powerSummary < 0 : produced more power than used
	function refreshSolarPowerStatus(timeNow) {
		// get power balance 
		let validData = emPowerIsValidData(timeNow);
		if (!validData) {
			debugPrint("refreshSolarPowerStatus Error: no power usage from recent measurement period!");
			solarPowerStatus = -2;
			return solarPowerStatus;
		}

		let powerSummary= emPowerUsageFromMeasurementPeriod();

		if (powerSummary == null) {
			debugPrint("valid data, but power summary cannot calculate!");
		}
		// used more power than produced from previous netto leveling
		else if (powerSummary > CONFIG.power_limit) {
			// use slow mode, case measurement period has just changed 
			solarPowerStatus = (solarPowerStatus > 0) ? solarPowerStatus - 1 : 0;
		}
		// produced more power than used from previous netto leveling
		else if (powerSummary < (CONFIG.power_limit * -1)) {
			solarPowerStatus = 2;
		}
		debugPrint("action solarPowerStatus : " + solarPowerStatus);
		// return last state
		return solarPowerStatus;
	};

	function getTempMin(timeNow, hour){
		// use higher temperature active time 
		let min_temp = (hour > 17 && hour < 21) ? CONFIG.temp_min_activetime : CONFIG.temp_min;

		// check is boiler stopped, set limit higher if boiler is stopped
		let diffsec = (timeNow.valueOf() - boilerDatetime.valueOf()) / 1000;
		// timestamp is older than 60 min , boiler temperature data is outdated
		if (diffsec > (60 * 60)) {
			debugPrint("boiler Temperature Error: temperature data outdated!");
			min_temp = min_temp + CONFIG.temp_boiler_increase;
		}
		else if (boilerTemperature < CONFIG.boiler_stop_temperature) {
			debugPrint("boiler is stopped!");
			min_temp = min_temp + CONFIG.temp_boiler_increase;
		}

		return min_temp;
	};
	
	function action() {
		let now = Date(Date.now());
		let hour = now.getHours();

		let solarStatus = refreshSolarPowerStatus(now);

		// use higher temperature active time 
		let min_temp = getTempMin(now, hour);

		// own produced solar power set max limit to higher
		let max_temp = (solarStatus > 0) ? CONFIG.temp_max_solar : min_temp + CONFIG.temp_heating_increase;

		debugPrint("action boilerDatetime : " + boilerDatetime);
		debugPrint("action boilerTemperature : " + boilerTemperature);
		debugPrint("action prevEmDatetime : " + prevEmDatetime);
		debugPrint("action upCirculationTemperature : " + upCirculationTemperature);
		debugPrint("action min_temp : " + min_temp);
		debugPrint("action max_temp : " + max_temp);
		// under minimum limit, set heater on
		if (upCirculationTemperature < min_temp) {
			switchVastus(true);
		}
		// porssisahko is high, set vastus off
		else if (porssisahkoIsOverLimit()) {
			switchVastus(false);
		}
		// over maximum limit, set heater off
		else if (upCirculationTemperature > max_temp) {
			switchVastus(false);
		}
		// use solar power, set heater on
		else if (solarStatus > 0) {
			switchVastus(true);
		}
		// no produced solar power, set heater off
		else if (solarStatus == 0) {
			switchVastus(false);
		}
	};

	function previousEmTotal() {
		Shelly.call(
			"KVS.GetMany",
			{ id: 0 },
			function (result, error_code, error_message, user_data) {
                for (let i = 0; i < result.items.length; i++) {
                    let item = result.items[i];

					if (item.key === CONFIG.key_total) {
						prevEmTotalAct = item.value;
					}
					if (item.key === CONFIG.key_total_ret) {
						prevEmTotalActRet = item.value;
					}
					if (item.key === CONFIG.key_total_store_datetime) {
						prevEmDatetime = Date(item.value);
					}
					if (item.key === CONFIG.key_boiler_temperature) {
						boilerTemperature = item.value;
					}
					if (item.key === CONFIG.key_boiler_store_datetime) {
						boilerDatetime = Date(item.value);
					}
                }

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
		init: function () {
			solarPowerStatus = -2;
			getPorssisahkoData();
		},
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
		porssisahko_refresh: function () {
			getPorssisahkoData();
		},
		
	};
})();

Heater.init();

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
		// temperature has changed
		else if (event_name === "porssisahko_refresh") {
			Heater.porssisahko_refresh();
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
