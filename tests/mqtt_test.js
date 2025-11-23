// mqtt_test.js 
// Shelly MQTT test script based on official examples from ALLTERCO/shelly-script-examples
// Uses Shelly's built-in MQTT functionality properly

let CONFIG = {
    test_topic: "shelly/test",
    response_topic: "shelly/test/response", 
    
    max_messages: 10, // Send only 10 messages then stop
    message_interval: 10000, // 10 seconds between messages
    debug: true,
};

let messageCount = 0;
let timerHandle = null;

function debugPrint(line) {
    if (CONFIG.debug) {
        print("[MQTT Test] " + line);
    }
}

function startTest() {
    // Check if MQTT is connected before starting
    if (!MQTT.isConnected()) {
        debugPrint("MQTT not connected! Please check MQTT configuration.");
        return;
    }
    
    debugPrint("Starting MQTT test - will send " + CONFIG.max_messages + " messages");
    debugPrint("MQTT is connected, proceeding...");
    
    // Subscribe to response topic to listen for replies
    MQTT.subscribe(CONFIG.response_topic, function(topic, message) {
        debugPrint("Received response on " + topic + ": " + message);
    });
    
    // Subscribe to our own test topic to see our messages
    MQTT.subscribe(CONFIG.test_topic, function(topic, message) {
        debugPrint("Echo received on " + topic + ": " + message);
        try {
            let parsedMessage = JSON.parse(message);
            debugPrint("  -> Message count: " + parsedMessage.count);
            debugPrint("  -> Device: " + parsedMessage.device);
            debugPrint("  -> Timestamp: " + new Date(parsedMessage.timestamp));
        } catch (e) {
            debugPrint("  -> Could not parse message as JSON");
        }
    });
    
    // Subscribe to status topic 
    MQTT.subscribe(CONFIG.test_topic + "/status", function(topic, message) {
        debugPrint("Status update on " + topic + ": " + message);
    });
    
    // Send first message immediately
    sendTestMessage();
    
    // Start periodic messages
    startPeriodicMessages();
}

function sendTestMessage() {
    if (!MQTT.isConnected()) {
        debugPrint("MQTT disconnected, cannot send message #" + (messageCount + 1));
        return;
    }
    
    messageCount++;
    
    // Get device info like in official examples
    let deviceInfo = Shelly.getDeviceInfo();
    let deviceName = deviceInfo ? deviceInfo.name : "Unknown Shelly";
    let deviceId = deviceInfo ? deviceInfo.id : "unknown-id";
    
    let testMessage = {
        timestamp: Date.now(),
        message: "Test message #" + messageCount,
        device: deviceName,
        device_id: deviceId,
        count: messageCount,
        uptime: Shelly.getComponentStatus("sys").uptime
    };
    
    let messageStr = JSON.stringify(testMessage);
    debugPrint("Publishing message #" + messageCount + " to " + CONFIG.test_topic);
    
    // Use MQTT.publish like in official examples 
    // Parameters: topic, message, qos, retain
    MQTT.publish(CONFIG.test_topic, messageStr, 0, false);
    
    debugPrint("Message #" + messageCount + " published - waiting for echo...");
    
    // Check if we've sent max messages
    if (messageCount >= CONFIG.max_messages) {
        debugPrint("Reached maximum messages (" + CONFIG.max_messages + "). Stopping script...");
        stopPeriodicMessages();
        
        // Send final status message
        MQTT.publish(CONFIG.test_topic + "/status", "test_completed", 0, false);
        
        Timer.set(2000, false, function() {
            debugPrint("Script completed. Sent " + messageCount + " messages total.");
        });
    }
}

// Monitor MQTT connection status like in official examples
function checkMQTTConnection() {
    if (MQTT.isConnected()) {
        debugPrint("MQTT connection status: Connected");
        return true;
    } else {
        debugPrint("MQTT connection status: Disconnected");
        return false;
    }
}

function startPeriodicMessages() {
    timerHandle = Timer.set(CONFIG.message_interval, true, function() {
        if (messageCount < CONFIG.max_messages && checkMQTTConnection()) {
            sendTestMessage();
        } else if (messageCount >= CONFIG.max_messages) {
            stopPeriodicMessages();
        }
    });
    
    debugPrint("Started periodic message sending (every " + (CONFIG.message_interval/1000) + " seconds, max " + CONFIG.max_messages + " messages)");
}

function stopPeriodicMessages() {
    if (timerHandle) {
        Timer.clear(timerHandle);
        timerHandle = null;
        debugPrint("Stopped periodic message sending");
    }
}

function publishStatusMessage(status) {
    debugPrint("Status: " + status);
    if (MQTT.isConnected()) {
        MQTT.publish(CONFIG.test_topic + "/status", status, 0, false);
    }
}

// Event handler for script lifecycle
Shelly.addEventHandler(
    function(event, user_data) {
        if (!event || !event.info) {
            return;
        }
        
        let event_name = event.info.event;
        debugPrint("Received event: " + event_name);
        
        if (event_name === "mqtt_test_start") {
            startTest();
        } else if (event_name === "mqtt_test_stop") {
            stopPeriodicMessages();
            publishStatusMessage("test stopped");
        } else if (event_name === "mqtt_send_message") {
            if (messageCount < CONFIG.max_messages) {
                sendTestMessage();
            }
        }
    },
    null
);

// Monitor MQTT disconnections like in official examples
MQTT.setDisconnectHandler(function() {
    debugPrint("MQTT disconnected! Stopping test.");
    stopPeriodicMessages();
});

// Auto-start the MQTT test
debugPrint("Starting MQTT test script...");
debugPrint("Based on official Shelly script examples");
debugPrint("Will send " + CONFIG.max_messages + " messages using MQTT.publish");

// Check initial connection and start
Timer.set(1000, false, function() {
    if (checkMQTTConnection()) {
        publishStatusMessage("test_starting");
        startTest();
    } else {
        debugPrint("MQTT not connected. Please configure MQTT settings first.");
        debugPrint("Go to device settings > MQTT and configure broker connection.");
    }
});

debugPrint("MQTT test script initialized.");

// To manually trigger events, use:
// Shelly.emitEvent("mqtt_test_start", {});
// Shelly.emitEvent("mqtt_send_message", {});  
// Shelly.emitEvent("mqtt_test_stop", {});
