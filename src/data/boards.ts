import type { Board, BoardId, Info } from '../types';

const BASE_CONSTS = { HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2 };
export const ESP_NEAR = ['3V3', 'GND', 'D15', 'D2', 'D4', 'RX2', 'TX2', 'D5', 'D18', 'D19', 'D21', 'RX0', 'TX0', 'D22', 'D23'];
export const ESP_FAR = ['VIN', 'GNDf', 'D13', 'D12', 'D14', 'D27', 'D26', 'D25', 'D33', 'D32', 'D35', 'D34', 'VN', 'VP', 'EN'];
/** The breadboard hole each ESP32 pin sits in. */
export const ESP_HOLES: Record<string, string> = {};
ESP_NEAR.forEach((n, i) => { ESP_HOLES[n] = 'j' + (4 + i); });
ESP_FAR.forEach((n, i) => { ESP_HOLES[n] = 'a' + (4 + i); });

export const ITEM_INFO: Record<string, Info> = {
  led: ['LED', 'Lights up when current flows through it. The long leg is the + side and must face the pin.'],
  res: ['Resistor', 'Limits the current. Without one in series, an LED would draw too much and burn out. The coloured bands spell out its value.'],
  button: ['Push button', 'Joins its two sides only while it is held down.'],
  pot: ['Potentiometer', 'A knob that outputs any voltage between ground and the supply voltage.'],
  buzzer: ['Buzzer', 'Turns a signal that switches on and off very fast into a sound. It has a + leg (red, with a + printed on top) and a − leg (dark). Put the + leg towards the pin and the − leg towards GND.'],
  sonar: ['HC-SR04 distance sensor', 'Sends out an ultrasonic ping and times how long the echo takes to come back.'],
  ldr: ['Light sensor (LDR)', 'A resistor that lets less current through in the dark: about 1 kΩ in bright light and 100 kΩ in darkness. Pair it with a fixed resistor to turn the light level into a voltage the board can read.'],
  temp: ['TMP36 temperature sensor', 'Gives 0.5 V at 0 °C plus 10 mV for every degree. Facing the flat side, the left leg is + (power, red), the middle leg is the output and the right leg is − (GND, dark). Wire it backwards and a real one gets hot.'],
  wire: ['Jumper wire', 'Carries current between two points with no resistance. Drag either end to a new hole or pin, or type new places below.'],
  pad: ['Touch pad', 'A bare piece of metal on a wire. A finger near it changes its electrical capacitance.'],
  servo: ['Servo motor', 'Turns its arm to the angle the sketch asks for, from 0° to 180°, and holds it there. Brown is GND, red is + (5 V), orange is the signal from a pin.'],
  rgb: ['RGB LED', 'A red, a green and a blue LED in one case, sharing one − leg: the long one, second from the left. Give each colour leg its own resistor and a PWM pin, and analogWrite() mixes any colour.'],
  slide: ['Slide switch', 'Joins its middle leg to the left leg or to the right one, and stays where you put it. Use two legs for on and off, or all three to choose between two things.'],
  tilt: ['Tilt switch', 'A small can with a metal ball inside. Standing upright, the ball joins the two legs. Tilted over, it rolls away and the circuit opens. Read it like a button, with INPUT_PULLUP.'],
  reed: ['Reed switch', 'Two thin metal reeds in a glass tube. A magnet nearby pulls them together and joins the two legs: this is how a door sensor knows the door is shut. Read it like a button, with INPUT_PULLUP.'],
  joy: ['Joystick', 'Two knobs and a button under one stick. VRx follows left and right, VRy follows down and up, each a voltage for an analog pin. Pressing the stick joins SW to GND, so read SW with INPUT_PULLUP.'],
  pir: ['Motion sensor (PIR)', 'Notices the warmth of a person or animal moving in front of it. OUT goes HIGH while it sees movement and LOW when all is still. It needs 5 V (VIN on the ESP32).'],
  ir: ['Obstacle sensor (IR)', 'Shines invisible infrared light and watches for it bouncing back. OUT is HIGH while the way is clear and goes LOW when something is in front of it.'],
  soil: ['Soil moisture sensor', 'Two prongs that go in the soil. The wetter the soil, the higher the voltage on OUT: read it with analogRead() and water the plant when it gets low.'],
  water: ['Water level sensor', 'Bare tracks that the water joins together. The deeper it stands in water, the higher the voltage on OUT. Read it with analogRead().'],
  gas: ['Gas sensor (MQ-2)', 'Smells smoke and burnable gas. OUT is about 0.1 V in clean air and rises towards 3.3 V as the air fills with gas. Its little heater needs 5 V (VIN on the ESP32).'],
  flame: ['Flame sensor', 'A dark LED that reacts to the infrared light of a flame. The brighter the flame in front of it, the higher the voltage on OUT. Read it with analogRead().'],
};

export const BOARDS: Record<BoardId, Board> = {
  uno: {
    id: 'uno', name: 'Arduino Uno', adcMax: 1023, builtin: 13,
    consts: Object.assign({ LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19 }, BASE_CONSTS),
    parts: {
      mcu: ['Microcontroller', 'The ATmega328P is the brain. It stores your sketch and runs it the moment the board has power.'],
      usb: ['USB port', 'Connects to your computer to upload sketches, send Serial messages and power the board.'],
      jack: ['Barrel jack', 'Power input for running without a computer. Use 7 to 12 V.'],
      digital: ['Digital pins 0 to 13', 'Each pin reads or writes HIGH (5 V) or LOW (0 V). Pins marked ~ can also dim and set speeds with PWM.'],
      analog: ['Analog inputs A0 to A5', 'Measure a voltage from 0 to 5 V and report it as a number from 0 to 1023.'],
      power: ['Power pins', '5V and 3.3V feed your circuit. GND is the return path every circuit needs.'],
      leds: ['On-board LEDs', 'ON shows power. TX and RX flicker with USB data. The L LED is wired to pin 13.'],
      reset: ['Reset button', 'Restarts your sketch from the top of setup(). Nothing is erased.'],
      crystal: ['16 MHz crystal', 'The clock. Every instruction and every delay() is timed from its ticks.'],
      usbchip: ['USB chip', 'A second small chip that translates between USB and the main chip.'],
      regulator: ['Voltage regulator', 'Turns the 7 to 12 V from the barrel jack into a steady 5 V.'],
      icsp: ['ICSP header', 'Direct programming pins. Beginners can ignore them.']
    },
    pinout: [
      { title: 'Digital', pins: [['0', 'RX'], ['1', 'TX'], ['2', ''], ['~3', 'PWM'], ['4', ''], ['~5', 'PWM'], ['~6', 'PWM'], ['7', ''], ['8', ''], ['~9', 'PWM'], ['~10', 'PWM'], ['~11', 'PWM'], ['12', ''], ['13', 'LED'], ['GND', '', 'gnd'], ['SDA', 'I2C', 'bus'], ['SCL', 'I2C', 'bus']] },
      { title: 'Analog in', pins: [['A0', ''], ['A1', ''], ['A2', ''], ['A3', ''], ['A4', 'SDA', 'bus'], ['A5', 'SCL', 'bus']] },
      { title: 'Power', pins: [['3.3V', '50 mA max', 'pwr'], ['5V', '', 'pwr'], ['GND', '', 'gnd'], ['GND', '', 'gnd'], ['VIN', '7 to 12 V', 'pwr'], ['RESET', '']] }
    ],
    facts: [['Chip', 'ATmega328P, 8-bit, 16 MHz'], ['Memory', '32 KB flash, 2 KB RAM'], ['Pin voltage', '5 V, about 20 mA per pin'], ['Analog input', '10-bit: 0 to 1023'], ['Wireless', 'None']],
  },

  esp32: {
    id: 'esp32', name: 'ESP32', adcMax: 4095, builtin: 2,
    consts: Object.assign({ LED_BUILTIN: 2, T0: 4, T3: 15, T4: 13, T5: 12, T6: 14, T7: 27, T8: 33, T9: 32 }, BASE_CONSTS),
    parts: {
      module: ['ESP32 module', 'Under the metal shield: a dual-core 240 MHz processor, flash memory, and the Wi-Fi and Bluetooth radio.'],
      antenna: ['Antenna', 'The zigzag copper trace sends and receives Wi-Fi and Bluetooth. Keep metal away from it.'],
      usb: ['USB port', 'Uploads your program, carries Serial messages and powers the board.'],
      pinsNear: ['Pins 3V3 to D23', 'General-purpose pins, including the usual I2C pins (D21, D22) and SPI pins (D18, D19, D23).'],
      pinsFar: ['Pins VIN to EN', 'Most analog-capable pins are on this side. D34, D35, VP and VN can only be inputs.'],
      boot: ['BOOT button', 'Hold it if an upload gets stuck at "Connecting...".'],
      en: ['EN button', 'Reset. Restarts your program from the beginning.'],
      leds: ['On-board LEDs', 'Red shows power. The blue LED is wired to GPIO 2.'],
      usbchip: ['USB-to-serial chip', 'Translates USB from your computer into serial signals for the ESP32.'],
      regulator: ['3.3 V regulator', 'Drops 5 V from USB to the 3.3 V the ESP32 runs on. The pins are not 5 V tolerant.']
    },
    pinout: [
      { title: 'Near row', pins: [['3V3', '', 'pwr'], ['GND', '', 'gnd'], ['D15', ''], ['D2', 'LED'], ['D4', 'touch T0'], ['RX2', 'GPIO 16'], ['TX2', 'GPIO 17'], ['D5', ''], ['D18', 'SCK', 'bus'], ['D19', 'MISO', 'bus'], ['D21', 'SDA', 'bus'], ['RX0', 'GPIO 3'], ['TX0', 'GPIO 1'], ['D22', 'SCL', 'bus'], ['D23', 'MOSI', 'bus']] },
      { title: 'Far row', pins: [['VIN', '5 V', 'pwr'], ['GND', '', 'gnd'], ['D13', ''], ['D12', ''], ['D14', ''], ['D27', ''], ['D26', 'DAC'], ['D25', 'DAC'], ['D33', 'analog'], ['D32', 'analog'], ['D35', 'in only'], ['D34', 'in only'], ['VN', 'GPIO 39, in'], ['VP', 'GPIO 36, in'], ['EN', 'reset']] }
    ],
    facts: [['Chip', 'ESP32, dual-core 32-bit, 240 MHz'], ['Memory', '4 MB flash, 520 KB RAM'], ['Pin voltage', '3.3 V only'], ['Analog input', '12-bit: 0 to 4095'], ['Wireless', 'Wi-Fi and Bluetooth']],
  }
};
