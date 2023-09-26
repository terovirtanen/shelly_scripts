// 100 anturi varaaja alakierto
// 101 anturi pannu

let CONFIG = {
	anturi_id_pannu: "101",
	anturi_pannu_name: "Pannu lämpötila", 
	anturi_id_alakierto: "100",
	anturi_alakierto_name: "Varaaja alakierto lämpötila",
	
	debug: true,
	
	pannu_max_temperature: 65,
}

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
}

function setTemperatureComponent() {
  Shelly.call(
    "Temperature.SetConfig",
    { id: CONFIG.anturi_id_alakierto,
	  config: {
		id:	CONFIG.anturi_id_alakierto,
		name: CONFIG.anturi_alakierto_name,
		report_thr_C: 1.0
	  }
	},
    function (response, error_code, error_message) {}
  );
   Shelly.call(
    "Temperature.SetConfig",
    { id: CONFIG.anturi_id_pannu,
	  config: {
		id:	CONFIG.anturi_id_pannu,
		name: CONFIG.anturi_pannu_name,
		report_thr_C: 1.0
	  }
	},
    function (response, error_code, error_message) {}
  );
};
setTemperatureComponent();

function switchPump(activate) {
  debugPrint("activate pump " + activate);
  
  Shelly.call(
    "Switch.Set",
    { id: 0, on: activate },
    function (response, error_code, error_message) {}
  );
};

function setPump(pannuTemperature, alakiertoTemperature) {
	if (pannuTemperature > CONFIG.pannu_max_temperature) {
		switchPump(true);
	}
	else if (pannuTemperature > alakiertoTemperature) {
		switchPump(true);
	}
	else if (pannuTemperature < alakiertoTemperature) {
		switchPump(false);		
	};
}

function readTemperatureAlakierto(pannu_data){
	Shelly.call(
    "Temperature.GetStatus",
    {"id":CONFIG.anturi_id_alakierto},
	function (result, error_code, error_message, user_data) {
		debugPrint(user_data.pannu_temperature);
		debugPrint(result.tC);
		setPump(user_data.pannu_temperature, result.tC);
	},
	pannu_data
  );
};

function readTemperaturePannu() {
	Shelly.call(
    "Temperature.GetStatus",
    {"id":CONFIG.anturi_id_pannu},
	function (result, error_code, error_message, user_data) {
//		debugPrint(result);
		debugPrint(result.tC);
		let pannuTemp = {
			"pannu_temperature": result.tC
		};
		readTemperatureAlakierto(pannuTemp);
	},
	null
  );
};

Shelly.addEventHandler(
    function (event, ud) {
      if (!event || !event.info) {
        return;
      }
      let event_name = event.info.event;
	//  debugPrint(event_name);
	  // temperature has changed
	  if (event_name === "manual") {
		readTemperaturePannu();
      }
	  if (event_name === "temperature_change") {
		readTemperaturePannu();
      }
    },
	null
);

Shelly.emitEvent("manual", {});
