# Embedly

An interactive 3D workbench that teaches the Arduino Uno and ESP32: wire a circuit, edit the sketch, press Run, and watch the board respond.

Built with Vite, React, TypeScript, three.js (through React Three Fiber) and Zustand.

## Commands

```
npm install      # once
npm run dev      # start the site at http://localhost:5173
npm test         # simulator, circuit checker, placement rules, stepping, and every mission's checks
npm run build    # type-check, then build the static site into dist/
```

`dist/` is a plain static site with relative paths, so it works from any folder on any host.

## CI and deploy

`.github/workflows/ci.yml` type-checks, tests and builds every pull request and every push to `main` or `dev`. A push to `main` that passes is published to GitHub Pages at `https://jzrmanzano.github.io/board_3d/`. Pages must be switched on once: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The Node version lives in `.nvmrc`.

## Where things are

| Folder | What it holds |
|---|---|
| `src/data/missions.ts` | The campus missions for both boards: story, goal, checks, prediction, hints, starter sketch and the reference build. Add or edit missions here. |
| `src/data/boards.ts` | The two boards: parts, pinouts and facts. |
| `src/data/guide.ts` | The guide: the coding walkthrough and the chapters about the parts. Add or edit chapters here. |
| `src/sim/check.ts` | The mission check engine: runs the student's own sketch on their own build, with scripted inputs, on a virtual clock. |
| `src/data/wiring.ts` | Turns a circuit into the rows of the Wiring tab. |
| `src/sim/interpreter.ts` | Runs the Arduino-style code (a subset of C++). |
| `src/sim/circuit.ts` | The electrical model: breadboard connectivity, the mistakes a student can make, and a small DC solver for voltages and currents. |
| `src/sim/hardware.ts` | The virtual pins, connected through the student's wiring to the parts. |
| `src/sim/timeline.ts` | The recording of pin states over time that the Timeline draws and replays. |
| `src/state/panels.ts` | Which panels are open over the bench, on a wide screen and on a phone. |
| `src/state/bench.ts` | The rules for placing parts: which holes exist, which are taken, what each part needs. |
| `src/scene/world.ts` | Builds the 3D board, breadboard and parts for a mission. |
| `src/scene/Bench.tsx` | The React Three Fiber scene: camera, lights, clicking, labels. |
| `src/state/` | App state (`store.ts`) and everything that changes it (`actions.ts`). |
| `src/components/` | The panels around the 3D view. |
| `tests/sim.test.ts` | Simulator tests. |

## Building circuits

Parts start in the tray above the 3D view. Pick a part, then click (or drag between) holes and pins, or type them (`e10 e11`). The circuit check explains problems in plain words: open circuit, LED backwards, missing resistor, short from power to ground. A short stops the sketch from starting, and an LED with no resistor burns out when the sketch drives it. Undo, redo and Reset bench are in the tray (Ctrl+Z, Ctrl+Y, Esc and Delete also work). Drag either end of a wire (the cursor turns into a hand) to plug it into a different hole or pin: the wire follows the pointer, a taken or impossible spot is refused with a reason, and Undo reverses it. Selecting a wire also shows From and To boxes to type new places. A lesson's own `circuit` is the reference answer, shown in the Wiring tab with a "Build it for me" button.

## Seeing inside the circuit

While a sketch runs, yellow beads travel along each wire from + towards -, faster with more current. Point at any hole or pin to read its voltage (and the current a pin supplies). **Step** runs one line and waits: the current line is highlighted in the editor, delays are skipped but still counted on the sketch clock, and **Continue** returns to full speed. Every step (and every pin change in a free run) is recorded in the **Timeline**; pause with Step or stop the sketch, then drag across the chart (or use the arrows) to see the board, the wires and the voltages as they were at that moment. The recording lives in `src/sim/timeline.ts` and wire currents come from `wireAmps` in `src/sim/circuit.ts`.

## The bench, the panels and the keyboard

The 3D bench fills the screen. The campus map, the mission brief, the guide and the code open over it as panels (Map, Brief, Guide and Code in the top bar, or along the bottom on a phone, where a panel is a sheet and only one is open at a time). Run, Step and Stop stay on the bench, so the sketch can run without the code open, and the circuit slides to stay centred in whatever the panels leave free. On a wide screen the inner edge of each panel can be dragged to make it wider for reading or narrower for building (double-click for the usual width; with the keyboard, Tab to the edge and use the arrow keys). The widths are remembered in the browser and the rules are in `src/state/panels.ts`.

Everything works without a mouse. Press **?** for the full list: **M**, **B**, **G** and **C** toggle the panels (focus moves into the panel, and Esc returns it to the button), **Ctrl+Enter** runs or stops, the arrow keys slide the view, **+**, **-**, **0** and **T** zoom, reset and look from the top, and **Delete**, **Ctrl+Z** and **Ctrl+Y** edit the bench. A part is placed from the keyboard by choosing it in the tray and typing its holes.

The look lives in `src/styles.css`: colour tokens for a paper-and-pegboard light theme and a chalkboard dark theme (`tests/palette.test.ts` checks that every text and control pair is readable in both), Zilla Slab for headings, Atkinson Hyperlegible for reading, and the icon set in `src/components/Icons.tsx`. Which panels are open is decided in `src/state/panels.ts`.

## The guide

The **Guide** panel (**G**) is the textbook next to the missions. Its coding walkthrough explains a sketch from the start: `setup()` and `loop()`, `pinMode`, `digitalWrite`, `delay`, variables, `digitalRead`, `analogRead` and `analogWrite`, `if` and `else`, `switch` and `case` (and when to choose which), loops, functions, `Serial` and `millis()`. Its second half explains the circuit and the parts: what a circuit is, how a breadboard is joined underneath, how an LED works and why it needs a resistor, buttons, knobs, buzzers, the distance sensor, servos and the touch pad. It opens on the left, so it can be read beside the code. The home page links to it, the workshop tour points at it, and the Code notes tab of every mission links to the chapters that mission uses (the mission's `guide` list of chapter ids).

A chapter is an object in `src/data/guide.ts`: a title, a one-line summary and a list of blocks (`p`, `list`, `tip`, `table`, `code` or `fig`). The drawings are in `src/components/GuidePanel.tsx`. `tests/guide.test.ts` parses every code block with the simulator's own interpreter, runs the whole sketches, and checks that an example with `prints` prints exactly that, so an example that stops working fails `npm test`.

## Campus missions

Each location on the campus map is a mission: a small device to build for somewhere at a school. A mission is passed only when **Check my build** runs the student's own sketch on their own circuit and every check passes. Before the first run the student predicts what will happen, and the guess is compared with what the simulator does. Hints come in three steps (a nudge, the idea, the answer) and are counted. Passing a mission puts new parts in the tray and opens the missions after it; the first pass also opens the free-build Open Studio.

## Adding a mission

Add an object to a board's list in `src/data/missions.ts`. It needs a story and goal, a starter sketch, the `guide` chapters that explain it, a reference `circuit` and `answer`, three hints, a prediction, and its checks. A check is a scenario made with `phases()`, `blinks()` or `sweeps()` from `src/sim/check.ts`: stretches of time with scripted inputs (a wall that moves, a button that is pressed) and what should be true by the end of each: any LED, the `red` or `green` LED, the buzzer, the Serial Monitor, a PWM duty, or a `servo` angle range. `npm test` then proves that the reference build passes, that the starter sketch and plausible wrong answers do not, and that every part a mission needs was unlocked by the missions before it. Connection points are named `U:13` (Uno pin), `E:D5` (ESP32 pin), `a10` (breadboard hole) or `T-15` (power rail).

## Simulator limits

The interpreter covers variables, arrays, functions, `if`, `for`, `while`, `switch`, the pin functions, `tone`, `pulseIn`, `touchRead`, `map`, `millis`, `Serial` and the `Servo` library (`attach`, `write`, `writeMicroseconds`, `read`, `attached`, `detach`; `#include <Servo.h>` and `<ESP32Servo.h>` both work). It has no other libraries and no Wi-Fi.

A servo plugs into three breadboard holes in a row: GND (brown), + (red, needs 5 V) and signal (orange, to a pin). The circuit check explains a servo with no ground, too little power, power taken from a pin, or no signal wire.
