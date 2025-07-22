# shelly_scripts

## Shelly library
Aseta laitteeseen library poluksi
https://raw.githubusercontent.com/terovirtanen/shelly_scripts/main/shelley_library_scripts.json

## Shelly laitteet

### Sähkön mittaus

laite: Shelly Pro 3EM
static ip: 192.168.100.100

### Varaaja kierto

laite: Shelly 1 Gen 3
static ip: 192.168.100.101
scripts:
 - circulation_pump.js
   - running

### Varaaja vastus

laite: Shelly 1 Gen 3
static ip: 192.168.100.102
scripts:
 - heating_element.js
   - running
 - em_power.js
   - scheduled
 - boiler_temperature.js
   - scheduled
 - porssisahko/porssisahko.js
   - scheduled

### Polttimen käyttö

laite: Shelly PM 1
static ip: 192.168.100.104
scripts:
 - pellet_burner.js
   - running
 - up_circulation_temperature.js
   - scheduled
 - boiler_temperature.js
   - scheduled
