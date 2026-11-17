/* The pinout of every part: its legs in the order they are drawn, what each one is for, and where it goes. The Parts drawer and the part card show these behind an "i" button. */
import type { PartKind } from '../types';

/** A leg or wire of a part. `plus` and `minus` are the power and ground sides, `signal` carries a reading or a command, and `free` has no special job (a resistor's ends, say). */
export type Tone = 'plus' | 'minus' | 'signal' | 'free';
export interface Leg {
  /** The short name drawn under the leg: +, −, OUT, VCC. */
  name: string;
  /** Where it goes and why, in a sentence. */
  note: string;
  tone: Tone;
  /** The colour of a lead, when the part has coloured wires. */
  color?: string;
}
export interface Pinout {
  title: string;
  /** What to remember about the part's orientation. */
  tip: string;
  legs: Leg[];
}

/** One for each kind of part that can go on the bench. */
export const PINOUTS: Record<PartKind, Pinout> = {
  led: {
    title: 'LED',
    legs: [
      { name: '+', tone: 'plus', note: 'Anode. The long leg. It faces the pin (or power).' },
      { name: '−', tone: 'minus', note: 'Cathode. The short leg, on the side of the rim that is flat. It faces GND.' },
    ],
    tip: 'An LED only works one way round, and it needs a resistor in series or it burns out.',
  },
  res: {
    title: 'Resistor',
    legs: [
      { name: '1', tone: 'free', note: 'Either end. A resistor has no front and back.' },
      { name: '2', tone: 'free', note: 'The other end. Current can flow through in either direction.' },
    ],
    tip: 'The coloured bands spell its value: the first two are digits, the next is how many zeros follow, and gold (5%) or brown (1%) is how exact it is. Pick the value in the Parts drawer.',
  },
  wire: {
    title: 'Jumper wire',
    legs: [
      { name: 'A', tone: 'free', note: 'One end goes in a breadboard hole or on a board pin.' },
      { name: 'B', tone: 'free', note: 'The other end. A wire joins its two ends with no resistance.' },
    ],
    tip: 'Red is for power and black for GND, which makes a circuit easy to read. The simulator colours them for you.',
  },
  button: {
    title: 'Push button',
    legs: [
      { name: 'A', tone: 'free', note: 'Joined to the other A leg inside, all the time.' },
      { name: 'A', tone: 'free', note: 'The same side again.' },
      { name: 'B', tone: 'free', note: 'Joined to the other B leg inside, all the time.' },
      { name: 'B', tone: 'free', note: 'The same side again. Pressing the button joins side A to side B.' },
    ],
    tip: 'It sits across the gap in the middle of the breadboard, so the two sides are never joined by the board itself.',
  },
  pot: {
    title: 'Knob (potentiometer)',
    legs: [
      { name: 'End', tone: 'free', note: 'One end of the track. Power goes on one end…' },
      { name: 'OUT', tone: 'signal', note: 'The wiper, the middle leg. It gives a voltage between the two ends. Wire it to an analog pin.' },
      { name: 'End', tone: 'free', note: '…and GND on the other. Swap them and the knob reads the other way round.' },
    ],
    tip: 'Turning the knob slides the wiper along the track, so the voltage on the middle leg goes from one end to the other.',
  },
  buzzer: {
    title: 'Buzzer',
    legs: [
      { name: '+', tone: 'plus', note: 'The leg with the + printed above it (red). It faces the pin.' },
      { name: '−', tone: 'minus', note: 'The other leg (dark). It faces GND.' },
    ],
    tip: 'A pin that switches on and off very fast makes the buzzer sound. tone() sets how fast.',
  },
  sonar: {
    title: 'Distance sensor (HC-SR04)',
    legs: [
      { name: 'VCC', tone: 'plus', note: 'Power. It needs 5 V.' },
      { name: 'TRIG', tone: 'signal', note: 'Trigger. An output pin sends it a short pulse to start a measurement.' },
      { name: 'ECHO', tone: 'signal', note: 'Echo. It answers on this pin with a pulse as long as the echo took. Wire it to an input pin.' },
      { name: 'GND', tone: 'minus', note: 'Ground. Wire it to GND.' },
    ],
    tip: 'The two round parts on the front are the speaker and the microphone. Keep them facing the thing you are measuring.',
  },
  pad: {
    title: 'Touch pad',
    legs: [{ name: 'PAD', tone: 'signal', note: 'The only wire. Take it to a touch pin, such as D4 on the ESP32.' }],
    tip: 'There is nothing to connect on the other side: a finger near the metal is the other half of the circuit.',
  },
  servo: {
    title: 'Servo motor',
    legs: [
      { name: '−', tone: 'minus', color: '#7a4a21', note: 'Brown wire. GND.' },
      { name: '+', tone: 'plus', color: '#d6453d', note: 'Red wire. 5 V (VIN on the ESP32), never a pin: a motor needs more current than a pin can give.' },
      { name: 'SIG', tone: 'signal', color: '#f08a24', note: 'Orange wire. The signal, from a digital pin. The pulse length is the angle.' },
    ],
    tip: 'The three wires come together in one plug, so they go in three holes side by side: GND, then +, then signal.',
  },
  ldr: {
    title: 'Light sensor (LDR)',
    legs: [
      { name: '1', tone: 'free', note: 'Either leg. It has no front and back.' },
      { name: '2', tone: 'free', note: 'The other leg. About 1 kΩ in bright light and 100 kΩ in the dark.' },
    ],
    tip: 'A pin reads voltage, not resistance, so put the sensor and a 10 kΩ resistor in a divider and read the point between them.',
  },
  temp: {
    title: 'Temperature sensor (TMP36)',
    legs: [
      { name: '+', tone: 'plus', note: 'Power: 5V on the Uno, 3V3 on the ESP32. Anything from 2.7 V works.' },
      { name: 'OUT', tone: 'signal', note: 'Output: 0.5 V plus 10 mV for every degree. Wire it to an analog pin.' },
      { name: '−', tone: 'minus', note: 'Ground. Wire it to GND.' },
    ],
    tip: 'Hold it with the flat face towards you and the legs down. Wired backwards, a real one gets hot enough to burn a finger.',
  },
  rgb: {
    title: 'RGB LED (common cathode)',
    legs: [
      { name: 'R', tone: 'signal', color: '#d6453d', note: 'Red. From a pin, through its own resistor.' },
      { name: '−', tone: 'minus', note: 'The shared cathode, and the longest leg. It goes to GND.' },
      { name: 'G', tone: 'signal', color: '#3aa655', note: 'Green. From a pin, through its own resistor.' },
      { name: 'B', tone: 'signal', color: '#3577d4', note: 'Blue. From a pin, through its own resistor.' },
    ],
    tip: 'Three LEDs share one case and one − leg. Use PWM pins and analogWrite() to mix colours: red and green make yellow, all three make white.',
  },
  slide: {
    title: 'Slide switch',
    legs: [
      { name: '1', tone: 'free', note: 'Joined to the middle leg while the switch is to the left.' },
      { name: 'COM', tone: 'signal', note: 'The middle leg, shared by both sides. Wire it to the pin, or to the thing you are switching.' },
      { name: '2', tone: 'free', note: 'Joined to the middle leg while the switch is to the right.' },
    ],
    tip: 'Unlike a push button it stays where you leave it. For a simple on and off, use the middle leg and one outer leg.',
  },
  tilt: {
    title: 'Tilt switch',
    legs: [
      { name: '1', tone: 'free', note: 'Either leg. It has no front and back.' },
      { name: '2', tone: 'free', note: 'The other leg. A metal ball inside joins the two while the switch stands upright.' },
    ],
    tip: 'Wire it like a button: one leg to a pin set to INPUT_PULLUP, the other to GND. Upright reads LOW, tilted reads HIGH.',
  },
  reed: {
    title: 'Reed switch',
    legs: [
      { name: '1', tone: 'free', note: 'Either end. It has no front and back.' },
      { name: '2', tone: 'free', note: 'The other end. A magnet nearby pulls the two reeds inside together.' },
    ],
    tip: 'Wire it like a button: one end to a pin set to INPUT_PULLUP, the other to GND. With the magnet near it reads LOW.',
  },
  joy: {
    title: 'Joystick',
    legs: [
      { name: 'GND', tone: 'minus', note: 'Ground. Wire it to GND.' },
      { name: '+', tone: 'plus', note: 'Power: 5V on the Uno, 3V3 on the ESP32.' },
      { name: 'VRx', tone: 'signal', note: 'Left and right, as a voltage. Wire it to an analog pin: the middle of the range is the stick at rest.' },
      { name: 'VRy', tone: 'signal', note: 'Down and up, as a voltage. Wire it to another analog pin.' },
      { name: 'SW', tone: 'signal', note: 'The button under the stick. Pressing joins it to GND, so read it with INPUT_PULLUP: pressed is LOW.' },
    ],
    tip: 'At rest both readings sit near the middle (about 512 on the Uno, 2048 on the ESP32), never exactly, so leave a little room around it in your sketch.',
  },
  pir: {
    title: 'Motion sensor (PIR, HC-SR501)',
    legs: [
      { name: '+', tone: 'plus', note: 'Power. It needs 5 V: 5V on the Uno, VIN on the ESP32.' },
      { name: 'OUT', tone: 'signal', note: 'HIGH (3.3 V) while it sees movement, LOW when all is still. Wire it to a digital pin and use digitalRead().' },
      { name: '−', tone: 'minus', note: 'Ground. Wire it to GND.' },
    ],
    tip: 'The white dome is a lens that gathers the warmth of anything moving in front of it. A real one takes up to a minute to settle after power-on.',
  },
  ir: {
    title: 'Obstacle sensor (IR)',
    legs: [
      { name: '+', tone: 'plus', note: 'Power: 5V on the Uno, 3V3 on the ESP32.' },
      { name: 'OUT', tone: 'signal', note: 'HIGH while the way is clear, LOW when something is in front. Wire it to a digital pin and use digitalRead().' },
      { name: '−', tone: 'minus', note: 'Ground. Wire it to GND.' },
    ],
    tip: 'It is the other way round from what you might expect: an obstacle reads LOW. The clear LED sends infrared light and the dark one watches for it coming back.',
  },
  soil: {
    title: 'Soil moisture sensor',
    legs: [
      { name: '+', tone: 'plus', note: 'Power: 5V on the Uno, 3V3 on the ESP32.' },
      { name: 'OUT', tone: 'signal', note: 'A voltage that rises as the soil gets wetter. Wire it to an analog pin and use analogRead().' },
      { name: '−', tone: 'minus', note: 'Ground. Wire it to GND.' },
    ],
    tip: 'Only the two prongs go in the soil. Dry soil reads near 0, soaked soil near the top of the range.',
  },
  water: {
    title: 'Water level sensor',
    legs: [
      { name: '+', tone: 'plus', note: 'Power: 5V on the Uno, 3V3 on the ESP32.' },
      { name: 'OUT', tone: 'signal', note: 'A voltage that rises with the water level. Wire it to an analog pin and use analogRead().' },
      { name: '−', tone: 'minus', note: 'Ground. Wire it to GND.' },
    ],
    tip: 'The water joins the bare tracks on the board, and the more of them it covers the higher the reading. Keep the pins at the top dry.',
  },
  gas: {
    title: 'Gas sensor (MQ-2)',
    legs: [
      { name: '+', tone: 'plus', note: 'Power for its heater. It needs 5 V: 5V on the Uno, VIN on the ESP32.' },
      { name: 'OUT', tone: 'signal', note: 'About 0.1 V in clean air, rising towards 3.3 V as the air fills with smoke or gas. Wire it to an analog pin.' },
      { name: '−', tone: 'minus', note: 'Ground. Wire it to GND.' },
    ],
    tip: 'The metal mesh covers a tiny heater, so a real one gets warm and needs a few minutes before its readings settle.',
  },
  flame: {
    title: 'Flame sensor',
    legs: [
      { name: '+', tone: 'plus', note: 'Power: 5V on the Uno, 3V3 on the ESP32.' },
      { name: 'OUT', tone: 'signal', note: 'A voltage that rises with the brightness of the flame. Wire it to an analog pin and use analogRead().' },
      { name: '−', tone: 'minus', note: 'Ground. Wire it to GND.' },
    ],
    tip: 'The dark LED at the front sees infrared light, which a flame gives off. Point it at where the fire would be.',
  },
};
