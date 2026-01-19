// warehouse_temperatures.js
// Lukee varaston ja ulkolämpötilat ja lähettää ne MQTT:lle
// Anturit: 100 = ulko, 101 = varasto
// mqtt tulee konfiguroida erikseen shelly:lle

let CONFIG = {
	sensor_outdoor_id: "100",
	sensor_warehouse_id: "101",

	mqtt_topic_outdoor: "outdoor/temperature",
	mqtt_topic_warehouse: "warehouse/temperature",

	// Kuinka usein luetaan (ms)
	// read_interval_ms: 60000,

	debug: false,
};

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
}

function datetimeNowToString() {
	let now = Date(Date.now());
	datetime = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + 'T' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();

	return datetime;
};

let TemperatureMqtt = (function () {
	let isRefreshOutdoorRunning = false;
    let isRefreshWarehouseRunning = false;

	function publishTemperature(topic, value) {
		if (!MQTT.isConnected()) {
			debugPrint("MQTT ei ole yhdistettynä, julkaisu ohitetaan");
			return;
		}
		// Shelly-skriptin rajoitusten vuoksi vältä lasketut avaimet
		let key = datetimeNowToString();
		let obj = {};
		obj[key] = value;
		let payload = JSON.stringify(obj);
		MQTT.publish(topic, payload, 0, true);
		debugPrint("Publish -> " + topic + ": " + payload);
	}

	function readTemperatureWarehouse(doneCb) {
		Shelly.call(
			"Temperature.GetStatus",
			{ id: CONFIG.sensor_warehouse_id },
			function (result, error_code, error_message) {
				if (error_code) {
					debugPrint("Warehouse read error: " + error_code + ", " + error_message);
					doneCb && doneCb(false);
					return;
				}
				if (result && result.tC !== undefined) {
                    publishTemperature(CONFIG.mqtt_topic_warehouse, result.tC);
				}
				doneCb && doneCb(true);
			},
			null
		);
	}

	function readTemperatureOutdoor(doneCb) {
		Shelly.call(
			"Temperature.GetStatus",
			{ id: CONFIG.sensor_outdoor_id },
			function (result, error_code, error_message) {
				if (error_code) {
					debugPrint("Outdoor read error: " + error_code + ", " + error_message);
					doneCb && doneCb(false);
					return;
				}
				if (result && result.tC !== undefined) {
                    publishTemperature(CONFIG.mqtt_topic_outdoor, result.tC);
				}
				doneCb && doneCb(true);
			},
			null
		);
	}

	let api = {

        refreshOutdoor: function () {
			if (isRefreshOutdoorRunning) {
				return;
			}
			isRefreshOutdoorRunning = true;

			// Luetaan molemmat anturit peräkkäin
            readTemperatureOutdoor(function () {
                isRefreshOutdoorRunning = false;
            });
		},
        refreshWarehouse: function () {
			if (isRefreshWarehouseRunning) {
				return;
			}
			isRefreshWarehouseRunning = true;

			// Luetaan molemmat anturit peräkkäin
			readTemperatureWarehouse(function () {
                isRefreshWarehouseRunning = false;
			});
		},

        refresh: function () {
            // Käytä paikallista api-viittausta, ei globaalia nimeä
            api.refreshOutdoor();
            api.refreshWarehouse();
        },
	};

    return api;
})();

// Tapahtumankäsittelijä: manuaali ja anturitapahtumat
Shelly.addEventHandler(
	function (event) {
		if (!event || !event.info) {
			return;
		}
		let event_name = event.info.event;
		if (event_name === "temperature_change") {
            let sensorId = event.info.id ||
                            (event.info.component && event.info.component.split(":")[1]);
            debugPrint("Temp change from sensor " + sensorId);

            if (sensorId == CONFIG.sensor_outdoor_id) {
                TemperatureMqtt.refreshOutdoor();
            } else if (sensorId == CONFIG.sensor_warehouse_id) {
                TemperatureMqtt.refreshWarehouse();
            } else {
                // Tuntematon ID → halutessa luetaan molemmat
                TemperatureMqtt.refresh();
            }            
		}
	},
	null
);

// // Ajoitetaan myös säännöllinen lukeminen
// Timer.set(CONFIG.read_interval_ms, true, function () {
// 	TemperatureMqtt.refresh();
// });

// Ensimmäinen lukeminen heti käynnistyksessä
TemperatureMqtt.refresh();