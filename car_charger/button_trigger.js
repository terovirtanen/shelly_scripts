// Shelly Plus 1: Shelly BLU RC Button 4 (BTHome) -> kääntää releen toiseen asentoon.
// Vaatimus: laitteen asetuksissa Bluetooth päällä. Aseta KVS-avaimeen "button_addr" napin MAC-osoite.

let CONFIG = {
  BUTTON_ADDR_KEY: "button_addr", // KVS-avain, jonka arvo on napin BT MAC-osoite
  BUTTON_ADDR: null,
  SWITCH_ID: 0,
};

// BTHome button event -arvot
let EVT_PRESS = 1;
let EVT_DOUBLE_PRESS = 2;
let EVT_TRIPLE_PRESS = 3;
let EVT_LONG_PRESS = 4;
let EVT_LONG_DOUBLE_PRESS = 5;
let EVT_LONG_TRIPLE_PRESS = 6;
let EVT_HOLD_PRESS = 128;

// Vain nappi 1 on käytössä: yksittäinen painallus tekee HTTP GET -kutsun.
let HANDLERS = {
  1: function (evt) {
    if (evt === EVT_PRESS) {
      Shelly.call("HTTP.GET", {
        url: "http://192.168.100.50/car_charger/start_now?hours=3&power_charging=true",
      });
    }
  },
  2: function (evt) {
    if (evt === EVT_PRESS) {
      Shelly.call("HTTP.GET", {
        url: "http://192.168.100.50/car_charger/start_now?hours=4",
      });
    }
  },
};

// BTHome-objektien datan pituudet (tavuina), joita tarvitaan jäsennyksessä
let LEN = {
  0x00: 1, 0x01: 1, 0x02: 2, 0x03: 2, 0x05: 3, 0x08: 2, 0x0c: 2, 0x0d: 2, 0x0e: 2,
  0x0f: 1, 0x10: 1, 0x11: 1, 0x12: 2, 0x3a: 1, 0x3f: 2, 0x45: 2,
};

let lastPacketId = -1;

function onScan(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;
  if (!res || res.addr !== CONFIG.BUTTON_ADDR) return;
  if (!res.service_data || typeof res.service_data["fcd2"] === "undefined") return;

  let d = res.service_data["fcd2"];
  let pos = 1; // tavu 0 = BTHome device info
  let packetId = -1;
  let buttons = [];

  while (pos < d.length) {
    let id = d.at(pos);
    let len = LEN[id];
    if (typeof len === "undefined") break;
    pos++;
    if (pos + len > d.length) break;
    if (id === 0x00) packetId = d.at(pos);
    else if (id === 0x3a) buttons.push(d.at(pos));
    pos += len;
  }

  // Mainostus toistuu: käsittele sama paketti vain kerran
  if (packetId === lastPacketId) return;
  lastPacketId = packetId;

  for (let i = 0; i < buttons.length; i++) {
    let evt = buttons[i];
    let h = HANDLERS[i + 1];
    if (evt !== 0 && h) h(evt);
  }
}

Shelly.call("KVS.Get", { key: CONFIG.BUTTON_ADDR_KEY }, function (res, err) {
  if (err || !res || !res.value) {
    print("KVS-avainta puuttuu: " + CONFIG.BUTTON_ADDR_KEY);
    return;
  }
  CONFIG.BUTTON_ADDR = String(res.value).toLowerCase();
  BLE.Scanner.Subscribe(onScan);
  if (!BLE.Scanner.isRunning()) {
    BLE.Scanner.Start({ duration_ms: BLE.Scanner.INFINITE_SCAN, active: false });
  }
});
