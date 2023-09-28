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

};

let LATEST_DATA = {};
let LATEST_DATA2 = {};
let SOLAR_ACTIVATED = false;
//
// A remote Shelly abstraction Call an RPC method on the remote Shelly
let RemoteShelly = {
  _cb: function (result, error_code, error_message, callback) {
	if (result === undefined) {
		return;
	}
    let rpcResult = JSON.parse(result.body);
    let rpcCode = result.code;
    let rpcMessage = result.message;
    callback(rpcResult, rpcCode, rpcMessage, this.user_data);
  },
  composeEndpoint: function (method) {
    return "http://" + this.address + "/rpc/" + method;
  },
  call: function (rpc, data, callback) {
    let postData = {
      url: this.composeEndpoint(rpc),
      body: data,
    };
    Shelly.call("HTTP.POST", postData, RemoteShelly._cb, callback, this.user_data);
  },
  getInstance: function (address, user_data) {
    let rs = Object.create(this);
    // remove static method
    rs.getInstance = null;
    rs.address = address;
	rs.user_data = user_data;
    return rs;
  },
};

function switchVastus(activate) {
  // print("activate vastus " + activate);
  
  if (!activate) {
	SOLAR_ACTIVATED = false;
  }

  Shelly.call(
    "Switch.Set",
    { id: 0, on: activate },
    function (response, error_code, error_message) {}
  );
};

function callPowerUsage(user_data) {
	// print(user_data);
	LATEST_DATA2=user_data;
  Shelly.call(
    "KVS.GetMany",
    {id: 0},
	function (result, error_code, error_message, user_data) {
		let now = Date(Date.now());
		// print(result);
		// print(user_data);
		// print(LATEST_DATA2);
		let temp = LATEST_DATA2.temp_ylakierto;
		let current_total_act = LATEST_DATA2.total_act;
		let current_total_act_ret = LATEST_DATA2.total_act_ret;

		let old_total_act = result.items.EM_TOTAL.value;
		let old_total_act_ret = result.items.EM_TOTAL_RET.value;
		
		let powerUsed = current_total_act - old_total_act;
		let powerRet = current_total_act_ret - old_total_act_ret;
		
		let powerSummary = powerUsed-powerRet;
		// print(powerSummary);
		// välillä 100 .. -100 ei muuteta vastuksen tilaa
		// käytetty enemmän kuin tuotettu, sammutetaan vastus
		if(powerSummary > CONFIG.power_limit && SOLAR_ACTIVATED) {
			switchVastus(false);
		}
		// tuotettu enemmän kuin kulutettu, käynnistetään vastus
		else if (powerSummary < (CONFIG.power_limit * -1)) {
			SOLAR_ACTIVATED = true;
			switchVastus(true);
		}
	},
	null
  );
}
function callEmTotal(user_data) {
  let emShelly = RemoteShelly.getInstance(CONFIG.em_ip, user_data);
  LATEST_DATA = user_data;
  
  emShelly.call(
    "EMData.GetStatus",
    {id: 0},
	function (result, error_code, error_message, user_data) {
		// print(result);
		// print(LATEST_DATA);
		
		// print(user_data);
		let currentData = {
			"temp_ylakierto": LATEST_DATA.temp_ylakierto,
			"total_act": result.total_act,
			"total_act_ret": result.total_act_ret
		}
		callPowerUsage(currentData);
	},
	null
  );
}

function callGetTemperature(id) {
  Shelly.call(
    "Temperature.GetStatus",
    {"id": id},
	function (result, error_code, error_message, user_data) {
		let now = Date(Date.now());
		let hour = now.getHours();

		let min_temp = (hour > 17 && hour < 22) ? CONFIG.temp_min_activetime : CONFIG.temp_min;
		let max_temp = (SOLAR_ACTIVATED) ? CONFIG.temp_max_solar : min_temp + CONFIG.temp_heating;
//		print(result);
		let temp = result.tC;
//		print(temp);
		if (temp < min_temp) {
			switchVastus(true); 
		} 
		else if (temp > max_temp) {
			switchVastus(false); 
		} 
		callEmTotal({"temp_ylakierto": temp})
	},
	null
  );
}
function switchHeater() {
	callGetTemperature(CONFIG.anturi_id_ylakierto);
}

Shelly.addEventHandler(
    function (event, ud) {
      if (!event || !event.info) {
        return;
      }
      let event_name = event.info.event;
	//  print(event_name);
	  if (event_name === "switchHeater") {
		switchHeater();
      }
	  // temperature has changed
	  else if (event_name === "temperature_change") {
		switchHeater();
      }
    },
	null
);

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
setTemperatureComponent();

Timer.set(	
	1000*60, // msec, 1min check  
	true,
	function (user_data) {
		Shelly.emitEvent("switchHeater", {});
	},
	null
)
Shelly.emitEvent("switchHeater", {});

