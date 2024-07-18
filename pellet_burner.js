
// Shelly PM1 
let CONFIG = {
	upCirculation_limit_temperature: 65, // kierron ylä lämpö -> alle, pellettipoltin päälle

    burner_starting_current: 0.85, //??
    burner_running_current: 0.65, // 0.239 - 0.652
    burner_idle_current: 0.02, // 0.023
    burner_running_limit_current: 0.1, 

	debug: true,
	dryrun: true,
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

    function running() {
        if (current_now > burner_running_limit_current) {
            return true;
        }
        return false;
    };


    function readCurrent() {
		Shelly.call(
			"Switch.GetStatus",
			{ id: 0 },
			function (result, error_code, error_message) {
                debugPrint(result.current);
                current_now = result.current;
                // debugPrint(result.aenergy);
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
	let now = Date(Date.now());
	let minutes = 15 - (now.getMinutes() % 15);// 15min välein 
	let seconds = now.getSeconds(); // sekunnit 0:aan

	// msec
	let timercount = (minutes * 60 - seconds) * 1000;

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
