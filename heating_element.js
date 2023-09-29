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
};

let LATEST_DATA = {};
let LATEST_DATA2 = {};
let SOLAR_ACTIVATED = false;

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
}

function setTemperatureComponent() {
	Shelly.call(
		"Temperature.SetConfig",
		{ id: CONFIG.anturi_id_ylakierto,
		config: {
			id:	CONFIG.anturi_id_ylakierto,
			name: "yläkierto lämpötila",
			report_thr_C: 1.0
		}
		},
		function (response, error_code, error_message) {}
	);
};

//
// A remote Shelly abstraction Call an RPC method on the remote Shelly
let RemoteShelly = {
	_cb: function (result, error_code, error_message, callbackObject) {
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
  // debugPrint("activate vastus " + activate);
  
  if (!activate) {
	SOLAR_ACTIVATED = false;
  }

  Shelly.call(
    "Switch.Set",
    { id: 0, on: activate },
    function (response, error_code, error_message) {}
  );
};

let Heater = (function () {
	let upCirculationTemperature;
	let emTotalAct;
	let emTotalActRet;
	let prevEmTotalAct;
	let prevEmTotalActRet;

	function action() {
		let now = Date(Date.now());
		let hour = now.getHours();

		let min_temp = (hour > 17 && hour < 22) ? CONFIG.temp_min_activetime : CONFIG.temp_min;
		let max_temp = (SOLAR_ACTIVATED) ? CONFIG.temp_max_solar : min_temp + CONFIG.temp_heating;

		let powerSummary = null; 
		if (emTotalAct != null) {
			let powerUsed = emTotalAct - prevEmTotalAct;
			let powerRet = emTotalActRet - prevEmTotalActRet;
			powerSummary = powerUsed-powerRet;
		}

		if (temp < min_temp) {
			switchVastus(true); 
		} 
		else if(powerSummary != null && powerSummary > CONFIG.power_limit && SOLAR_ACTIVATED) {
			switchVastus(false);
		}
		else if (powerSummary != null && powerSummary < (CONFIG.power_limit * -1)) {
			SOLAR_ACTIVATED = true;
			switchVastus(true);
		}
		else if (temp > max_temp) {
			switchVastus(false); 
		} 

	};

	function previousEmTotal() {
		Shelly.call(
			"KVS.GetMany",
			{id: 0},
			function (result, error_code, error_message, user_data) {
				prevEmTotalAct = result.items.EM_TOTAL.value;
				prevEmTotalActRet = result.items.EM_TOTAL_RET.value;

				action();
			},
			null
		  );
		
	};

	function getEmTotalCallback(result, error_code, error_message, user_data) {
		if (result !== null) {
			emTotalAct=result.total_act;
			emTotalActRet=result.total_act_ret;
		}
		  // debugPrint(result);
		  // debugPrint(LATEST_DATA);
		  // debugPrint(user_data);
		  let currentData = {
			  "temp_ylakierto": LATEST_DATA.temp_ylakierto,
			  "total_act": result.total_act,
			  "total_act_ret": result.total_act_ret
		  }
		  previousEmTotal();
	};

	function getEmTotal() {
		let emShelly = RemoteShelly.getInstance(CONFIG.em_ip);
		LATEST_DATA = user_data;
		
		emShelly.call(
		  "EMData.GetStatus",
		  {id: 0},
		  this
		);
	};
	  
	function callGetTemperature(id) {
		Shelly.call(
		  "Temperature.GetStatus",
		  {"id": id},
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
		refresh: function() {
			callGetTemperature(CONFIG.anturi_id_ylakierto);
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
	1000*60, // msec, 1min check  
	true,
	function (user_data) {
		Shelly.emitEvent("switchHeater", {});
	},
	null
)
Shelly.emitEvent("switchHeater", {});

