/* Templates: finished projects for the Open Studio. Each one is a build and a sketch that work together, loaded onto the bench in one press,
   to try, take apart and change. They use only the tray's parts. Each has a proof, checks its own build and sketch must pass, so a template
   cannot quietly stop working: tests/templates.test.ts runs them, and also places every build by hand, the way a student would. */
import { phases, type InputStep, type Scenario, type Trace } from '../sim/check';
import { esp5vNear, espSensorPower, LONG, unoGndFar, unoPowerNear } from './missions';
import { LED_COLORS, type BoardId, type Item } from '../types';

export interface Template {
  id: string;
  title: string;
  /** What it does, in a sentence. */
  about: string;
  /** What to try once it runs. */
  tryIt: string;
  /** The chapters of the guide that explain it (ids from src/data/guide.ts). */
  guide: string[];
  circuit: Item[];
  sketch: string;
  /** Checks the template's own build and sketch must pass. */
  proof: Scenario[];
}

/* --- builds shared by several templates --- */
/** An LED on D5 with its resistor to the near − rail, which a GND pin feeds. The same as the ESP32 missions'. */
const espLed = (color: number = LED_COLORS.red): Item[] => [
  { t: 'wire', a: 'E:D5', b: 'j22', c: 'orange' },
  { t: 'led', id: 'led', a: 'g22', k: 'g23', color },
  { t: 'res', a: 'h23', b: 'h27' },
  { t: 'wire', a: 'j27', b: 'B-27', c: 'black' },
  { t: 'wire', a: 'E:GND', b: 'B-5', c: 'black' },
];
/** The lines every Wi-Fi template starts with: join the workshop's Wi-Fi and print the address to open on the phone. */
const JOIN = `  WiFi.begin("Workshop", "solder123");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  Serial.print("Open http://");
  Serial.println(WiFi.localIP());`;
/** The first stretch of a Wi-Fi proof: the board starts up and joins the Wi-Fi before the phone asks it anything. */
const BOOT = { when: 'the board starts up and joins the Wi-Fi', ms: 3000, expect: {} };

/** Angles of the servos on the bench as the stick moves: [the inputs from then on, the range the first servo must be in, the range the second must be in]. */
function servosFollow(label: string, steps: [set: InputStep['set'], first: [number, number], second: [number, number]][]): Scenario {
  const plan = steps.map(([set], i) => ({ from: i * 1500, set }));
  return {
    label, plan, run: steps.length * 1500,
    judge(tr: Trace) {
      if (tr.servoCount < 2) return 'I could not find two servos on the bench.';
      for (const [i, [, a, b]] of steps.entries()) {
        const [x, y] = tr.at(i * 1500 + 1400).servos, inside = (v: number, [lo, hi]: [number, number]) => v >= lo && v <= hi;
        if (!inside(x, a) || !inside(y, b)) return `With the stick at step ${i + 1}, the servos should be at about ${Math.round((a[0] + a[1]) / 2)}° and ${Math.round((b[0] + b[1]) / 2)}°, but they were at ${x}° and ${y}°.`;
      }
      return null;
    },
  };
}

const UNO: Template[] = [
  {
    id: 'traffic', title: 'Traffic light', guide: ['led', 'functions', 'delay'],
    about: 'Red, amber and green LEDs take turns, the way a crossing\'s lights do.',
    tryIt: 'Change the waits in loop(), or add the red-and-amber step that comes before green in some countries.',
    circuit: [
      { t: 'wire', a: 'U:12', b: 'a5', c: 'red' },
      { t: 'led', id: 'red', a: 'e5', k: 'e6', color: LED_COLORS.red },
      { t: 'res', a: 'c6', b: 'c9' },
      { t: 'wire', a: 'a9', b: 'T-9', c: 'black' },
      { t: 'wire', a: 'U:11', b: 'a11', c: 'yellow' },
      { t: 'led', id: 'amber', a: 'e11', k: 'e12', color: LED_COLORS.yellow },
      { t: 'res', a: 'c12', b: 'c15' },
      { t: 'wire', a: 'a15', b: 'T-15', c: 'black' },
      { t: 'wire', a: 'U:10', b: 'a17', c: 'green' },
      { t: 'led', id: 'green', a: 'e17', k: 'e18', color: LED_COLORS.green },
      { t: 'res', a: 'c18', b: 'c21' },
      { t: 'wire', a: 'a21', b: 'T-21', c: 'black' },
      ...unoGndFar,
    ],
    sketch: `// Traffic light: green, then amber, then red, over and over
const int RED_PIN = 12;
const int AMBER_PIN = 11;
const int GREEN_PIN = 10;

// Lights the three LEDs as asked (HIGH or LOW), then waits
void show(int red, int amber, int green, int ms) {
  digitalWrite(RED_PIN, red);
  digitalWrite(AMBER_PIN, amber);
  digitalWrite(GREEN_PIN, green);
  delay(ms);
}

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(AMBER_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
}

void loop() {
  show(LOW, LOW, HIGH, 3000);   // green: go
  show(LOW, HIGH, LOW, 1000);   // amber: get ready to stop
  show(HIGH, LOW, LOW, 3000);   // red: stop
}`,
    proof: [{
      label: 'Each light takes its turn, one at a time', plan: [], run: 8000,
      judge(tr) {
        if (tr.ledCount < 3) return 'I could not find three LEDs on the bench.';
        const seen = new Set<number>();
        for (let t = 100; t < tr.ms; t += 100) {   // moments in time, so the instant between one digitalWrite() and the next does not count
          const lit = tr.at(t).leds.flatMap((v, i) => (v > 0.5 ? [i] : []));
          if (lit.length > 1) return 'Two lights were on at once.';
          lit.forEach(i => seen.add(i));
        }
        return seen.size === 3 ? null : `Only ${seen.size} of the three lights came on.`;
      },
    }],
  },
  {
    id: 'distance', title: 'Distance meter', guide: ['sonar', 'lcd'],
    about: 'The distance sensor measures how far away the wall is, and the LCD shows it in centimetres.',
    tryIt: 'Move the wall with its slider. Then make the backlight flash when something comes closer than 10 cm.',
    circuit: [   // the sensor on a long breadboard, so its wall has the front of the bench to itself; the LCD in front on the left, beside the Uno's A4 and A5
      LONG, ...unoPowerNear, { t: 'wire', a: 'B+30', b: 'B+31', c: 'red' },
      ...unoGndFar, { t: 'wire', a: 'T-30', b: 'T-31', c: 'black' }, { t: 'wire', a: 'B+48', b: 'T+48', c: 'red' },
      { t: 'sonar', id: 'sonar', row: 'j', col: 36, ctl: 'Distance to the wall' },   // wired from behind, across the centre gap
      { t: 'wire', a: 'f36', b: 'd36', c: 'red' }, { t: 'wire', a: 'a36', b: 'T+36', c: 'red' },
      { t: 'wire', a: 'f37', b: 'd37', c: 'blue' }, { t: 'wire', a: 'a37', b: 'U:10', c: 'blue' },
      { t: 'wire', a: 'f38', b: 'd38', c: 'green' }, { t: 'wire', a: 'a38', b: 'U:9', c: 'green' },
      { t: 'wire', a: 'f39', b: 'd39', c: 'black' }, { t: 'wire', a: 'a39', b: 'T-39', c: 'black' },
      { t: 'lcd', id: 'lcd' },
      { t: 'wire', a: 'LCD:GND', b: 'B-4', c: 'black' }, { t: 'wire', a: 'LCD:VCC', b: 'B+3', c: 'red' },
      { t: 'wire', a: 'LCD:SDA', b: 'U:A4', c: 'blue' }, { t: 'wire', a: 'LCD:SCL', b: 'U:A5', c: 'yellow' },
    ],
    sketch: `// Distance meter: the HC-SR04 measures, and the LCD shows it
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const int TRIG_PIN = 10;
const int ECHO_PIN = 9;

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  lcd.init();
  lcd.backlight();
  lcd.print("Distance meter");
}

void loop() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);   // a 10 microsecond ping
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH);   // how long the echo took to come back, in microseconds
  long cm = duration / 58;                   // sound takes about 58 microseconds to go 1 cm and back

  lcd.setCursor(0, 1);
  lcd.print(cm);
  lcd.print(" cm        ");   // the spaces wipe out what a longer number left behind
  delay(250);
}`,
    proof: [
      phases('The LCD shows the distance to the wall', [
        { when: 'the wall is 30 cm away', set: { sonar: 30 }, expect: { lcd: /\b(29|30) cm/ } },
        { when: 'the wall moves to 80 cm', set: { sonar: 80 }, expect: { lcd: /\b(79|80) cm/ } },
        { when: 'the wall comes in to 9 cm', set: { sonar: 9 }, expect: { lcd: /\b(8|9) cm/ } },
      ]),
    ],
  },
  {
    id: 'pantilt', title: 'Pan and tilt', guide: ['servo', 'analog', 'button'],
    about: 'Two servos follow a joystick, one turning left and right and one tipping up and down: the base and shoulder of a robot arm.',
    tryIt: 'Push the stick around and press it to centre both. Then make the servos creep towards the stick instead of jumping there.',
    circuit: [   // the servos on the far side beside pins 10 and 9, their motors behind the breadboard; the joystick on the near side beside A0, A1 and A2
      ...unoPowerNear, { t: 'wire', a: 'B+30', b: 'T+30', c: 'red' }, ...unoGndFar,
      { t: 'servo', id: 'pan', row: 'd', col: 6 },
      { t: 'wire', a: 'a6', b: 'T-6', c: 'black' }, { t: 'wire', a: 'a7', b: 'T+7', c: 'red' }, { t: 'wire', a: 'a8', b: 'U:10', c: 'orange' },
      { t: 'servo', id: 'tilt', row: 'd', col: 20 },
      { t: 'wire', a: 'a20', b: 'T-20', c: 'black' }, { t: 'wire', a: 'a21', b: 'T+21', c: 'red' }, { t: 'wire', a: 'a22', b: 'U:9', c: 'orange' },
      { t: 'joy', id: 'stick', row: 'g', col: 12, ctl: 'Joystick' },
      { t: 'wire', a: 'j12', b: 'B-12', c: 'black' }, { t: 'wire', a: 'j13', b: 'B+13', c: 'red' },
      { t: 'wire', a: 'j14', b: 'U:A0', c: 'green' }, { t: 'wire', a: 'j15', b: 'U:A1', c: 'blue' }, { t: 'wire', a: 'j16', b: 'U:A2', c: 'yellow' },
    ],
    sketch: `// Pan and tilt: two servos follow the joystick
#include <Servo.h>

const int PAN_PIN = 10;     // turns left and right
const int TILT_PIN = 9;     // tips up and down
const int X_PIN = A0;       // the stick, left to right
const int Y_PIN = A1;       // the stick, down to up
const int CENTRE_PIN = A2;  // pressing the stick joins this to GND (an analog pin works as a digital one too)

Servo pan;
Servo tilt;

void setup() {
  pinMode(CENTRE_PIN, INPUT_PULLUP);
  pan.attach(PAN_PIN);
  tilt.attach(TILT_PIN);
}

void loop() {
  if (digitalRead(CENTRE_PIN) == LOW) {   // pressed: both back to the middle
    pan.write(90);
    tilt.write(90);
  } else {
    pan.write(map(analogRead(X_PIN), 0, 1023, 0, 180));
    tilt.write(map(analogRead(Y_PIN), 0, 1023, 0, 180));
  }
  delay(20);
}`,
    proof: [
      servosFollow('Each servo follows its own direction of the stick', [
        [{ joy: 0, joyY: 1 }, [0, 5], [175, 180]],
        [{ joy: 1, joyY: 0 }, [175, 180], [0, 5]],
        [{ joy: 0.25, joyY: 0.75 }, [35, 55], [125, 145]],
      ]),
      servosFollow('Pressing the stick centres both servos', [
        [{ joy: 1, joyY: 1 }, [175, 180], [175, 180]],
        [{ joy: 1, joyY: 1, joySw: 1 }, [85, 95], [85, 95]],
      ]),
    ],
  },
];

const ESP: Template[] = [
  {
    id: 'dimmer', title: 'Wi-Fi dimmer', guide: ['wifi', 'analog', 'functions'],
    about: 'A lamp you dim and brighten from the phone, in steps, with the page showing how bright it is.',
    tryIt: 'Run it, press Go on the phone and tap Brighter. Then add a step between Off and Full, or a form to type a brightness.',
    circuit: espLed(LED_COLORS.white).map((it): Item => (it.t === 'res' ? { ...it, ohms: 100 } : it)),   // a white LED needs more than 3.3 V can push through 220 Ω
    sketch: `// Wi-Fi dimmer: set a lamp's brightness from the phone
#include <WiFi.h>
#include <WebServer.h>

const int LAMP_PIN = 5;

WebServer server(80);
int level = 0;   // 0 is off, 255 is full

void sendPage() {
  String page = "<h1>Desk lamp</h1><p>Brightness: ";
  page += level * 100 / 255;
  page += "%</p><p><a href=\\"/down\\">Dimmer</a> &nbsp; <a href=\\"/up\\">Brighter</a></p>";
  page += "<p><a href=\\"/off\\">Off</a> &nbsp; <a href=\\"/full\\">Full</a></p>";
  server.send(200, "text/html", page);
}

void setLevel(int to) {
  level = constrain(to, 0, 255);
  analogWrite(LAMP_PIN, level);
  sendPage();
}

void handleRoot() { sendPage(); }
void handleUp() { setLevel(level + 64); }
void handleDown() { setLevel(level - 64); }
void handleOff() { setLevel(0); }
void handleFull() { setLevel(255); }

void setup() {
  pinMode(LAMP_PIN, OUTPUT);
  Serial.begin(115200);
${JOIN}

  server.on("/", handleRoot);
  server.on("/up", handleUp);
  server.on("/down", handleDown);
  server.on("/off", handleOff);
  server.on("/full", handleFull);
  server.begin();
}

void loop() {
  server.handleClient();
  delay(2);
}`,
    proof: [
      phases('Brighter, Dimmer, Full and Off set the lamp', [
        BOOT, { when: 'the phone opens the page', visit: '/', expect: { page: /brightness: 0%/i, led: false } },
        { when: 'Brighter is tapped', tap: 'Brighter', expect: { duty: [0.2, 0.3] } },
        { when: 'Brighter is tapped again', tap: 'Brighter', expect: { duty: [0.45, 0.55], page: /brightness: 50%/i } },
        { when: 'Dimmer is tapped', tap: 'Dimmer', expect: { duty: [0.2, 0.3] } },
        { when: 'Full is tapped', tap: 'Full', expect: { duty: [0.95, 1], page: /brightness: 100%/i } },
        { when: 'Off is tapped', tap: 'Off', expect: { led: false, page: /brightness: 0%/i } },
      ]),
    ],
  },
  {
    id: 'plant', title: 'Plant monitor', guide: ['soil', 'wifi', 'analog'],
    about: 'A soil sensor in a pot: the phone shows how damp the soil is, and a light comes on when the plant needs water.',
    tryIt: 'Run it and press Go on the phone. Then dry the soil out with its slider: the plant the probe stands in droops, the light comes on, and Check again shows it on the phone.',
    circuit: [   // the potted plant behind the long breadboard, its probe's pins in line with columns 36 to 38, beside the far rails and the ESP32's analog pins
      LONG, ...espLed(), ...espSensorPower, { t: 'module', kind: 'soil', id: 'soil', ctl: 'Soil moisture', x: 72.1, z: -50.2 },
      { t: 'wire', a: 'SOIL:VCC', b: 'T+36', c: 'red' }, { t: 'wire', a: 'SOIL:SIG', b: 'E:D34', c: 'green' }, { t: 'wire', a: 'SOIL:GND', b: 'T-38', c: 'black' },
    ],
    sketch: `// Plant monitor: the soil's moisture on the phone, and a light when the plant needs water
#include <WiFi.h>
#include <WebServer.h>

const int SOIL_PIN = 34;    // the probe's SIG pin: higher when the soil is wetter
const int LED_PIN = 5;      // on when the soil is dry
const int DRY_BELOW = 30;   // percent

WebServer server(80);

int moisture() {
  return map(analogRead(SOIL_PIN), 0, 4095, 0, 100);
}

void handleRoot() {
  int m = moisture();
  String page = "<h1>Plant monitor</h1><p>Moisture: ";
  page += m;
  page += "%</p><p>";
  page += m < DRY_BELOW ? "Needs water!" : "No water needed.";
  page += "</p><p><a href=\\"/\\">Check again</a></p>";
  server.send(200, "text/html", page);
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
${JOIN}

  server.on("/", handleRoot);
  server.begin();
}

void loop() {
  server.handleClient();
  digitalWrite(LED_PIN, moisture() < DRY_BELOW);
  delay(10);
}`,
    proof: [
      phases('The light and the page follow the soil', [
        { ...BOOT, set: { soil: 0.2 } },
        { when: 'the phone opens the page while the soil is dry (20%)', visit: '/', expect: { page: /moisture: (19|20)%[\s\S]*needs water/i, led: true } },
        { when: 'the plant is watered (70%) and Check again is tapped', set: { soil: 0.7 }, tap: 'Check again', expect: { page: /moisture: (69|70)%[\s\S]*no water needed/i, led: false } },
      ]),
    ],
  },
  {
    id: 'motion', title: 'Motion alarm', guide: ['pir', 'millis', 'buzzer'],
    about: 'A light and a beeping buzzer when someone moves, until all has been still for 3 seconds.',
    tryIt: 'Flip the motion sensor to someone moving and back. Then make it count the visitors in the Serial Monitor.',
    circuit: [   // on the near side of a long breadboard, beside D18 and D19, with the sensor's 5 V carried over from VIN
      LONG, ...espLed(), ...esp5vNear,
      { t: 'module', kind: 'pir', id: 'pir', row: 'g', col: 36, ctl: 'Movement' },
      { t: 'wire', a: 'j36', b: 'B+36', c: 'red' }, { t: 'wire', a: 'j37', b: 'E:D18', c: 'yellow' }, { t: 'wire', a: 'j38', b: 'B-38', c: 'black' },
      { t: 'buzzer', id: 'buzz', a: 'g45', b: 'g48' },   // clear of the motion sensor's board, which is 32 mm wide
      { t: 'wire', a: 'E:D19', b: 'j45', c: 'purple' }, { t: 'wire', a: 'j48', b: 'B-48', c: 'black' },
    ],
    sketch: `// Motion alarm: a light and a beep when someone moves, until all is still for 3 seconds
const int PIR_PIN = 18;      // HIGH while the sensor sees movement
const int LED_PIN = 5;
const int BUZZER_PIN = 19;
const unsigned long HOLD_MS = 3000;

unsigned long lastMotion = 0;
bool alarmOn = false;

void setup() {
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  if (digitalRead(PIR_PIN) == HIGH) {
    if (!alarmOn) Serial.println("Movement!");
    lastMotion = millis();
    alarmOn = true;
  }
  if (alarmOn && millis() - lastMotion >= HOLD_MS) {
    alarmOn = false;
    Serial.println("All still");
  }

  digitalWrite(LED_PIN, alarmOn);
  if (alarmOn && (millis() / 250) % 2 == 0) {   // beep a quarter of a second on, a quarter off
    tone(BUZZER_PIN, 1200);
  } else {
    noTone(BUZZER_PIN);
  }
  delay(10);
}`,
    proof: [
      phases('It sounds while someone moves, and stops when all is still', [
        { when: 'all is still', set: { pir: 0 }, ms: 1000, expect: { led: false, sound: false } },
        { when: 'someone moves', set: { pir: 1 }, ms: 1000, mode: 'during', expect: { led: true, sound: true } },
        { when: 'they have just stopped moving', set: { pir: 0 }, ms: 1500, expect: { led: true } },
        { when: 'all has been still for over 3 seconds', ms: 2500, expect: { led: false, sound: false, serial: /Movement![\s\S]*All still/ } },
      ]),
    ],
  },
];

export const TEMPLATES: Record<BoardId, Template[]> = { uno: UNO, esp32: ESP };
