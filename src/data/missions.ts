/* Missions. Each mission is a small device to build, checked by running the student's own sketch on the student's own circuit.
   The reference build in each mission (`circuit` and `answer`) is what the tests run to prove the checks can be passed, and what the last hint offers. */
import { blinks, colorOn, ledOn, phases, reaction, servoAt, soundOn, sweeps, type InputKind, type InputStep, type Sample, type Scenario, type Trace } from '../sim/check';
import type { Tool } from '../state/bench';
import type { Choice } from './boardchoice';
import { LED_COLORS, type BoardId, type Item } from '../types';

/* --- the parts tray --- */
export type PartId = 'led' | 'resistor' | 'wire' | 'button' | 'knob' | 'buzzer' | 'sonar' | 'pad' | 'servo' | 'ldr' | 'temp'
  | 'rgb' | 'slide' | 'tilt' | 'reed' | 'pir' | 'ir' | 'soil' | 'water' | 'gas' | 'flame' | 'joystick';
/** Every part of the tray. A `studio` part is one no mission unlocks yet: it is in the Open Studio's tray and nowhere else.
    The LED is one part in every colour, and the resistor one part of every value: the drawer picks which, and the tool carries it. */
export const PARTS: Record<PartId, { label: string; tool: Tool; only?: BoardId; studio?: true }> = {
  led: { label: 'LED', tool: { kind: 'led', color: LED_COLORS.red } },
  resistor: { label: 'Resistor', tool: { kind: 'res', ohms: 220 } },
  wire: { label: 'Wire', tool: { kind: 'wire' } },
  button: { label: 'Button', tool: { kind: 'button' } },
  knob: { label: 'Knob', tool: { kind: 'pot' } },
  buzzer: { label: 'Buzzer', tool: { kind: 'buzzer' } },
  sonar: { label: 'Distance sensor', tool: { kind: 'sonar' } },
  pad: { label: 'Touch pad', tool: { kind: 'pad' }, only: 'esp32' },
  servo: { label: 'Servo', tool: { kind: 'servo' } },
  ldr: { label: 'Light sensor', tool: { kind: 'ldr' } },
  temp: { label: 'Temp sensor', tool: { kind: 'temp' } },
  rgb: { label: 'RGB LED', tool: { kind: 'rgb' }, studio: true },
  slide: { label: 'Slide switch', tool: { kind: 'slide' }, studio: true },
  tilt: { label: 'Tilt switch', tool: { kind: 'contact', sub: 'tilt' }, studio: true },
  reed: { label: 'Reed switch', tool: { kind: 'contact', sub: 'reed' } },
  joystick: { label: 'Joystick', tool: { kind: 'joy' }, studio: true },
  pir: { label: 'Motion sensor', tool: { kind: 'module', sub: 'pir' } },
  ir: { label: 'Obstacle sensor', tool: { kind: 'module', sub: 'ir' }, studio: true },
  soil: { label: 'Soil moisture', tool: { kind: 'module', sub: 'soil' } },
  water: { label: 'Water level', tool: { kind: 'module', sub: 'water' }, studio: true },
  gas: { label: 'Gas sensor', tool: { kind: 'module', sub: 'gas' }, studio: true },
  flame: { label: 'Flame sensor', tool: { kind: 'module', sub: 'flame' }, studio: true },
};
/** The parts that only the Open Studio has. */
export const STUDIO_PARTS = (Object.keys(PARTS) as PartId[]).filter(id => PARTS[id].studio);
/** What the tray holds before any mission has been passed. */
export const BASE_PARTS: PartId[] = ['led', 'resistor', 'wire'];

export function partIdOf(it: Item): PartId {
  switch (it.t) {
    case 'led': return 'led';
    case 'res': return 'resistor';
    case 'pot': return 'knob';
    case 'joy': return 'joystick';
    case 'rgb': case 'slide': return it.t;
    case 'contact': case 'module': return it.kind;
    case 'wire': case 'button': case 'buzzer': case 'sonar': case 'pad': case 'servo': case 'ldr': case 'temp': return it.t;
  }
}

/* --- missions --- */
export interface PredictOption { id: string; label: string }
/** Asked before the first run: what will the build do? The demo run is the student's own sketch on their own circuit, so the answer is checked against the real thing. */
export interface Prediction {
  question: string;
  options: PredictOption[];
  /** The inputs to play during the demo, and how long it lasts. */
  demo: InputStep[];
  run: number;
  /** Which option describes what the sketch did. */
  classify(tr: Trace): string;
  /** The option that means it works. */
  works: string;
  /** What each outcome means, shown when the prediction is compared with the result. */
  explain: Record<string, string>;
}
export interface Mission {
  id: string;
  title: string;
  /** The place on the mission map. */
  place: string;
  hook: string;
  /** Where it sits on the map, in percent from the left and the top. */
  map: [x: number, y: number];
  /** Missions that must be passed first. */
  after: string[];
  /** Free build: no goal and no checks. */
  sandbox?: boolean;
  /** Label the parts of the board, as in a tour. */
  showParts?: boolean;
  /** Trusted HTML. */
  story: string;
  goal: string;
  how: string[];
  /** The chapters of the guide (ids from src/data/guide.ts) that explain what this mission uses, most useful first. */
  guide: string[];
  /** The on-screen controls, named for the story ("Hallway light level"). */
  controls?: Partial<Record<InputKind, string>>;
  starter: string;
  /** The reference build and sketch. */
  circuit: Item[];
  answer: string;
  predict?: Prediction;
  /** A nudge, then the idea, then the answer. */
  hints: [nudge: string, idea: string, answer: string];
  checks: Scenario[];
  /** Parts added to the tray when this mission is passed. */
  unlocks: PartId[];
  /** A repair job: the bench the student starts from, with faults in it. Without this the bench starts empty. */
  start?: Item[];
  /** The build and sketch are somebody else's, and the faults are the student's to find. */
  repair?: boolean;
  /** A mission answered by choosing a board on the supply shelf, not by building on the bench. */
  choice?: Choice;
}

/* --- circuits shared by several missions --- */
const unoLed = (pin: number): Item[] => [
  { t: 'wire', a: 'U:' + pin, b: 'a10', c: 'orange' },
  { t: 'led', id: 'led', a: 'e10', k: 'e11', color: 0xff3b30 },
  { t: 'res', a: 'c11', b: 'c15' },
];
const unoKnob: Item[] = [
  ...unoLed(9),
  { t: 'wire', a: 'a15', b: 'T-15', c: 'black' }, { t: 'wire', a: 'U:GND', b: 'T-2', c: 'black' }, { t: 'wire', a: 'U:5V', b: 'T+1', c: 'red' },
  { t: 'pot', id: 'pot', row: 'd', col: 24, ctl: 'Knob position' },
  { t: 'wire', a: 'a24', b: 'T+24', c: 'red' }, { t: 'wire', a: 'a26', b: 'T-26', c: 'black' }, { t: 'wire', a: 'a25', b: 'U:A0', c: 'green' },
];
/** A light sensor on a voltage divider: 5V, the sensor, the point the pin reads, a 10 kΩ resistor, GND. */
const unoLdr: Item[] = [
  ...unoLed(9),
  { t: 'wire', a: 'a15', b: 'T-15', c: 'black' }, { t: 'wire', a: 'U:GND', b: 'T-2', c: 'black' }, { t: 'wire', a: 'U:5V', b: 'T+1', c: 'red' },
  { t: 'ldr', id: 'ldr', a: 'e24', b: 'e25', ctl: 'Light level' }, { t: 'wire', a: 'a24', b: 'T+24', c: 'red' },
  { t: 'res', a: 'c25', b: 'c28', ohms: 10000 }, { t: 'wire', a: 'a28', b: 'T-28', c: 'black' },
  { t: 'wire', a: 'a25', b: 'U:A0', c: 'green' },
];
/** The knob's circuit with a TMP36 where the knob was. */
const unoTemp: Item[] = unoKnob.map((it): Item => (it.t === 'pot' ? { t: 'temp', id: 'temp', row: 'd', col: 24, ctl: 'Temperature' } : it));
const espLed: Item[] = [
  { t: 'wire', a: 'E:D5', b: 'j22', c: 'orange' },
  { t: 'led', id: 'led', a: 'g22', k: 'g23', color: 0xff3b30 },
  { t: 'res', a: 'h23', b: 'h27' },
  { t: 'wire', a: 'j27', b: 'B-27', c: 'black' },
  { t: 'wire', a: 'E:GND', b: 'B-5', c: 'black' },
];

/* --- reading what a run did, for the prediction --- */
type Behaviour = 'off' | 'on' | 'blinks';
const behaviour = (tr: Trace, who: 'led' | 'builtin'): Behaviour => {
  const on = (s: Sample) => (who === 'led' ? ledOn(s) : s.builtin > 0.5);
  let changes = 0;
  for (let i = 1; i < tr.samples.length; i++) if (on(tr.samples[i]) !== on(tr.samples[i - 1])) changes++;
  return changes >= 3 ? 'blinks' : tr.samples.some(on) ? 'on' : 'off';
};
const BLINK_OPTIONS: PredictOption[] = [{ id: 'off', label: 'It stays dark' }, { id: 'on', label: 'It turns on and stays on' }, { id: 'blinks', label: 'It blinks' }];
const BLINK_EXPLAIN = {
  off: 'The light never turned on. Check that the sketch sets the pin HIGH and, if you wired the LED yourself, that the pin in the sketch is the pin the wire is on.',
  on: 'The light turned on but never went off again, so it did not blink. A blink needs a wait, an off and another wait.',
  blinks: 'The light went on and off again and again, which is a blink.',
};
/** "Does it react?": the state in one moment compared with the state in a later one. */
const reacts = (state: (s: Sample) => boolean, earlier: number, later: number, later_id: string, earlier_id: string) => (tr: Trace): string => {
  const r = reaction(tr, state, earlier, later);
  return r === 'later' ? later_id : r === 'earlier' ? earlier_id : r;
};
/** What each outcome means for a mission whose build should react to an input. */
const reactExplain = (laterId: string, laterText: string, earlierId: string, earlierText: string): Record<string, string> => ({
  [laterId]: laterText,
  [earlierId]: earlierText,
  always: 'It was on the whole time, whatever the input did. The sketch is not looking at the input, or the comparison is always true.',
  never: 'It never came on. Check that the sketch reads the input and that the output pin matches the wire.',
});

const dark = 0.1, bright = 0.9;

/** Three short taps of a button at uneven moments, so a sketch that only looks at the button now and then misses at least one. */
const TAP_TIMES = [1000, 2250, 3600];
const TAPS: InputStep[] = [{ from: 0, set: { button: 0 } }, ...TAP_TIMES.flatMap(t => [{ from: t, set: { button: 1 } }, { from: t + 150, set: { button: 0 } }])];

/* --- the Uno missions --- */
/* --- choosing a board: missions answered on the supply shelf instead of the bench --- */
type ChoiceMission = Pick<Mission, 'id' | 'title' | 'place' | 'hook' | 'map' | 'after' | 'story' | 'guide' | 'hints'> & Choice;
function choose({ needs, ...m }: ChoiceMission): Mission {
  return {
    ...m, choice: { needs },
    goal: 'Choose a board that meets every need on the list.',
    how: ['Each card on the shelf lists what that board has, and all five are drawn to the same scale.', 'Only the Uno and the ESP32 are on this workshop\'s bench. The other three are here to compare, as they would be in a catalogue.'],
    starter: '', circuit: [], answer: '', checks: [], unlocks: [],
  };
}

const UNO: Mission[] = [
  {
    id: 'tour', title: 'Workshop tour', place: 'Maker Workshop', hook: 'Meet the board and make its own light blink.', map: [25, 93], after: [], showParts: true, guide: ['sketch', 'pinmode', 'digitalwrite', 'delay', 'serial'],
    story: 'Every maker starts in the workshop. An Arduino Uno is a small computer that runs one program, called a sketch. Click the labels on the board to see what each part does. Then finish the sketch so the tiny light marked <b>L</b> blinks.',
    goal: 'Make the board\'s own L light blink, half a second on and half a second off.',
    how: ['<code>setup()</code> runs once when the board starts. <code>loop()</code> runs again and again, forever.', '<code>LED_BUILTIN</code> is pin 13, the pin wired to the L light.', '<code>Serial.println()</code> sends text to the Serial Monitor under the code.'],
    starter: `void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Hello from the Uno!");
}

void loop() {
  // turn the light on, wait half a second, turn it off, wait again
}`,
    circuit: [],
    answer: `void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Hello from the Uno!");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);   // light on
  delay(500);                        // wait half a second
  digitalWrite(LED_BUILTIN, LOW);    // light off
  delay(500);
}`,
    predict: {
      question: 'The starter sketch is ready to run. What will the L light on the board do?',
      options: BLINK_OPTIONS, demo: [], run: 6000, classify: tr => behaviour(tr, 'builtin'), works: 'blinks', explain: BLINK_EXPLAIN,
    },
    hints: [
      'Look at the checklist: the sketch says hello already, so the part that is failing is the blinking. What does <code>loop()</code> do right now?',
      'To blink, the light has to go on, stay on for a while, go off, and stay off for a while. <code>digitalWrite(pin, HIGH)</code> turns it on, <code>digitalWrite(pin, LOW)</code> turns it off, and <code>delay(ms)</code> waits.',
      'Inside <code>loop()</code>: digitalWrite(LED_BUILTIN, HIGH); delay(500); digitalWrite(LED_BUILTIN, LOW); delay(500);',
    ],
    checks: [
      phases('The sketch says hello', [{ when: 'the sketch starts', ms: 500, mode: 'during', expect: { serial: /hello/i } }]),
      blinks('The on-board light blinks', 'builtin'),
    ],
    unlocks: [],
  },
  {
    id: 'beacon', title: 'Gate beacon', place: 'Front Gate', hook: 'Build a blinking light so delivery drivers can find the gate.', map: [30, 83], after: [], guide: ['circuit', 'breadboard', 'led', 'resistor', 'variables'],
    story: 'The front gate has no light and delivery drivers keep missing it after dark. Build a <b>beacon</b>: an LED that blinks about once a second. You will wire it yourself, so remember that current needs a complete loop and that an LED needs a resistor.',
    goal: 'Wire an LED and a resistor to any digital pin, and make the LED blink about once a second.',
    how: ['<code>const int LED_PIN = 13;</code> gives the pin a name, so you change one line if you move the wire.', '<code>pinMode(LED_PIN, OUTPUT)</code> lets the pin supply current.', 'HIGH puts 5 V on the pin and lights the LED. LOW puts 0 V and it goes dark.'],
    starter: `// Gate beacon
// Which pin is your LED's wire plugged into? Put its number here.
const int LED_PIN = 13;

void setup() {
  // get the pin ready to send out power
}

void loop() {
  // turn the LED on, wait, turn it off, wait
}`,
    circuit: [...unoLed(13), { t: 'wire', a: 'a15', b: 'U:GND2', c: 'black' }],
    answer: `const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}`,
    predict: {
      question: 'You have wired the LED and written the sketch. What will the LED do when you press Run?',
      options: BLINK_OPTIONS, demo: [], run: 6000, classify: tr => behaviour(tr, 'led'), works: 'blinks', explain: BLINK_EXPLAIN,
    },
    hints: [
      'Press <b>Check my build</b> and read the first line. If the wiring check fails, the circuit check panel over the 3D view says exactly what is wrong.',
      'Current flows in a loop: out of a pin, through the LED, through a resistor, and back to GND. The long leg of the LED must face the pin. In the sketch, the pin has to be an OUTPUT, and blinking means HIGH, wait, LOW, wait.',
      'Wire pin 13 to hole a10, put the LED\'s long leg in e10 and its short leg in e11, put a 220 Ω resistor from c11 to c15, and wire a15 to GND. In the sketch set the pin to OUTPUT in setup(), then in loop() write HIGH, delay(1000), write LOW, delay(1000).',
    ],
    checks: [
      phases('The LED lights up', [{ when: 'the sketch has been running for a few seconds', ms: 3000, mode: 'during', expect: { led: true } }]),
      blinks('The LED blinks about once a second'),
    ],
    unlocks: ['knob'],
  },
  {
    id: 'nightlight', title: 'Night light', place: 'Main Hallway', hook: 'Turn a light on when the hallway gets dark.', map: [70, 73], after: ['beacon'], guide: ['knob', 'analog', 'ifelse'],
    story: 'The main hallway is pitch dark at night, and the lights are on a timer nobody trusts. Build a <b>night light</b> that comes on by itself when it is dark and goes off when it is bright. The knob stands in for the light sensor: <b>0% is darkness</b>, <b>100% is full daylight</b>.',
    goal: 'The LED comes on when the light level is low and goes off when it is high.',
    controls: { pot: 'Hallway light level' },
    how: ['A knob gives the board a voltage between 0 V and 5 V. <code>analogRead()</code> turns it into a number from 0 to 1023.', '<code>if</code> / <code>else</code> chooses between two things to do. <code>&lt;</code> means "is less than".', 'The sketch keeps checking, because <code>loop()</code> repeats. The short <code>delay()</code> stops it checking thousands of times a second.'],
    starter: `// Hallway night light
const int SENSOR_PIN = A0;   // the light sensor (the knob)
const int LED_PIN = 9;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  // 1. read the sensor with analogRead(SENSOR_PIN)
  // 2. if the number is low (it is dark) turn the LED on, otherwise turn it off
  delay(50);
}`,
    circuit: unoKnob,
    answer: `const int SENSOR_PIN = A0;
const int LED_PIN = 9;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int light = analogRead(SENSOR_PIN);   // 0 (dark) to 1023 (bright)

  if (light < 300) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(50);
}`,
    predict: {
      question: 'Your night light is built. The hallway starts bright, then gets dark. What will the LED do?',
      options: [
        { id: 'dark', label: 'It turns on when the hallway gets dark' }, { id: 'bright', label: 'It turns on when the hallway gets bright' },
        { id: 'always', label: 'It stays on whatever happens' }, { id: 'never', label: 'It never lights' },
      ],
      demo: [{ from: 0, set: { pot: bright } }, { from: 2000, set: { pot: dark } }], run: 4000,
      classify: reacts(ledOn, 1800, 3800, 'dark', 'bright'), works: 'dark',
      explain: reactExplain('dark', 'It reacted the way it should: it came on when it got dark.', 'bright', 'It reacted, but backwards: it came on when it got bright. Check which way your comparison points.'),
    },
    hints: [
      'Turn the light level knob while the sketch runs, and watch the number the sensor gives. Which numbers mean dark?',
      'Read the sensor with <code>analogRead(SENSOR_PIN)</code>. Dark is a low number. Use <code>if</code> to compare it with a limit somewhere in the low hundreds, and write HIGH or LOW to the LED pin.',
      'In loop(): int light = analogRead(SENSOR_PIN); then if (light &lt; 300) digitalWrite(LED_PIN, HIGH); else digitalWrite(LED_PIN, LOW); then delay(50).',
    ],
    checks: [
      phases('The light stays off in daylight', [{ when: 'the hallway is bright (light level 90%)', set: { pot: bright }, expect: { led: false } }]),
      phases('The light comes on in the dark', [{ when: 'the hallway is dark (light level 10%)', set: { pot: dark }, expect: { led: true } }]),
      phases('It follows the light as it changes', [
        { when: 'the hallway is bright', set: { pot: bright }, expect: { led: false } },
        { when: 'the lights go out', set: { pot: dark }, expect: { led: true } },
        { when: 'the sun comes back', set: { pot: bright }, expect: { led: false } },
      ]),
    ],
    unlocks: ['button', 'ldr'],
  },
  {
    id: 'lamp', title: 'Reading lamp', place: 'Reading Room', hook: 'Dim a lamp smoothly with a dial.', map: [30, 63], after: ['nightlight'], guide: ['analog', 'knob'],
    story: 'The reading room lamp is either blinding or off. Build a <b>dimmer</b>: turning the dial up should make the lamp brighter, and all the way down should switch it off. A pin cannot output half a voltage, but it can switch on and off so fast that the LED looks dimmer. That is called PWM.',
    goal: 'The LED\'s brightness follows the dial from off to full.',
    controls: { pot: 'Lamp dial' },
    how: ['<code>analogWrite(pin, value)</code> switches a pin on and off very fast. A value of 0 is always off and 255 is always on. In between, the LED is on for that share of the time.', '<code>map(reading, 0, 1023, 0, 255)</code> turns a reading from 0 to 1023 into a brightness from 0 to 255.', 'Only the pins marked <b>~</b> on the board can do PWM.'],
    starter: `// Reading room lamp
const int KNOB_PIN = A0;
const int LAMP_PIN = 9;   // a pin marked ~ can dim with analogWrite

void setup() {
  pinMode(LAMP_PIN, OUTPUT);
}

void loop() {
  // read the knob (0 to 1023), turn it into a brightness (0 to 255), then use analogWrite
  delay(20);
}`,
    circuit: unoKnob,
    answer: `const int KNOB_PIN = A0;
const int LAMP_PIN = 9;

void setup() {
  pinMode(LAMP_PIN, OUTPUT);
}

void loop() {
  int reading = analogRead(KNOB_PIN);              // 0 to 1023
  int brightness = map(reading, 0, 1023, 0, 255);  // 0 to 255
  analogWrite(LAMP_PIN, brightness);
  delay(20);
}`,
    predict: {
      question: 'The lamp is built and the dial is turned up from a little to a lot. What will the LED do?',
      options: [
        { id: 'brighter', label: 'It gets brighter as the dial goes up' }, { id: 'dimmer', label: 'It gets dimmer as the dial goes up' },
        { id: 'same', label: 'It stays at one brightness' }, { id: 'never', label: 'It never lights' },
      ],
      demo: [{ from: 0, set: { pot: 0.2 } }, { from: 2000, set: { pot: 0.8 } }], run: 4000,
      classify: tr => {
        const low = Math.max(0, ...tr.at(1800).duties), high = Math.max(0, ...tr.at(3800).duties);
        return Math.max(low, high) < 0.02 ? 'never' : high > low + 0.2 ? 'brighter' : low > high + 0.2 ? 'dimmer' : 'same';
      },
      works: 'brighter',
      explain: {
        brighter: 'The LED got brighter as the dial went up, which is what a dimmer does.',
        dimmer: 'The LED got dimmer as the dial went up. The brightness has to grow with the reading.',
        same: 'The LED stayed at one brightness. It is probably only being switched fully on or fully off, not dimmed.',
        never: 'The LED never lit. Check that the sketch reads the knob and writes to the same pin the LED is wired to.',
      },
    },
    hints: [
      'Turn the dial slowly and watch the LED. Does it change smoothly, or only jump between off and on?',
      'Read the dial with <code>analogRead</code> (0 to 1023). Scale that to 0 to 255 with <code>map</code>, and write it with <code>analogWrite</code>, not <code>digitalWrite</code>, so the pin can dim.',
      'In loop(): int reading = analogRead(KNOB_PIN); int brightness = map(reading, 0, 1023, 0, 255); analogWrite(LAMP_PIN, brightness); delay(20);',
    ],
    checks: [
      phases('The lamp is off at zero', [{ when: 'the dial is turned all the way down', set: { pot: 0 }, expect: { led: false } }]),
      phases('The lamp gets brighter as the dial goes up', [
        { when: 'the dial is at 20%', set: { pot: 0.2 }, expect: { duty: [0.1, 0.3] } },
        { when: 'the dial is at 60%', set: { pot: 0.6 }, expect: { duty: [0.5, 0.7] } },
        { when: 'the dial is all the way up', set: { pot: 1 }, expect: { duty: [0.95, 1] } },
      ]),
    ],
    unlocks: ['buzzer'],
  },
  {
    id: 'chime', title: 'Door chime', place: 'Front Office', hook: 'Play a two-note chime when a visitor presses the bell.', map: [75, 53], after: ['lamp'], guide: ['button', 'digitalread', 'buzzer'],
    story: 'Visitors to the front office stand at the door and wait because nobody hears them. Build a <b>door chime</b>: when the bell button is pressed it plays two notes, and the rest of the time it stays silent.',
    goal: 'A button press plays a chime of two different notes. No press, no sound.',
    controls: { button: 'Hold to press the bell' },
    how: ['<code>INPUT_PULLUP</code> gives a button pin a gentle pull towards 5 V, so it reads HIGH until the button joins it to GND. Pressed reads <b>LOW</b>.', '<code>tone(pin, hertz)</code> starts a note and <code>noTone(pin)</code> stops it. A higher number is a higher note.', 'A note keeps playing until you stop it or start another, so wait between them with <code>delay()</code>.'],
    starter: `// Door chime
const int BUTTON_PIN = 2;
const int BUZZER_PIN = 8;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
  // when the button is pressed (it reads LOW), play two notes, then stop the sound
}`,
    circuit: [
      { t: 'button', id: 'btn', col: 20, ctl: 'Hold to press the button' },
      { t: 'wire', a: 'U:2', b: 'a20', c: 'yellow' }, { t: 'wire', a: 'a22', b: 'T-22', c: 'black' }, { t: 'wire', a: 'U:GND', b: 'T-1', c: 'black' },
      { t: 'buzzer', id: 'buzz', a: 'e26', b: 'e29' }, { t: 'wire', a: 'U:8', b: 'a26', c: 'purple' }, { t: 'wire', a: 'a29', b: 'T-29', c: 'black' },
    ],
    answer: `const int BUTTON_PIN = 2;
const int BUZZER_PIN = 8;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
  if (digitalRead(BUTTON_PIN) == LOW) {   // someone pressed the bell
    tone(BUZZER_PIN, 659);
    delay(250);
    tone(BUZZER_PIN, 523);
    delay(350);
    noTone(BUZZER_PIN);
  }
}`,
    predict: {
      question: 'The bell and the buzzer are wired. A visitor waits, then presses the button. What will you hear?',
      options: [
        { id: 'press', label: 'Silence, then a chime when the button is pressed' }, { id: 'always', label: 'Sound all the time' },
        { id: 'never', label: 'Nothing, even when the button is pressed' },
      ],
      demo: [{ from: 0, set: { button: 0 } }, { from: 1000, set: { button: 1 } }, { from: 1500, set: { button: 0 } }], run: 3000,
      classify: tr => (tr.window(0, 950).some(soundOn) ? 'always' : tr.window(1000, 2000).some(soundOn) ? 'press' : 'never'), works: 'press',
      explain: {
        press: 'It stayed silent until the button was pressed and then played, which is a door chime.',
        always: 'It made sound even before anyone pressed the button. The sketch is not waiting for the button.',
        never: 'It never made a sound. Check that the sketch reads the button and plays a note on the buzzer\'s pin.',
      },
    },
    hints: [
      'Hold the bell button while the sketch runs. Does the Serial Monitor or the buzzer react? Remember that with INPUT_PULLUP a pressed button reads LOW, not HIGH.',
      'Use <code>if (digitalRead(BUTTON_PIN) == LOW)</code> to notice a press. Inside it, <code>tone()</code> one note, <code>delay()</code>, <code>tone()</code> a different note, <code>delay()</code>, then <code>noTone()</code>.',
      'In loop(): if (digitalRead(BUTTON_PIN) == LOW) { tone(BUZZER_PIN, 659); delay(250); tone(BUZZER_PIN, 523); delay(350); noTone(BUZZER_PIN); }',
    ],
    checks: [
      phases('It is silent when nobody is at the door', [{ when: 'nobody has pressed the bell', set: { button: 0 }, ms: 1500, mode: 'during', expect: { sound: false } }]),
      phases('The chime plays when the bell is pressed', [
        { when: 'nobody is at the door', set: { button: 0 }, ms: 800, mode: 'during', expect: { sound: false } },
        { when: 'the bell is pressed', set: { button: 1 }, ms: 900, mode: 'during', expect: { sound: true } },
        { when: 'the visitor lets go and the chime has finished', set: { button: 0 }, ms: 1500, expect: { sound: false } },
      ]),
      {
        label: 'The chime has two different notes',
        plan: [{ from: 0, set: { button: 0 } }, { from: 500, set: { button: 1 } }, { from: 1000, set: { button: 0 } }], run: 2500,
        judge(tr) {
          if (tr.buzzerCount === 0) return 'I could not find a buzzer on your bench.';
          const notes = new Set(tr.window(500, 2500).map(s => Math.round(s.sound)).filter(n => n > 0));
          return notes.size >= 2 ? null : notes.size === 1 ? 'Only one note played. A chime needs two different notes.' : 'No note played when the bell was pressed.';
        },
      },
    ],
    unlocks: ['sonar'],
  },
  choose({
    id: 'democart', title: 'Demo cart', place: 'Science Lab', hook: 'The lab owns a box of motor shields. Choose the board they plug onto.', map: [25, 53], after: ['chime'], guide: ['boards', 'analog'],
    story: 'A science club wants a cart that drives itself across the lab. They already own ten <b>motor shields</b>: boards that plug on top of an Arduino and drive two motors. The cart\'s motors and its two light sensors are 5 V parts.',
    needs: [
      { need: { k: 'shield' }, text: 'The lab\'s motor shields plug straight onto it.' },
      { need: { k: 'volts5' }, text: 'Its motors and light sensors are 5 V parts, wired straight to the pins.' },
      { need: { k: 'analog', n: 2 }, text: 'It reads the two light sensors as analog values.' },
    ],
    hints: [
      'Start with the need that rules out the most boards: the shields.',
      'A shield only plugs onto a board with the Uno\'s header layout. Look at the "Uno shields" line on each card.',
      'The <b>Arduino Uno</b>. It is the only board here with the Uno\'s header layout, it runs at 5 V, and it has 6 analog inputs.',
    ],
  }),
  {
    id: 'parking', title: 'Parking bay sensor', place: 'Parking Lot', hook: 'Warn the driver when the car is too close to the wall.', map: [25, 43], after: ['chime'], guide: ['sonar', 'ifelse', 'serial'],
    story: 'Cars keep bumping the wall at the end of the parking bay. Build a <b>proximity warning</b>: a distance sensor measures how far away the wall is, and an LED comes on when the car is closer than <b>20 cm</b>. The slider under the 3D view moves the wall.',
    goal: 'The LED turns on only when the wall is closer than 20 cm.',
    controls: { sonar: 'Distance from the sensor to the wall' },
    how: ['The sensor sends out a ping and <code>pulseIn()</code> times how long the echo takes to come back, in microseconds.', 'Sound travels about 0.0343 cm per microsecond, and the ping goes there and back, so <code>distance = duration * 0.0343 / 2</code>.', 'A <code>float</code> can hold a number with a decimal point.'],
    starter: `// Parking bay sensor
const int TRIG_PIN = 9;
const int ECHO_PIN = 10;
const int LED_PIN = 13;

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  // send a ping
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // time the echo and turn it into a distance in centimetres
  long duration = pulseIn(ECHO_PIN, HIGH);
  float distance = duration * 0.0343 / 2;

  // light the LED when the distance is under 20, otherwise turn it off

  delay(250);
}`,
    circuit: [
      ...unoLed(13),
      { t: 'wire', a: 'a15', b: 'T-15', c: 'black' }, { t: 'wire', a: 'U:GND', b: 'T-2', c: 'black' }, { t: 'wire', a: 'U:5V', b: 'T+1', c: 'red' },
      { t: 'sonar', id: 'sonar', row: 'j', col: 18, ctl: 'Distance to the wall' },
      { t: 'wire', a: 'f18', b: 'T+18', c: 'red' }, { t: 'wire', a: 'f21', b: 'T-21', c: 'black' }, { t: 'wire', a: 'g19', b: 'U:9', c: 'blue' }, { t: 'wire', a: 'g20', b: 'U:10', c: 'green' },
    ],
    answer: `const int TRIG_PIN = 9;
const int ECHO_PIN = 10;
const int LED_PIN = 13;

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  // send a ping
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // time the echo
  long duration = pulseIn(ECHO_PIN, HIGH);
  float distance = duration * 0.0343 / 2;

  Serial.print(distance);
  Serial.println(" cm");

  if (distance < 20) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(250);
}`,
    predict: {
      question: 'The sensor, LED and sketch are ready. The wall starts far away, then moves close. What will the LED do?',
      options: [
        { id: 'near', label: 'It turns on when the wall is close' }, { id: 'far', label: 'It turns on when the wall is far away' },
        { id: 'always', label: 'It stays on whatever the wall does' }, { id: 'never', label: 'It never lights' },
      ],
      demo: [{ from: 0, set: { sonar: 60 } }, { from: 2000, set: { sonar: 10 } }], run: 4000,
      classify: reacts(ledOn, 1800, 3800, 'near', 'far'), works: 'near',
      explain: reactExplain('near', 'It lit when the wall came close, which is what a proximity warning does.', 'far', 'It lit when the wall was far away: the comparison points the wrong way.'),
    },
    hints: [
      'Open the Serial Monitor and slide the wall closer. Do the printed distances change? If the sensor never reads, check its power and its two signal wires.',
      'The sensor\'s pins are VCC, Trig, Echo and GND, from left to right. Power it from 5 V and GND, and wire Trig and Echo to pins the sketch uses. Then compare <code>distance</code> with 20 using <code>if</code> and <code>&lt;</code>.',
      'Wire VCC to the + rail (f18 to T+18), GND to the − rail (f21 to T−21), Trig to pin 9 (g19) and Echo to pin 10 (g20). In the sketch: if (distance < 20) digitalWrite(LED_PIN, HIGH); else digitalWrite(LED_PIN, LOW);',
    ],
    checks: [
      phases('The light is off when the bay is empty', [{ when: 'the wall is far away (60 cm)', set: { sonar: 60 }, expect: { led: false } }]),
      phases('The light comes on when a car is close', [{ when: 'a car is close to the wall (10 cm)', set: { sonar: 10 }, expect: { led: true } }]),
      phases('The limit is about 20 cm', [
        { when: 'the car is just inside the limit (17 cm)', set: { sonar: 17 }, expect: { led: true } },
        { when: 'the car is just outside the limit (24 cm)', set: { sonar: 24 }, expect: { led: false } },
      ]),
      phases('It follows the car as it drives in and out', [
        { when: 'the bay is empty', set: { sonar: 60 }, expect: { led: false } },
        { when: 'a car drives in', set: { sonar: 10 }, expect: { led: true } },
        { when: 'it drives out again', set: { sonar: 60 }, expect: { led: false } },
      ]),
    ],
    unlocks: ['soil'],
  },
  choose({
    id: 'linebot', title: 'Line-follower robot', place: 'Robotics Club', hook: 'Choose a board small enough for the club\'s robot.', map: [75, 43], after: ['parking'], guide: ['boards', 'analog'],
    story: 'The robotics club is building a robot that follows a black line on the floor. Five line sensors look down at the floor, each giving a voltage: high over white, low over black. The robot is small, and the sensors are 5 V parts.',
    needs: [
      { need: { k: 'fits', l: 50, w: 30 }, text: 'It fits on the robot\'s deck, which has room for a board 50 × 30 mm.' },
      { need: { k: 'volts5' }, text: 'Its five line sensors are 5 V parts, wired straight to the pins.' },
      { need: { k: 'analog', n: 5 }, text: 'It reads all five sensors as analog values.' },
    ],
    hints: [
      'There are three needs: size, voltage and analog inputs. Rule boards out one need at a time.',
      'The Uno has everything except the size. Is there a board with the Uno\'s chip in a smaller shape?',
      'The <b>Arduino Nano</b>: 45 × 18 mm, 5 V like the Uno, and 8 analog inputs.',
    ],
  }),
  {
    id: 'greenhouse', title: 'Plant alert', place: 'Greenhouse', hook: 'Warn the gardeners when the soil gets too dry.', map: [70, 33], after: ['parking'], guide: ['soil', 'analog', 'ifelse', 'buzzer'],
    story: 'The greenhouse dries out over the weekend and the tomato plants suffer. Push a <b>soil moisture sensor</b> into the pot and build a <b>plant-watering alert</b>: when the soil moisture falls below <b>30%</b>, light the alert LED <em>and</em> sound the buzzer. When the soil is moist again, go quiet.',
    goal: 'LED on and buzzer sounding when moisture is under 30%. Dark and silent otherwise.',
    controls: { soil: 'Soil moisture' },
    how: ['The soil sensor has three pins: <b>+</b> to 5V, <b>OUT</b> in the middle to A0, and <b>GND</b>. The wetter the soil, the higher the voltage on OUT.',
      '<code>map(value, 0, 1023, 0, 100)</code> turns a raw reading into a percentage, which is easier to think about.', 'One <code>if</code> can do several things: put them all between the braces.', 'Remember the <code>else</code> side too. An alert that never switches itself off is worse than none.'],
    starter: `// Greenhouse alert
const int MOISTURE_PIN = A0;
const int LED_PIN = 13;
const int BUZZER_PIN = 8;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int moisture = map(analogRead(MOISTURE_PIN), 0, 1023, 0, 100);   // percent

  // if the soil is under 30% turn the LED on and play a note
  // otherwise turn the LED off and stop the sound

  delay(100);
}`,
    circuit: [
      ...unoLed(13),
      { t: 'wire', a: 'a15', b: 'T-15', c: 'black' }, { t: 'wire', a: 'U:GND', b: 'T-2', c: 'black' }, { t: 'wire', a: 'U:5V', b: 'T+1', c: 'red' },
      { t: 'module', kind: 'soil', id: 'soil', row: 'd', col: 22, ctl: 'Soil moisture' },   // two columns left of where a knob would go, so the sensor's board clears the buzzer
      { t: 'wire', a: 'a22', b: 'T+22', c: 'red' }, { t: 'wire', a: 'a24', b: 'T-24', c: 'black' }, { t: 'wire', a: 'a23', b: 'U:A0', c: 'green' },
      { t: 'buzzer', id: 'buzz', a: 'e28', b: 'e30' }, { t: 'wire', a: 'U:8', b: 'a28', c: 'purple' }, { t: 'wire', a: 'a30', b: 'T-30', c: 'black' },
    ],
    answer: `const int MOISTURE_PIN = A0;
const int LED_PIN = 13;
const int BUZZER_PIN = 8;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int moisture = map(analogRead(MOISTURE_PIN), 0, 1023, 0, 100);   // percent

  if (moisture < 30) {         // too dry
    digitalWrite(LED_PIN, HIGH);
    tone(BUZZER_PIN, 440);
  } else {
    digitalWrite(LED_PIN, LOW);
    noTone(BUZZER_PIN);
  }
  delay(100);
}`,
    predict: {
      question: 'The alert is built. The soil starts moist and then dries out. What will the alert do?',
      options: [
        { id: 'dry', label: 'LED and buzzer come on when the soil gets dry' }, { id: 'moist', label: 'LED and buzzer come on when the soil gets moist' },
        { id: 'always', label: 'The alert is on the whole time' }, { id: 'never', label: 'The alert never comes on' },
      ],
      demo: [{ from: 0, set: { soil: 0.7 } }, { from: 2000, set: { soil: 0.1 } }], run: 4000,
      classify: reacts(s => ledOn(s) || soundOn(s), 1800, 3800, 'dry', 'moist'), works: 'dry',
      explain: reactExplain('dry', 'The alert came on when the soil dried out, which is what the gardeners need.', 'moist', 'The alert came on when the soil was moist: the comparison points the wrong way.'),
    },
    hints: [
      'Slide the Soil moisture control down and watch both the LED and the sound. Which one is not reacting?',
      'One <code>if (moisture &lt; 30)</code> can both light the LED and play a note. The <code>else</code> part must turn the LED off and call <code>noTone()</code> to stop the sound.',
      'In loop(): if (moisture < 30) { digitalWrite(LED_PIN, HIGH); tone(BUZZER_PIN, 440); } else { digitalWrite(LED_PIN, LOW); noTone(BUZZER_PIN); } then delay(100).',
    ],
    checks: [
      phases('It is quiet while the soil is moist', [{ when: 'the soil is moist (70%)', set: { soil: 0.7 }, expect: { led: false, sound: false } }]),
      phases('The alert comes on when the soil is dry', [{ when: 'the soil is dry (10%)', set: { soil: 0.1 }, expect: { led: true, sound: true } }]),
      phases('The limit is about 30%', [
        { when: 'the soil is at 25%', set: { soil: 0.25 }, expect: { led: true, sound: true } },
        { when: 'the soil is at 35%', set: { soil: 0.35 }, expect: { led: false, sound: false } },
      ]),
      phases('It follows the soil as it dries and is watered', [
        { when: 'the soil is moist', set: { soil: 0.7 }, expect: { led: false, sound: false } },
        { when: 'it dries out', set: { soil: 0.1 }, expect: { led: true, sound: true } },
        { when: 'the gardener waters it', set: { soil: 0.7 }, expect: { led: false, sound: false } },
      ]),
    ],
    unlocks: [],
  },
  {
    id: 'crossing', title: 'Crossing signal', place: 'Crossing', hook: 'Keep a warning light blinking and answer the walk button at once.', map: [30, 23], after: ['greenhouse'], guide: ['millis', 'delay', 'button', 'variables'],
    story: 'The pedestrian crossing has a red <b>warning light</b> that blinks all day, and a green <b>walk light</b> that should come on the moment a pedestrian presses the button. The old sketch blinks with <code>delay()</code>. While the board waits it cannot see the button, so quick taps are missed. Rewrite it so the board never stops to wait: watch the clock with <code>millis()</code> instead.',
    goal: 'The red LED keeps blinking about once a second. The green LED lights the instant the button is pressed and goes off when it is let go.',
    controls: { button: 'Hold to press the walk button' },
    how: [
      '<code>millis()</code> is how many milliseconds the board has been running. It keeps counting while the sketch does other things.',
      'Remember when the red light last changed. When <code>millis() - lastChange &gt;= 500</code>, flip it and remember the new time.',
      'With no <code>delay()</code> in <code>loop()</code>, the board goes round thousands of times a second and looks at the button every time.',
    ],
    starter: `// Crossing signal
const int WARN_PIN = 12;     // red warning light
const int WALK_PIN = 11;     // green walk light
const int BUTTON_PIN = 2;    // reads LOW while pressed

void setup() {
  pinMode(WARN_PIN, OUTPUT);
  pinMode(WALK_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
  // the warning light: it blinks, but while delay() waits the board cannot see the button
  digitalWrite(WARN_PIN, HIGH);
  delay(500);
  digitalWrite(WARN_PIN, LOW);
  delay(500);

  // the walk light: on while the button is held
  if (digitalRead(BUTTON_PIN) == LOW) {
    digitalWrite(WALK_PIN, HIGH);
  } else {
    digitalWrite(WALK_PIN, LOW);
  }
}`,
    circuit: [
      { t: 'wire', a: 'U:12', b: 'a5', c: 'orange' },
      { t: 'led', id: 'warn', a: 'e5', k: 'e6', color: 0xff3b30 },
      { t: 'res', a: 'c6', b: 'c9' },
      { t: 'wire', a: 'a9', b: 'T-9', c: 'black' },
      { t: 'wire', a: 'U:11', b: 'a11', c: 'green' },
      { t: 'led', id: 'walk', a: 'e11', k: 'e12', color: 0x2ecc40 },
      { t: 'res', a: 'c12', b: 'c15' },
      { t: 'wire', a: 'a15', b: 'T-15', c: 'black' },
      { t: 'button', id: 'btn', col: 20, ctl: 'Hold to press the button' },
      { t: 'wire', a: 'U:2', b: 'a20', c: 'yellow' }, { t: 'wire', a: 'a22', b: 'T-22', c: 'black' },
      { t: 'wire', a: 'U:GND', b: 'T-1', c: 'black' },
    ],
    answer: `const int WARN_PIN = 12;     // red warning light
const int WALK_PIN = 11;     // green walk light
const int BUTTON_PIN = 2;    // reads LOW while pressed

unsigned long lastChange = 0;   // when the warning light last changed
bool warnOn = false;

void setup() {
  pinMode(WARN_PIN, OUTPUT);
  pinMode(WALK_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
  unsigned long now = millis();

  // the warning light: flip it every 500 ms, without waiting
  if (now - lastChange >= 500) {
    warnOn = !warnOn;
    digitalWrite(WARN_PIN, warnOn);
    lastChange = now;
  }

  // the walk light: checked on every pass, so it answers at once
  if (digitalRead(BUTTON_PIN) == LOW) {
    digitalWrite(WALK_PIN, HIGH);
  } else {
    digitalWrite(WALK_PIN, LOW);
  }
}`,
    predict: {
      question: 'Three pedestrians each tap the walk button quickly, one after another. What will the green walk light do?',
      options: [{ id: 'instant', label: 'It lights for every tap, straight away' }, { id: 'late', label: 'It misses some of the taps' }, { id: 'never', label: 'It never lights' }],
      demo: TAPS, run: 4000,
      classify: tr => {
        const green = colorOn(tr, 'green'), seen = TAP_TIMES.filter(t => tr.window(t, t + 100).some(green)).length;
        return seen === TAP_TIMES.length ? 'instant' : tr.samples.some(green) ? 'late' : 'never';
      },
      works: 'instant',
      explain: {
        instant: 'The walk light answered every tap, because the board never stopped to wait.',
        late: 'Some taps were missed. While delay() waits, the board is not looking at the button at all. Use millis() so loop() never stops.',
        never: 'The walk light never came on. Check the button and green LED wiring, and that the sketch writes HIGH to the walk pin while the button reads LOW.',
      },
    },
    hints: [
      'Tap the walk button quickly a few times while the sketch runs. Does the green light answer every tap? Open the Timeline: the board only looks at the button once a second, between the delays.',
      'Take out both <code>delay()</code> calls. Keep a variable <code>lastChange</code> with the time the red light last changed. When <code>millis() - lastChange &gt;= 500</code>, flip the light and set <code>lastChange</code> to the time now. The button check can stay as it is.',
      'Above setup(): unsigned long lastChange = 0; bool warnOn = false; In loop(): unsigned long now = millis(); if (now - lastChange >= 500) { warnOn = !warnOn; digitalWrite(WARN_PIN, warnOn); lastChange = now; } then the same if/else for the button, with no delay() anywhere.',
    ],
    checks: [
      blinks('The red warning light keeps blinking', 'red'),
      blinks('It keeps blinking while someone holds the button', 'red', [{ from: 0, set: { button: 1 } }]),
      phases('The walk light stays off while nobody waits', [{ when: 'nobody is at the crossing', set: { button: 0 }, ms: 2500, mode: 'during', expect: { green: false } }]),
      phases('The walk light answers every tap at once', [
        { when: 'nobody is at the crossing', set: { button: 0 }, ms: 1000, expect: { green: false } },
        { when: 'a pedestrian taps the button', set: { button: 1 }, ms: 150, expect: { green: true } },
        { when: 'they let go', set: { button: 0 }, ms: 1100, expect: { green: false } },
        { when: 'a second pedestrian taps the button', set: { button: 1 }, ms: 150, expect: { green: true } },
        { when: 'they let go', set: { button: 0 }, ms: 1200, expect: { green: false } },
        { when: 'a third pedestrian taps the button', set: { button: 1 }, ms: 150, expect: { green: true } },
      ]),
    ],
    unlocks: ['servo', 'reed'],
  },
  {
    id: 'barrier', title: 'Bus-bay barrier', place: 'Bus Loop', hook: 'Lift a barrier arm with a servo when the bus driver presses the button.', map: [70, 13], after: ['crossing'], guide: ['servo', 'button', 'digitalread'],
    story: 'Cars keep parking in the bus loop, so a <b>barrier arm</b> now goes across it. Build the controller: a <b>servo</b> motor turns the arm. It rests down at <b>0°</b>. When the bus driver presses the button, the arm lifts to <b>90°</b>, stays up for <b>3 seconds</b> so the bus can drive through, then comes back down by itself.',
    goal: 'The servo rests at 0°. A press lifts it to 90° for about 3 seconds, then it goes back to 0°.',
    controls: { button: 'Hold to press the driver\'s button' },
    how: [
      '<code>#include &lt;Servo.h&gt;</code> brings in the Servo library, and <code>Servo barrier;</code> makes one servo for the sketch to control.',
      '<code>barrier.attach(9)</code> says which pin its orange signal wire is on. <code>barrier.write(90)</code> turns it to 90° and holds it there.',
      'A servo\'s motor needs more current than a pin can give, so its red wire goes to <b>5V</b> and its brown wire to <b>GND</b>. Only the orange signal wire goes to a pin.',
    ],
    starter: `// Bus-bay barrier
#include <Servo.h>

const int BUTTON_PIN = 2;   // reads LOW while pressed
const int SERVO_PIN = 9;

Servo barrier;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  barrier.attach(SERVO_PIN);
  barrier.write(0);   // start with the arm down
}

void loop() {
  // when the button is pressed: lift the arm to 90, wait 3 seconds, then put it back down to 0
}`,
    circuit: [
      { t: 'button', id: 'btn', col: 20, ctl: 'Hold to press the button' },
      { t: 'wire', a: 'U:2', b: 'a20', c: 'yellow' }, { t: 'wire', a: 'a22', b: 'T-22', c: 'black' }, { t: 'wire', a: 'U:GND', b: 'T-1', c: 'black' },
      { t: 'servo', id: 'servo', row: 'g', col: 24 },
      { t: 'wire', a: 'j24', b: 'B-24', c: 'black' }, { t: 'wire', a: 'j25', b: 'B+25', c: 'red' }, { t: 'wire', a: 'j26', b: 'U:9', c: 'orange' },
      { t: 'wire', a: 'U:5V', b: 'B+1', c: 'red' }, { t: 'wire', a: 'U:GNDb', b: 'B-2', c: 'black' },
    ],
    answer: `#include <Servo.h>

const int BUTTON_PIN = 2;   // reads LOW while pressed
const int SERVO_PIN = 9;

Servo barrier;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  barrier.attach(SERVO_PIN);
  barrier.write(0);   // start with the arm down
}

void loop() {
  if (digitalRead(BUTTON_PIN) == LOW) {   // the driver pressed the button
    barrier.write(90);   // lift the arm
    delay(3000);         // time for the bus to drive through
    barrier.write(0);    // and down again
  }
}`,
    predict: {
      question: 'The barrier is wired and the sketch is ready. The bus driver taps the button once. What will the arm do?',
      options: [
        { id: 'lifts', label: 'It lifts, waits, then comes down by itself' }, { id: 'stays', label: 'It lifts and stays up' },
        { id: 'held', label: 'It is only up while the button is held' }, { id: 'never', label: 'It does not move' },
      ],
      demo: [{ from: 0, set: { button: 0 } }, { from: 1000, set: { button: 1 } }, { from: 1300, set: { button: 0 } }], run: 6000,
      classify: tr => {
        const up = (t: number) => servoAt(tr.at(t)) >= 45;
        return up(2600) ? (up(5800) ? 'stays' : 'lifts') : up(1200) ? 'held' : 'never';
      },
      works: 'lifts',
      explain: {
        lifts: 'The arm lifted, waited while the bus drove through, and came down again by itself.',
        stays: 'The arm lifted but never came down. After the wait, write 0 to put it back.',
        held: 'The arm was only up while the button was held, so it dropped before the bus could get through. Lift it, then wait with delay() before putting it down.',
        never: 'The arm did not move. Check that the sketch writes 90 when the button reads LOW, that attach() uses the pin the orange wire is on, and that the servo has 5 V and GND.',
      },
    },
    hints: [
      'Press the button while the sketch runs and watch the servo arm. Does the Circuit check say anything about the servo? Its red + wire needs 5 V.',
      'Inside <code>loop()</code>, check <code>if (digitalRead(BUTTON_PIN) == LOW)</code>. Inside it: <code>barrier.write(90)</code>, a <code>delay()</code> of 3000 milliseconds, then <code>barrier.write(0)</code>.',
      'In loop(): if (digitalRead(BUTTON_PIN) == LOW) { barrier.write(90); delay(3000); barrier.write(0); } Put the servo lead in g24 to g26, then wire j24 to the − rail, j25 to the + rail and j26 to pin 9, with the rails on 5V and GND.',
    ],
    checks: [
      phases('The arm rests down', [{ when: 'no bus is waiting', set: { button: 0 }, ms: 1500, expect: { servo: [0, 10] } }]),
      phases('A press lifts the arm', [
        { when: 'no bus is waiting', set: { button: 0 }, ms: 800, expect: { servo: [0, 10] } },
        { when: 'the driver presses the button', set: { button: 1 }, ms: 600, expect: { servo: [80, 100] } },
      ]),
      phases('The arm stays up while the bus drives through', [
        { when: 'no bus is waiting', set: { button: 0 }, ms: 800, expect: { servo: [0, 10] } },
        { when: 'the driver taps the button', set: { button: 1 }, ms: 300, expect: { servo: [80, 100] } },
        { when: 'the bus is driving through, two seconds later', set: { button: 0 }, ms: 2000, expect: { servo: [80, 100] } },
      ]),
      phases('The arm comes down again by itself', [
        { when: 'no bus is waiting', set: { button: 0 }, ms: 800, expect: { servo: [0, 10] } },
        { when: 'the driver taps the button', set: { button: 1 }, ms: 300, expect: { servo: [80, 100] } },
        { when: 'the bus has gone, five seconds later', set: { button: 0 }, ms: 5000, expect: { servo: [0, 10] } },
      ]),
    ],
    unlocks: [],
  },
  {
    id: 'colddoor', title: 'Cold-store door alarm', place: 'Cold Store', hook: 'Sound an alarm when the cold-store door is left open, but not on every quick visit.', map: [30, 5], after: ['crossing'], guide: ['reed', 'millis', 'digitalread', 'buzzer'],
    story: 'The kitchen\'s walk-in <b>cold store</b> warms up whenever its door is left open, and food has been thrown away twice this month. The old alarm buzzed the moment the door opened, on every single visit, so the cooks unplugged it. Fit a <b>reed switch</b> to the door frame, where the magnet on the door holds it closed while the door is shut. Light a red lamp as soon as the door opens, but sound the buzzer only if the door stays open for <b>more than 5 seconds</b>. Shutting the door silences it, and the next opening starts the count again.',
    goal: 'The red light is on whenever the door is open. The buzzer sounds once the door has been open for 5 seconds, and stops when the door is shut.',
    controls: { reed: 'Magnet on the door' },
    how: [
      'Wire the reed switch like a button: one leg to pin 2 with <code>INPUT_PULLUP</code>, the other to GND. While the door is shut the magnet closes the switch and the pin reads <b>LOW</b>. An open door reads <b>HIGH</b>.',
      'Start counting at the moment the door <em>opens</em>: when it is open now but was not on the last pass of <code>loop()</code>, remember <code>openedAt = millis()</code>.',
      'Sound the buzzer while the door is open and <code>millis() - openedAt &gt;= LIMIT_MS</code>. Do not wait with <code>delay()</code>: the light would lag, and the board could not see the door being shut.',
    ],
    starter: `// Cold-store door alarm
const int REED_PIN = 2;      // LOW while the door is shut: the magnet closes the switch
const int LIGHT_PIN = 12;    // red "door open" light
const int BUZZER_PIN = 8;
const unsigned long LIMIT_MS = 5000;   // how long the door may stay open before the alarm

void setup() {
  pinMode(REED_PIN, INPUT_PULLUP);
  pinMode(LIGHT_PIN, OUTPUT);
}

void loop() {
  // the old alarm: it buzzes the moment the door opens, on every visit
  if (digitalRead(REED_PIN) == HIGH) {   // the door is open
    digitalWrite(LIGHT_PIN, HIGH);
    tone(BUZZER_PIN, 880);
  } else {
    digitalWrite(LIGHT_PIN, LOW);
    noTone(BUZZER_PIN);
  }
}`,
    circuit: [
      { t: 'wire', a: 'U:12', b: 'a5', c: 'orange' }, { t: 'led', id: 'light', a: 'e5', k: 'e6', color: 0xff3b30 }, { t: 'res', a: 'c6', b: 'c9' }, { t: 'wire', a: 'a9', b: 'T-9', c: 'black' },
      { t: 'contact', kind: 'reed', id: 'reed', a: 'e20', b: 'e22', ctl: 'Magnet' }, { t: 'wire', a: 'U:2', b: 'a20', c: 'yellow' }, { t: 'wire', a: 'a22', b: 'T-22', c: 'black' },
      { t: 'buzzer', id: 'buzz', a: 'e28', b: 'e30' }, { t: 'wire', a: 'U:8', b: 'a28', c: 'purple' }, { t: 'wire', a: 'a30', b: 'T-30', c: 'black' },
      { t: 'wire', a: 'U:GND', b: 'T-1', c: 'black' },
    ],
    answer: `const int REED_PIN = 2;      // LOW while the door is shut: the magnet closes the switch
const int LIGHT_PIN = 12;    // red "door open" light
const int BUZZER_PIN = 8;
const unsigned long LIMIT_MS = 5000;   // how long the door may stay open before the alarm

bool wasOpen = false;
unsigned long openedAt = 0;  // when the door was last opened

void setup() {
  pinMode(REED_PIN, INPUT_PULLUP);
  pinMode(LIGHT_PIN, OUTPUT);
}

void loop() {
  bool doorOpen = digitalRead(REED_PIN) == HIGH;

  if (doorOpen && !wasOpen) {   // the door has just been opened: start counting
    openedAt = millis();
  }
  wasOpen = doorOpen;

  digitalWrite(LIGHT_PIN, doorOpen);
  if (doorOpen && millis() - openedAt >= LIMIT_MS) {
    tone(BUZZER_PIN, 880);
  } else {
    noTone(BUZZER_PIN);
  }
}`,
    predict: {
      question: 'Someone opens the cold-store door, takes out a crate, and shuts it again 3 seconds later. What will the alarm do?',
      options: [
        { id: 'quiet', label: 'The light comes on while the door is open, and the buzzer stays quiet' }, { id: 'beeps', label: 'The buzzer sounds as soon as the door opens' },
        { id: 'always', label: 'Something is on while the door is shut' }, { id: 'never', label: 'Nothing happens at all' },
      ],
      demo: [{ from: 0, set: { reed: 1 } }, { from: 1000, set: { reed: 0 } }, { from: 4000, set: { reed: 1 } }], run: 5000,
      classify: tr => {
        const before = ledOn(tr.at(800)) || soundOn(tr.at(800)), light = ledOn(tr.at(2500)), beeped = tr.window(1000, 4000).some(soundOn);
        return before ? 'always' : beeped ? 'beeps' : light ? 'quiet' : 'never';
      },
      works: 'quiet',
      explain: {
        quiet: 'The light showed the door was open, and the buzzer stayed quiet for a quick visit, which is what the cooks need.',
        beeps: 'The buzzer sounded on a quick visit, like the old alarm the cooks unplugged. Start counting when the door opens, and sound the buzzer only once 5 seconds have gone by.',
        always: 'Something was on while the door was shut. With <code>INPUT_PULLUP</code> a shut door reads LOW and an open one HIGH: check which one the sketch treats as open, and that the switch\'s other leg goes to GND.',
        never: 'Nothing came on while the door was open. Check that the switch is on the pin the sketch reads, that the pin uses <code>INPUT_PULLUP</code>, and that the light\'s pin matches its wire.',
      },
    },
    hints: [
      'Flip the door\'s magnet to "away" and back to "near" within a couple of seconds. The old sketch buzzes at once: the buzzer has to wait until the door has been open for 5 seconds.',
      'Keep <code>bool wasOpen</code> and <code>unsigned long openedAt</code> above setup(). When the door is open now but <code>wasOpen</code> is false, it has just opened: set <code>openedAt = millis()</code>. Then set <code>wasOpen = doorOpen</code>. Sound the buzzer only while the door is open and <code>millis() - openedAt &gt;= LIMIT_MS</code>.',
      'Above setup(): bool wasOpen = false; unsigned long openedAt = 0; In loop(): bool doorOpen = digitalRead(REED_PIN) == HIGH; if (doorOpen && !wasOpen) { openedAt = millis(); } wasOpen = doorOpen; digitalWrite(LIGHT_PIN, doorOpen); if (doorOpen && millis() - openedAt >= LIMIT_MS) { tone(BUZZER_PIN, 880); } else { noTone(BUZZER_PIN); }',
    ],
    checks: [
      phases('All is quiet while the door is shut', [{ when: 'the door is shut', set: { reed: 1 }, ms: 3000, mode: 'during', expect: { led: false, sound: false } }]),
      phases('The light comes on the moment the door opens', [
        { when: 'the door is shut', set: { reed: 1 }, ms: 1000, expect: { led: false } },
        { when: 'the door has just been opened', set: { reed: 0 }, ms: 300, expect: { led: true, sound: false } },
      ]),
      phases('A quick visit does not sound the alarm', [
        { when: 'the door is shut', set: { reed: 1 }, ms: 500, expect: { led: false, sound: false } },
        { when: 'someone fetches a crate in 3 seconds', set: { reed: 0 }, ms: 3000, mode: 'during', expect: { sound: false } },
        { when: 'they shut the door again', set: { reed: 1 }, ms: 1500, expect: { led: false, sound: false } },
      ]),
      phases('The alarm sounds when the door is left open', [
        { when: 'the door is shut', set: { reed: 1 }, ms: 500, expect: { led: false } },
        { when: 'the door has been open for nearly 4 seconds', set: { reed: 0 }, ms: 4000, expect: { led: true, sound: false } },
        { when: 'the door has been open for nearly 6 seconds', set: { reed: 0 }, ms: 2000, expect: { led: true, sound: true } },
      ]),
      phases('Shutting the door silences it, and the next opening counts from the start', [
        { when: 'the door is shut', set: { reed: 1 }, ms: 500, expect: { sound: false } },
        { when: 'the door has been left open', set: { reed: 0 }, ms: 6500, expect: { sound: true } },
        { when: 'someone shuts it', set: { reed: 1 }, ms: 1000, expect: { led: false, sound: false } },
        { when: 'it has been open again for nearly 3 seconds', set: { reed: 0 }, ms: 3000, expect: { led: true, sound: false } },
        { when: 'it has been open again for nearly 6 seconds', set: { reed: 0 }, ms: 3000, expect: { sound: true } },
      ]),
    ],
    unlocks: [],
  },
  {
    id: 'streetlamp', title: 'Street lamp', place: 'Staff Car Park', hook: 'Switch a lamp on at dusk with a real light sensor, without it flickering.', map: [25, 73], after: ['nightlight'], guide: ['ldr', 'analog', 'variables'],
    story: 'The staff car park has a lamp on a pole, and the old timer switches it on at the wrong time all year round. Fit a <b>light sensor</b> instead. At dusk the light fades slowly, and a lamp that flicks on and off at every cloud would drive the neighbours mad, so the lamp needs to be <b>properly dark</b> before it turns on and <b>properly bright</b> before it turns off. The light sensor is a resistor whose value changes with the light, so you will build its voltage divider yourself.',
    goal: 'The lamp comes on in the dark and goes off in daylight, and it stays as it is in the gloomy stretch in between.',
    controls: { ldr: 'Light in the car park' },
    how: [
      'A light sensor (LDR) is a <b>resistor that changes with light</b>: about 1 kΩ in bright light and 100 kΩ in the dark. A pin cannot read resistance, only voltage, so put the sensor in a <b>divider</b>: 5V, then the sensor, then a 10 kΩ resistor, then GND. The pin reads the point between them.',
      'In the dark the sensor resists more, so less of the 5 V is left for the pin: <b>dark is a low number</b>, as with the knob.',
      'To stop flicker, use two limits. Below the first the lamp turns on, above the second it turns off, and in between it keeps doing what it was doing. A <code>bool</code> variable remembers it.',
    ],
    starter: `// Staff car park street lamp
const int SENSOR_PIN = A0;   // the light sensor's divider
const int LAMP_PIN = 9;
const int DARK_BELOW = 250;    // below this it is properly dark
const int BRIGHT_ABOVE = 450;  // above this it is properly bright

bool lampOn = false;         // remembers what the lamp is doing

void setup() {
  pinMode(LAMP_PIN, OUTPUT);
}

void loop() {
  int light = analogRead(SENSOR_PIN);

  // 1. properly dark: remember that the lamp is on
  // 2. properly bright: remember that it is off
  // 3. in between: change nothing
  // then write lampOn to the lamp pin

  delay(50);
}`,
    circuit: unoLdr,
    answer: `const int SENSOR_PIN = A0;
const int LAMP_PIN = 9;
const int DARK_BELOW = 250;
const int BRIGHT_ABOVE = 450;

bool lampOn = false;

void setup() {
  pinMode(LAMP_PIN, OUTPUT);
}

void loop() {
  int light = analogRead(SENSOR_PIN);

  if (light < DARK_BELOW) {
    lampOn = true;
  } else if (light > BRIGHT_ABOVE) {
    lampOn = false;
  }

  if (lampOn) {
    digitalWrite(LAMP_PIN, HIGH);
  } else {
    digitalWrite(LAMP_PIN, LOW);
  }
  delay(50);
}`,
    predict: {
      question: 'The light sensor, its resistor and the lamp are built. It starts out bright, then gets dark. What will the lamp do?',
      options: [
        { id: 'dark', label: 'It turns on when it gets dark' }, { id: 'bright', label: 'It turns on when it gets bright' },
        { id: 'always', label: 'It stays on whatever happens' }, { id: 'never', label: 'It never lights' },
      ],
      demo: [{ from: 0, set: { ldr: bright } }, { from: 2000, set: { ldr: dark } }], run: 4000,
      classify: reacts(ledOn, 1800, 3800, 'dark', 'bright'), works: 'dark',
      explain: reactExplain('dark', 'It reacted the way it should: it came on when it got dark.', 'bright', 'It reacted, but backwards: it came on when it got bright. Check which way your comparison points.'),
    },
    hints: [
      'Move the Light in the car park slider while the sketch runs and watch the number the sensor gives. Which way does it go in the dark? If it never changes, check the divider: the sensor and the 10 kΩ resistor must meet in the column that goes to A0.',
      'Dark is a low reading. Turn <code>lampOn</code> on when <code>light &lt; DARK_BELOW</code>, off when <code>light &gt; BRIGHT_ABOVE</code>, and do nothing in between. Then write the lamp pin from <code>lampOn</code>.',
      'In loop(): int light = analogRead(SENSOR_PIN); if (light < DARK_BELOW) lampOn = true; else if (light > BRIGHT_ABOVE) lampOn = false; then if (lampOn) digitalWrite(LAMP_PIN, HIGH); else digitalWrite(LAMP_PIN, LOW); then delay(50). Wire 5V to the sensor, the sensor to a 10 kΩ resistor, the resistor to GND, and the point between them to A0.',
    ],
    checks: [
      phases('The lamp stays off in daylight', [{ when: 'it is bright (light 90%)', set: { ldr: bright }, expect: { led: false } }]),
      phases('The lamp comes on in the dark', [{ when: 'it is dark (light 10%)', set: { ldr: dark }, expect: { led: true } }]),
      phases('It does not flicker at dusk', [
        { when: 'it is bright', set: { ldr: bright }, expect: { led: false } },
        { when: 'the light fades to dusk (35%), not dark enough yet', set: { ldr: 0.35 }, expect: { led: false } },
        { when: 'it gets properly dark', set: { ldr: dark }, expect: { led: true } },
        { when: 'the light comes back to dusk (35%), not bright enough yet', set: { ldr: 0.35 }, expect: { led: true } },
        { when: 'the sun is fully up', set: { ldr: bright }, expect: { led: false } },
      ]),
    ],
    unlocks: ['temp'],
  },
  {
    id: 'heatwarn', title: 'Heat warning', place: 'Server Room', hook: 'Read a temperature sensor, print it, and warn when the room gets too hot.', map: [25, 33], after: ['streetlamp'], guide: ['temp', 'analog', 'serial'],
    story: 'The school\'s server cupboard has no fan, and last summer it got so hot that it shut itself down. Put a <b>temperature sensor</b> in it. The sketch must print the temperature in °C on the Serial Monitor, and turn a warning LED on when it goes over <b>30 °C</b>.',
    goal: 'The Serial Monitor shows the temperature in °C, and the LED is on above 30 °C and off at or below it.',
    controls: { temp: 'Room temperature' },
    how: [
      'The <b>TMP36</b> gives <b>0.5 V at 0 °C plus 10 mV for every degree</b>. Facing the flat side: left leg to 5V, middle leg is the output (to A0), right leg to GND.',
      '<code>analogRead()</code> gives 0 to 1023 for 0 to 5 V. Turn it into volts first with <code>raw * 5.0 / 1023.0</code>, then into degrees with <code>(volts - 0.5) * 100.0</code>.',
      'Use <code>float</code> for numbers with a decimal point, and write them with <code>Serial.println()</code>. Put the numbers in the sketch as <code>5.0</code> and <code>100.0</code>, not <code>5</code> and <code>100</code>, or the division throws away the decimals.',
    ],
    starter: `// Server room heat warning
const int SENSOR_PIN = A0;   // the TMP36's output
const int WARN_PIN = 9;

void setup() {
  pinMode(WARN_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(SENSOR_PIN);    // 0 to 1023

  // 1. turn raw into volts: raw * 5.0 / 1023.0
  // 2. turn volts into degrees: (volts - 0.5) * 100.0
  // 3. print the degrees
  // 4. turn the warning on above 30, otherwise off

  delay(500);
}`,
    circuit: unoTemp,
    answer: `const int SENSOR_PIN = A0;
const int WARN_PIN = 9;

void setup() {
  pinMode(WARN_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(SENSOR_PIN);
  float volts = raw * 5.0 / 1023.0;      // 0 to 5 V
  float celsius = (volts - 0.5) * 100.0; // TMP36: 0.5 V at 0 degrees, 10 mV per degree

  Serial.println(celsius);

  if (celsius > 30) {
    digitalWrite(WARN_PIN, HIGH);
  } else {
    digitalWrite(WARN_PIN, LOW);
  }
  delay(500);
}`,
    predict: {
      question: 'The sensor and the warning LED are built. The room starts cool, then heats up to 40 °C. What will the LED do?',
      options: [
        { id: 'hot', label: 'It turns on when the room gets hot' }, { id: 'cold', label: 'It turns on when the room gets cool' },
        { id: 'always', label: 'It stays on whatever happens' }, { id: 'never', label: 'It never lights' },
      ],
      demo: [{ from: 0, set: { temp: 22 } }, { from: 2000, set: { temp: 40 } }], run: 4000,
      classify: reacts(ledOn, 1800, 3800, 'hot', 'cold'), works: 'hot',
      explain: reactExplain('hot', 'It reacted the way it should: it came on when the room got hot.', 'cold', 'It reacted, but backwards: it came on when the room was cool. Check which way your comparison points.'),
    },
    hints: [
      'Print the raw reading first with <code>Serial.println(raw)</code> and move the temperature slider. At 25 °C the sensor gives 0.75 V, which is about 153. If the number never changes, the sensor is not wired to A0, or it has no power.',
      'Volts are <code>raw * 5.0 / 1023.0</code>. Degrees are <code>(volts - 0.5) * 100.0</code>, because 0.5 V means 0 °C and each 10 mV is a degree. Then <code>if (celsius &gt; 30)</code> chooses the LED.',
      'In loop(): int raw = analogRead(SENSOR_PIN); float volts = raw * 5.0 / 1023.0; float celsius = (volts - 0.5) * 100.0; Serial.println(celsius); if (celsius > 30) digitalWrite(WARN_PIN, HIGH); else digitalWrite(WARN_PIN, LOW); delay(500). Put 5V on the sensor\'s left leg, A0 on the middle, GND on the right.',
    ],
    checks: [
      phases('It prints the temperature in degrees', [
        { when: 'the room is 25 °C', set: { temp: 25 }, expect: { serial: /\b2[45]\.\d/ } },
        { when: 'the room heats up to 40 °C', set: { temp: 40 }, expect: { serial: /\b(39|40)\.\d/ } },
      ]),
      phases('The warning stays off while the room is cool', [{ when: 'the room is 22 °C', set: { temp: 22 }, expect: { led: false } }]),
      phases('The warning comes on when the room is hot', [{ when: 'the room is 38 °C', set: { temp: 38 }, expect: { led: true } }]),
      phases('It follows the temperature as it changes', [
        { when: 'the room is cool (22 °C)', set: { temp: 22 }, expect: { led: false } },
        { when: 'it heats up (38 °C)', set: { temp: 38 }, expect: { led: true } },
        { when: 'the window is opened and it cools (26 °C)', set: { temp: 26 }, expect: { led: false } },
      ]),
    ],
    unlocks: [],
  },
  {
    id: 'workshop', title: 'Open studio', place: 'Open Studio', hook: 'Free build with every part, open from the start.', map: [75, 93], after: [], sandbox: true, guide: ['circuit', 'breadboard', 'switch', 'loops', 'functions'],
    story: 'The studio is yours: no goal and no checks. <b>Every part is in the tray here</b>, whether or not a mission has unlocked it yet, so you can build and test a project of your own at any time. Wire it, write the sketch, and run it. The missions teach the parts one at a time, and the <b>i</b> on a part in the tray shows its pinout.',
    goal: 'Build anything you like.',
    how: ['Use the tray to add parts and wires. Drag a wire end to move it, and use Step to watch your sketch one line at a time.', 'Point at a hole or pin to read its voltage while the sketch runs.'],
    starter: `// Open studio: your own sketch
void setup() {
}

void loop() {
}`,
    circuit: [], answer: '', hints: ['Nothing to check here.', 'Nothing to check here: this is free build.', 'Nothing to check here: build what you like.'], checks: [], unlocks: [],
  },
];

/* --- the ESP32 missions --- */
const ESP: Mission[] = [
  {
    id: 'tour', title: 'Workshop tour', place: 'Maker Workshop', hook: 'Meet the board and make its own light blink.', map: [25, 93], after: [], showParts: true, guide: ['sketch', 'pinmode', 'digitalwrite', 'delay', 'serial'],
    story: 'The ESP32 is programmed like an Arduino but is much faster and has Wi-Fi and Bluetooth built in. Its pins point downwards, so it plugs into a breadboard. Click the labels to explore. Then finish the sketch so the blue light on the board blinks.',
    goal: 'Make the board\'s own blue light blink, half a second on and half a second off.',
    how: ['The blue light is wired to GPIO 2.', 'The ESP32 usually talks to the computer at 115200 baud, faster than the Uno\'s 9600.', 'Every pin works at 3.3 V. Connecting 5 V to a pin can damage the chip.'],
    starter: `const int LED = 2;   // blue on-board LED

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(115200);
  Serial.println("Hello from the ESP32!");
}

void loop() {
  // turn the light on, wait half a second, turn it off, wait again
}`,
    circuit: [],
    answer: `const int LED = 2;   // blue on-board LED

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(115200);
  Serial.println("Hello from the ESP32!");
}

void loop() {
  digitalWrite(LED, HIGH);
  delay(500);
  digitalWrite(LED, LOW);
  delay(500);
}`,
    predict: { question: 'The starter sketch is ready to run. What will the blue light on the board do?', options: BLINK_OPTIONS, demo: [], run: 6000, classify: tr => behaviour(tr, 'builtin'), works: 'blinks', explain: BLINK_EXPLAIN },
    hints: [
      'The sketch already says hello, so look at what <code>loop()</code> does. Right now it does nothing.',
      'To blink: <code>digitalWrite(pin, HIGH)</code> turns the light on, <code>digitalWrite(pin, LOW)</code> turns it off, and <code>delay(ms)</code> waits between them.',
      'Inside loop(): digitalWrite(LED, HIGH); delay(500); digitalWrite(LED, LOW); delay(500);',
    ],
    checks: [
      phases('The sketch says hello', [{ when: 'the sketch starts', ms: 500, mode: 'during', expect: { serial: /hello/i } }]),
      blinks('The on-board light blinks', 'builtin'),
    ],
    unlocks: [],
  },
  {
    id: 'beacon', title: 'Gate beacon', place: 'Front Gate', hook: 'Build a blinking light so delivery drivers can find the gate.', map: [30, 80], after: [], guide: ['circuit', 'breadboard', 'led', 'resistor', 'variables'],
    story: 'The front gate has no light and delivery drivers keep missing it after dark. Build a <b>beacon</b>: an LED that blinks about once a second. On the ESP32 each pin shares a breadboard column with the free hole beside it, so a wire in that hole reaches the pin.',
    goal: 'Wire an LED and a resistor to a pin, and make the LED blink about once a second.',
    how: ['On the ESP32 you use the GPIO number in code. The pin labelled D5 is GPIO 5.', 'HIGH is 3.3 V here, not 5 V. That is still enough to light an LED.', 'The breadboard has the free holes on the right of the board, columns 22 to 30.'],
    starter: `// Gate beacon
const int LED_PIN = 5;   // the pin labelled D5

void setup() {
  // get the pin ready to send out power
}

void loop() {
  // turn the LED on, wait, turn it off, wait
}`,
    circuit: espLed,
    answer: `const int LED_PIN = 5;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}`,
    predict: { question: 'You have wired the LED and written the sketch. What will the LED do when you press Run?', options: BLINK_OPTIONS, demo: [], run: 6000, classify: tr => behaviour(tr, 'led'), works: 'blinks', explain: BLINK_EXPLAIN },
    hints: [
      'Press <b>Check my build</b> and read the first line. The circuit check panel over the 3D view says exactly what is wrong with the wiring.',
      'Current flows in a loop: out of a pin, through the LED and a resistor, and back to a GND pin. The ESP32 has GND pins next to the others. In the sketch the pin is an OUTPUT, and blinking is HIGH, wait, LOW, wait.',
      'Wire D5 to hole j22, put the LED\'s long leg in g22 and short leg in g23, a 220 Ω resistor from h23 to h27, a wire from j27 to the near − rail (B−27), and a wire from the GND pin to that rail. Sketch: OUTPUT in setup(), then HIGH, delay(1000), LOW, delay(1000).',
    ],
    checks: [
      phases('The LED lights up', [{ when: 'the sketch has been running for a few seconds', ms: 3000, mode: 'during', expect: { led: true } }]),
      blinks('The LED blinks about once a second'),
    ],
    unlocks: ['pad', 'knob'],
  },
  {
    id: 'touchlamp', title: 'Study-desk lamp', place: 'Library Desk', hook: 'Switch a lamp on with a touch, no button needed.', map: [75, 67], after: ['beacon'], guide: ['touch', 'serial', 'ifelse'],
    story: 'The reading desks have lamps with fiddly switches that keep breaking. Build a <b>touch lamp</b>: the LED is on while a finger touches the pad and off when it lets go. Ten ESP32 pins can sense touch with nothing more than a wire.',
    goal: 'The LED is on while the pad is touched and off otherwise.',
    controls: { pad: 'Hold to touch the pad' },
    how: ['<code>touchRead()</code> returns a high number normally and a low number when touched.', 'A limit in between decides what counts as a touch.', '<code>value &lt; THRESHOLD</code> is either true or false, which also works as HIGH or LOW.'],
    starter: `// Study-desk touch lamp
const int TOUCH_PIN = 4;     // touch channel T0
const int LED_PIN = 5;
const int THRESHOLD = 30;    // below this means touched

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int value = touchRead(TOUCH_PIN);
  // turn the LED on when the value is under the threshold, otherwise off
  delay(100);
}`,
    circuit: [...espLed, { t: 'pad', id: 'pad', ctl: 'Hold to touch the pad' }, { t: 'wire', a: 'E:D4', b: 'PAD', c: 'white' }],
    answer: `const int TOUCH_PIN = 4;     // touch channel T0
const int LED_PIN = 5;
const int THRESHOLD = 30;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  int value = touchRead(TOUCH_PIN);
  Serial.println(value);

  digitalWrite(LED_PIN, value < THRESHOLD);
  delay(100);
}`,
    predict: {
      question: 'The pad is wired to D4 and the lamp is built. A finger is not on the pad, then touches it. What will the LED do?',
      options: [
        { id: 'touch', label: 'It comes on when the pad is touched' }, { id: 'free', label: 'It comes on when nobody is touching' },
        { id: 'always', label: 'It stays on' }, { id: 'never', label: 'It never lights' },
      ],
      demo: [{ from: 0, set: { pad: 0 } }, { from: 2000, set: { pad: 1 } }], run: 4000,
      classify: reacts(ledOn, 1800, 3800, 'touch', 'free'), works: 'touch',
      explain: reactExplain('touch', 'It came on when the pad was touched, which is a touch lamp.', 'free', 'It came on when nobody was touching: the comparison points the wrong way.'),
    },
    hints: [
      'Open the Serial Monitor and touch the pad. Do the numbers change? If they never do, the pad may not be wired to a touch pin.',
      'The pad\'s wire must go to the pin the sketch reads (D4 is touch channel T0). A touch makes the number <em>smaller</em>, so compare with <code>&lt;</code> and a limit between the two readings.',
      'Wire D4 to the pad (white wire to PAD), keep the LED on D5 as before. In loop(): int value = touchRead(TOUCH_PIN); digitalWrite(LED_PIN, value < THRESHOLD); delay(100);',
    ],
    checks: [
      phases('The lamp is off until it is touched', [{ when: 'nobody is touching the pad', set: { pad: 0 }, expect: { led: false } }]),
      phases('The lamp is on while it is touched', [{ when: 'a finger is on the pad', set: { pad: 1 }, expect: { led: true } }]),
      phases('It follows the finger', [
        { when: 'nobody is touching the pad', set: { pad: 0 }, expect: { led: false } },
        { when: 'a finger touches the pad', set: { pad: 1 }, expect: { led: true } },
        { when: 'the finger lifts off', set: { pad: 0 }, expect: { led: false } },
      ]),
    ],
    unlocks: ['button', 'buzzer'],
  },
  choose({
    id: 'mural', title: 'Touch mural', place: 'Art Room', hook: 'Choose a board that can feel six touches on a painted wall.', map: [25, 67], after: ['touchlamp'], guide: ['boards', 'touch'],
    story: 'The art club has painted a mural of the town with six bright spots on it. Behind each spot is a small piece of copper tape. Touch a spot and a sound plays, and the artist wants to change the sounds from a laptop over Wi-Fi.',
    needs: [
      { need: { k: 'touch', n: 6 }, text: 'It senses a finger on six copper pads, with nothing in between.' },
      { need: { k: 'wifi' }, text: 'It connects to your Wi-Fi.' },
    ],
    hints: [
      'You have already used a pad like these, at the Library Desk.',
      'Sensing a touch is built into some chips and not others. Look at the "Touch pins" line on each card.',
      'The <b>ESP32 DevKit</b>, the board on your bench: 9 touch pins, and Wi-Fi.',
    ],
  }),
  {
    id: 'toggle', title: 'Cafeteria lights', place: 'Cafeteria', hook: 'One press switches the lights on, the next press switches them off.', map: [25, 54], after: ['touchlamp'], guide: ['button', 'digitalread', 'variables'],
    story: 'The cafeteria has one switch that is wired badly: you have to hold it down to keep the lights on. Build a <b>push-on, push-off</b> switch: one press turns the LED on and it stays on, the next press turns it off. The sketch has to remember what the light is doing.',
    goal: 'Each press of the button flips the LED, and the LED keeps its state after the button is let go.',
    controls: { button: 'Hold to press the button' },
    how: ['<code>bool ledOn</code> remembers whether the light should be on. A variable outside the functions keeps its value between loops.', '<code>lastState</code> holds the previous reading, so the sketch can spot the moment the button <em>changes</em> from not pressed to pressed.', '<code>ledOn = !ledOn</code> flips true to false and false to true.'],
    starter: `// Cafeteria lights
const int BUTTON_PIN = 18;
const int LED_PIN = 5;

bool ledOn = false;
int lastState = HIGH;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int state = digitalRead(BUTTON_PIN);   // LOW while pressed

  // when the button has just been pressed (state is LOW and lastState was HIGH), flip ledOn
  // and write it to the LED

  lastState = state;
}`,
    circuit: [...espLed, { t: 'button', id: 'btn', col: 28, ctl: 'Hold to press the button' }, { t: 'wire', a: 'E:D18', b: 'j28', c: 'yellow' }, { t: 'wire', a: 'j30', b: 'B-30', c: 'black' }],
    answer: `const int BUTTON_PIN = 18;
const int LED_PIN = 5;

bool ledOn = false;
int lastState = HIGH;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  int state = digitalRead(BUTTON_PIN);

  if (state == LOW && lastState == HIGH) {   // just pressed
    ledOn = !ledOn;
    digitalWrite(LED_PIN, ledOn);
    Serial.println(ledOn ? "LED on" : "LED off");
    delay(50);
  }
  lastState = state;
}`,
    predict: {
      question: 'The button and LED are wired. You press and let go twice. What will the LED do?',
      options: [
        { id: 'toggle', label: 'It flips with each press and stays that way when I let go' }, { id: 'hold', label: 'It is on only while I hold the button' },
        { id: 'stuck', label: 'It comes on and never goes off again' }, { id: 'never', label: 'It never lights' },
      ],
      demo: [{ from: 0, set: { button: 0 } }, { from: 500, set: { button: 1 } }, { from: 900, set: { button: 0 } }, { from: 1500, set: { button: 1 } }, { from: 1900, set: { button: 0 } }], run: 3000,
      classify: tr => {
        const first = ledOn(tr.at(1300)), second = ledOn(tr.at(2500)), held = ledOn(tr.at(800));
        return first && !second ? 'toggle' : first && second ? 'stuck' : held ? 'hold' : 'never';
      },
      works: 'toggle',
      explain: {
        toggle: 'The LED flipped with each press and kept its state, which is a push-on, push-off switch.',
        hold: 'The LED followed the button, so it only stayed on while held. The sketch needs to remember the state, not copy the button.',
        stuck: 'The LED came on and never went off again. The sketch is setting it on but never flipping it back.',
        never: 'The LED never lit. Check that the sketch notices the press and writes to the LED\'s pin.',
      },
    },
    hints: [
      'Press and let go of the button and watch the Serial Monitor in your own sketch. Is the LED changing on the press, or while you hold?',
      'Keep a <code>bool ledOn</code> and a <code>lastState</code>. Act only when <code>state == LOW &amp;&amp; lastState == HIGH</code> (the moment of pressing), then flip with <code>ledOn = !ledOn</code>. Do not forget to save <code>lastState = state</code> every time.',
      'In loop(): if (state == LOW && lastState == HIGH) { ledOn = !ledOn; digitalWrite(LED_PIN, ledOn); delay(50); } then lastState = state; outside the if.',
    ],
    checks: [
      phases('It starts off and one press turns it on and keeps it on', [
        { when: 'nothing has been pressed yet', set: { button: 0 }, ms: 600, expect: { led: false } },
        { when: 'the button is pressed once', set: { button: 1 }, ms: 500, expect: { led: true } },
        { when: 'the button is let go (the LED should stay on)', set: { button: 0 }, ms: 600, expect: { led: true } },
      ]),
      phases('A second press turns it off again', [
        { when: 'nothing has been pressed yet', set: { button: 0 }, ms: 600, expect: { led: false } },
        { when: 'the button is pressed once', set: { button: 1 }, ms: 500, expect: { led: true } },
        { when: 'the button is let go', set: { button: 0 }, ms: 600, expect: { led: true } },
        { when: 'the button is pressed a second time', set: { button: 1 }, ms: 500, expect: { led: false } },
        { when: 'the button is let go again (the LED should stay off)', set: { button: 0 }, ms: 600, expect: { led: false } },
      ]),
    ],
    unlocks: ['pir'],
  },
  choose({
    id: 'bagtag', title: 'Bag finder tag', place: 'Lost & Found', hook: 'Choose a board small enough to hide in a bag, that a phone can find.', map: [75, 54], after: ['toggle'], guide: ['boards'],
    story: 'People keep losing their bags. The lost-and-found desk wants a small tag that sits in a bag\'s pocket and lets a phone find it nearby over Bluetooth, the way wireless earbuds are found. The pocket has room for a board 30 × 25 mm.',
    needs: [
      { need: { k: 'bluetooth' }, text: 'A phone can find it over Bluetooth.' },
      { need: { k: 'fits', l: 30, w: 25 }, text: 'It fits the pocket, which has room for a board 30 × 25 mm.' },
    ],
    hints: [
      'Only some boards have Bluetooth at all. Start there.',
      'Two boards here have Bluetooth. Only one of them fits the pocket.',
      'The <b>ESP32-C3 SuperMini</b>: 23 × 18 mm, with Bluetooth LE.',
    ],
  }),
  {
    id: 'stairs', title: 'Stairwell light', place: 'Back Stairwell', hook: 'Light the stairs when someone moves, and keep them lit until they are safely up.', map: [75, 47], after: ['toggle'], guide: ['pir', 'millis', 'digitalread', 'variables'],
    story: 'The light in the back stairwell burns all night for nobody. Fit a <b>motion sensor</b> at the foot of the stairs: when it sees someone move, switch the light on. The sensor only says HIGH <em>while</em> something moves, though, and people stop on stairs: to catch their breath, to answer a phone. So keep the light on for <b>5 seconds after the last movement</b>, and start the 5 seconds again each time the sensor sees more. Nobody should be left in the dark halfway up.',
    goal: 'The LED comes on as soon as the sensor sees movement and stays on until 5 seconds after the last movement. Off while all is still.',
    controls: { pir: 'Someone on the stairs' },
    how: [
      'The motion sensor needs <b>5 V</b>, so power its + pin from <b>VIN</b>. Its OUT pin only ever gives 3.3 V, which is safe for an ESP32 pin.',
      'Each time the sensor reads HIGH, remember the time with <code>lastMotion = millis();</code>. The light should go off once <code>millis() - lastMotion &gt;= HOLD_MS</code>.',
      'Do not wait with <code>delay(5000)</code>. While the board waits it cannot see someone move again, so it cannot start the 5 seconds again.',
    ],
    starter: `// Stairwell light
const int PIR_PIN = 18;    // HIGH while the sensor sees movement
const int LED_PIN = 5;
const unsigned long HOLD_MS = 5000;   // keep the light on this long after the last movement

void setup() {
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  // the light follows the sensor, so it goes off the moment someone stands still
  if (digitalRead(PIR_PIN) == HIGH) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
}`,
    circuit: [
      ...espLed, { t: 'wire', a: 'E:VIN', b: 'B+34', c: 'red' },
      { t: 'module', kind: 'pir', id: 'pir', row: 'g', col: 30, ctl: 'Movement' },
      { t: 'wire', a: 'j30', b: 'B+30', c: 'red' }, { t: 'wire', a: 'j31', b: 'E:D18', c: 'yellow' }, { t: 'wire', a: 'j32', b: 'B-32', c: 'black' },
    ],
    answer: `const int PIR_PIN = 18;    // HIGH while the sensor sees movement
const int LED_PIN = 5;
const unsigned long HOLD_MS = 5000;   // keep the light on this long after the last movement

unsigned long lastMotion = 0;   // when the sensor last saw movement
bool lightOn = false;

void setup() {
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  if (digitalRead(PIR_PIN) == HIGH) {   // someone is moving: light on, and start the wait again
    lightOn = true;
    lastMotion = millis();
  }
  if (lightOn && millis() - lastMotion >= HOLD_MS) {   // all still for long enough
    lightOn = false;
  }
  digitalWrite(LED_PIN, lightOn);
}`,
    predict: {
      question: 'Someone walks past the sensor, then stands still on the stairs. What will the light do?',
      options: [
        { id: 'holds', label: 'It comes on, and stays on for a while after they stop' }, { id: 'follows', label: 'It comes on, and goes off the moment they stop moving' },
        { id: 'always', label: 'It is on the whole time' }, { id: 'never', label: 'It never comes on' },
      ],
      demo: [{ from: 0, set: { pir: 0 } }, { from: 1000, set: { pir: 1 } }, { from: 1600, set: { pir: 0 } }], run: 4000,
      classify: tr => {
        const before = ledOn(tr.at(800)), during = ledOn(tr.at(1500)), after = ledOn(tr.at(3500));
        return before ? 'always' : !during ? 'never' : after ? 'holds' : 'follows';
      },
      works: 'holds',
      explain: {
        holds: 'The light stayed on after they stopped moving, so nobody is left in the dark halfway up.',
        follows: 'The light went off the moment they stood still. The sensor is only HIGH while something moves, so the sketch has to do the waiting: remember when it last saw movement.',
        always: 'The light was on before anyone moved. Check that HIGH is what turns it on. And if the sketch only checks <code>millis() - lastMotion</code>, remember that lastMotion starts at 0, so the first 5 seconds look like "just after movement".',
        never: 'The light did not come on while someone was moving. Check that the sensor\'s OUT pin is wired to the pin the sketch reads, and that its + pin has 5 V from VIN.',
      },
    },
    hints: [
      'Switch the sensor to "someone moving", then back to "all still", and watch the light. It goes off at once: the sensor is only HIGH while it sees movement, so the waiting has to happen in the sketch.',
      'Keep <code>unsigned long lastMotion</code> and <code>bool lightOn</code> above setup(). When the sensor reads HIGH, set <code>lightOn = true</code> and <code>lastMotion = millis()</code>. When <code>millis() - lastMotion &gt;= HOLD_MS</code>, set <code>lightOn = false</code>. Then write <code>lightOn</code> to the LED. A <code>delay(5000)</code> will not do: while it waits, the board cannot see someone move again.',
      'Above setup(): unsigned long lastMotion = 0; bool lightOn = false; In loop(): if (digitalRead(PIR_PIN) == HIGH) { lightOn = true; lastMotion = millis(); } if (lightOn && millis() - lastMotion >= HOLD_MS) { lightOn = false; } digitalWrite(LED_PIN, lightOn); with no delay() anywhere.',
    ],
    checks: [
      phases('The light stays off while all is still', [{ when: 'nobody is on the stairs', set: { pir: 0 }, ms: 2500, mode: 'during', expect: { led: false } }]),
      phases('The light comes on as soon as someone moves', [
        { when: 'nobody is on the stairs', set: { pir: 0 }, ms: 1000, expect: { led: false } },
        { when: 'someone starts up the stairs', set: { pir: 1 }, ms: 300, expect: { led: true } },
      ]),
      phases('It stays on for about 5 seconds after the last movement', [
        { when: 'someone walks past', set: { pir: 1 }, ms: 500, expect: { led: true } },
        { when: 'they have stood still for over 3 seconds', set: { pir: 0 }, ms: 3500, expect: { led: true } },
        { when: 'they have stood still for over 6 seconds', set: { pir: 0 }, ms: 3000, expect: { led: false } },
      ]),
      phases('Each movement starts the 5 seconds again', [
        { when: 'someone walks past', set: { pir: 1 }, ms: 300, expect: { led: true } },
        { when: 'they stop for 3 seconds', set: { pir: 0 }, ms: 3000, expect: { led: true } },
        { when: 'they move again', set: { pir: 1 }, ms: 300, expect: { led: true } },
        { when: 'they have stood still for nearly 4 seconds since, over 7 seconds after they first moved', set: { pir: 0 }, ms: 4000, expect: { led: true } },
        { when: 'they have stood still for nearly 7 seconds since', set: { pir: 0 }, ms: 3000, expect: { led: false } },
      ]),
    ],
    unlocks: [],
  },
  {
    id: 'siren', title: 'Sports-hall siren', place: 'Sports Hall', hook: 'Slide a buzzer up and down like an alarm.', map: [75, 41], after: ['toggle'], guide: ['buzzer', 'loops'],
    story: 'The sports hall needs an alarm that cuts through the noise of a basketball game. A steady beep is easy to ignore, but a <b>siren</b> that slides up and down in pitch is not. Build one with a buzzer and two loops that change the note a little at a time.',
    goal: 'The buzzer slides up from a low note to a high note and back down, again and again.',
    how: ['The first <code>for</code> loop raises the frequency from 400 Hz to 1000 Hz in steps of 20.', 'The second loop counts back down. <code>f -= 20</code> means "subtract 20 from f".', 'The short <code>delay()</code> sets how fast the pitch moves.'],
    starter: `// Sports hall siren
const int BUZZER_PIN = 18;

void setup() {
}

void loop() {
  // slide up: a for loop from 400 to 1000 Hz in steps of 20, calling tone() and a short delay()
  // slide down: another for loop that counts back down
}`,
    circuit: [
      { t: 'buzzer', id: 'buzz', a: 'f22', b: 'f25' }, { t: 'wire', a: 'E:D18', b: 'j22', c: 'purple' }, { t: 'wire', a: 'j25', b: 'B-25', c: 'black' }, { t: 'wire', a: 'E:GND', b: 'B-5', c: 'black' },
    ],
    answer: `const int BUZZER_PIN = 18;

void setup() {
}

void loop() {
  for (int f = 400; f <= 1000; f += 20) {   // slide up
    tone(BUZZER_PIN, f);
    delay(15);
  }
  for (int f = 1000; f >= 400; f -= 20) {   // slide down
    tone(BUZZER_PIN, f);
    delay(15);
  }
}`,
    predict: {
      question: 'The buzzer is wired to D18 and the sketch has two loops. What will you hear?',
      options: [{ id: 'sweep', label: 'A note that slides up and down' }, { id: 'steady', label: 'One steady note' }, { id: 'silent', label: 'Nothing' }],
      demo: [], run: 3000,
      classify: tr => {
        const notes = tr.samples.map(s => Math.round(s.sound)).filter(n => n > 0);
        return !notes.length ? 'silent' : new Set(notes).size >= 8 ? 'sweep' : 'steady';
      },
      works: 'sweep',
      explain: { sweep: 'The pitch slid through many notes, which is a siren.', steady: 'Only one or a few notes played. A siren needs the frequency to change a little each time round the loop.', silent: 'There was no sound. Check that the buzzer is wired to the pin the sketch plays on.' },
    },
    hints: [
      'Turn the sound on with the toolbar button and listen. Does the pitch change, or is it one note?',
      'A <code>for</code> loop can count: <code>for (int f = 400; f &lt;= 1000; f += 20)</code>. Play <code>tone(BUZZER_PIN, f)</code> inside it, with a short delay so each pitch can be heard, then write a second loop that counts back down.',
      'In loop(): for (int f = 400; f <= 1000; f += 20) { tone(BUZZER_PIN, f); delay(15); } then for (int f = 1000; f >= 400; f -= 20) { tone(BUZZER_PIN, f); delay(15); }',
    ],
    checks: [
      phases('The siren is sounding', [{ when: 'the sketch has been running a moment', ms: 800, mode: 'during', expect: { sound: true } }]),
      sweeps('The siren slides up and back down'),
    ],
    unlocks: ['sonar'],
  },
  choose({
    id: 'visitorlight', title: 'Visitor light', place: 'Guard House', hook: 'Choose a small Wi-Fi board for the guard\'s sign-in light.', map: [25, 41], after: ['siren'], guide: ['boards'],
    story: 'At the front gate, visitors wait until a light turns green. The guard will switch it from a phone over Wi-Fi. The light box is small: it has room for a board 40 × 30 mm.',
    needs: [
      { need: { k: 'wifi' }, text: 'It connects to your Wi-Fi.' },
      { need: { k: 'fits', l: 40, w: 30 }, text: 'It fits the light box, which has room for a board 40 × 30 mm.' },
    ],
    hints: [
      'Which boards have Wi-Fi? Then, which of those fit the box?',
      'The ESP32 DevKit has Wi-Fi but is 52 mm long. Two smaller Wi-Fi boards fit.',
      'The <b>Wemos D1 mini</b> or the <b>ESP32-C3 SuperMini</b>. Both have Wi-Fi and fit the 40 × 30 mm box.',
    ],
  }),
  {
    id: 'nightlight', title: 'Night light', place: 'Main Hallway', hook: 'Turn a light on when the hallway gets dark, with the ESP32\'s finer readings.', map: [30, 28], after: ['siren'], guide: ['knob', 'analog', 'ifelse'],
    story: 'The main hallway is dark at night. Build a <b>night light</b> that comes on by itself when it is dark. The ESP32 measures voltage in 4096 steps instead of 1024, so the numbers are four times bigger. The knob stands in for the light sensor and runs from <b>3.3 V</b>, never 5 V, because the pins cannot take more.',
    goal: 'The LED comes on when the light level is low and goes off when it is high.',
    controls: { pot: 'Hallway light level' },
    how: ['<code>analogRead()</code> gives 0 to 4095 on the ESP32, because its converter has 12 bits.', 'The sensor must be powered from 3V3. A pin cannot take 5 V.', 'Pins D34 to D39 are input-only, which is fine for a sensor.'],
    starter: `// Hallway night light
const int SENSOR_PIN = 34;   // the light sensor (the knob)
const int LED_PIN = 5;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  // 1. read the sensor with analogRead(SENSOR_PIN): 0 to 4095
  // 2. if it is dark (a low number) turn the LED on, otherwise off
  delay(50);
}`,
    circuit: [
      ...espLed, { t: 'wire', a: 'E:3V3', b: 'B+4', c: 'red' },
      { t: 'pot', id: 'pot', row: 'g', col: 28, ctl: 'Knob position' }, { t: 'wire', a: 'j28', b: 'B+28', c: 'red' }, { t: 'wire', a: 'j30', b: 'B-30', c: 'black' }, { t: 'wire', a: 'j29', b: 'E:D34', c: 'green' },
    ],
    answer: `const int SENSOR_PIN = 34;
const int LED_PIN = 5;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int light = analogRead(SENSOR_PIN);   // 0 (dark) to 4095 (bright)

  if (light < 1200) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(50);
}`,
    predict: {
      question: 'Your night light is built. The hallway starts bright, then gets dark. What will the LED do?',
      options: [
        { id: 'dark', label: 'It turns on when the hallway gets dark' }, { id: 'bright', label: 'It turns on when the hallway gets bright' },
        { id: 'always', label: 'It stays on whatever happens' }, { id: 'never', label: 'It never lights' },
      ],
      demo: [{ from: 0, set: { pot: bright } }, { from: 2000, set: { pot: dark } }], run: 4000,
      classify: reacts(ledOn, 1800, 3800, 'dark', 'bright'), works: 'dark',
      explain: reactExplain('dark', 'It reacted the way it should: it came on when it got dark.', 'bright', 'It reacted, but backwards: it came on when it got bright.'),
    },
    hints: [
      'Turn the light level knob and watch the number the sensor gives in the Serial Monitor. How big does it get? Remember the ESP32 counts to 4095.',
      'Read with <code>analogRead(SENSOR_PIN)</code>. Dark is a low number, so use <code>&lt;</code> with a limit well below 4095, and write HIGH or LOW to the LED pin.',
      'In loop(): int light = analogRead(SENSOR_PIN); if (light < 1200) digitalWrite(LED_PIN, HIGH); else digitalWrite(LED_PIN, LOW); then delay(50). Power the knob from 3V3 (E:3V3 to the + rail), not from 5 V.',
    ],
    checks: [
      phases('The light stays off in daylight', [{ when: 'the hallway is bright (light level 90%)', set: { pot: bright }, expect: { led: false } }]),
      phases('The light comes on in the dark', [{ when: 'the hallway is dark (light level 10%)', set: { pot: dark }, expect: { led: true } }]),
      phases('It follows the light as it changes', [
        { when: 'the hallway is bright', set: { pot: bright }, expect: { led: false } },
        { when: 'the lights go out', set: { pot: dark }, expect: { led: true } },
        { when: 'the sun comes back', set: { pot: bright }, expect: { led: false } },
      ]),
    ],
    unlocks: ['servo', 'temp'],
  },
  {
    id: 'weather', title: 'Wind gauge', place: 'Rooftop Weather Station', hook: 'Swing a servo needle to show how hard the wind blows.', map: [70, 15], after: ['nightlight'], guide: ['servo', 'analog', 'knob'],
    story: 'The science club runs a weather station on the roof and wants a big <b>wind gauge</b> in the entrance hall that everyone can read from across the room. A <b>servo</b> turns a needle across a half-circle dial: <b>0°</b> for still air, <b>180°</b> for a gale, and everything in between. The knob stands in for the wind sensor.',
    goal: 'The servo needle points at 0° when the air is still and 180° in a gale, and follows the wind in between.',
    controls: { pot: 'Wind speed' },
    how: [
      'On the ESP32 the library is <code>ESP32Servo.h</code>, but the Servo in it works just like the Arduino one: <code>attach()</code> it to a pin, then <code>write()</code> an angle.',
      '<code>map(wind, 0, 4095, 0, 180)</code> turns the 12-bit reading into an angle.',
      'The servo needs 5 V, so power it from <b>VIN</b>, which carries the 5 V from USB. Its signal can still come from a 3.3 V pin. The sensor must stay on <b>3V3</b>.',
    ],
    starter: `// Wind gauge
#include <ESP32Servo.h>

const int SENSOR_PIN = 34;   // the wind sensor (the knob): 0 to 4095
const int SERVO_PIN = 13;

Servo needle;

void setup() {
  needle.attach(SERVO_PIN);
}

void loop() {
  int wind = analogRead(SENSOR_PIN);

  // turn the reading (0 to 4095) into an angle (0 to 180) and write it to the needle

  delay(50);
}`,
    circuit: [
      { t: 'servo', id: 'servo', row: 'g', col: 22 },
      { t: 'wire', a: 'j22', b: 'B-22', c: 'black' }, { t: 'wire', a: 'j23', b: 'B+23', c: 'red' }, { t: 'wire', a: 'j24', b: 'E:D13', c: 'orange' },
      { t: 'wire', a: 'E:VIN', b: 'B+26', c: 'red' }, { t: 'wire', a: 'E:GND', b: 'B-26', c: 'black' },
      { t: 'pot', id: 'pot', row: 'd', col: 27, ctl: 'Knob position' },
      { t: 'wire', a: 'a27', b: 'T+27', c: 'red' }, { t: 'wire', a: 'a29', b: 'T-29', c: 'black' }, { t: 'wire', a: 'a28', b: 'E:D34', c: 'green' },
      { t: 'wire', a: 'E:3V3', b: 'T+23', c: 'red' }, { t: 'wire', a: 'E:GNDf', b: 'T-24', c: 'black' },
    ],
    answer: `#include <ESP32Servo.h>

const int SENSOR_PIN = 34;   // the wind sensor (the knob): 0 to 4095
const int SERVO_PIN = 13;

Servo needle;

void setup() {
  needle.attach(SERVO_PIN);
}

void loop() {
  int wind = analogRead(SENSOR_PIN);
  int angle = map(wind, 0, 4095, 0, 180);
  needle.write(angle);
  delay(50);
}`,
    predict: {
      question: 'The gauge is built. The air starts still, then the wind picks up to a gale. What will the needle do?',
      options: [{ id: 'follows', label: 'It swings across as the wind rises' }, { id: 'backwards', label: 'It swings the other way' }, { id: 'still', label: 'It does not move' }],
      demo: [{ from: 0, set: { pot: 0.05 } }, { from: 2000, set: { pot: 0.95 } }], run: 4000,
      classify: tr => {
        const a = servoAt(tr.at(1800)), b = servoAt(tr.at(3800));
        return a < 0 || b < 0 ? 'still' : b - a > 45 ? 'follows' : a - b > 45 ? 'backwards' : 'still';
      },
      works: 'follows',
      explain: {
        follows: 'The needle swung across as the wind rose, which is a wind gauge.',
        backwards: 'The needle swung the wrong way: it showed a gale when the air was still. Swap the last two numbers in map().',
        still: 'The needle did not move with the wind. Check that the sketch writes the mapped angle to the servo, and that the servo has 5 V from VIN.',
      },
    },
    hints: [
      'Turn the Wind speed knob while the sketch runs. Does the needle move? Print <code>wind</code> to the Serial Monitor to see what the sensor reads: on the ESP32 it goes up to 4095.',
      '<code>map(wind, 0, 4095, 0, 180)</code> gives the angle. Write it to the servo with <code>needle.write(angle)</code>. Power the servo from VIN (5 V), and keep the knob on 3V3.',
      'In loop(): int angle = map(wind, 0, 4095, 0, 180); needle.write(angle); then delay(50). Put the servo lead in g22 to g24, then wire j22 to the − rail, j23 to the + rail and j24 to D13, with VIN on the + rail and GND on the − rail.',
    ],
    checks: [
      phases('The needle rests at 0° in still air', [{ when: 'the air is still (wind 0%)', set: { pot: 0 }, expect: { servo: [0, 8] } }]),
      phases('The needle swings right over in a gale', [{ when: 'a gale blows (wind 100%)', set: { pot: 1 }, expect: { servo: [172, 180] } }]),
      phases('In between, the needle points in between', [
        { when: 'the wind is moderate (50%)', set: { pot: 0.5 }, expect: { servo: [80, 100] } },
        { when: 'the wind is light (25%)', set: { pot: 0.25 }, expect: { servo: [35, 55] } },
      ]),
      phases('It follows the wind as it changes', [
        { when: 'the air is still', set: { pot: 0 }, expect: { servo: [0, 8] } },
        { when: 'the wind picks up to a gale', set: { pot: 1 }, expect: { servo: [172, 180] } },
        { when: 'the wind drops again (10%)', set: { pot: 0.1 }, expect: { servo: [8, 28] } },
      ]),
    ],
    unlocks: [],
  },
  {
    id: 'fridge', title: 'Fridge alarm', place: 'Canteen Kitchen', hook: 'Read a temperature sensor with the ESP32\'s 3.3 V and warn when the fridge gets too warm.', map: [30, 12], after: ['nightlight'], guide: ['temp', 'analog', 'serial'],
    story: 'The canteen\'s walk-in fridge door is left open all the time, and food inside has gone off twice. Put a <b>temperature sensor</b> in it. The sketch must print the temperature in °C and turn a warning LED on when the fridge is warmer than <b>8 °C</b>. The ESP32 runs on <b>3.3 V</b> and counts to 4095, so the numbers in the sums are different from the Uno\'s.',
    goal: 'The Serial Monitor shows the temperature in °C, and the LED is on above 8 °C and off at or below it.',
    controls: { temp: 'Fridge temperature' },
    how: [
      'The <b>TMP36</b> gives <b>0.5 V at 0 °C plus 10 mV for every degree</b>, whatever its supply. Power it from <b>3V3</b>, the same as the other parts.',
      'On the ESP32, <code>analogRead()</code> gives 0 to 4095 for 0 to 3.3 V. So volts are <code>raw * 3.3 / 4095.0</code>.',
      'Degrees are <code>(volts - 0.5) * 100.0</code>. Print them with <code>Serial.println()</code>, then compare with 8.',
    ],
    starter: `// Canteen fridge alarm
const int SENSOR_PIN = 34;   // the TMP36's output
const int WARN_PIN = 5;

void setup() {
  pinMode(WARN_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  int raw = analogRead(SENSOR_PIN);    // 0 to 4095

  // 1. turn raw into volts: raw * 3.3 / 4095.0
  // 2. turn volts into degrees: (volts - 0.5) * 100.0
  // 3. print the degrees
  // 4. turn the warning on above 8, otherwise off

  delay(500);
}`,
    circuit: [
      ...espLed, { t: 'wire', a: 'E:3V3', b: 'B+4', c: 'red' },
      { t: 'temp', id: 'temp', row: 'g', col: 28, ctl: 'Temperature' }, { t: 'wire', a: 'j28', b: 'B+28', c: 'red' }, { t: 'wire', a: 'j30', b: 'B-30', c: 'black' }, { t: 'wire', a: 'j29', b: 'E:D34', c: 'green' },
    ],
    answer: `const int SENSOR_PIN = 34;
const int WARN_PIN = 5;

void setup() {
  pinMode(WARN_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  int raw = analogRead(SENSOR_PIN);
  float volts = raw * 3.3 / 4095.0;      // 0 to 3.3 V
  float celsius = (volts - 0.5) * 100.0; // TMP36: 0.5 V at 0 degrees, 10 mV per degree

  Serial.println(celsius);

  if (celsius > 8) {
    digitalWrite(WARN_PIN, HIGH);
  } else {
    digitalWrite(WARN_PIN, LOW);
  }
  delay(500);
}`,
    predict: {
      question: 'The sensor and the warning LED are built. The fridge starts cold, then warms up to 14 °C. What will the LED do?',
      options: [
        { id: 'warm', label: 'It turns on when the fridge gets warm' }, { id: 'cold', label: 'It turns on when the fridge is cold' },
        { id: 'always', label: 'It stays on whatever happens' }, { id: 'never', label: 'It never lights' },
      ],
      demo: [{ from: 0, set: { temp: 4 } }, { from: 2000, set: { temp: 14 } }], run: 4000,
      classify: reacts(ledOn, 1800, 3800, 'warm', 'cold'), works: 'warm',
      explain: reactExplain('warm', 'It reacted the way it should: it came on when the fridge got warm.', 'cold', 'It reacted, but backwards: it came on when the fridge was cold. Check which way your comparison points.'),
    },
    hints: [
      'Print the raw reading first with <code>Serial.println(raw)</code> and move the temperature slider. At 25 °C the sensor gives 0.75 V, which is about 931 on the ESP32. If it never changes, check the sensor\'s power (3V3), ground and the wire to D34.',
      'Volts are <code>raw * 3.3 / 4095.0</code> on the ESP32 (the Uno\'s sum uses 5.0 and 1023.0). Degrees are <code>(volts - 0.5) * 100.0</code>. Then <code>if (celsius &gt; 8)</code> chooses the LED.',
      'In loop(): int raw = analogRead(SENSOR_PIN); float volts = raw * 3.3 / 4095.0; float celsius = (volts - 0.5) * 100.0; Serial.println(celsius); if (celsius > 8) digitalWrite(WARN_PIN, HIGH); else digitalWrite(WARN_PIN, LOW); delay(500). Power the sensor from 3V3.',
    ],
    checks: [
      phases('It prints the temperature in degrees', [
        { when: 'the fridge is 4 °C', set: { temp: 4 }, expect: { serial: /\b[34]\.\d/ } },
        { when: 'it warms up to 14 °C', set: { temp: 14 }, expect: { serial: /\b1[34]\.\d/ } },
      ]),
      phases('The alarm stays off while the fridge is cold', [{ when: 'the fridge is 4 °C', set: { temp: 4 }, expect: { led: false } }]),
      phases('The alarm comes on when the fridge is warm', [{ when: 'the fridge is 14 °C', set: { temp: 14 }, expect: { led: true } }]),
      phases('It follows the temperature as it changes', [
        { when: 'the fridge is cold (4 °C)', set: { temp: 4 }, expect: { led: false } },
        { when: 'the door is left open (14 °C)', set: { temp: 14 }, expect: { led: true } },
        { when: 'the door is shut again (6 °C)', set: { temp: 6 }, expect: { led: false } },
      ]),
    ],
    unlocks: [],
  },
  {
    id: 'workshop', title: 'Open studio', place: 'Open Studio', hook: 'Free build with every part, open from the start.', map: [75, 93], after: [], sandbox: true, guide: ['circuit', 'breadboard', 'switch', 'loops', 'functions'],
    story: 'The studio is yours: no goal and no checks. <b>Every part is in the tray here</b>, whether or not a mission has unlocked it yet, so you can build and test a project of your own at any time. Wire it, write the sketch, and run it. The missions teach the parts one at a time, and the <b>i</b> on a part in the tray shows its pinout.',
    goal: 'Build anything you like.',
    how: ['Use the tray to add parts and wires. The ESP32 plugs into the left of the breadboard, so build in columns 22 to 30.', 'Point at a hole or pin to read its voltage while the sketch runs.'],
    starter: `// Open studio: your own sketch
void setup() {
}

void loop() {
}`,
    circuit: [], answer: '', hints: ['Nothing to check here.', 'Nothing to check here: this is free build.', 'Nothing to check here: build what you like.'], checks: [], unlocks: [],
  },
];

/* --- repair jobs: a mission someone else has already built, with its faults put back in --- */
interface Repair {
  id: string; title: string; place: string; hook: string; map: [number, number]; after: string[];
  story: string; goal: string; how: string[]; hints: Mission['hints']; guide: string[];
  /** Changes the bench. Returns the part as it should now be, or null to take it away. */
  fault: (it: Item) => Item | null;
  /** Changes in the sketch: [what the right sketch says, what the faulty one says]. */
  code: [from: string, to: string][];
}
/** Builds a repair job from a mission: its reference build and sketch with faults put back in. The checks are the same, so the job is done when the mission would be passed. */
function repairOf(base: Mission, r: Repair): Mission {
  const starter = r.code.reduce((c, [from, to]) => {
    if (!c.includes(from)) throw new Error(`repair ${r.id}: the answer of ${base.id} has no "${from}"`);
    return c.split(from).join(to);
  }, base.answer);
  const start = base.circuit.flatMap(it => r.fault(it) ?? []);
  return {
    ...base, id: r.id, title: r.title, place: r.place, hook: r.hook, map: r.map, after: r.after, story: r.story, goal: r.goal, how: r.how, hints: r.hints, guide: r.guide,
    repair: true, start, starter, predict: undefined, controls: base.controls, unlocks: [],
  };
}
const unoMission = (id: string) => UNO.find(m => m.id === id)!, espMission = (id: string) => ESP.find(m => m.id === id)!;

UNO.splice(UNO.length - 1, 0,
  repairOf(unoMission('beacon'), {
    id: 'fixbeacon', title: 'Beacon repair', place: 'Loading Dock', hook: 'A rushed install: the beacon never blinks. Find the faults.', map: [75, 83], after: ['beacon'], guide: ['led', 'digitalwrite', 'debugging'],
    story: 'A volunteer fitted a <b>beacon</b> at the loading dock in a hurry and left. Drivers say it is either dark or stuck on, but never blinks. The bench and the sketch are exactly as they left them. This is a <b>repair job</b>: the checks are the same as for a new beacon, but the faults are somebody else\'s. Press Run, watch what it does, then find out why. <b>There is more than one fault.</b>',
    goal: 'Make the beacon blink about once a second.',
    how: ['Start with <b>Check my build</b>. The wiring check names mistakes in the circuit.', 'Then read the sketch line by line and say out loud what each line does to the pin.', 'Fix <b>one thing at a time</b> and run again. If two faults hide each other, fixing the first lets you see the second.'],
    hints: [
      'Press Run and watch the LED, then press <b>Check my build</b>. The first problem is something the wiring check can name. The second only shows up once the first is fixed.',
      'An LED only works one way round, long leg towards the pin. Select the LED and press Flip. Then read the sketch: what level does the pin end up at in each half of the loop?',
      'Select the LED and press Flip. In loop(), the second digitalWrite must say LOW, not HIGH, or the LED never goes off.',
    ],
    fault: it => (it.t === 'led' ? { ...it, a: it.k, k: it.a } : it),
    code: [['digitalWrite(LED_PIN, LOW);', 'digitalWrite(LED_PIN, HIGH);']],
  }),
  repairOf(unoMission('nightlight'), {
    id: 'fixnight', title: 'Night light repair', place: 'Caretaker\'s Office', hook: 'The caretaker built it and the light is on all day. Find the faults.', map: [75, 63], after: ['nightlight'], guide: ['knob', 'analog', 'debugging'],
    story: 'The caretaker built a <b>night light</b> for the hallway, but the light is on all day and nothing the light level does changes it. The sketch and the bench are just as the caretaker left them. This is a <b>repair job</b>: find out why, and fix it. <b>There is more than one fault.</b>',
    goal: 'The LED comes on when the light level is low and goes off when it is high.',
    how: ['Print the number the sensor gives with <code>Serial.println()</code> and move the light level slider. Does it change?', 'A sensor that never changes is often a sensor with no power or no ground.', 'The reading is 0 to 1023 on the Uno. Is the number in the comparison one the reading can ever reach?'],
    hints: [
      'Print <code>light</code> to the Serial Monitor and move the slider. If the number does not follow it, look at the knob in the circuit check. If it does, look at the number the sketch compares it with.',
      'The knob needs power on one outer leg and GND on the other, or its middle leg floats at one end. And the Uno\'s reading never goes above 1023, so a limit of 3000 is always passed.',
      'Wire a26 to the - rail (GND) to give the knob its ground. In the sketch, change <code>light &lt; 3000</code> to <code>light &lt; 300</code>.',
    ],
    fault: it => (it.t === 'wire' && it.a === 'a26' ? null : it),
    code: [['light < 300', 'light < 3000']],
  }),
  repairOf(unoMission('chime'), {
    id: 'fixchime', title: 'Chime repair', place: 'Visitor Centre', hook: 'The new chime is silent, then rings all the time. Find the faults.', map: [25, 13], after: ['chime'], guide: ['button', 'digitalread', 'debugging'],
    story: 'The <b>door chime</b> in the visitor centre is wired and written, yet it does not work. Visitors say it stays silent when they press the bell. A trainee says that when the bell cable was unplugged it rang non-stop. This is a <b>repair job</b>. <b>There is more than one fault, and one of them hides the other.</b>',
    goal: 'A button press plays a chime of two different notes. No press, no sound.',
    how: ['Does the buzzer make any sound at all? If never, the problem is between the pin and the buzzer, not in the button.', 'The sketch plays a note on a pin. Is the buzzer\'s wire on that pin?', 'With <code>INPUT_PULLUP</code>, the button reads <b>LOW</b> when it is pressed and HIGH when it is not.'],
    hints: [
      'Compare the pin number in the sketch with the pin the buzzer\'s wire goes to. Fix that first, so that you can hear what the sketch does.',
      'Once you can hear it, you will find it plays when nobody presses the bell. Which reading means pressed with <code>INPUT_PULLUP</code>?',
      'Move the buzzer\'s wire from pin 7 to pin 8 (the sketch plays on <code>BUZZER_PIN</code> = 8). Then change <code>digitalRead(BUTTON_PIN) == HIGH</code> to <code>== LOW</code>.',
    ],
    fault: it => (it.t === 'wire' && it.a === 'U:8' ? { ...it, a: 'U:7' } : it),
    code: [['digitalRead(BUTTON_PIN) == LOW', 'digitalRead(BUTTON_PIN) == HIGH']],
  }),
);

ESP.splice(ESP.length - 1, 0,
  repairOf(espMission('touchlamp'), {
    id: 'fixtouch', title: 'Touch lamp repair', place: 'Study Hall', hook: 'The desk lamp ignores every touch. Find the faults.', map: [75, 28], after: ['touchlamp'], guide: ['touch', 'serial', 'debugging'],
    story: 'A student built a <b>touch lamp</b> for the study hall, but touching the pad does nothing: the lamp just sits there. The bench and the sketch are as they left them. This is a <b>repair job</b>. <b>There is more than one fault.</b>',
    goal: 'The LED is on while the pad is touched and off otherwise.',
    how: ['Open the Serial Monitor. Print <code>touchRead()</code> and hold the pad: do the numbers drop?', 'A pad that reads the same whatever you do is usually not connected to the pin the sketch reads.', 'Touching makes the number <b>smaller</b>. Which way does the comparison point?'],
    hints: [
      'Print <code>value</code> and hold the pad. If the number never drops, the pad is not wired to the pin in the sketch (D4).',
      'Once the pad is wired, the lamp comes on when nobody touches it, because the comparison points the wrong way. A touch makes the number smaller.',
      'Wire D4 to PAD with a wire. In the sketch change <code>value &gt; THRESHOLD</code> to <code>value &lt; THRESHOLD</code>.',
    ],
    fault: it => (it.t === 'wire' && it.b === 'PAD' ? null : it),
    code: [['value < THRESHOLD', 'value > THRESHOLD']],
  }),
  repairOf(espMission('weather'), {
    id: 'fixgauge', title: 'Wind gauge repair', place: 'Rooftop Mast', hook: 'The needle jerks to the end and the servo is weak. Find the faults.', map: [75, 80], after: ['weather'], guide: ['servo', 'analog', 'debugging'],
    story: 'The science club\'s <b>wind gauge</b> was copied from an Arduino Uno tutorial and moved to an ESP32. Now the needle barely moves in a light breeze and slams over to the end stop in anything stronger. The servo also hums and does not turn properly. This is a <b>repair job</b>. <b>There is more than one fault.</b>',
    goal: 'The servo needle points at 0° when the air is still and 180° in a gale, and follows the wind in between.',
    how: ['The ESP32 counts to <b>4095</b>, not 1023. The sums in an Uno tutorial need changing.', 'A servo needs 5 V to turn. On the ESP32 that is the <b>VIN</b> pin, not 3V3.', 'Check the circuit check panel first: it knows what the servo needs.'],
    hints: [
      'The circuit check names the servo\'s problem. And look at the numbers in <code>map()</code>: what is the biggest number the ESP32\'s <code>analogRead()</code> gives?',
      'The servo\'s red wire must be on a 5 V supply. VIN carries the 5 V from USB. And <code>map(wind, 0, 1023, 0, 180)</code> reaches 180° at a quarter of the wind.',
      'Wire VIN (not 3V3) to the + rail the servo uses. In the sketch change <code>map(wind, 0, 1023, 0, 180)</code> to <code>map(wind, 0, 4095, 0, 180)</code>.',
    ],
    fault: it => (it.t === 'wire' && it.a === 'E:VIN' ? { ...it, a: 'E:3V3' } : it),
    code: [['map(wind, 0, 4095, 0, 180)', 'map(wind, 0, 1023, 0, 180)']],
  }),
);

export const MISSIONS: Record<BoardId, Mission[]> = { uno: UNO, esp32: ESP };

/* --- progress: what is open and what is in the tray --- */
export const missionKey = (board: BoardId, id: string) => `${board}-${id}`;

/** Every part in the tray, given the missions passed (as board-id keys). */
export function unlockedParts(passed: Iterable<string>): Set<PartId> {
  const done = new Set(passed), have = new Set<PartId>(BASE_PARTS);
  for (const board of Object.keys(MISSIONS) as BoardId[]) for (const m of MISSIONS[board]) if (done.has(missionKey(board, m.id))) m.unlocks.forEach(p => have.add(p));
  return have;
}

/** The parts that can be picked up in a mission. The studio has every part from the start, so a project can be built there at any time; everywhere else the tray holds what the passed missions have unlocked. */
export const trayParts = (m: Mission, passed: Iterable<string>): Set<PartId> => (m.sandbox ? new Set(Object.keys(PARTS) as PartId[]) : unlockedParts(passed));

/** A mission is open once every mission it comes after has been passed. The studio comes after nothing, so it is always open. */
export const isAvailable = (board: BoardId, m: Mission, passed: Set<string>) => m.after.every(id => passed.has(missionKey(board, id)));

/** The first mission that puts a part in the tray, or null when the tray starts with it. */
export function lockedBy(part: PartId): { board: BoardId; mission: Mission } | null {
  if (BASE_PARTS.includes(part)) return null;
  for (const board of Object.keys(MISSIONS) as BoardId[]) for (const mission of MISSIONS[board]) if (mission.unlocks.includes(part)) return { board, mission };
  return null;
}
