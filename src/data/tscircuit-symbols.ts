/* Schematic symbols from tscircuit's "schematic-symbols" package, version 0.0.251 (https://github.com/tscircuit/schematic-symbols).
   Written by scripts/vendor-symbols.mjs: run it again to refresh them rather than editing this file. Coordinates are in the package's
   units with y pointing up, and the text placeholders for part names and values are left out.

   MIT License

   Copyright (c) 2024 tscircuit

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.
*/
import type { SchSymbol } from './symbols';

export const TSCIRCUIT = {
  resistor: {
    from: 'resistor_right',
    paths: [
      { points: [[0.47, 0.04], [0.21, 0.04]] },
      { points: [[-0.21, 0.04], [-0.47, 0.04]] },
      { points: [[0.21, 0.04], [0.19, -0.05]] },
      { points: [[-0.19, 0.14], [-0.21, 0.04]] },
      { points: [[0.19, -0.05], [0.13, 0.14]] },
      { points: [[0.08, -0.05], [0.13, 0.14]] },
      { points: [[0.08, -0.05], [0.03, 0.14]] },
      { points: [[-0.03, -0.05], [0.03, 0.14]] },
      { points: [[-0.03, -0.05], [-0.08, 0.14]] },
      { points: [[-0.13, -0.05], [-0.08, 0.14]] },
      { points: [[-0.13, -0.05], [-0.19, 0.14]] },
    ],
    circles: [],
    ports: [{ x: -0.47, y: 0.04, labels: ['1'] }, { x: 0.47, y: 0.04, labels: ['2'] }],
  },
  led: {
    from: 'led_right',
    paths: [
      { points: [[0.14, 0], [-0.13, -0.14]] },
      { points: [[0.13, 0], [0.54, 0]] },
      { points: [[-0.13, 0.13], [0.14, 0]] },
      { points: [[-0.13, -0.14], [-0.13, 0.13]] },
      { points: [[0.14, 0.13], [0.14, -0.14]] },
      { points: [[-0.13, 0], [-0.54, 0]] },
      { points: [[0.16, 0.29], [0.25, 0.3], [0.22, 0.21]], fill: true },
      { points: [[0.08, 0.17], [0.09, 0.17], [0.21, 0.27], [0.21, 0.27]] },
      { points: [[-0.02, 0.31], [0.08, 0.32], [0.04, 0.23]], fill: true },
      { points: [[-0.1, 0.19], [-0.09, 0.2], [0.04, 0.29], [0.04, 0.29]] },
    ],
    circles: [],
    ports: [{ x: -0.54, y: 0, labels: ['1', 'anode', 'pos'] }, { x: 0.54, y: 0, labels: ['2', 'cathode', 'neg'] }],
  },
  button: {
    from: 'push_button_normally_open_momentary_horz',
    paths: [
      { points: [[-0.05, 0.09], [-0.05, 0.04]] },
      { points: [[-0.05, 0.09], [0.07, 0.09]] },
      { points: [[0.07, 0.09], [0.07, 0.04]] },
      { points: [[-0.47, -0.05], [-0.17, -0.05]] },
      { points: [[-0.16, 0.04], [0.18, 0.04]] },
      { points: [[0.2, -0.05], [0.47, -0.05]] },
    ],
    circles: [{ x: -0.14, y: -0.05, r: 0.02 }, { x: 0.17, y: -0.05, r: 0.02 }],
    ports: [{ x: -0.47, y: -0.05, labels: ['1'] }, { x: 0.47, y: -0.05, labels: ['2'] }],
  },
  knob: {
    from: 'potentiometer3_down',
    paths: [
      { points: [[0, 0.42], [0, 0.3]] },
      { points: [[0, 0.3], [0.1, 0.25], [-0.1, 0.15], [0.1, 0.05], [-0.1, -0.05], [0.1, -0.15], [-0.1, -0.25], [0, -0.3]] },
      { points: [[0, -0.3], [0, -0.42]] },
      { points: [[-0.17, 0], [-0.4, 0]] },
      { points: [[-0.12, 0], [-0.2, -0.05], [-0.2, 0.05], [-0.12, 0]], fill: true },
    ],
    circles: [],
    ports: [{ x: 0, y: 0.42, labels: ['1'] }, { x: 0, y: -0.42, labels: ['3'] }, { x: -0.4, y: 0, labels: ['2'] }],
  },
  ground: {
    from: 'ground_down',
    paths: [
      { points: [[0.01, 0.29], [0, -0.04]] },
      { points: [[-0.22, -0.04], [0.22, -0.04]] },
      { points: [[-0.17, -0.12], [0.17, -0.12]] },
      { points: [[-0.06, -0.19], [0.06, -0.19]] },
    ],
    circles: [],
    ports: [{ x: 0.01, y: 0.29, labels: ['1'] }],
  },
  supply: {
    from: 'vcc_up',
    paths: [
      { points: [[0, 0.091], [-0.12, 0]] },
      { points: [[0, 0.091], [0.12, 0]] },
      { points: [[0, 0.091], [0, -0.11]] },
    ],
    circles: [],
    ports: [{ x: 0, y: -0.11, labels: ['1'] }],
  },
} satisfies Record<string, SchSymbol>;
