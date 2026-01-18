// circulation_pump.js
// kierrätys pannu varaaja
// 100 anturi varaaja alakierto
// 101 anturi pannu
// 102 anturi autotalli
// laitteen ip 192.168.100.101
// mqtt tulee konfiguroida erikseen shelly em:lle

let CONFIG = {
	anturi_garage_id: "102",	
	anturi_boiler_id: "101",
	anturi_boiler_name: "Pannu lämpötila",
	anturi_downCirculation_id: "100",
	anturi_downCirculation_name: "Varaaja alakierto lämpötila",
	anturi_downCirculation_offset: 8.0,
	
	boiler_max_temperature: 75, // pannun max lämpö, ylitys -> kierto päälle
	boiler_min_temperature: 40, // talviajan alaraja
	downCirculation_max_temperature: 65, // kierron max lämpö -> ylitys kierto pois päältä
	upCirculation_max_temperature: 72, // kierron ylä max lämpö -> ylitys kierto päälle päältä. case vastus lämmittää
	
	key_up_circulation_temperature: "UP_CIRCULATION_TEMPERATURE",
	key_up_circulation_store_datetime: "UP_CIRCULATION_STORETIME",
	
	mqtt_topic_garage: "garage/temperature",

	debug: false,
	dryrun: false,
}

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
};

function datetimeNowToString() {
	let now = Date(Date.now());
	let datetime = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + 'T' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();

	return datetime;
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

function setTemperatureComponent() {
	Shelly.call(
		"Temperature.SetConfig",
		{
			id: CONFIG.anturi_downCirculation_id,
			config: {
				id: CONFIG.anturi_downCirculation_id,
				name: CONFIG.anturi_downCirculation_name,
				report_thr_C: 1.0,
				offset_C: CONFIG.anturi_downCirculation_offset
			}
		},
		function (response, error_code, error_message) { }
	);
	Shelly.call(
		"Temperature.SetConfig",
		{
			id: CONFIG.anturi_boiler_id,
			config: {
				id: CONFIG.anturi_boiler_id,
				name: CONFIG.anturi_boiler_name,
				report_thr_C: 1.0
			}
		},
		function (response, error_code, error_message) { }
	);
};

let TemperatureHandler = (function () {
	let boilerTemperature;
	let downCirculationTemperature;

	let upCirculationTemperature; // -1 if outdated
	let upCirculationDatetime;

	let isRefreshRunning = false; // estää päällekkäiset refresh kutsut
	let isRefreshGarageRunning = false; // estää päällekkäiset refresh kutsut

	function publishTemperature(topic, value) {
		if (!MQTT.isConnected()) {
			debugPrint("MQTT ei ole yhdistettynä, julkaisu ohitetaan");
			return;
		}
		let payload = JSON.stringify({ tC: value, ts: datetimeNowToString() });
		MQTT.publish(topic, payload, 0, true);
		debugPrint("Publish -> " + topic + ": " + payload);
	}

	function winterTime() {
		let now = Date(Date.now());
		let month = now.getMonth(); // months start from 0

		debugPrint("month is " + month);
		if (month < 3 || month > 8) {
			debugPrint("WINTERTIME !");
			return true;
		}

		return false;
	};

	function setPump() {
		debugPrint("Pannu lämpötila:  " + boilerTemperature);
		debugPrint("Kierto lämpötila: " + downCirculationTemperature);
		// pannu max lämpö ylitetty
		if (boilerTemperature > CONFIG.boiler_max_temperature) {
			debugPrint("Rule 1");
			switchPump(true);
		}
		// kierron ylälämpö ylitetty, vastus lämmittää 
		else if (upCirculationTemperature > CONFIG.upCirculation_max_temperature && upCirculationTemperature > boilerTemperature) {
			debugPrint("Rule 2");
			switchPump(true);
		}
		// pannun minilämpö alitettu (talvikuukaudet)
		else if (winterTime() && boilerTemperature < CONFIG.boiler_min_temperature) {
			debugPrint("Rule 3");
			switchPump(true);
		}
		// pannun lämpötila alle kierron
		else if (boilerTemperature < downCirculationTemperature) {
			debugPrint("Rule 4");
			switchPump(false);
		}
		// kierron lämpö yli max arvon
		else if (downCirculationTemperature > CONFIG.downCirculation_max_temperature) {
			debugPrint("Rule 5");
			switchPump(false);
		}
		// pannun lämpötila yli kierron lämpötilan
		else if (boilerTemperature > downCirculationTemperature) {
			debugPrint("Rule 6");
			switchPump(true);
		}
		
		// Merkitään refresh valmiiksi
		isRefreshRunning = false;
		debugPrint("TemperatureHandler refresh completed");
	};

	function readKvs() {
		Shelly.call(
			"KVS.GetMany",
			{ id: 0 },
			function (result, error_code, error_message, user_data) {
				// before version 1.5.0
				// upCirculationTemperature = result.items[CONFIG.key_up_circulation_temperature].value;
				// upCirculationDatetime = result.items[CONFIG.key_up_circulation_store_datetime].value;
                for (let i = 0; i < result.items.length; i++) {
                    let item = result.items[i];

					if (item.key === CONFIG.key_up_circulation_temperature) {
						upCirculationTemperature = item.value;
					}
					if (item.key === CONFIG.key_up_circulation_store_datetime) {
						upCirculationDatetime = item.value;
					}
                }

				debugPrint("upCirculationTemperature  " + upCirculationTemperature);
				debugPrint("upCirculationDatetime  " + upCirculationDatetime);

				let now = Date(Date.now());
				let diffsec = (now.valueOf() - Date(upCirculationDatetime).valueOf()) / 1000;
				// timestamp is older than 30 min (2* em measurement period), em data is outdated
				if (diffsec > (60 * 5)) {
					debugPrint("upCirculation Error: data outdated!");
					upCirculationTemperature = -1;
				}

				setPump();
			},
			null
		);
	};

	function readTemperatureAlakierto() {
		Shelly.call(
			"Temperature.GetStatus",
			{ "id": CONFIG.anturi_downCirculation_id },
			function (result, error_code, error_message, user_data) {
				debugPrint(result.tC);
				downCirculationTemperature = result.tC;
				readKvs();
			},
			null
		);
	};

	function readTemperatureBoiler() {
		Shelly.call(
			"Temperature.GetStatus",
			{ "id": CONFIG.anturi_boiler_id },
			function (result, error_code, error_message, user_data) {
				//		debugPrint(result);
				debugPrint(result.tC);
				boilerTemperature = result.tC;
				readTemperatureAlakierto();
			},
			null
		);
	};

	function readTemperatureGarage(doneCb) {
		Shelly.call(
			"Temperature.GetStatus",
			{ id: CONFIG.anturi_garage_id },
			function (result, error_code, error_message) {
				if (error_code) {
					debugPrint("Garage read error: " + error_code + ", " + error_message);
					doneCb && doneCb(false);
					return;
				}
				if (result && result.tC !== undefined) {
                    publishTemperature(CONFIG.mqtt_topic_garage, result.tC);
				}
				doneCb && doneCb(true);
			},
			null
		);
	};

	let api = { // public interface
		refreshGarage: function () {
			if (isRefreshGarageRunning) {
				return;
			}
			isRefreshGarageRunning = true;

			// luetaan autotallin lämpötila ja julkaistaan se MQTT:lle
			readTemperatureGarage(function () {
                isRefreshGarageRunning = false;
			});
		},
		refresh: function () {
			// Tarkista onko refresh jo käynnissä
			if (isRefreshRunning) {
				debugPrint("TemperatureHandler refresh already running, skipping...");
				return;
			}
			
			// Merkitään refresh käynnissä olevaksi
			isRefreshRunning = true;
			debugPrint("Starting TemperatureHandler refresh");
			readTemperatureBoiler();
		},
	};

	return api;
})();

setTemperatureComponent();

Shelly.addEventHandler(
	function (event, ud) {
		if (!event || !event.info) {
			return;
		}
		let event_name = event.info.event;
		//  debugPrint(event_name);
		// temperature has changed
		if (event_name === "manual") {
			TemperatureHandler.refresh();
			TemperatureHandler.refreshGarage();
		}
		if (event_name === "temperature_change") {
            let sensorId = event.info.id ||
                            (event.info.component && event.info.component.split(":")[1]);
            debugPrint("Temp change from sensor " + sensorId);

            if (sensorId == CONFIG.anturi_garage_id) {
				TemperatureHandler.refreshGarage();
				return; // ignore garage sensor changes
			}
			TemperatureHandler.refresh();
		}
		if (event_name === "up_circulation_temperature") {
			TemperatureHandler.refresh();
		}
	},
	null
);

// check heating up circulation status every  5 minute
Timer.set(
	1000 * 60 * 5, // msec, 5min check  
	true,
	function (user_data) {
		Shelly.emitEvent("up_circulation_temperature", {});
	},
	null
)
Shelly.emitEvent("manual", {});
