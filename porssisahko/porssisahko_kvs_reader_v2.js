// porssisahko_kvs_reader
// kvs format in hour kvs
//   PORSSISAHKO_<hour>
//   date: array, array size is 4 (hour quaters 0-3)
//  {"2025-10-5": [0,0,0,0]}

let CONFIG = {

	key_base: "PORSSISAHKO_",
    // price limit in cents
    price_limit: 12,

    debug: true,
    
};

let timerhanlde = null;

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
};

let PorssisahkoReader = (function () {
    let priceData = {};


    function getPorssisahkoKvsDateFormat() {
        let dateKey = new Date();
        let formattedDate = dateKey.getFullYear() + '-' + (dateKey.getMonth() + 1 ) + '-' + dateKey.getDate();

        return formattedDate;
    };
    function isUnderLimit() {
        let dateKey = getPorssisahkoKvsDateFormat();
        let quarter = Math.floor(new Date().getMinutes() / 15);
        if (!priceData[dateKey]) {
            debugPrint("Error: dateKey not found in priceData.");
            return false;
        }
        let price = priceData[dateKey][quarter];
        debugPrint("isUnderLimit: " + dateKey + " quarter: " + quarter + " price: " + price);
        if (price === undefined || price === null) {
            return false;
        }
        if (parseInt(price) < CONFIG.price_limit) {
            return true;
        }
        return false;
    };

    function getKvs() {
        let hour = new Date().getHours();

        Shelly.call(
			"KVS.Get",
			{ id: 0, key: CONFIG.key_base + hour },
			function (result, error_code, error_message, user_data) {
                let value = result ? JSON.parse(result.value) : null;


                priceData = {};


                priceData = Object.assign({}, value);
                // let t = JSON.stringify(priceData);
                // debugPrint("Porssisahko data: ");
                // debugPrint(t);
                if (isUnderLimit()) {
                    debugPrint("Porssisahko price under limit!");
                }
			},
			null
		);
    };


    return { // public interface
		run: function () {
			getKvs();
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
		if (event_name === "porssisahko_refresh") {
			debugPrint("Porssisahko event!");
            PorssisahkoReader.run();
		}

	},
	null
);

