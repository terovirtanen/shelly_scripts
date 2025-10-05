// forecast_reader.js

let CONFIG = {
	forecast_power_max: "FORECAST_POWER_MAX",
	forecast_power: "FORECAST_POWER",
	forecast_store_datetime: "FORECAST_STORETIME",
    forecast_base: "FORECAST_",

    debug: true,    
};

let timerhandle = null;

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
};

let ForecastReader = (function () {
    let forecastPowerMax = -1;
    let forecastPower = -1;
    let forecastStoreDatetime = null;


    function getKvs() {
        Shelly.call(
			"KVS.GetMany",
			{ id: 0, match: CONFIG.forecast_base + '*' },
			function (result, error_code, error_message, user_data) {
                for (let i = 0; i < result.items.length; i++) {
                    let item = result.items[i];

					if (item.key === CONFIG.forecast_power_max) {
					    forecastPowerMax = JSON.parse(item.value);                        
					}
					if (item.key === CONFIG.forecast_power) {
					    forecastPower = JSON.parse(item.value);
					}
                    if (item.key === CONFIG.forecast_store_datetime) {
                        forecastStoreDatetime = Date(item.value);
                    }
                }

                debugPrintValues();
			},
			null
		);
    };

    function debugPrintValues() {
        debugPrint("forecastPowerMax: " + forecastPowerMax);
        debugPrint("forecastPower: " + forecastPower);
        debugPrint("forecastStoreDatetime: " + forecastStoreDatetime);
    }


    return { // public interface
		run: function () {
			getKvs();
		},
	};
})();

ForecastReader.run();