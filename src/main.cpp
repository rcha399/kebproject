#include <Arduino.h>
#include <WiFi.h>
#include <LittleFS.h>
#include <ESPAsyncWebServer.h>

// ============================================================
// SeatSense - Single Seat Demo (final state machine + web sync)
// ============================================================
// FREE (green)      -> button press                -> TAKEN (red)
// TAKEN (red)       -> sensor stops detecting        -> FINISHING (yellow)
// TAKEN (red)       -> sensor still detects           -> stays TAKEN (red)
// FINISHING (yellow)-> 15s elapses OR button pressed -> FREE (green)
// FINISHING (yellow)-> sensor detects again          -> TAKEN (red)
//
// Serves the existing kebproject site from LittleFS (data/ folder,
// uploaded via `pio run --target uploadfs`) and exposes GET /api/seats
// returning [{id,name,status,updatedAt}] exactly as data.js expects
// when SOURCE_MODE = "live". The site's red/amber/green rendering and
// the physical LED both read from the same currentState, so they can
// never disagree.
// ============================================================

// ---------- WiFi (Access Point mode) ----------
// ESP32 broadcasts its own network - no dependency on venue WiFi.
// Connect your phone/laptop to this SSID, then browse to the IP
// printed on Serial (default AP IP is 192.168.4.1).
const char* AP_SSID = "KEB-SeatSignal-Demo";
const char* AP_PASSWORD = "projectplaygroundt4"; // must be 8+ characters, or "" for an open network

// ---------- Pin map ----------
#define TRIG_PIN 18
#define ECHO_PIN 19       // via 1k/2.2k voltage divider
#define BUTTON_PIN 4      // INPUT_PULLUP

#define LED_R 25
#define LED_G 26
#define LED_B 27

// Set true if the Jaycar RGB module is common ANODE (colors turn on with LOW).
// Confirm this using your separate LED test file before flipping.
#define COMMON_ANODE false

// ---------- Tuning ----------
const float OCCUPIED_THRESHOLD_CM = 80.0;         // closer than this = something detected
const unsigned long PRESENCE_DEBOUNCE_MS = 1500;  // sensor reading must be stable this long
const unsigned long FINISHING_TIMEOUT_MS = 15000; // yellow -> green after 15s
const unsigned long BUTTON_DEBOUNCE_MS = 50;
const unsigned long BUTTON_COOLDOWN_MS = 5000; // ignore further presses for 5s after one is accepted

// ---------- Seat identity (must match data.js SEATS[0].id) ----------
const char* SEAT_ID = "A1";
const char* SEAT_NAME = "Seat A1";

// ---------- State ----------
enum SeatState { FREE, TAKEN, FINISHING };
SeatState currentState = FREE;

unsigned long lastPresenceChangeTime = 0;
bool lastPresenceReading = false;
bool stablePresence = false;

unsigned long finishingStartTime = 0;
bool finishingWasManual = false; // true if entered FINISHING via button override

bool lastButtonReading = HIGH;
unsigned long lastButtonDebounceTime = 0;
bool buttonActiveLast = false;
unsigned long lastAcceptedPressTime = 0; // 0 = no press accepted yet

AsyncWebServer server(80);

// ---------- Ultrasonic ----------
bool readPresence() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  if (duration == 0) {
    return stablePresence; // no echo - hold last known reading
  }
  float distanceCm = duration * 0.0343 / 2;
  return distanceCm < OCCUPIED_THRESHOLD_CM;
}

void updateStablePresence() {
  bool occupied = readPresence();
  if (occupied != lastPresenceReading) {
    lastPresenceReading = occupied;
    lastPresenceChangeTime = millis();
  }
  if (millis() - lastPresenceChangeTime > PRESENCE_DEBOUNCE_MS) {
    stablePresence = lastPresenceReading;
  }
}

// ---------- Button (debounced, edge-triggered, cooldown-gated) ----------
// Returns true at most once per physical press, and never again within
// BUTTON_COOLDOWN_MS of the last accepted press.
bool buttonPressedEdge() {
  bool reading = digitalRead(BUTTON_PIN);
  bool pressed = false;

  if (reading != lastButtonReading) {
    lastButtonDebounceTime = millis();
  }

  if (millis() - lastButtonDebounceTime > BUTTON_DEBOUNCE_MS) {
    bool buttonActive = (reading == LOW); // pressed = LOW with INPUT_PULLUP
    if (buttonActive && !buttonActiveLast) {
      bool cooldownElapsed = (lastAcceptedPressTime == 0) ||
                              (millis() - lastAcceptedPressTime > BUTTON_COOLDOWN_MS);
      if (cooldownElapsed) {
        pressed = true;
        lastAcceptedPressTime = millis();
      } else {
        Serial.println("Button press ignored (cooldown active)");
      }
    }
    buttonActiveLast = buttonActive;
  }

  lastButtonReading = reading;
  return pressed;
}

// ---------- LED ----------
void writeLED(int pin, bool on) {
  if (COMMON_ANODE) {
    digitalWrite(pin, on ? LOW : HIGH);
  } else {
    digitalWrite(pin, on ? HIGH : LOW);
  }
}

void setLED(SeatState state) {
  bool r = false, g = false, b = false;
  switch (state) {
    case FREE:      r = true; break;              // wired R pin actually shows green
    case TAKEN:     g = true; break;              // wired G pin actually shows red
    case FINISHING: r = true; g = true; break;    // yellow (both mixed either way)
  }
  writeLED(LED_R, r);
  writeLED(LED_G, g);
  writeLED(LED_B, b);
}

const char* stateName(SeatState state) {
  switch (state) {
    case FREE: return "FREE";
    case TAKEN: return "TAKEN";
    case FINISHING: return "FINISHING";
  }
  return "UNKNOWN";
}

// Maps to exactly the status strings data.js/app.js already render
// (free/taken/finishing) so the website's color and the LED can never
// disagree - both are derived from this single currentState.
const char* statusJson(SeatState state) {
  switch (state) {
    case FREE: return "free";
    case TAKEN: return "taken";
    case FINISHING: return "finishing";
  }
  return "free";
}

void changeState(SeatState newState) {
  currentState = newState;
  Serial.print("State change: ");
  Serial.println(stateName(currentState));
  setLED(currentState);
}

// ---------- State machine ----------
void runStateMachine(bool pressed) {
  switch (currentState) {
    case FREE:
      if (pressed) {
        changeState(TAKEN);
      }
      break;

    case TAKEN:
      if (pressed) {
        // manual override: seat owner flags they're leaving, regardless of sensor
        changeState(FINISHING);
        finishingStartTime = millis();
        finishingWasManual = true;
      } else if (!stablePresence) {
        changeState(FINISHING);
        finishingStartTime = millis();
        finishingWasManual = false;
      }
      break;

    case FINISHING:
      if (pressed) {
        // manual override: confirmed leaving, skip straight to free
        changeState(FREE);
      } else if (!finishingWasManual && stablePresence) {
        // only auto-cancel back to TAKEN if this was an automatic (sensor-triggered)
        // entry - a manual override expects the sensor to keep seeing them
        changeState(TAKEN);
      } else if (millis() - finishingStartTime > FINISHING_TIMEOUT_MS) {
        changeState(FREE);
      }
      break;
  }
}

// ---------- Web server ----------

void handleApiSeats(AsyncWebServerRequest *request) {
  // updatedAt as millis-since-boot; matches the {id,name,status,updatedAt}
  // shape data.js expects from fetchLiveSeats(). Fine for a local demo run;
  // swap for a real epoch timestamp (e.g. via NTP) if you need it elsewhere.
  String json = "[{\"id\":\"";
  json += SEAT_ID;
  json += "\",\"name\":\"";
  json += SEAT_NAME;
  json += "\",\"status\":\"";
  json += statusJson(currentState);
  json += "\",\"updatedAt\":";
  json += String(millis());
  json += "}]";

  request->send(200, "application/json", json);
}

void setupWebServer() {
  if (!LittleFS.begin()) {
    Serial.println("LittleFS mount failed - did you run 'pio run --target uploadfs'?");
  }

  server.on("/api/seats", HTTP_GET, handleApiSeats);

  // Serves index.html/app.js/data.js/style.css etc. straight from the
  // uploaded data/ folder, same as the existing site.
  server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");

  server.begin();
  Serial.println("Web server started.");
}

void startAccessPoint() {
  WiFi.mode(WIFI_AP);
  bool ok = WiFi.softAP(AP_SSID, AP_PASSWORD);

  if (ok) {
    Serial.println("Access Point started.");
    Serial.print("SSID: ");
    Serial.println(AP_SSID);
    Serial.print("Password: ");
    Serial.println(AP_PASSWORD);
    Serial.print("Connect your phone/laptop to this network, then browse to: http://");
    Serial.println(WiFi.softAPIP());
  } else {
    Serial.println("Failed to start Access Point.");
  }
}

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);

  Serial.begin(115200);
  setLED(currentState);
  Serial.println("SeatSense single-seat demo starting...");

  startAccessPoint();
  setupWebServer();
}

void loop() {
  updateStablePresence();
  bool pressed = buttonPressedEdge();
  runStateMachine(pressed);
  setLED(currentState); // defensive: keep LED always in sync with current state
  delay(50);
}
