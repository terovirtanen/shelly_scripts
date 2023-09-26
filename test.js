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
//callTest();
testTime();
read_kvs();