// porssisahko_kvs_reader
// kvs format
//   array, array size is 24 (hours 0-23)
//   {"2025-4-24":["10","10","10","10","10","16"]}

let CONFIG = {

	key_porssisahko_today: "PORSSISAHKO_TODAY",
    key_porssisahko_tomorrow: "PORSSISAHKO_TOMORROW",

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
        let hour = new Date().getHours();
        if (!priceData[dateKey]) {
            debugPrint("Error: dateKey not found in priceData.");
            return false;
        }
        let price = priceData[dateKey][hour];
        debugPrint("isUnderLimit: " + dateKey + " hour: " + hour + " price: " + price);
        if (price === undefined || price === null) {
            return false;
        }
        if (parseInt(price) < CONFIG.price_limit) {
            return true;
        }
        return false;
    };

    function getKvs() {
        Shelly.call(
			"KVS.GetMany",
			{ id: 0, match: 'PORSSISAHKO_*' },
			function (result, error_code, error_message, user_data) {
                let val1 = {};
                let val2 = {};
                priceData = {};
                for (let i = 0; i < result.items.length; i++) {
                    let item = result.items[i];

					if (item.key === CONFIG.key_porssisahko_today) {
					    val1 = JSON.parse(item.value);
                        
                        // let key = Object.keys(val)[0];
                        // debugPrint("Porssisahko today: " + key);
					}
					if (item.key === CONFIG.key_porssisahko_tomorrow) {
					    val2 = JSON.parse(item.value);
					}
                }
                
                priceData = Object.assign({}, val1, val2);
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

