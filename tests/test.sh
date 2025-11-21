
curl http://192.168.100.200/rpc/Shelly.GetStatus
curl http://192.168.100.200/rpc/Shelly.GetConfig


curl http://192.168.100.200/rpc/Schedule.List




# Shelly EV01 charger status - list all available methods first
curl http://192.168.100.200/rpc/Shelly.ListMethods

# Try different EV charging related endpoints
curl http://192.168.100.200/rpc/Enum.GetStatus?id=200
curl http://192.168.100.200/rpc/Enum.GetConfig?id=200

curl http://192.168.100.200/rpc/Number.GetStatus?id=200
curl http://192.168.100.200/rpc/Boolean.GetStatus?id=200
