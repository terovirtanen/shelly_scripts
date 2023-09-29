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
  
let EmData ={
	callRemote: function () {
		this.emShelly.call(
			"EMData.GetStatus",
			{ id: 0 },
			this
		);
	},
	getInstance: function (data) {
		let rs = Object.create(this);
		// remove static method
		rs.getInstance = null;
		rs.emShelly = RemoteShelly.getInstance(CONFIG.em_ip);
		rs.user_data = data;
		return rs;
	},
	callback: function (result, error_code, message) {
		print(result);
		print(result.total_act);
		print(result.total_act_ret);
		print(this.user_data);
		this.total_act = result.total_act;
		this._kvsRead();
	},
	_kvsRead: function() {
		Shelly.call(
		  "KVS.GetMany",
		  {id: 0},
		  this._kvsFunction,
		  this
		);
	},
	_kvsFunction: function (result, error_code, error_message, callbackObject) {
		let now = Date(Date.now());
		// print(result);
		// print(user_data);
		 print("aika1:" + result.items.TESTIAIKA.value);
		 callbackObject.kvs_datetime = result.items.TESTIAIKA.value;
		 callbackObject._summary();
	},
	_summary: function() {
		print("summary");
		print("total_act " + this.total_act);
		print("kvs_datetime "+ this.kvs_datetime);

	},
};

let emdata = EmData.getInstance({testi: "testidata"});
emdata.callRemote();

function read_em(user_data) {
	print(user_data)
	let emShelly = RemoteShelly.getInstance(CONFIG.em_ip);

	emShelly.call(
		"EMData.GetStatus",
		{ id: 0 },
		function (result, error_code, message) {
		print(result);
		print(result.total_act);
		print(result.total_act_ret);
		print(user_data);
		}
	);
}
read_em({testi: "loyty"});

// testaukseen vain
function callTest() {
  Shelly.call(
    "Script.List",
    null,
	function (result, error_code, error_message, user_data) {
		print(result);
	},
	null
  );
  // Shelly.call(
    // "KVS.Get",
    // {"key":"EM_TOTAL"},
	// function (result, error_code, error_message, user_data) {
		// print(result.value);
	// },
	// null
  // );
};

function setTotal(key, value) {
  Shelly.call(
    "KVS.Set",
    {"key":key, "value":value},
	function (result, error_code, error_message, user_data) {
		// print(result);
	},
	null
  );
}

function datetimeNowString() {
  let now = Date(Date.now());
  let datetime = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate()+'T'+now.getHours()+':'+now.getMinutes()+':'+now.getSeconds();

  return datetime:
}

function testTime() {
	let now = Date(Date.now());
	let hour = now.getHours();	 

	print(now);
	print(hour);
	let s = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate()+'T'+now.getHours()+':'+now.getMinutes()+':'+now.getSeconds();

	setTotal("TESTIAIKA", datetimeNowString());
};

//callTest();
testTime();


function read_kvs() {
	Shelly.call(
	  "KVS.GetMany",
	  {id: 0},
	  function (result, error_code, error_message, user_data) {
		  let now = Date(Date.now());
		  // print(result);
		  // print(user_data);
		   print("aika1:" + result.items.TESTIAIKA.value);
		  let kvs_time = Date(result.items.TESTIAIKA.value);
		  print ("aika2:" +now.valueOf());
		  print ("aika3:" +kvs_time.valueOf());
		  
		  let diffsec = (now.valueOf()-kvs_time.valueOf()) / 1000;
		  print ("diff secs:" + diffsec);
		  
		  print(now);
		  print(kvs_time);
		  // The valueOf() method returns the primitive value of a date object.
		  // The primitive value is returned as the number of millisecond since midnight January 1, 1970 UTC.
		  let y = now.getFullYear()-50;
		  let m = now.getMonth();
		  let d = now.getDate();
		  let s = (now.getFullYear()-50)+'-'+now.getMonth()+'-'+now.getDate()+'T'+now.getHours()+':'+now.getMinutes()+':'+now.getSeconds();
		  print(s);
		  let now_1= Date(s);
		  print (now_1);
		  let t= (kvs_time.getFullYear()-50)+'-'+kvs_time.getMonth()+'-'+kvs_time.getDate()+'T'+kvs_time.getHours()+':'+kvs_time.getMinutes()+':'+kvs_time.getSeconds();
		  print(t);
		  let kvs_1= Date(t);
		  print (kvs_1);
		  //let kvs_1 = Date.setFullYear(kvs_time.getFullYear()-50, kvs_time.getMonth(), kvs_time.getDate());
		  let diff_sec = (now_1.valueOf()-kvs_1.valueOf()) * 1000
	  },
	  null
	);
  };

//   read_kvs();

