import { BREADBOARD_COLS, breadboardName, MAIN_COLS, onExtraBoard, type Item, type WireColor } from '../types';
import { ESP_HOLES, ITEM_INFO } from './boards';
import { ohmsLabel } from './resistor';

export const WIRE_CSS: Record<WireColor, string> = { red: '#d6453d', black: '#2f353d', orange: '#f08a24', yellow: '#e8c22e', green: '#3aa655', blue: '#3577d4', white: '#e9ecef', purple: '#8d5bd1' };

/** A connection point in words, such as "Uno pin 13" or "minus rail, far side". */
function pointName(a: string): string {
  let m;
  if ((m = /^U:(.+)$/.exec(a))) { const n = m[1].replace(/^GND.*$/, 'GND').replace('3V3', '3.3V'); return /^\d+$/.test(n) ? 'Uno pin ' + n : 'Uno ' + n; }
  if ((m = /^E:(.+)$/.exec(a))) return `ESP32 ${m[1].replace('GNDf', 'GND')} (hole ${ESP_HOLES[m[1]]})`;
  if (a === 'PAD') return 'the touch pad';
  if ((m = /^LCD:(.+)$/.exec(a))) return `the LCD's ${m[1]} pin`;
  if ((m = /^([TB])([+-])(\d+)$/.exec(a))) return `${m[2] === '+' ? 'plus' : 'minus'} rail, ${m[1] === 'T' ? 'far' : 'near'} side${onExtraBoard(a) ? ', second breadboard' : ''}`;
  return 'hole ' + a;
}

export interface WiringRow { part: string; where: string; wire?: WireColor }

/** One row of the wiring table per part and wire. */
export function wiringRows(circuit: Item[]): WiringRow[] {
  return circuit.map((it): WiringRow => {
    switch (it.t) {
      case 'led': return { part: 'LED', where: `long leg in ${it.a}, short leg in ${it.k}` };
      case 'res': return { part: `${ohmsLabel(it.ohms ?? 220)} resistor`, where: `${it.a} to ${it.b}` };
      case 'button': return { part: 'Push button', where: `across the centre gap: e${it.col}, e${it.col + 2}, f${it.col}, f${it.col + 2}` };
      case 'pot': return { part: 'Potentiometer', where: `${it.row}${it.col}, ${it.row}${it.col + 1}, ${it.row}${it.col + 2}` };
      case 'buzzer': return { part: 'Buzzer', where: `one leg in ${it.a}, the other in ${it.b}` };
      case 'sonar': return { part: 'HC-SR04', where: `VCC ${it.row}${it.col}, Trig ${it.row}${it.col + 1}, Echo ${it.row}${it.col + 2}, GND ${it.row}${it.col + 3}` };
      case 'ldr': return { part: 'Light sensor (LDR)', where: `${it.a} to ${it.b}` };
      case 'temp': return { part: 'TMP36 temperature sensor', where: `+ ${it.row}${it.col}, OUT ${it.row}${it.col + 1}, GND ${it.row}${it.col + 2}` };
      case 'pad': return { part: 'Touch pad', where: 'on the table, on the end of the white wire' };
      case 'servo': return { part: 'Servo', where: `GND (brown) ${it.row}${it.col}, + (red) ${it.row}${it.col + 1}, signal (orange) ${it.row}${it.col + 2}` };
      case 'rgb': return { part: 'RGB LED', where: `red ${it.row}${it.col}, long leg (−) ${it.row}${it.col + 1}, green ${it.row}${it.col + 2}, blue ${it.row}${it.col + 3}` };
      case 'slide': return { part: 'Slide switch', where: `${it.row}${it.col}, ${it.row}${it.col + 1} (the middle leg), ${it.row}${it.col + 2}` };
      case 'contact': return { part: it.kind === 'tilt' ? 'Tilt switch' : 'Reed switch', where: `${it.a} to ${it.b}` };
      case 'module': return { part: ITEM_INFO[it.kind][0], where: `+ ${it.row}${it.col}, OUT ${it.row}${it.col + 1}, GND ${it.row}${it.col + 2}` };
      case 'joy': return { part: 'Joystick', where: `GND ${it.row}${it.col}, + ${it.row}${it.col + 1}, VRx ${it.row}${it.col + 2}, VRy ${it.row}${it.col + 3}, SW ${it.row}${it.col + 4}` };
      case 'lcd': return { part: 'LCD display (16×2, I2C)', where: 'on the table in front of the bench, wired by its four pins: GND, VCC, SDA and SCL' };
      case 'breadboard': return { part: breadboardName(it.size), where: `on the table beside the first one: columns ${MAIN_COLS + 1} to ${MAIN_COLS + BREADBOARD_COLS[it.size]}, with rails of its own` };
      case 'wire': return { part: `${it.c[0].toUpperCase() + it.c.slice(1)} wire`, where: `${pointName(it.a)} to ${pointName(it.b)}`, wire: it.c };
    }
  });
}
