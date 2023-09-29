// 100 anturi varaaja alakierto
// 101 anturi pannu

let CONFIG = {
	anturi_id_pannu: "101",
	anturi_pannu_name: "Pannu lämpötila",
	anturi_id_alakierto: "100",
	anturi_alakierto_name: "Varaaja alakierto lämpötila",

	boiler_max_temperature: 65,

	debug: true,
	dryrun: true,
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
			id: CONFIG.anturi_id_alakierto,
			config: {
				id: CONFIG.anturi_id_alakierto,
				name: CONFIG.anturi_alakierto_name,
				report_thr_C: 1.0
			}
		},
		function (response, error_code, error_message) { }
	);
	Shelly.call(
		"Temperature.SetConfig",
		{
			id: CONFIG.anturi_id_pannu,
			config: {
				id: CONFIG.anturi_id_pannu,
				name: CONFIG.anturi_pannu_name,
				report_thr_C: 1.0
			}
		},
		function (response, error_code, error_message) { }
	);
};

let TemperatureHandler = (function () {
	let boilerTemperature;
	let downCirculationTemperature;

	function setPump() {
		if (boilerTemperature > CONFIG.boiler_max_temperature) {
			switchPump(true);
		}
		else if (boilerTemperature > downCirculationTemperature) {
			switchPump(true);
		}
		else if (boilerTemperature < downCirculationTemperature) {
			switchPump(false);
		};
	}

	function readTemperatureAlakierto() {
		Shelly.call(
			"Temperature.GetStatus",
			{ "id": CONFIG.anturi_id_alakierto },
			function (result, error_code, error_message, user_data) {
				debugPrint(user_data.pannu_temperature);
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
			{ "id": CONFIG.anturi_id_pannu },
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
