// const fetch = require('node-fetch');
import fetch from "node-fetch";
import SunCalc from "suncalc";

const latitude = 60.65000; // Koski Tl
const longitude = 23.15000;

const panelTilt = 22; // panle tilt 1:2,5
const peakPower = 8100; // Peak power of the panel in watts
const panelEfficiency = 1.00; // Assume the panel efficiency is 90%


let cloudTimes = [];
let sunrise;
let sunset;

const url_forecast_fmi = "https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::forecast::edited::weather::scandinavia::point::timevaluepair&place=koski_tl&parameters=totalcloudcover&";

// sallitut parametrit tästä linkistä             <om:observedProperty  xlink:href="https://opendata.fmi.fi/meta?observableProperty=forecast&amp;param=Pressure,GeopHeight,Temperature,DewPoint,Humidity,WindDirection,WindSpeedMS,WindUMS,WindVMS,PrecipitationAmount,TotalCloudCover,LowCloudCover,MediumCloudCover,HighCloudCover,RadiationGlobal,RadiationGlobalAccumulation,RadiationNetSurfaceLWAccumulation,RadiationNetSurfaceSWAccumulation,RadiationSWAccumulation,Visibility,WindGust&amp;language=eng"/>

// forecast
(async () => {
  try {
    const res = await fetch(url_forecast_fmi);
    // const headerDate = res.headers && res.headers.get('date') ? res.headers.get('date') : 'no response date';
    console.log('Status Code:', res.status);
    // console.log('Date in Response header:', headerDate);
    
    const response = await res.text();

    // console.log('response:', response);
    responseHandler(response);

    DailyPowerEstimation();

  } catch (err) {
    console.log(err.message); //can be console.error
  }
})();

function DailyPowerEstimation() {
  let dayPower = 0;
  let date;
  cloudTimes.forEach(item => {
    if (!date) {
      date = item[0];
    }
    if (item[0].getDate() !== date.getDate()) {
      console.log(`Estimated Solar Power on ${date.toLocaleString('fi-FI', { hour12:false })}  is : ${dayPower.toFixed(2)} Wh`);
      date = item[0];
      dayPower = 0;
    }
    dayPower += item[2] * (1- (item[1] / 100));
  });
  console.log(`Estimated Solar Power on ${date.toLocaleString('fi-FI', { hour12:false })}  is : ${dayPower.toFixed(2)} Wh`);
}

function responseHandler(response, debug = false) {
    // Split the text into lines
    const lines = response.split('\n');

    //  <wml2:point>
    //      <wml2:MeasurementTVP>
    //               <wml2:time>2024-08-28T18:00:00Z</wml2:time>
    //               <wml2:value>19.9</wml2:value>
    //      </wml2:MeasurementTVP>
    //  </wml2:point>
        // Define the regular expression to match
    const regexTime = /<wml2:time>(.*)</; // Replace with your actual regex pattern
    const regexValue = /<wml2:value>(.*)</; // Replace with your actual regex pattern

    // Loop through each line and process it
    lines.forEach((line, index) => {
      const timeMatch = line.match(regexTime);
      
      if (timeMatch) {
        if (debug) console.log(`Time: ${timeMatch[1]}`);

        // value is in the next line
        const nextLine = lines[index + 1];
        const valueMatch = nextLine.match(regexValue);
        if (debug) console.log(`Value: ${valueMatch[1]}`);

        forecast(timeMatch[1], valueMatch[1]);
      }
    });
}

function forecast(date, value) {
  // const time =  new Date(value.dt_txt).toLocaleString('fi-FI', { hour12:false } );
  const time =  new Date(date);
  const cloud = parseFloat(value);

  const power = calculateSolarPowerSummary(time);
  cloudTimes.push([time, cloud, power]);
}

function calculateSolarPowerSummary(date, debug = false) {
  if (debug) console.log(`Date: ${date}`);
  // East-facing panels
  const eastAzimuth = -90; // East direction
  const eastPower = calculateSolarPower(date, panelTilt, eastAzimuth, peakPower / 2, false);

  // West-facing panels
  const westAzimuth = 90; // West direction
  const westPower = calculateSolarPower(date, panelTilt, westAzimuth, peakPower / 2, false);

  const totalPower = eastPower + westPower;
  if (debug) console.log(`  Estimated Total Power: ${totalPower.toFixed(2)} W`);
  if (debug) console.log('');
  return totalPower;
}

function calculateSolarPower(date, panelTilt, panelAzimuth,  peakPower, debug = false) {
  const sunPosition = getSunPosition(latitude, longitude, date, debug); // date is UTC time


    // const panelTilt = 18; // Assume the panel is tilted at 30 degrees
    // const panelAzimuth = 90; // Assume the panel faces west
  const incidentAngle = calculateIncidentAngle(sunPosition.altitude, panelTilt, panelAzimuth, sunPosition.azimuth, false);
  
  //  const cos1 = 1- Math.cos(54 * Math.PI / 180);
  //  console.log(`  cos1: ${cos1.toFixed(2)}`);
  const cos = 1 - Math.cos(incidentAngle * Math.PI / 180);
  const sin = Math.sin(incidentAngle * Math.PI / 180);
  if (debug) {
    console.log(`  incidentAngle: ${incidentAngle.toFixed(2)}°`);
    // console.log(`  incidentAngle cos: ${cos.toFixed(2)}`);
    // console.log(`  incidentAngle sin: ${sin.toFixed(2)}`);
  }

  // näillä arvoilla menee tarpeeksi lähelle mitä on mitattu 5.6.2024
  let fix = 1.00;
  if (incidentAngle < 35) { fix = 0.80; }
  if (incidentAngle < 25) { fix = 0.60; }
  if (incidentAngle > 60) { fix = 0.92; }
  if (incidentAngle > 70) { fix = 0.85; }

  const maxIncidentAngle = latitude;
  const fixFactory = 1 / (1- Math.cos(maxIncidentAngle * Math.PI / 180));
  // console.log(`  fixFactory: ${fixFactory.toFixed(2)}`);
  const power = incidentAngle < 1 ? 0 : peakPower *fix * panelEfficiency * fixFactory * ( 1 - Math.cos(incidentAngle * Math.PI / 180));
  
  if (debug) {
    console.log(`  power: ${power.toFixed(2)} W`);
  }

  return power > 0 ? power : 0;
}

function calculateIncidentAngle(sunAltitude, panelTilt, panelAzimuth, sunAzimuth, debug = false) {
  // east is negative sun azimuth
  // west is positive sun azimuth
  const azMin = -90 + panelAzimuth;
  const azMax = 90 + panelAzimuth;
  let AzimuthDirection = 1; // aurinko paistaa paneelin edestä 1 tai takaa -1
  if (sunAzimuth < azMin || sunAzimuth > azMax) {
    // return 0;
    AzimuthDirection = -1;
  }
  if (sunAltitude <= 0) { // Check if the Sun is above the horizon
    return 0;
  }

  // kohtauskulma
  // const panelTilt = 18; // Assume the panel is tilted at 30 degrees
  const tiltAngle = (AzimuthDirection * panelTilt) + sunAltitude;

  // paneelin kohatuskulma on negatiivinen, ei tuota energiaa
  if (tiltAngle < 0) {
    return 0;
  }

  return tiltAngle;
}

function getSunPosition(latitude, longitude, date, debug = false) {
  const sunPosition = SunCalc.getPosition(date, latitude, longitude);
  const azimuth = sunPosition.azimuth * 180 / Math.PI;
  const altitude = sunPosition.altitude * 180 / Math.PI;

  if (debug) {
    console.log(`Date: ${date}`);
    console.log(`  Azimuth: ${azimuth.toFixed(2)}°`);
    console.log(`  Altitude: ${altitude.toFixed(2)}°`);
  }

  return { azimuth, altitude };
}



/*
~$ curl "https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::forecast::edited::weather::scandinavia::point::timevaluepair&place=koski_tl&parameters=totalcloudcover&"
<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection
    timeStamp="2024-08-28T18:15:41Z"
    numberMatched="1"
    numberReturned="1"
    xmlns:wfs="http://www.opengis.net/wfs/2.0"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:om="http://www.opengis.net/om/2.0"
    xmlns:omso="http://inspire.ec.europa.eu/schemas/omso/3.0"
    xmlns:ompr="http://inspire.ec.europa.eu/schemas/ompr/3.0"
    xmlns:gml="http://www.opengis.net/gml/3.2"
    xmlns:gmd="http://www.isotc211.org/2005/gmd"
    xmlns:gco="http://www.isotc211.org/2005/gco"
    xmlns:swe="http://www.opengis.net/swe/2.0"
    xmlns:gmlcov="http://www.opengis.net/gmlcov/1.0"
    xmlns:sam="http://www.opengis.net/sampling/2.0"
    xmlns:sams="http://www.opengis.net/samplingSpatial/2.0"
    xmlns:wml2="http://www.opengis.net/waterml/2.0"
    xmlns:target="http://xml.fmi.fi/namespace/om/atmosphericfeatures/1.1"
    xsi:schemaLocation="http://www.opengis.net/wfs/2.0 http://schemas.opengis.net/wfs/2.0/wfs.xsd
    http://www.opengis.net/gmlcov/1.0 http://schemas.opengis.net/gmlcov/1.0/gmlcovAll.xsd
    http://www.opengis.net/sampling/2.0 http://schemas.opengis.net/sampling/2.0/samplingFeature.xsd
    http://www.opengis.net/samplingSpatial/2.0 http://schemas.opengis.net/samplingSpatial/2.0/spatialSamplingFeature.xsd
    http://www.opengis.net/swe/2.0 http://schemas.opengis.net/sweCommon/2.0/swe.xsd
    http://inspire.ec.europa.eu/schemas/omso/3.0 https://inspire.ec.europa.eu/schemas/omso/3.0/SpecialisedObservations.xsd
    http://inspire.ec.europa.eu/schemas/ompr/3.0 https://inspire.ec.europa.eu/schemas/ompr/3.0/Processes.xsd
    http://www.opengis.net/waterml/2.0 http://schemas.opengis.net/waterml/2.0/waterml2.xsd
    http://xml.fmi.fi/namespace/om/atmosphericfeatures/1.1 https://xml.fmi.fi/schema/om/atmosphericfeatures/1.1/atmosphericfeatures.xsd">


    <wfs:member>
        <omso:PointTimeSeriesObservation gml:id="WFS-ayp1jEPmo0ONndYP7PxTjKyYmQaJTowoYmbbpdOs2_llx4efR06y5NPTLkdOu.XD00ZeTp1zx4d2TTuw9tOF064b9O7o6ddNO3L2w7OuXhh08oWliy59O6pp25bVH8Kh42zQRGNj5c61ItCnHdOmjJq4Z2XdkqaduW1R_Cofts0ERwZtO7JOy4eWXn0rYdmnJIZmfLv05OdZjZqxYN27o15fPffyyX9_bLy78tPTDi2ZYmlsy9suyp54ZamZs348OzLWpm0340ld16ZnDW24fETTz6Yd2PLStXQgNbbp589O7PUy.OlY07DOZW3fky7K3uGHZf568O7Jp3Ye2nCyuGHlh21vdN_TDsx7N_XJj39svJuc.m_llyceuXl5v6clYYmbbpdOs2_llx4efR06y5NPTLkdOu.XD00ZeTp1zx4d2TTuw9tOF064b9O7o6ddNO3L2w7OuXhh08mh007ctPpl4T8hNDpp25bW_dlrGq1IYA---totalcloudcover">
                             <om:phenomenonTime>
                <gml:TimePeriod gml:id="time-interval-1-1">
                    <gml:beginPosition>2024-08-28T19:00:00Z</gml:beginPosition>
                    <gml:endPosition>2024-08-31T18:00:00Z</gml:endPosition>
                </gml:TimePeriod>
            </om:phenomenonTime>
            <om:resultTime>
                <gml:TimeInstant gml:id="time-1-1">
                    <gml:timePosition>2024-08-28T17:33:53Z</gml:timePosition>
                </gml:TimeInstant>
            </om:resultTime>

            <om:procedure xlink:href="http://xml.fmi.fi/inspire/process/pal_skandinavia"/>
                        <om:parameter>
                <om:NamedValue>
                    <om:name xlink:href="https://inspire.ec.europa.eu/codeList/ProcessParameterValue/value/numericalModel/analysisTime"/>
                    <om:value>
                        <gml:TimeInstant gml:id="analysis-time-1-1-totalcloudcover--">
                            <gml:timePosition>2024-08-28T17:28:00Z</gml:timePosition>

                        </gml:TimeInstant>
                    </om:value>
                </om:NamedValue>
            </om:parameter>

            <om:observedProperty  xlink:href="https://opendata.fmi.fi/meta?observableProperty=forecast&amp;param=totalcloudcover&amp;language=eng"/>
                        <om:featureOfInterest>
                <sams:SF_SpatialSamplingFeature gml:id="enn-s-1-1-totalcloudcover">
          <sam:sampledFeature>
                <target:LocationCollection gml:id="sampled-target-1-1-totalcloudcover">
                    <target:member>
                    <target:Location gml:id="forloc-geoid-651077-pos-totalcloudcover">
                        <gml:identifier codeSpace="http://xml.fmi.fi/namespace/stationcode/geoid">651077</gml:identifier>
                        <gml:name codeSpace="http://xml.fmi.fi/namespace/locationcode/name">Koski Tl</gml:name>
                        <gml:name codeSpace="http://xml.fmi.fi/namespace/locationcode/geoid">651077</gml:name>
                        <target:representativePoint xlink:href="#point-651077-totalcloudcover"/>
                        <target:country codeSpace="http://xml.fmi.fi/namespace/location/country">Finland</target:country>
                        <target:timezone>Europe/Helsinki</target:timezone>
                        <target:region codeSpace="http://xml.fmi.fi/namespace/location/region">Finland</target:region>
                    </target:Location></target:member>
                </target:LocationCollection>
           </sam:sampledFeature>
                <sams:shape>
                    <gml:MultiPoint gml:id="foi-multipoint-1-1-totalcloudcover">
                        <gml:pointMembers>
                           <gml:Point gml:id="point-651077-totalcloudcover" srsName="http://www.opengis.net/def/crs/EPSG/0/4258" srsDimension="2">
                               <gml:name>Koski Tl</gml:name>
                               <gml:pos>60.65000 23.15000 </gml:pos>
                           </gml:Point>
                        </gml:pointMembers>
                    </gml:MultiPoint>
                </sams:shape>
            </sams:SF_SpatialSamplingFeature>
        </om:featureOfInterest>
                        <om:result>
                    <wml2:MeasurementTimeseries gml:id="mts-1-1-totalcloudcover">
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-28T19:00:00Z</wml2:time>
                                      <wml2:value>12.9</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-28T20:00:00Z</wml2:time>
                                      <wml2:value>10.8</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-28T21:00:00Z</wml2:time>
                                      <wml2:value>12.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-28T22:00:00Z</wml2:time>
                                      <wml2:value>34.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-28T23:00:00Z</wml2:time>
                                      <wml2:value>38.8</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T00:00:00Z</wml2:time>
                                      <wml2:value>31.3</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T01:00:00Z</wml2:time>
                                      <wml2:value>22.4</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T02:00:00Z</wml2:time>
                                      <wml2:value>24.8</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T03:00:00Z</wml2:time>
                                      <wml2:value>33.0</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T04:00:00Z</wml2:time>
                                      <wml2:value>43.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T05:00:00Z</wml2:time>
                                      <wml2:value>48.7</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T06:00:00Z</wml2:time>
                                      <wml2:value>45.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T07:00:00Z</wml2:time>
                                      <wml2:value>1.6</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T08:00:00Z</wml2:time>
                                      <wml2:value>1.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T09:00:00Z</wml2:time>
                                      <wml2:value>0.7</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T10:00:00Z</wml2:time>
                                      <wml2:value>1.0</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T11:00:00Z</wml2:time>
                                      <wml2:value>0.9</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T12:00:00Z</wml2:time>
                                      <wml2:value>0.8</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T13:00:00Z</wml2:time>
                                      <wml2:value>1.4</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T14:00:00Z</wml2:time>
                                      <wml2:value>2.6</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T15:00:00Z</wml2:time>
                                      <wml2:value>1.8</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T16:00:00Z</wml2:time>
                                      <wml2:value>1.5</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T17:00:00Z</wml2:time>
                                      <wml2:value>1.4</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T18:00:00Z</wml2:time>
                                      <wml2:value>1.1</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T19:00:00Z</wml2:time>
                                      <wml2:value>1.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T20:00:00Z</wml2:time>
                                      <wml2:value>1.4</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T21:00:00Z</wml2:time>
                                      <wml2:value>1.5</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T22:00:00Z</wml2:time>
                                      <wml2:value>1.7</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-29T23:00:00Z</wml2:time>
                                      <wml2:value>1.9</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T00:00:00Z</wml2:time>
                                      <wml2:value>2.1</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T01:00:00Z</wml2:time>
                                      <wml2:value>4.6</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T02:00:00Z</wml2:time>
                                      <wml2:value>7.0</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T03:00:00Z</wml2:time>
                                      <wml2:value>9.4</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T04:00:00Z</wml2:time>
                                      <wml2:value>15.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T05:00:00Z</wml2:time>
                                      <wml2:value>21.1</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T06:00:00Z</wml2:time>
                                      <wml2:value>26.9</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T07:00:00Z</wml2:time>
                                      <wml2:value>30.7</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T08:00:00Z</wml2:time>
                                      <wml2:value>34.4</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T09:00:00Z</wml2:time>
                                      <wml2:value>38.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T10:00:00Z</wml2:time>
                                      <wml2:value>44.3</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T11:00:00Z</wml2:time>
                                      <wml2:value>50.4</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T12:00:00Z</wml2:time>
                                      <wml2:value>56.5</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T13:00:00Z</wml2:time>
                                      <wml2:value>53.4</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T14:00:00Z</wml2:time>
                                      <wml2:value>50.3</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T15:00:00Z</wml2:time>
                                      <wml2:value>47.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T16:00:00Z</wml2:time>
                                      <wml2:value>62.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T17:00:00Z</wml2:time>
                                      <wml2:value>77.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T18:00:00Z</wml2:time>
                                      <wml2:value>92.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T19:00:00Z</wml2:time>
                                      <wml2:value>94.8</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T20:00:00Z</wml2:time>
                                      <wml2:value>97.4</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T21:00:00Z</wml2:time>
                                      <wml2:value>100.0</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T22:00:00Z</wml2:time>
                                      <wml2:value>100.0</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-30T23:00:00Z</wml2:time>
                                      <wml2:value>100.0</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T00:00:00Z</wml2:time>
                                      <wml2:value>100.0</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T01:00:00Z</wml2:time>
                                      <wml2:value>92.4</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T02:00:00Z</wml2:time>
                                      <wml2:value>84.7</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T03:00:00Z</wml2:time>
                                      <wml2:value>77.1</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T04:00:00Z</wml2:time>
                                      <wml2:value>64.1</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T05:00:00Z</wml2:time>
                                      <wml2:value>51.0</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T06:00:00Z</wml2:time>
                                      <wml2:value>38.0</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T07:00:00Z</wml2:time>
                                      <wml2:value>34.4</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T08:00:00Z</wml2:time>
                                      <wml2:value>30.8</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T09:00:00Z</wml2:time>
                                      <wml2:value>27.2</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T10:00:00Z</wml2:time>
                                      <wml2:value>18.1</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T11:00:00Z</wml2:time>
                                      <wml2:value>9.1</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T12:00:00Z</wml2:time>
                                      <wml2:value>0.0</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T13:00:00Z</wml2:time>
                                      <wml2:value>5.0</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T14:00:00Z</wml2:time>
                                      <wml2:value>10.1</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T15:00:00Z</wml2:time>
                                      <wml2:value>15.1</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T16:00:00Z</wml2:time>
                                      <wml2:value>15.0</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T17:00:00Z</wml2:time>
                                      <wml2:value>14.9</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                        <wml2:point>
                            <wml2:MeasurementTVP>
                                      <wml2:time>2024-08-31T18:00:00Z</wml2:time>
                                      <wml2:value>14.8</wml2:value>
                            </wml2:MeasurementTVP>
                        </wml2:point>
                    </wml2:MeasurementTimeseries>
                </om:result>

        </omso:PointTimeSeriesObservation>
    </wfs:member>

</wfs:FeatureCollection>
*/