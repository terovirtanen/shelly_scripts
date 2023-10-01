// 100 anturi varaaja alakierto
// 101 anturi pannu

let CONFIG = {
	anturi_boiler_id: "101",
	anturi_boiler_name: "Pannu lämpötila",
	anturi_downCirculation_id: "100",
	anturi_downCirculation_name: "Varaaja alakierto lämpötila",
	anturi_downCirculation_offset: 8.0,

	boiler_max_temperature: 75, // pannun max lämpö, ylitys -> kierto päälle
	boiler_min_temperature: 30, // talviajan alaraja
	downCirculation_max_temperature: 60, // kierron max lämpö -> ylitys kierto pois päältä

	debug: false,
	dryrun: false,
}

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
}

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
		// pannun minilämpö alitettu (talvikuukaudet)
		else if (winterTime() && boilerTemperature < CONFIG.boiler_min_temperature) {
			debugPrint("Rule 2");
			switchPump(true);
		}
		// pannun lämpötila alle kierron
		else if (boilerTemperature < downCirculationTemperature) {
			debugPrint("Rule 3");
			switchPump(false);
		}
		// kierron lämpö yli max arvon
		else if (downCirculationTemperature > CONFIG.downCirculation_max_temperature) {
			debugPrint("Rule 4");
			switchPump(false);
		}
		// pannun lämpötila yli kierron lämpötilan
		else if (boilerTemperature > downCirculationTemperature) {
			debugPrint("Rule 5");
			switchPump(true);
		};
	};

	function readTemperatureAlakierto() {
		Shelly.call(
			"Temperature.GetStatus",
			{ "id": CONFIG.anturi_downCirculation_id },
			function (result, error_code, error_message, user_data) {
				debugPrint(result.tC);
				downCirculationTemperature = result.tC;
				setPump();
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

	return { // public interface
		refresh: function () {
			readTemperatureBoiler();
		},
	};
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
		}
		if (event_name === "temperature_change") {
			TemperatureHandler.refresh();
		}
	},
	null
);

Shelly.emitEvent("manual", {});
