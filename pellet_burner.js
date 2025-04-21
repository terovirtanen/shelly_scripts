
// Shelly PM1 
// burner controller
let CONFIG = {
	upCirculation_limit_high_temperature: 65, // kierron ylä lämpö yläraja -> yli, pellettipoltin pois päältä
	upCirculation_limit_low_temperature: 51, // kierron ylä lämpö alaraja -> alle, pellettipoltin päälle

	upCirculation_limit_afternoon_temperature: 61, // kierron ylä lämpö iltapäivällä -> alle, pellettipoltin päälle, lämmitetään iltaa varten

	boiler_limit_low_temperature: 43, // pannun alalämpötila, kierron alaraja on 40

    burner_starting_current: 2.0, // ??? sytytysvastus päällä
    burner_running_current: 0.65, // 0.2 - 0.7
    burner_idle_current: 0.02, // 0.02
    burner_starting_limit_current: 1.0, 
    burner_running_limit_current: 0.1,     

	key_boiler_temperature: "BOILER_TEMPERATURE",
	key_boiler_store_datetime: "BOILER_STORETIME",
	key_up_circulation_temperature: "UP_CIRCULATION_TEMPERATURE",
	key_up_circulation_store_datetime: "UP_CIRCULATION_STORETIME",

	debug: false,
	dryrun: false,
}

let timerhanlde = null;

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
}

function switchBurner(activate) {
	debugPrint("activate burner " + activate);

	if (CONFIG.dryrun) {
		return;
	}

	Shelly.call(
		"Switch.Set",
		{ id: 0, on: activate },
		function (response, error_code, error_message) { }
	);
};

let BurnerHandler = (function () {
    let current_now;
	
    let upCirculationTemperature; // -1 if outdated
	let upCirculationDatetime;

    let boilerTemperature; // -1 if outdated
	let boilerDatetime;

    function running() {
        if (current_now > CONFIG.burner_running_limit_current) {
            return true;
        }
        return false;
    };

    function isAfternoon() {
        let hour = Date(Date.now()).getHours();
        if (hour > 17 && hour < 22) {
            return true;
        }
        return false;
    };

    function action() {
		debugPrint("Polttimen kytkentä/sammutus");
        let afternoon = isAfternoon();

        // no temperature data, turn burner on just in case
        if (upCirculationTemperature < 0 && afternoon) {
            switchBurner(true);
        }
		// boiler temperature is under limit
		else if (boilerTemperature < CONFIG.boiler_limit_low_temperature ) {
            switchBurner(true);
		}
        // no need to heat water
        else if (upCirculationTemperature > CONFIG.upCirculation_limit_high_temperature){
            switchBurner(false);
        }
        // heat is needed
        else if (upCirculationTemperature < CONFIG.upCirculation_limit_low_temperature){
            switchBurner(true);
        }
        // afternoon, limit is tighter
        else if (afternoon && upCirculationTemperature < CONFIG.upCirculation_limit_afternoon_temperature){
            switchBurner(true);
        };
    };

	function readKvs() {
		Shelly.call(
			"KVS.GetMany",
			{ id: 0 },
			function (result, error_code, error_message, user_data) {
                for (let i = 0; i < result.items.length; i++) {
                    let item = result.items[i];

					if (item.key === CONFIG.key_up_circulation_temperature) {
						upCirculationTemperature = item.value;
					}
					if (item.key === CONFIG.key_up_circulation_store_datetime) {
						upCirculationDatetime = item.value;
					}
					if (item.key === CONFIG.key_boiler_temperature) {
						boilerTemperature = item.value;
					}
					if (item.key === CONFIG.key_boiler_store_datetime) {
						boilerDatetime = item.value;
					}
                }

				let now = Date(Date.now());

				// up circulation temperature
				let diffsec = (now.valueOf() - upCirculationDatetime.valueOf()) / 1000;
				// timestamp is older than 30 min (2* em measurement period), em data is outdated
				if (diffsec > (60 * 5)) {
					debugPrint("upCirculation Error: data outdated!");
					upCirculationTemperature = -1;
				}

				// boiler temperature
				let boilerDiffsec = (now.valueOf() - boilerDatetime.valueOf()) / 1000;
				// timestamp is older than 30 min (2* em measurement period), em data is outdated
				if (boilerDiffsec > (60 * 5)) {
					debugPrint("boiler Error: data outdated!");
					boilerTemperature = -1;
				}				

				action();
			},
			null
		);
	};

    function readCurrent() {
		Shelly.call(
			"Switch.GetStatus",
			{ id: 0 },
			function (result, error_code, error_message) {
                debugPrint(result.current);
                current_now = result.current;
                // debugPrint(result.aenergy);
                if (! running()) {
                    readKvs();
                }
			},
			null
		);
	};


	return { // public interface
		refresh: function () {
			readCurrent();
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
		// temperature has changed
		if (event_name === "manual") {
			BurnerHandler.refresh();
		}
		if (event_name === "current_change") { //  when the current has changed with at least 0.05A and 5% from the last reported value.
			BurnerHandler.refresh();
		}
		if (event_name === "quaterly") {
			BurnerHandler.refresh();
		}
	},
	null
);

function setTimer() {
	// let now = Date(Date.now());
	// let minutes = 15 - (now.getMinutes() % 15);// 15min välein 
	// let seconds = now.getSeconds(); // sekunnit 0:aan

	// // msec
	// let timercount = (minutes * 60 - seconds) * 1000;
	let timercount = 1000 * 60; // msec, 1min check  

	Timer.clear(timerhanlde);

	return Timer.set(
		timercount,
		false,
		function (user_data) {
			Shelly.emitEvent("quaterly", {});
			timerhanlde = setTimer();
		},
		null
	)
}

Shelly.emitEvent("manual", {});
timerhanlde = setTimer();
