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

`.github/workflows/ci.yml` type-checks, tests and builds every pull request and every push to `main` or `dev`. A push to `main` that passes is published to GitHub Pages at `https://jzrmanzano.github.io/Embedly/`. Pages must be switched on once: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The Node version lives in `.nvmrc`.

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
| `src/sim/schematic.ts` | Lays out the circuit on the bench as a schematic for the Schematic tab. |
| `src/data/symbols.ts` | The schematic symbols: tscircuit's (copied into `tscircuit-symbols.ts` by `scripts/vendor-symbols.mjs`) and our buzzer. |
| `src/state/panels.ts` | Which panels are open over the bench, on a wide screen and on a phone. |
| `src/state/route.ts` | Which page the address bar hash opens: the home page, the guide (`#guide`, `#guide/led`) or a mission (`#uno-beacon`). |
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

## The schematic

The **Schematic** tab of the mission brief draws the circuit on the bench as an electronics drawing, and redraws it every time the bench changes. The board sits on the left with only the pins in use. Each pin starts a row that runs right through its parts (an LED, a resistor, a button, a buzzer) until it reaches ground, power, another pin or a leg with nothing on it; a part joined part-way along a row hangs below it on a branch. The knob, the distance sensor, the servo and the touch pad sit at the end of the rows that feed them. Ground and power are drawn as their usual symbols wherever a row reaches them, a leg with nothing on it ends in a small circle, and a connection that cannot be drawn as a line gets the same name tag at both ends. A key under the drawing explains the symbols it uses. A backwards LED is drawn backwards, and a part that is not wired to anything shows open ends, so the drawing also shows mistakes. While the sketch runs, each LED on the drawing lights up in its own colour, as bright as it is on the bench (a dimmed LED is fainter), and a buzzer that is sounding fills in orange (the colour of Run) with sound waves either side and its pitch underneath, such as 880 Hz (the waves hold still for people who ask for less motion). A servo's box has a protractor showing its angle (0° right, 90° up, 180° left, as the arm turns on the bench): orange while the sketch is telling it where to go, its needle easing there the way the arm does, and grey at the angle it was left at once the signal stops. When the Timeline is held at a moment, the drawing shows the LEDs, buzzers and servos as they were then. It reads the same `currentReadout()` the 3D bench does, every frame, and changes only the LEDs, so the drawing is not redrawn as they blink.

The layout is `src/sim/schematic.ts` (no React, and tested in `tests/schematic.test.ts`: every mission's reference circuit draws every part once with nothing overlapping). It reads the nets from `netOf` in `src/sim/circuit.ts`. The resistor, LED, push button, knob, ground and power symbols are tscircuit's [schematic-symbols](https://github.com/tscircuit/schematic-symbols) (MIT). The package is not a dependency: it asks for TypeScript 5 as a peer, which this project has moved past, and only six of its symbols are used, so `scripts/vendor-symbols.mjs` copies them, with tscircuit's licence, into `src/data/tscircuit-symbols.ts`. Its header says how to refresh them. tscircuit has no buzzer, so ours is drawn in the same form in `src/data/symbols.ts`. The boards and modules have no standard symbol anywhere, so they are drawn as labelled boxes with their pin names, as schematics usually show them.

## The bench, the panels and the keyboard

The 3D bench fills the screen. The campus map, the mission brief and the code open over it as panels (Map, Brief and Code in the top bar, or along the bottom on a phone, where a panel is a sheet and only one is open at a time). Guide, next to them, goes to the guide, which is a page of its own. Run, Step and Stop stay on the bench, so the sketch can run without the code open, and the circuit slides to stay centred in whatever the panels leave free. On a wide screen the inner edge of each panel can be dragged to make it wider for reading or narrower for building (double-click for the usual width; with the keyboard, Tab to the edge and use the arrow keys). The widths are remembered in the browser and the rules are in `src/state/panels.ts`.

Everything works without a mouse. Press **?** for the full list: **M**, **B** and **C** toggle the panels (focus moves into the panel, and Esc returns it to the button), **G** goes to the guide and back, **Ctrl+Enter** runs or stops, the arrow keys slide the view, **+**, **-**, **0** and **T** zoom, reset and look from the top, and **Delete**, **Ctrl+Z** and **Ctrl+Y** edit the bench. A part is placed from the keyboard by choosing it in the tray and typing its holes.

The look lives in `src/styles.css`: colour tokens for a paper-and-pegboard light theme and a chalkboard dark theme (`tests/palette.test.ts` checks that every text and control pair is readable in both), Zilla Slab for headings, Atkinson Hyperlegible for reading, and the icon set in `src/components/Icons.tsx`. Which panels are open is decided in `src/state/panels.ts`.

## The guide

The **Guide** (**G**) is the textbook next to the missions, on a page of its own: `#guide` for the contents and `#guide/<chapter>` for each chapter, so a chapter can be bookmarked or opened in another tab. Its coding walkthrough explains a sketch from the start: `setup()` and `loop()`, `pinMode`, `digitalWrite`, `delay`, variables, `digitalRead`, `analogRead` and `analogWrite`, `if` and `else`, `switch` and `case` (and when to choose which), loops, functions, `Serial` and `millis()`. Its second half explains the circuit and the parts: what a circuit is, how a breadboard is joined underneath, how an LED works and why it needs a resistor, buttons, knobs, buzzers, the distance sensor, servos and the touch pad. Its contents page puts the two halves side by side, each drawn the way it is used: the coding walkthrough as one wire with a numbered pad per step (it is read in order), and the parts as a drawer of bins, each marked with the part's circuit symbol (they are looked up). On a wide screen a chapter page lists both down the side, and its header shows where it sits: the step along the wire, or the part's symbol. The symbols are in `SYMBOLS` in `src/components/GuidePage.tsx`. The way back to the bench (or **G** again) returns to the mission as it was left, with the sketch stopped. The home page links to it, the workshop tour points at it, and the Code notes tab of every mission links to the chapters that mission uses (the mission's `guide` list of chapter ids).

A chapter is an object in `src/data/guide.ts`: a title, a one-line summary and a list of blocks (`p`, `list`, `tip`, `table`, `code` or `fig`). The page and its drawings are in `src/components/GuidePage.tsx`. `tests/guide.test.ts` parses every code block with the simulator's own interpreter, runs the whole sketches, and checks that an example with `prints` prints exactly that, so an example that stops working fails `npm test`.

## Campus missions

Each location on the campus map is a mission: a small device to build for somewhere at a school. A mission is passed only when **Check my build** runs the student's own sketch on their own circuit and every check passes. Before the first run the student predicts what will happen, and the guess is compared with what the simulator does. Hints come in three steps (a nudge, the idea, the answer) and are counted. Passing a mission puts new parts in the tray and opens the missions after it; the first pass also opens the free-build Open Studio.

## Adding a mission

Add an object to a board's list in `src/data/missions.ts`. It needs a story and goal, a starter sketch, the `guide` chapters that explain it, a reference `circuit` and `answer`, three hints, a prediction, and its checks. A check is a scenario made with `phases()`, `blinks()` or `sweeps()` from `src/sim/check.ts`: stretches of time with scripted inputs (a wall that moves, a button that is pressed) and what should be true by the end of each: any LED, the `red` or `green` LED, the buzzer, the Serial Monitor, a PWM duty, or a `servo` angle range. `npm test` then proves that the reference build passes, that the starter sketch and plausible wrong answers do not, and that every part a mission needs was unlocked by the missions before it. Connection points are named `U:13` (Uno pin), `E:D5` (ESP32 pin), `a10` (breadboard hole) or `T-15` (power rail).

## Simulator limits

The interpreter covers variables, arrays, functions, `if`, `for`, `while`, `switch`, the pin functions, `tone`, `pulseIn`, `touchRead`, `map`, `millis`, `Serial` and the `Servo` library (`attach`, `write`, `writeMicroseconds`, `read`, `attached`, `detach`; `#include <Servo.h>` and `<ESP32Servo.h>` both work). It has no other libraries and no Wi-Fi.

A servo plugs into three breadboard holes in a row: GND (brown), + (red, needs 5 V) and signal (orange, to a pin). The circuit check explains a servo with no ground, too little power, power taken from a pin, or no signal wire.
