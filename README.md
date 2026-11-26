<div align="center">

# ⚡ Embedly

### Wire it. Code it. Press Run. Watch it come alive.

An interactive **3D workbench** that teaches the **Arduino Uno** and **ESP32**.
No parts to buy, nothing to burn out (well, *almost* nothing, see below 🔥).

![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![three.js](https://img.shields.io/badge/three.js-000000?logo=threedotjs&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-433E38)

**[🚀 Try it live](https://jzrmanzano.github.io/Embedly/)**

</div>

---

## 🎬 The loop

```
   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
   │ 🔌Wire   │──▶ │  ✍️ Code │──▶│  ▶ Run   │ ──▶ │ 👀 Watch │
   │ the bench│     │the sketch│     │          │     │ it react │
   └──────────┘     └──────────┘     └──────────┘     └────┬─────┘
         ▲                                                 │
         └────────── 🐛 debug, tweak, try again ◀──────────┘
```

Every mission is a small device to build. You predict what will happen, run your own sketch on your own circuit, and the simulator tells you whether you were right.

---

## 🏁 Get started

```bash
npm install      # once
npm run dev      # the site, at http://localhost:5173
npm test         # simulator, circuit checker, placement rules, stepping, every mission's checks
npm run build    # type-check, then build the static site into dist/
```

> [!TIP]
> `dist/` is a plain static site with relative paths, so it works from any folder on any host.

<details>
<summary><b>🤖 CI and deploy</b></summary>

<br>

`.github/workflows/ci.yml` type-checks, tests and builds every pull request and every push to `main` or `dev`. A passing push to `main` is published to GitHub Pages at <https://jzrmanzano.github.io/Embedly/>.

Pages must be switched on once: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The Node version lives in `.nvmrc`.

</details>

---

## ✨ What you can do

| | |
|---|---|
| 🧱 **Build real circuits** | Breadboard (and a second one, short or long), wires, LEDs, resistors, buttons, knobs, buzzers, a distance sensor, servos, a touch pad, a light sensor and a temperature sensor. |
| 🧠 **Run real-looking code** | Write Arduino-style C++ and watch it drive the board. |
| 🔬 **See inside the wires** | Glowing beads, live voltages, a step debugger and a rewindable timeline. |
| 📐 **Get a free schematic** | The circuit you build is redrawn as an electronics diagram, live. |
| 🗺️ **Follow a map** | Missions unlock parts, which unlock more missions. |
| 📶 **Go wireless** | The ESP32 joins the workshop's Wi-Fi and serves web pages to a phone beside the bench. |
| 📖 **Read the guide** | A built-in textbook for the code and for every part. |
| 🛒 **Pick the right board** | Five boards on a supply shelf, and a comparison page to match one to a project. |

---

## 🔌 Building circuits

Parts start in the **tray** above the 3D view. Pick a part, then click (or drag between) holes and pins. Prefer typing? Type them: `e10 e11`.

The circuit check explains problems in plain words:

- 🔓 open circuit
- 🔄 LED backwards
- 🧯 missing resistor
- 💥 short from power to ground

> [!WARNING]
> A short stops the sketch from starting, and an LED with no resistor **burns out** when the sketch drives it.

**Editing is forgiving.** Undo, redo and Reset bench live in the tray (<kbd>Ctrl</kbd>+<kbd>Z</kbd>, <kbd>Ctrl</kbd>+<kbd>Y</kbd>, <kbd>Esc</kbd> and <kbd>Delete</kbd> work too). Drag either end of a wire (the cursor turns into a ✋) to replug it: the wire follows the pointer, and a taken or impossible spot is refused with a reason. Selecting a wire also shows **From** and **To** boxes to type new places.

**Placed parts move too.** Drag a part to other holes and it follows the pointer hole by hole, keeping its shape: an LED keeps its two legs the same distance apart, a knob its three columns, and a button stays across the middle gap. It shows in its new holes while they would take it, and a taken or impossible spot is refused with a reason when you let go. With a part selected, the arrow keys move it a hole at a time (five with <kbd>Shift</kbd>), and a quick run of nudges is one Undo step. Wires plugged in beside it stay where they are, as on a real breadboard, so moving a part can change the circuit. The rules are `movedPart` in `src/state/bench.ts`, tested in `tests/moveparts.test.ts`.

**And they change after they are placed.** Select a placed LED to give it another **Colour**, a resistor to change its **Value** with the slider or by typing one (its bands follow), or the second breadboard to make it **Short** or **Long**. The tray's tiles stay simple: each says what it comes as (Red, 220 Ω, Short), which is whatever was last chosen on the bench. A quick run of changes to one part, such as dragging the value slider along, is one Undo step.

A lesson's own `circuit` is the reference answer, shown in the Wiring tab with a **Build it for me** button.

### 🧱 A second breadboard

Need more room? The **Breadboard** tile in the tray's Wiring group adds a second one to the right of the bench's own. Select it on the bench to make it **Short** (30 columns, like the first) or **Long** (63 columns), and the view reframes to fit it. It starts to the right of the first one.

| | Short | Long |
|---|---|---|
| Columns | 31 to 60 | 31 to 93 |
| Holes | `a31` … `j60` | `a31` … `j93` |
| Rails | `T+31` … `B-60` | `T+31` … `B-93` |

- 🔢 Its columns **carry on from the first one's**, so every hole on the bench has a name of its own.
- 🔌 **Its rails are its own**, as on two real breadboards. A wire such as `T+30` to `T+31` joins them.
- ✋ **Drag it anywhere on the table** by the board itself (the cursor turns into a ✋ over it; pressing on a part in it moves just that part), and everything plugged into it comes along, wires and all. It stops against the first breadboard, the Uno, the LCD and the touch pad and slides along them instead of landing on them. A press that does not move still just selects it.
- ⌨️ With it selected, the **arrow keys move it** one hole at a time (ten with <kbd>Shift</kbd>), and quick nudges in a row are one Undo step. **Put it back** in its card returns it to where it started. Moving it never stops a running sketch: the circuit is the same wherever it lies.
- 🔁 Pick the other size and press the tile again to **swap** it, keeping its left end where it is. A long one only becomes short when nothing is plugged in past column 60, and a short one only becomes long when there is room.
- 🗑️ **Removing it takes off everything plugged into it**, and Undo puts it all back.

The rules live in `src/state/bench.ts` (`withoutBreadboard`, `resizedBreadboard`, `movedBreadboard`), where things lie on the table and how the breadboard slides in `src/state/table.ts`, the separate rails in `holeNode` in `src/sim/circuit.ts`, and `tests/breadboard.test.ts` covers them.

---

## 🔬 Seeing inside the circuit

While a sketch runs, **yellow beads** travel along each wire from `+` towards `-`, faster with more current. Point at any hole or pin to read its voltage (and the current a pin supplies).

| Tool | What it does |
|---|---|
| ⏯️ **Step** | Runs one line and waits. The current line is highlighted, delays are skipped but still counted on the sketch clock. |
| ⏩ **Continue** | Returns to full speed. |
| 📈 **Timeline** | Records every step (and every pin change in a free run). Pause or stop, then drag across the chart (or use the arrows) to see the board, wires and voltages *as they were at that moment*. |

The recording lives in `src/sim/timeline.ts`, and wire currents come from `wireAmps` in `src/sim/circuit.ts`.

---

## 📐 The schematic

The **Schematic** tab of the mission brief draws your bench as an electronics drawing, and redraws it every time the bench changes.

```
  ┌───────┐
  │ board │── pin ──[ resistor ]──▶| LED ──── ⏚ ground
  │       │── pin ──[ button ]───────────────── ⏚
  └───────┘
```

<details>
<summary><b>How the drawing works</b></summary>

<br>

- The board sits on the left with only the pins in use. Each pin starts a row that runs right through its parts until it reaches ground, power, another pin or a leg with nothing on it. A part joined part-way along a row hangs below it on a branch.
- The knob, distance sensor, servo and touch pad sit at the end of the rows that feed them.
- Ground and power are drawn as their usual symbols. A leg with nothing on it ends in a small circle. A connection that cannot be drawn as a line gets the same name tag at both ends.
- A key under the drawing explains the symbols it uses.
- Mistakes show up: a backwards LED is drawn backwards, and a part wired to nothing shows open ends.

</details>

<details>
<summary><b>It comes alive while the sketch runs</b></summary>

<br>

- 💡 Each LED lights in its own colour, as bright as on the bench (a dimmed LED is fainter).
- 🔔 A sounding buzzer fills in orange (the colour of Run) with sound waves either side and its pitch underneath, such as `880 Hz`. The waves hold still for people who ask for less motion.
- 🦾 A servo's box has a protractor: 0° right, 90° up, 180° left, as the arm turns on the bench. It is orange while the sketch is telling it where to go, its needle easing there the way the arm does, and grey at the angle it was left at once the signal stops.
- ⏪ When the Timeline is held at a moment, the drawing shows LEDs, buzzers and servos as they were then.

It reads the same `currentReadout()` the 3D bench does, every frame, and changes only the LEDs, so the drawing is not redrawn as they blink.

</details>

<details>
<summary><b>Where it comes from</b></summary>

<br>

The layout is `src/sim/schematic.ts` (no React, tested in `tests/schematic.test.ts`: every mission's reference circuit draws every part once with nothing overlapping). It reads the nets from `netOf` in `src/sim/circuit.ts`.

The resistor, LED, push button, knob, ground and power symbols are tscircuit's [schematic-symbols](https://github.com/tscircuit/schematic-symbols) (MIT). The package is not a dependency: it asks for TypeScript 5 as a peer, which this project has moved past, and only six of its symbols are used. So `scripts/vendor-symbols.mjs` copies them, with tscircuit's licence, into `src/data/tscircuit-symbols.ts` (its header says how to refresh them). tscircuit has no buzzer, so ours is drawn in the same form in `src/data/symbols.ts`. Boards and modules have no standard symbol anywhere, so they are labelled boxes with their pin names, as schematics usually show them.

</details>

---

## 🌡️ Light and temperature sensors

Two sensors join the tray, each with an on-screen slider.

| Sensor | Legs | How it behaves | Slider |
|---|---|---|---|
| ☀️ **Light sensor** (LDR) | 2, like a resistor | `ldrOhms` gives ~**1 kΩ** in bright light, **10 kΩ** at half light, **100 kΩ** in the dark. Build its voltage divider with a 10 kΩ resistor: high in the light, low in the dark. | percent |
| 🌡️ **Temperature sensor** (TMP36) | 3: `+` left, output middle, `GND` right | `tempVolts` gives **0.5 V at 0 °C** and **10 mV more per degree**, whatever the supply (2.7 V and up). The check names a sensor with no power, no ground, no pin, or in backwards. | °C |

Checks script them as the `ldr` and `temp` inputs. Missions that use them: **Street lamp** and **Heat warning** on the Uno, **Fridge alarm** on the ESP32. The guide has a chapter on each.

---

## 📶 Wi-Fi and the phone

The ESP32 can join the workshop's Wi-Fi and run a web server. A **phone** sits beside the bench on the same Wi-Fi: it shows up whenever the ESP32's sketch has a `WebServer`, stays in its pocket while you build, and comes out when the sketch runs.

```
  phone ──GET /on──▶ Wi-Fi ──▶ server.handleClient() ──▶ handleOn() ──▶ server.send(200, "text/html", page) ──▶ phone
```

| | |
|---|---|
| 📡 **The network** | Called `Workshop`, password `solder123`. Joining takes 1.2 s on the sketch's clock, then the board is at `192.168.1.57`. A wrong name or password never joins, and the phone says which was wrong. |
| 📱 **The phone** | Type an address and press Go. The page the sketch sends is drawn as a browser would, and its links and forms send the phone's next request to the board. It gives up after 4 s with no answer. |
| 🚫 **What it cannot do** | Nothing on a page runs (no JavaScript), and the Wi-Fi has no internet: a page cannot fetch anything, and another address says so. Nothing leaves the browser. |

The sketch side covers `WiFi.begin`, `status`, `localIP`, `isConnected`, `SSID`, `RSSI`, `disconnect` and `mode`, and a `WebServer`'s `on` (with or without a method), `onNotFound`, `begin`, `handleClient`, `send`, `sendHeader` (redirects are followed), `arg`, `hasArg`, `args`, `argName`, `uri` and `method`. A handler is named without brackets, as on a real board. An address with no handler gets the library's own `Not found: /path`. Raw strings `R"( … )"`, `PROGMEM` and `F("…")` work, so pages can be written the way tutorials write them.

The **Gate light by phone** mission (ESP32, after the Night light) uses it, and the guide's **WiFi and WebServer** chapter explains it.

<details>
<summary><b>How it works</b></summary>

<br>

`src/sim/network.ts` is the Wi-Fi: who has joined since when, which ports are listening, and every request from the phone with its answer, all on the sketch's own clock so a check comes out the same every time. The interpreter's `WiFi` and `WebServer` calls go to it through `hw.net`, which only the ESP32's virtual hardware has. A handler runs inside `server.handleClient()`, one request at a time, as on the real board.

The phone is `src/components/Phone.tsx`. A page is shown in a sandboxed frame that cannot run scripts, with a content security policy that blocks every request it could make. Clicks on links and form submissions are caught and sent to the board instead.

A check scripts the phone with `visit` (open an address) and `tap` (tap the link or button with these words on whatever page it shows), and `expect: { page }` judges what the phone shows. `tests/wifi.test.ts` covers the network, the library calls and the checks.

</details>

---

## 🔧 Repair jobs

> *"It worked yesterday."* 😅

A repair job is a mission that starts **broken**: one fault in the wiring and one in the sketch. Fixing only one is not enough, and `tests/missions.test.ts` proves it.

<details>
<summary><b>How they're made</b></summary>

<br>

In `src/data/missions.ts`, `repairOf` builds one from an existing mission: its reference circuit and answer, with a `fault` function that breaks the bench and a list of changes that break the sketch. `start` is the bench the student opens on, and `repair: true` swaps the prediction for a note about debugging. The checks are the base mission's, so the job is done when the mission would be passed. The guide chapter **Debugging** explains how to hunt for faults.

</details>

---

## 💾 Saving progress

The browser remembers it all: passed missions, hints, predictions, the circuit built for each mission, and the sketch written for each (saved a moment after the last key press).

The home page shows how far along each board you are and offers **Continue** at the next open mission. At its foot you can **save a backup** to a file, **restore** one, or **reset** everything. Restore and reset both ask for a second press before replacing anything.

A backup is read with `parseBackup` in `src/state/progress.ts`, which keeps only what makes sense: missions that exist, parts with every field they need, and sketches of a sensible size.

---

## 🖥️ The bench, the panels and the keyboard

The 3D bench fills the screen. The **Map**, **Brief** and **Code** open over it as panels (in the top bar, or along the bottom on a phone, where a panel is a sheet and only one is open at a time). **Guide** goes to a page of its own. **Run**, **Step** and **Stop** stay on the bench, so a sketch can run without the code open, and the circuit slides to stay centred in whatever the panels leave free.

On a wide screen, drag the inner edge of a panel to make it wider for reading or narrower for building. Double-click for the usual width, or Tab to the edge and use the arrow keys. Widths are remembered; the rules are in `src/state/panels.ts`.

### ⌨️ No mouse needed

Press <kbd>?</kbd> in the app for the full list. The highlights:

| Key | Does |
|---|---|
| <kbd>M</kbd> <kbd>B</kbd> <kbd>C</kbd> | Toggle Map, Brief, Code (focus moves into the panel, <kbd>Esc</kbd> returns it to the button) |
| <kbd>G</kbd> | Go to the guide and back |
| <kbd>Ctrl</kbd>+<kbd>Enter</kbd> | Run or stop |
| <kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd> | Slide the view |
| <kbd>+</kbd> <kbd>-</kbd> <kbd>0</kbd> <kbd>T</kbd> | Zoom in, zoom out, reset, look from the top |
| <kbd>Delete</kbd> <kbd>Ctrl</kbd>+<kbd>Z</kbd> <kbd>Ctrl</kbd>+<kbd>Y</kbd> | Edit the bench |

A part is placed from the keyboard by choosing it in the tray and typing its holes.

### 🎨 The look

Colour tokens in `src/styles.css` give a **paper-and-pegboard** light theme and a **chalkboard** dark theme (`tests/palette.test.ts` checks every text and control pair is readable in both). Headings are **Zilla Slab**, reading is **Atkinson Hyperlegible**, and the icons are in `src/components/Icons.tsx`.

The 3D bench is drawn like an illustration (`src/scene/world.ts`): toon-shaded solids with an ink outline, ink lines along every hard edge (merged so each part costs a draw call or two), and soft shadows on the table, warm on paper and black on the chalkboard. The shadows come from a light of their own behind and to the right, so they fall in front of things where the camera sees them. The parts are modelled to read as the real ones:

| Part | Detail |
|---|---|
| 🔌 Jumper wire | Dupont housing on each end, with a collar in the wire's colour |
| 💡 LED | Epoxy dome on a rim with a flat on the cathode side, legs bending in under it |
| 〰️ Resistor | Dog-bone body, fatter where the leads go in, colour bands that follow its shape |
| 🔘 Button | Metal plate with corner dimples, rounded cap, legs bent under the base |
| 🎛️ Knob | Ridged dark knob on a metal bushing, with a white pointer line |
| 📡 HC-SR04 | Silver transducers with mesh fronts, a crystal, printed labels, and a brick wall to measure |
| 🌡️ TMP36 | D-shaped TO-92 case with its name on the flat face |
| 🦾 Servo | Label, screw holes in the tabs, holes in the horn |
| 🧱 Breadboard | A real channel down the middle, notched at each end |

---

## 📖 The guide

The **Guide** (<kbd>G</kbd>) is the textbook next to the missions, on a page of its own: `#guide` for the contents and `#guide/<chapter>` for each chapter, so any chapter can be bookmarked or opened in another tab.

**Part 1: the coding walkthrough** (read in order, drawn as one wire with a numbered pad per step)
`setup()` and `loop()` → `pinMode` → `digitalWrite` → `delay` → variables → `digitalRead` → `analogRead` and `analogWrite` → `if` and `else` → `switch` and `case` (and when to choose which) → loops → functions → `Serial` → `millis()` → `WiFi` and `WebServer`

**Part 2: the parts** (looked up, drawn as a drawer of bins, each marked with its circuit symbol)
what a circuit is · how a breadboard is joined underneath · how an LED works and why it needs a resistor · buttons · knobs · buzzers · the distance sensor · servos · the touch pad

On a wide screen a chapter page lists both down the side, and its header shows where it sits: the step along the wire, or the part's symbol (`SYMBOLS` in `src/components/GuidePage.tsx`). The way back to the bench (or <kbd>G</kbd> again) returns to the mission as you left it, with the sketch stopped.

The home page links to it, the workshop tour points at it, and every mission's **Code notes** tab links to the chapters that mission uses (its `guide` list of chapter ids).

<details>
<summary><b>Writing a chapter</b></summary>

<br>

A chapter is an object in `src/data/guide.ts`: a title, a one-line summary and a list of blocks (`p`, `list`, `tip`, `table`, `code` or `fig`). The page and its drawings are in `src/components/GuidePage.tsx`.

`tests/guide.test.ts` parses every code block with the simulator's own interpreter, runs the whole sketches, and checks that an example with `prints` prints exactly that. **An example that stops working fails `npm test`.** ✅

</details>

---

## 🗺️ Missions

Each location on the mission map is a mission: a small device to build. A mission is passed only when **Check my build** runs *your* sketch on *your* circuit and every check passes.

1. 🔮 **Predict** what will happen.
2. ▶️ **Run** it and compare with what the simulator does.
3. 💡 **Hints** come in three steps (a nudge, the idea, the answer) and are counted.
4. 🎁 **Pass** it and new parts land in the tray, and the next missions open.

### 🧪 Open Studio

Free build: no goal, no checks. Open from the start with **every part in the tray**, whether or not a mission has unlocked it, so you can build a project of your own any time (`trayParts()` in `src/data/missions.ts` decides what a mission's tray holds). Each board has its own studio, reached from the bottom of the mission map or from the board's card on the home page.

#### 🧰 Templates

The home page lists them all under **Start from a template** (the **Templates** link in its top bar scrolls there): each card opens its board's studio with the brief scrolled to that template. The studio's brief offers them too. **Load** puts a template's parts on the bench and its sketch in the editor, ready to run, take apart and change. If there is work of your own on the bench or in the editor, it asks first: Undo brings the bench back, but not the sketch.

| Board | Template | What it does |
|---|---|---|
| Uno | 🚦 Traffic light | Red, amber and green LEDs take turns. |
| Uno | 📏 Distance meter | The distance sensor measures, and the LCD shows it in centimetres. |
| Uno | 🦾 Pan and tilt | Two servos follow a joystick: the base and shoulder of a robot arm. |
| ESP32 | 💡 Wi-Fi dimmer | Dim and brighten a lamp from the phone. |
| ESP32 | 🪴 Plant monitor | The phone shows how damp the soil is, and a light asks for water. |
| ESP32 | 🚨 Motion alarm | A light and a beeping buzzer until all is still for 3 seconds. |

A template is an object in `src/data/templates.ts`: a title, what it does and what to try next, its guide chapters, its `circuit` and `sketch`, and a `proof`, scenarios its own build and sketch must pass. `tests/templates.test.ts` places every build by hand, checks it has no wiring mistakes, runs its proof, and makes sure the proof fails on an empty bench. Checks can move the joystick too, with the `joy`, `joyY` and `joySw` inputs.

### 🛒 Choosing a board (the side quest)

Some places on the map don't ask for a build. They ask for a **board**, marked by a chip in the badge. Each is a request with two or three needs: Wi-Fi, Bluetooth, 5 V parts, analog inputs, touch pins, a space it must fit, or the Uno shields the lab already owns.

The bench gives way to a **supply shelf** of five boards, drawn to the same scale on the same line:

| Board | |
|---|---|
| Arduino Uno | on the bench |
| ESP32 DevKit | on the bench |
| Arduino Nano | card to compare |
| Wemos D1 mini (ESP8266) | card to compare |
| ESP32-C3 SuperMini | card to compare |

Choose one and every need is marked met or not, with the reason. The mission is passed when every need is met, and the shelf tells you when more than one board would do. These missions sit beside the build missions and never stand in the way of them.

<details>
<summary><b>Under the hood</b></summary>

<br>

The boards and their facts are in `src/data/boardchoice.ts`, with `meets` and `why` for each kind of need. A choice mission is made with `choose()` in `src/data/missions.ts`: a story, the needs in the asker's words, and three hints, the last naming every board that works.

`tests/boardchoice.test.ts` pins down the right boards for every mission, checks that every board on the shelf is the right answer somewhere, that each need rules something out, and that the answer hint names exactly the boards that work. The guide's **Choosing a board** chapter explains each line on the cards.

</details>

### 📊 Compare boards

`#boards` (`src/components/BoardsPage.tsx`) is a page of its own with the same five boards, open any time: from the Boards link on the home page, the brief's Board tab, the supply shelf, or the guide chapter.

All five stand on one line at the same scale, each with its length marked under it like a technical drawing. Below them, every line of their datasheets is in one table, and a picker for what a project needs fades out the boards that couldn't do it and says which can. It shares the guide's top bar (`PageBar.tsx`), and the way back returns to the mission as it was left.

---

## 🧩 Adding a mission

Add an object to a board's list in `src/data/missions.ts`. It needs:

- 📜 a **story** and **goal**
- 📝 a **starter sketch**
- 📖 the **`guide`** chapters that explain it
- ✅ a reference **`circuit`** and **`answer`**
- 💡 three **hints**
- 🔮 a **prediction**
- 🎯 its **checks**

A check is a scenario made with `phases()`, `blinks()` or `sweeps()` from `src/sim/check.ts`: stretches of time with scripted inputs (a wall that moves, a button that is pressed) and what should be true by the end of each. That can be any LED, the `red` or `green` LED, the buzzer, the Serial Monitor, a PWM duty, a `servo` angle range, or the `page` the phone shows. On the ESP32 a phase can also `visit` an address on the phone or `tap` a link or button on the page it shows.

Then `npm test` proves that:

1. the reference build passes,
2. the starter sketch and plausible wrong answers do not, and
3. every part a mission needs was unlocked by the missions before it.

**Connection points** are named like this:

| Name | Means |
|---|---|
| `U:13` | Uno pin 13 |
| `E:D5` | ESP32 pin D5 |
| `a10` | breadboard hole a10 |
| `T-15` | power rail |
| `a45`, `T+45` | a hole or rail on the second breadboard (columns 31 and up) |

---

## 🧭 Where things are

<details open>
<summary><b>📦 Data (what the app teaches)</b></summary>

<br>

| File | What it holds |
|---|---|
| `src/data/missions.ts` | The missions for both boards: story, goal, checks, prediction, hints, starter sketch and reference build. **Add or edit missions here.** |
| `src/data/boards.ts` | The two boards: parts, pinouts and facts. |
| `src/data/guide.ts` | The guide: the coding walkthrough and the chapters about the parts. **Add or edit chapters here.** |
| `src/data/templates.ts` | The Open Studio's templates: finished builds and sketches, each with a proof. **Add or edit templates here.** |
| `src/data/wiring.ts` | Turns a circuit into the rows of the Wiring tab. |
| `src/data/symbols.ts` | Schematic symbols: tscircuit's (copied into `tscircuit-symbols.ts` by `scripts/vendor-symbols.mjs`) and our buzzer. |

</details>

<details open>
<summary><b>🧠 Simulator (the brains)</b></summary>

<br>

| File | What it holds |
|---|---|
| `src/sim/interpreter.ts` | Runs the Arduino-style code (a subset of C++). |
| `src/sim/circuit.ts` | The electrical model: breadboard connectivity, the mistakes a student can make, and a small DC solver for voltages and currents. |
| `src/sim/hardware.ts` | The virtual pins, connected through the student's wiring to the parts. |
| `src/sim/check.ts` | The mission check engine: runs the student's own sketch on their own build, with scripted inputs, on a virtual clock. |
| `src/sim/timeline.ts` | The recording of pin states over time that the Timeline draws and replays. |
| `src/sim/network.ts` | The workshop's Wi-Fi: the board joining it, its web server's requests and answers, and what the phone shows. |
| `src/sim/schematic.ts` | Lays out the circuit on the bench as a schematic. |

</details>

<details open>
<summary><b>🗃️ State (what changes)</b></summary>

<br>

| File | What it holds |
|---|---|
| `src/state/store.ts` | App state. |
| `src/state/actions.ts` | Everything that changes it. |
| `src/state/progress.ts` | How far along each board a student is, which mission to offer next, and reading and checking a backup file. |
| `src/state/panels.ts` | Which panels are open over the bench, on a wide screen and on a phone. |
| `src/state/route.ts` | Which page the address bar hash opens: home, the guide (`#guide`, `#guide/led`) or a mission (`#uno-beacon`). |
| `src/state/bench.ts` | The rules for placing parts: which holes exist, which are taken, what each part needs. |

</details>

<details open>
<summary><b>🎭 Scene and UI (what you see)</b></summary>

<br>

| File | What it holds |
|---|---|
| `src/scene/world.ts` | Builds the 3D board, breadboard and parts for a mission. |
| `src/scene/Bench.tsx` | The React Three Fiber scene: camera, lights, clicking, labels. |
| `src/components/` | The panels around the 3D view. |
| `tests/sim.test.ts` | Simulator tests. |

</details>

---

## ⚠️ Simulator limits

The interpreter covers:

> variables · arrays · functions · `if` · `for` · `while` · `switch` · the pin functions · `tone` · `pulseIn` · `touchRead` · `map` · `millis` · `Serial` · the `Servo` library (`attach`, `write`, `writeMicroseconds`, `read`, `attached`, `detach`) · `LiquidCrystal_I2C` · on the ESP32, `WiFi` and `WebServer` (see [Wi-Fi and the phone](#-wi-fi-and-the-phone))

Both `#include <Servo.h>` and `<ESP32Servo.h>` work. There are **no other libraries**: no Bluetooth, no `WiFiClient` or `HTTPClient` to reach other sites, and no `ESPAsyncWebServer`.

### 🦾 Wiring a servo

A servo plugs into three breadboard holes in a row:

| Wire | Colour | Goes to |
|---|---|---|
| GND | 🟤 brown | ground |
| `+` | 🔴 red | 5 V (needs 5 V) |
| signal | 🟠 orange | a pin |

The circuit check explains a servo with no ground, too little power, power taken from a pin, or no signal wire.

---

<div align="center">

**Happy building! 🔧💡**

</div>
