let CONFIG = {
    latitude: 60.65000, // Koski Tl
    longitude: 23.15000,

    panelTilt: 22, // panle tilt 1:2,5
    peakPower:  8100, // Peak power of the panel in watts
    panelEfficiency: 1.00, // Assume the panel efficiency is 90%

    url_forecast_fmi: "https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::forecast::edited::weather::scandinavia::point::timevaluepair&place=koski_tl&parameters=totalcloudcover&",

    debug: true,
    
};
print("starting");

function debugPrint(line) {
	if (CONFIG.debug) {
		print(line);
	}
};
//
// A remote Shelly abstraction Call an RPC method on the remote Shelly
let ForecastFmi = {
	_cb: function (result, error_code, error_message, callback) {
        debugPrint("ForecastFmi _cb");
        debugPrint(error_code);
        debugPrint(error_message);
        debugPrint(result);
		if (result === undefined) {
			return;
		}
        debugPrint(result.code);
        debugPrint(result.message);
		let rpcResult = result.body;
		let rpcCode = result.code;
		let rpcMessage = result.message;
		callback(rpcResult, rpcCode, rpcMessage);
	},

	call: function (callback) {
		let getData = {
			url: CONFIG.url_forecast_fmi
		};
        debugPrint("ForecastFmi call");
		Shelly.call("HTTP.GET", getData, ForecastFmi._cb, callback);
	},
	getInstance: function () {
		let rs = Object.create(this);
		// remove static method
		rs.getInstance = null;
		return rs;
	},
};


let Forecast = (function () {
    let cloudTimes = [];

    
    function getFmiForecast() {
        let forecastFmi = ForecastFmi.getInstance();
    
        forecastFmi.call(
            function (body, code, message) {
                debugPrint(body);
                debugPrint(code);
                debugPrint(message);
            }
        );
    };

    return { // public interface
		run: function () {
			getFmiForecast();
		},
	};
})();

Forecast.run();