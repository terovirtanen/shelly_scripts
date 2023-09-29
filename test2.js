let CONFIG = {
	em_ip: "192.168.100.100",
};
print("starting");
//
// A remote Shelly abstraction Call an RPC method on the remote Shelly
let RemoteShelly = {
	_cb: function (result, error_code, error_message, callbackObject) {
		if (result === undefined) {
		  return;
		}
	  let rpcResult = JSON.parse(result.body);
	  let rpcCode = result.code;
	  let rpcMessage = result.message;
	  callbackObject.callback(rpcResult, rpcCode, rpcMessage);
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
  
let EmData = (function () {
	let emShelly = null;
	let kvs_datetime = null;
	let kvs_datetime2 = null;
	let user_data;
	let user_data2;

	function _kvsRead() {
		Shelly.call(
		  "KVS.GetMany",
		  {id: 0},
		  _kvsFunction,
		  this
		);
	};
	function _kvsFunction (result, error_code, error_message, callbackObject) {
		let now = Date(Date.now());
		// print(result);
		// print(user_data);
		 print("aika1:" + result.items.TESTIAIKA.value);
		 kvs_datetime = result.items.TESTIAIKA.value;
		 _summary();
	}; 
	function _summary() {
		print("summary");
		print("user_data ");
		print(user_data);
		print("user_data2 ");
		print(user_data2);
		print("total_act " + total_act);
		print("kvs_datetime "+ kvs_datetime);
		print("kvs_datetime2 "+ kvs_datetime2);

	};
	// let instance;

    function initial(data) {
		emShelly = RemoteShelly.getInstance(CONFIG.em_ip);
		user_data = data;
    };
	return { // public interface
		userData: function (data) {user_data2 = data;},
		callRemote: function () {
			emShelly.call(
				"EMData.GetStatus",
				{ id: 0 },
				this
			);
		},
		callback: function (result, error_code, message) {
			total_act = result.total_act;
			_kvsRead();
		},
		init: function(data){
			initial(data);
		},
	};
})();

EmData.init({testi: "testidata"});
EmData.userData ( {testi: "testidata22"});
EmData.callRemote();
