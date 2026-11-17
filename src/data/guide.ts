/* The guide: a walkthrough of the code and of the parts, written for someone who has never programmed a board before.
   Text is trusted HTML, like the mission text. Every code block is parsed by tests/guide.test.ts, and the ones with `prints`
   are run to prove that they print exactly that, so the guide cannot drift away from what the simulator does. */

export type Figure = 'breadboard' | 'led' | 'pwm';
export type Block =
  | { p: string }
  | { list: string[] }
  /** A sketch, or a few lines from one. A block with "void setup" is a whole sketch. `prints` is what it writes to the Serial Monitor. */
  | { code: string; prints?: string }
  /** Something worth remembering, or a mistake that is easy to make. */
  | { tip: string }
  | { table: [string, string][]; head: [string, string] }
  | { fig: Figure; caption: string };

export type GuideGroup = 'code' | 'parts';
export interface Chapter { id: string; group: GuideGroup; title: string; lede: string; blocks: Block[] }

export const GUIDE_GROUPS: [GuideGroup, string, string][] = [
  ['code', 'Coding walkthrough', 'How a sketch is written, one idea at a time.'],
  ['parts', 'Parts and circuits', 'What each part on the bench does and how to wire it.'],
];

export const GUIDE: Chapter[] = [
  /* ------------------------------------------------------------ code ------------------------------------------------------------ */
  {
    id: 'sketch', group: 'code', title: 'The shape of a sketch', lede: 'Every program has the same two parts: setup() and loop().',
    blocks: [
      { p: 'A program for an Arduino or ESP32 is called a <b>sketch</b>. The board reads it from top to bottom, one line at a time, and does exactly what each line says. Every sketch has two blocks:' },
      { list: [
        '<code>setup()</code> runs <b>once</b>, when the board gets power or you press Run. Use it to get things ready.',
        '<code>loop()</code> runs after that, <b>again and again, forever</b>. When it reaches the last line it starts again from its first line. This is where the real work goes.',
      ] },
      { code: `// Blink the light on the board
void setup() {
  pinMode(13, OUTPUT);      // get ready: pin 13 will send electricity out
}

void loop() {
  digitalWrite(13, HIGH);   // light on
  delay(500);               // wait half a second
  digitalWrite(13, LOW);    // light off
  delay(500);               // wait again, then loop() starts over
}` },
      { p: 'The small marks matter as much as the words:' },
      { table: [
        ['<code>;</code>', 'Ends an instruction, like a full stop ends a sentence. Forgetting one is the most common mistake.'],
        ['<code>{ }</code>', 'Curly braces hold a group of lines together. Every <code>{</code> needs a matching <code>}</code>.'],
        ['<code>( )</code>', 'Round brackets hold what you give to an instruction, such as the pin number.'],
        ['<code>//</code>', 'A comment. The board ignores the rest of the line. Write notes for yourself here.'],
        ['<code>void</code>', 'Means "this block gives nothing back". You need it in front of setup and loop.'],
      ], head: ['Mark', 'What it does'] },
      { tip: 'Capital letters count. <code>pinMode</code> works, <code>pinmode</code> and <code>PinMode</code> do not. When a sketch has a mistake, the editor marks the line number in the gutter.' },
      { p: 'Use <b>Step</b> on the bench to run one line at a time and watch the highlighted line move. It is the quickest way to see the order things happen in.' },
    ],
  },
  {
    id: 'pinmode', group: 'code', title: 'pinMode: giving a pin its job', lede: 'A pin can send electricity out or sense it coming in. You must say which.',
    blocks: [
      { p: 'The metal pins along the edge of the board are how your sketch reaches the outside world. Each pin can do one of two jobs, and <code>pinMode(pin, mode)</code> chooses the job. It normally goes in <code>setup()</code>, because the job only has to be chosen once.' },
      { table: [
        ['<code>OUTPUT</code>', 'The pin <b>sends</b> electricity out. Use it for things the board controls: an LED, a buzzer.'],
        ['<code>INPUT</code>', 'The pin <b>senses</b> a voltage coming in. Use it for things that send a clear signal by themselves, such as the distance sensor\'s echo.'],
        ['<code>INPUT_PULLUP</code>', 'An input with a gentle pull towards HIGH built in. Use it for <b>buttons</b>: the pin reads HIGH until the button joins it to GND.'],
      ], head: ['Mode', 'What the pin does'] },
      { code: `const int LED_PIN = 9;
const int BUTTON_PIN = 2;

void setup() {
  pinMode(LED_PIN, OUTPUT);            // we control the LED
  pinMode(BUTTON_PIN, INPUT_PULLUP);   // we listen to the button
}

void loop() {
}` },
      { tip: 'If an LED only glows very faintly, you probably forgot <code>pinMode(pin, OUTPUT)</code>. A pin starts as an input, and writing HIGH to an input only switches on its weak pull-up, which is far too little to light an LED properly.' },
      { p: 'Pin numbers are the labels printed on the board. On the Uno the digital pins are <code>0</code> to <code>13</code> and the analog inputs are <code>A0</code> to <code>A5</code>. On the ESP32 the pin labelled <b>D5</b> is written <code>5</code> in the sketch. The <b>Board</b> tab of the mission brief lists every pin.' },
    ],
  },
  {
    id: 'digitalwrite', group: 'code', title: 'digitalWrite: on and off', lede: 'HIGH puts the pin at full voltage, LOW puts it at 0 V.',
    blocks: [
      { p: '<code>digitalWrite(pin, value)</code> switches an output pin. "Digital" means there are only two choices:' },
      { table: [
        ['<code>HIGH</code>', 'The pin is connected to the supply: <b>5 V</b> on the Uno, <b>3.3 V</b> on the ESP32. Current can flow out of it.'],
        ['<code>LOW</code>', 'The pin is connected to ground: <b>0 V</b>. Nothing flows out.'],
      ], head: ['Value', 'What happens at the pin'] },
      { p: 'Think of the pin as a light switch your sketch can flip. With an LED wired from the pin to GND, HIGH pushes current through the LED and it lights. LOW leaves both ends of the LED at 0 V, so nothing flows and it goes dark.' },
      { code: `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);   // the pin goes to 5 V and STAYS there
  delay(1000);
  digitalWrite(13, LOW);    // now it goes to 0 V and stays there
  delay(1000);
}` },
      { list: [
        'A pin <b>remembers</b> what you wrote. It stays HIGH until a later line writes LOW. You do not have to keep repeating it.',
        'The change is instant. Without a <code>delay()</code> between HIGH and LOW the LED switches thousands of times a second and just looks dim.',
        '<code>HIGH</code> is really the number 1 and <code>LOW</code> is 0, so <code>digitalWrite(pin, 1)</code> also works. The words are easier to read.',
      ] },
      { tip: 'While a sketch runs, point at any pin or hole on the bench to read its voltage. Watch a pin jump between 0 V and 5 V as your sketch writes to it.' },
    ],
  },
  {
    id: 'delay', group: 'code', title: 'delay: waiting', lede: 'delay() pauses the whole sketch for a number of milliseconds.',
    blocks: [
      { p: '<code>delay(ms)</code> makes the board do nothing for a while, then carry on with the next line. The number is in <b>milliseconds</b>, and there are 1000 of them in a second.' },
      { table: [['<code>delay(1000)</code>', '1 second'], ['<code>delay(500)</code>', 'half a second'], ['<code>delay(50)</code>', 'a twentieth of a second, a blink of an eye'], ['<code>delay(60000)</code>', '1 minute']], head: ['Code', 'How long'] },
      { p: 'Pins keep doing whatever they were told while the sketch waits. That is how blinking works: turn the LED on, wait (it stays on), turn it off, wait (it stays off).' },
      { p: '<b>The catch:</b> during a delay the board is "asleep". It cannot read a button, check a sensor or change anything else. If a button is pressed and let go in the middle of a <code>delay(2000)</code>, the sketch never sees it.' },
      { tip: 'Use <code>delay()</code> when the sketch has only one thing to do. When it must watch a button <i>while</i> something blinks, use <code>millis()</code> instead. See <b>Doing two things at once</b>.' },
      { p: 'A short delay at the end of <code>loop()</code>, such as <code>delay(20)</code>, is a good habit when reading sensors. Without it the loop runs many thousands of times a second for no benefit.' },
    ],
  },
  {
    id: 'variables', group: 'code', title: 'Variables: names for values', lede: 'A variable is a labelled box that holds a number your sketch can use and change.',
    blocks: [
      { p: 'To make a variable, write its <b>type</b>, its <b>name</b> and a starting value. After that, use the name wherever you want the value.' },
      { code: `const int LED_PIN = 9;     // never changes: which pin the LED is on
int brightness = 0;        // a whole number that can change
float volts = 3.3;         // a number with a decimal point
bool lampOn = false;       // true or false
unsigned long lastBlink = 0;   // a very big whole number, used for time` },
      { table: [
        ['<code>int</code>', 'A whole number. The one you will use most.'],
        ['<code>float</code>', 'A number with a decimal point, such as 2.5.'],
        ['<code>bool</code>', 'Only <code>true</code> or <code>false</code>. Good for "is the lamp on?".'],
        ['<code>unsigned long</code>', 'A big whole number that is never negative. Use it for <code>millis()</code> times.'],
        ['<code>const</code>', 'Put in front to promise the value never changes. Use it for pin numbers.'],
      ], head: ['Type', 'What it holds'] },
      { p: 'Naming the pin once at the top means that if you move the wire to another pin, you change <b>one line</b> instead of hunting through the sketch.' },
      { p: '<b>Where you create a variable matters.</b> One made at the top of the sketch, outside any block, keeps its value for as long as the board is on. One made inside <code>loop()</code> is created fresh on every pass and forgotten at the end.' },
      { code: `int presses = 0;           // made once, remembers between passes

void setup() {
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(A0);   // made new on every pass
  presses = presses + 1;          // the same as: presses++;
  delay(500);
}` },
      { p: 'Whole numbers divide into whole numbers: the part after the decimal point is thrown away. Put a decimal point on one of the numbers if you want to keep it.' },
      { code: `void setup() {
  Serial.begin(9600);
  Serial.println(7 / 2);     // two whole numbers
  Serial.println(7 / 2.0);   // one has a decimal point
}

void loop() {
}`, prints: '3\n3.50\n' },
    ],
  },
  {
    id: 'digitalread', group: 'code', title: 'digitalRead: is it on or off?', lede: 'Reads an input pin and answers HIGH or LOW.',
    blocks: [
      { p: '<code>digitalRead(pin)</code> looks at the voltage on a pin and gives back <code>HIGH</code> (near the supply voltage) or <code>LOW</code> (near 0 V). It is how the sketch senses a button.' },
      { code: `const int BUTTON_PIN = 2;
const int LED_PIN = 9;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  if (digitalRead(BUTTON_PIN) == LOW) {   // LOW means pressed
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
}` },
      { p: '<b>Why is pressed LOW?</b> With <code>INPUT_PULLUP</code> the board gently holds the pin at HIGH. The button is wired from the pin to GND, so pressing it joins the pin to 0 V and the reading drops to LOW. It feels backwards at first, but it needs no extra parts, which is why almost every button is wired this way.' },
      { tip: 'A pin set to plain <code>INPUT</code> with nothing holding it HIGH or LOW is <b>floating</b>: on a real board it picks up stray electricity and reads at random. That is the problem <code>INPUT_PULLUP</code> solves.' },
      { p: 'To do something <b>once per press</b>, rather than for as long as the button is held, remember the last reading and act only when it changes:' },
      { code: `const int BUTTON_PIN = 2;
const int LED_PIN = 9;
int last = HIGH;        // the reading on the pass before
bool lampOn = false;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int now = digitalRead(BUTTON_PIN);
  if (now == LOW && last == HIGH) {   // it has just been pressed
    lampOn = !lampOn;                 // flip true to false, or false to true
    digitalWrite(LED_PIN, lampOn);
  }
  last = now;
  delay(20);
}` },
    ],
  },
  {
    id: 'analog', group: 'code', title: 'analogRead and analogWrite: in between', lede: 'Not everything is on or off. These two handle the values in the middle.',
    blocks: [
      { p: '<b><code>analogRead(pin)</code></b> measures the voltage on an analog input and turns it into a number. 0 V reads as 0 and the full supply voltage reads as the biggest number.' },
      { table: [['Arduino Uno', '<code>0</code> to <code>1023</code> for 0 V to 5 V, on pins A0 to A5'], ['ESP32', '<code>0</code> to <code>4095</code> for 0 V to 3.3 V, on pins such as 32, 33, 34 and 35']], head: ['Board', 'Range'] },
      { p: 'Half the voltage gives about half the number: a knob in the middle reads around 512 on the Uno. An analog input needs no <code>pinMode</code>.' },
      { p: '<b><code>analogWrite(pin, value)</code></b> sets how strongly an output is driven, from <code>0</code> (off) to <code>255</code> (fully on). The pin cannot really produce half a voltage. It switches on and off very fast and changes how much of the time it stays on. This is called <b>PWM</b>. Your eye sees the average, so the LED looks dimmer.' },
      { fig: 'pwm', caption: 'PWM: the pin is only ever fully on or fully off. A bigger number keeps it on for more of each cycle.' },
      { tip: 'On a real Uno, <code>analogWrite</code> only works on the pins marked <b>~</b>: 3, 5, 6, 9, 10 and 11. Plan the wiring so that a dimmable LED sits on one of those.' },
      { p: 'The two ranges do not match (1023 in, 255 out), so use <code>map(value, fromLow, fromHigh, toLow, toHigh)</code> to stretch one range onto the other:' },
      { code: `const int KNOB_PIN = A0;
const int LED_PIN = 9;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int knob = analogRead(KNOB_PIN);              // 0 to 1023
  int brightness = map(knob, 0, 1023, 0, 255);  // 0 to 255
  analogWrite(LED_PIN, brightness);
  delay(20);
}` },
      { code: `void setup() {
  Serial.begin(9600);
  Serial.println(map(512, 0, 1023, 0, 255));   // halfway in gives halfway out
  Serial.println(map(1023, 0, 1023, 0, 180));  // the top of one is the top of the other
}

void loop() {
}`, prints: '127\n180\n' },
    ],
  },
  {
    id: 'ifelse', group: 'code', title: 'if and else: making decisions', lede: 'Run some lines only when a question is true.',
    blocks: [
      { p: 'An <code>if</code> asks a yes-or-no question. When the answer is yes (true), the lines inside its braces run. When it is no, they are skipped. An <code>else</code> gives the lines to run instead.' },
      { code: `int light = analogRead(A0);

if (light < 300) {
  digitalWrite(9, HIGH);   // it is dark: lamp on
} else {
  digitalWrite(9, LOW);    // otherwise: lamp off
}` },
      { p: 'Questions are built from comparisons:' },
      { table: [
        ['<code>a == b</code>', 'a equals b (two equals signs)'], ['<code>a != b</code>', 'a is not equal to b'],
        ['<code>a &lt; b</code> &nbsp; <code>a &gt; b</code>', 'a is less than b, a is greater than b'], ['<code>a &lt;= b</code> &nbsp; <code>a &gt;= b</code>', 'less than or equal, greater than or equal'],
        ['<code>x &amp;&amp; y</code>', '<b>and</b>: true only when both are true'], ['<code>x || y</code>', '<b>or</b>: true when at least one is true'], ['<code>!x</code>', '<b>not</b>: turns true into false and false into true'],
      ], head: ['Code', 'Meaning'] },
      { tip: 'One <code>=</code> <b>stores</b> a value. Two <code>==</code> <b>compares</b>. Writing <code>if (x = 5)</code> puts 5 into x and counts as true every time, which is a classic bug.' },
      { p: 'Chain several questions with <code>else if</code>. They are checked from the top, and <b>only the first one that is true runs</b>. So put the narrowest question first.' },
      { code: `void setup() {
  Serial.begin(9600);
  int cm = 25;   // distance to the wall

  if (cm < 10) {
    Serial.println("STOP");
  } else if (cm < 30) {
    Serial.println("slow down");
  } else {
    Serial.println("keep going");
  }
}

void loop() {
}`, prints: 'slow down\n' },
      { p: '<b>Use <code>if</code> / <code>else</code> when</b> the question is about a <b>range</b> (less than, greater than), when it mixes several conditions with <code>&amp;&amp;</code> or <code>||</code>, or when there are only two or three choices.' },
    ],
  },
  {
    id: 'switch', group: 'code', title: 'switch and case: one of many', lede: 'Pick one branch out of several by the exact value of one variable.',
    blocks: [
      { p: 'A <code>switch</code> looks at one whole-number value and jumps to the <code>case</code> that matches it. It does the same job as a long chain of <code>else if (x == ...)</code>, but is easier to read when there are many choices.' },
      { code: `void setup() {
  Serial.begin(9600);

  for (int mode = 0; mode <= 3; mode++) {
    switch (mode) {
      case 0:
        Serial.println("off");
        break;
      case 1:
        Serial.println("dim");
        break;
      case 2:
        Serial.println("bright");
        break;
      default:
        Serial.println("unknown");
        break;
    }
  }
}

void loop() {
}`, prints: 'off\ndim\nbright\nunknown\n' },
      { list: [
        '<code>case 1:</code> marks where to start when the value is 1. Note the <b>colon</b>, not a semicolon.',
        '<code>break;</code> leaves the switch. <b>Without it the sketch carries on into the next case</b> and runs that too. Forgetting <code>break</code> is the usual switch mistake.',
        '<code>default:</code> runs when no case matches, like the final <code>else</code>. It is optional but worth having.',
      ] },
      { p: 'Leaving <code>break</code> out on purpose lets several values share the same lines:' },
      { code: `void setup() {
  Serial.begin(9600);
  int day = 7;

  switch (day) {
    case 6:
    case 7:
      Serial.println("weekend: bell off");
      break;
    default:
      Serial.println("day start: bell on");
      break;
  }
}

void loop() {
}`, prints: 'weekend: bell off\n' },
      { p: '<b>Which one should I use?</b>' },
      { table: [
        ['One variable against exact values (mode 0, 1, 2, 3)', '<code>switch</code>'],
        ['Steps in a sequence, such as a traffic light: red, green, amber', '<code>switch</code>'],
        ['A range: "less than 300", "between 10 and 30"', '<code>if</code> / <code>else if</code>'],
        ['Two things at once: "dark <b>and</b> someone is there"', '<code>if</code> with <code>&amp;&amp;</code>'],
        ['A decimal number or a yes/no answer', '<code>if</code>'],
      ], head: ['The question is about', 'Use'] },
      { tip: 'A <code>case</code> can only be a single whole number. <code>case x &lt; 10:</code> does not mean "less than 10". Ranges need <code>if</code>.' },
    ],
  },
  {
    id: 'loops', group: 'code', title: 'for and while: repeating', lede: 'Repeat some lines a set number of times, or for as long as something is true.',
    blocks: [
      { p: '<code>loop()</code> already repeats forever. A <code>for</code> or <code>while</code> repeats a few lines <b>inside</b> it.' },
      { p: 'A <b><code>for</code></b> loop counts. Its brackets hold three things separated by semicolons: where to start, the question that keeps it going, and what to do after each pass.' },
      { code: `void setup() {
  Serial.begin(9600);

  for (int i = 1; i <= 3; i++) {   // start at 1; go on while i is 3 or less; add 1 each time
    Serial.println(i);
  }
}

void loop() {
}`, prints: '1\n2\n3\n' },
      { p: 'This fades an LED up by counting through every brightness:' },
      { code: `for (int level = 0; level <= 255; level++) {
  analogWrite(9, level);
  delay(8);
}` },
      { p: 'A <b><code>while</code></b> loop repeats for as long as its question stays true. Use it when you do not know the number of passes in advance.' },
      { code: `while (digitalRead(2) == LOW) {   // for as long as the button is held
  tone(8, 440);
}
noTone(8);` },
      { tip: 'Something inside a <code>while</code> must eventually make its question false. If nothing does, the sketch is stuck there forever and the rest of <code>loop()</code> never runs.' },
      { p: '<code>break;</code> leaves a loop early, and <code>continue;</code> skips straight to the next pass.' },
    ],
  },
  {
    id: 'functions', group: 'code', title: 'Functions: your own instructions', lede: 'Give a group of lines a name, then use them with one word.',
    blocks: [
      { p: '<code>setup</code> and <code>loop</code> are functions the board calls for you. You can write your own, to avoid repeating the same lines and to make <code>loop()</code> read like a plan.' },
      { code: `const int LED_PIN = 9;

// blink the LED a number of times
void blink(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(150);
    digitalWrite(LED_PIN, LOW);
    delay(150);
  }
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  blink(3);        // use it by name
  delay(1000);
}` },
      { list: [
        'The word before the name is what the function <b>gives back</b>. <code>void</code> means nothing.',
        'The values in the brackets are its <b>parameters</b>: what you hand it when you call it.',
        '<code>return</code> hands a value back to the line that called it.',
      ] },
      { code: `// turn an analog reading into volts
float toVolts(int reading) {
  return reading * 5.0 / 1023;
}

void setup() {
  Serial.begin(9600);
  Serial.println(toVolts(1023));
}

void loop() {
}`, prints: '5.00\n' },
    ],
  },
  {
    id: 'serial', group: 'code', title: 'Serial: letting the board talk', lede: 'Print messages and numbers to see what your sketch is thinking.',
    blocks: [
      { p: 'A board has no screen, so when something goes wrong you cannot see why. <code>Serial</code> sends text to the <b>Serial monitor</b> under the code editor. Printing a sensor reading is the best way to find out what the sketch really sees.' },
      { code: `void setup() {
  Serial.begin(9600);            // open the connection, once
}

void loop() {
  int light = analogRead(A0);
  Serial.print("Light: ");       // print stays on the same line
  Serial.println(light);         // println ends the line
  delay(500);
}` },
      { table: [
        ['<code>Serial.begin(9600)</code>', 'Starts the connection. Goes in <code>setup()</code>. A real board prints nothing without it.'],
        ['<code>Serial.print(x)</code>', 'Prints text in quotes, or the value of a variable, and stays on the line.'],
        ['<code>Serial.println(x)</code>', 'The same, then starts a new line.'],
      ], head: ['Code', 'What it does'] },
      { tip: 'Text needs double quotes: <code>Serial.println("light")</code> prints the word, <code>Serial.println(light)</code> prints the number stored in the variable.' },
      { p: 'Put a <code>delay()</code> in a loop that prints, or the monitor fills faster than you can read.' },
    ],
  },
  {
    id: 'millis', group: 'code', title: 'millis: doing two things at once', lede: 'Keep time without stopping the sketch.',
    blocks: [
      { p: '<code>millis()</code> gives the number of milliseconds since the sketch started. It is a clock you can look at, where <code>delay()</code> is a nap. Instead of sleeping until it is time, you check the clock on every pass and act when enough time has gone by. Between checks the sketch is free to do other things.' },
      { code: `const int LED_PIN = 9;
const int BUTTON_PIN = 2;
const int BUZZER_PIN = 8;

unsigned long lastBlink = 0;   // when the LED last changed
bool ledOn = false;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
  // job 1: blink every 500 ms, without ever waiting
  if (millis() - lastBlink >= 500) {
    lastBlink = millis();
    ledOn = !ledOn;
    digitalWrite(LED_PIN, ledOn);
  }

  // job 2: the button is checked on every pass, so it answers at once
  if (digitalRead(BUTTON_PIN) == LOW) {
    tone(BUZZER_PIN, 880);
  } else {
    noTone(BUZZER_PIN);
  }
}` },
      { list: [
        'Store times in an <code>unsigned long</code>. An <code>int</code> is too small and overflows after about half a minute on an Uno.',
        'Always compare with <code>millis() - then &gt;= interval</code>. Written this way it keeps working even when the clock eventually wraps around.',
      ] },
      { table: [['The sketch does one thing in order', '<code>delay()</code>: simple and clear'], ['It must react while something else is timed', '<code>millis()</code>']], head: ['When', 'Use'] },
    ],
  },

  /* ------------------------------------------------------------ parts ------------------------------------------------------------ */
  {
    id: 'debugging', group: 'code', title: 'Debugging: finding what is wrong', lede: 'Nothing works the first time. Here is how to find out why.',
    blocks: [
      { p: 'Every fault is in one of three places: the <b>circuit</b> (a part in backwards, a wire in the wrong hole), the <b>sketch</b> (a wrong number, a comparison pointing the wrong way) or the <b>agreement between them</b> (the sketch uses pin 8, the wire is on pin 7). Debugging is just working out which one.' },
      { list: [
        '<b>Say what it does, in words.</b> "The LED stays dark." "The buzzer plays when nobody presses." The words point at the cause.',
        '<b>Let the bench tell you.</b> The circuit check panel and <b>Check my build</b> name wiring mistakes in plain words.',
        '<b>Let the sketch tell you.</b> Print what it sees with <code>Serial.println()</code>. If a sensor never changes, no sketch can use it.',
        '<b>Change one thing at a time.</b> Then run it again. If you change three things and it works, you do not know which one mattered.',
      ] },
      { code: `void setup() {
  Serial.begin(9600);
}

void loop() {
  int value = analogRead(A0);
  Serial.print("A0 reads ");
  Serial.println(value);      // what does the sensor really say?
  delay(500);
}` },
      { table: [
        ['The LED never lights', 'The LED is in backwards, or a leg is not in the loop, or the wire is on a different pin than the sketch uses, or the sketch never writes HIGH.'],
        ['The LED is always on', 'The sketch never writes LOW, or the comparison is always true (a limit the reading can never reach).'],
        ['A sensor reading never changes', 'The sensor has no power or no ground, or its wire is not on the pin the sketch reads.'],
        ['A reading is far too big or small', 'The Uno counts to 1023 and the ESP32 to 4095. A sum copied from the other board is wrong.'],
        ['A button does the opposite', 'With <code>INPUT_PULLUP</code> a pressed button reads LOW, not HIGH.'],
        ['Fixing one thing changes nothing', 'There are two faults, and the first one hides the second. Keep going.'],
      ], head: ['What you see', 'Look for'] },
      { tip: 'Two faults can hide each other. A buzzer on the wrong pin is silent, so you cannot see that the sketch also plays at the wrong time. After every fix, run it again and look afresh.' },
    ],
  },
  {
    id: 'circuit', group: 'parts', title: 'What a circuit is', lede: 'Electricity only flows around a complete loop.',
    blocks: [
      { p: 'A <b>circuit</b> is a closed path: out of a power source, through the parts, and back again. Break the path anywhere and everything stops, which is called an <b>open circuit</b>.' },
      { table: [
        ['<b>Voltage</b> (volts, V)', 'The push. Like the pressure in a water pipe. The Uno pushes with 5 V, the ESP32 with 3.3 V.'],
        ['<b>Current</b> (amps, A)', 'The flow: how much electricity moves. Small circuits use thousandths of an amp, written mA.'],
        ['<b>Resistance</b> (ohms, Ω)', 'How hard it is to flow through something. A narrow section of pipe.'],
      ], head: ['Word', 'What it means'] },
      { p: 'The three are tied together by <b>Ohm\'s law</b>: <code>current = voltage ÷ resistance</code>. More push means more flow, and more resistance means less.' },
      { list: [
        '<b>GND</b> (ground) is the return path, the 0 V that every voltage is measured from. Every part must find its way back to GND, and all the GND pins are the same point.',
        'A <b>short circuit</b> is a path from power straight to GND with nothing to slow it. Far too much current flows. The bench refuses to start a sketch while there is one.',
        'One pin can safely supply only about 20 mA, enough for an LED but not a motor. Hungry parts take their power from the 5V pin instead.',
      ] },
      { tip: 'While a sketch runs, yellow beads move along each wire from + towards −, faster when more current flows. If no beads move, the loop is not complete.' },
    ],
  },
  {
    id: 'breadboard', group: 'parts', title: 'How a breadboard works', lede: 'Holes that are already wired together underneath, so nothing needs soldering.',
    blocks: [
      { p: 'A breadboard lets you build a circuit by pushing legs and wires into holes. Under the plastic are metal strips that join certain holes together. Knowing <b>which holes are joined</b> is the whole trick.' },
      { fig: 'breadboard', caption: 'Orange: the five holes a to e of one column are one connection. Blue: f to j of the same column are a separate one. The long rails run the whole length.' },
      { list: [
        '<b>Columns</b> are numbered 1 to 30 and <b>rows</b> are lettered a to j, so a hole has a name such as <code>e10</code>.',
        'In each column, <b>a b c d e are joined</b> to each other, and <b>f g h i j are joined</b> to each other.',
        'The <b>gap</b> down the middle separates the two halves. <code>e10</code> and <code>f10</code> are not connected.',
        'Columns are <b>not</b> joined to their neighbours. <code>a10</code> and <code>a11</code> are separate.',
        'The <b>rails</b> along the edges (<code>+</code> and <code>−</code>) are joined along their whole length. Wire 5V to a <code>+</code> rail and GND to a <code>−</code> rail once, then take power from any hole along them.',
      ] },
      { p: '<b>To connect two legs</b>, put them in the same column on the same side of the gap. <b>To keep them apart</b>, use different columns.' },
      { tip: 'A part\'s two legs must go in <b>different</b> columns. If both legs of an LED sit in <code>a10</code> and <code>c10</code>, the strip underneath joins them and the current skips the LED completely.' },
      { list: [
        'The rails carry nothing until you wire them to the board. A rail is just a long strip.',
        'Each hole holds one leg or one wire end. Use another hole in the same column to join more.',
        'The ESP32 is plugged into the breadboard itself, so the holes under it are taken. Click its pins directly and build in the free columns to the right.',
      ] },
      { p: 'On the bench, pick a part from the tray and click the holes, or type them, such as <code>e10 e11</code>.' },
    ],
  },
  {
    id: 'led', group: 'parts', title: 'How an LED works', lede: 'A light that only lets current through in one direction.',
    blocks: [
      { p: 'An LED (light-emitting diode) glows when current flows through it. It is a one-way street: current goes in at the <b>long leg</b> and out at the <b>short leg</b>. Put in backwards, it blocks the current and stays dark. Nothing is damaged, so just turn it round.' },
      { fig: 'led', caption: 'The loop for one LED: out of the pin, through the resistor, through the LED from its long leg to its short leg, and back to GND.' },
      { table: [
        ['Long leg', '<b>+</b>, the anode. Faces the pin, the side the current comes from.'],
        ['Short leg', '<b>−</b>, the cathode. Faces GND.'],
      ], head: ['Leg', 'Which way'] },
      { p: '<b>An LED always needs a resistor.</b> Once an LED starts to conduct it barely resists at all, so with nothing to limit it the current shoots far above the 20 mA it can take and it burns out. A resistor in the same path keeps the current safe. It can go on either side of the LED.' },
      { p: 'How much current flows? A red LED uses up about 2 V. On a 5 V pin that leaves 3 V across the resistor, and Ohm\'s law gives <code>3 V ÷ 220 Ω ≈ 14 mA</code>: bright, and safe for both the LED and the pin.' },
      { list: [
        'A bigger resistor (1 kΩ) gives a dimmer LED. A smaller one gives a brighter LED, until it is too much.',
        'Blue and green LEDs use up more voltage than red ones, so on the 3.3 V ESP32 they glow more faintly.',
        'To dim an LED from the sketch, use <code>analogWrite()</code>.',
      ] },
      { tip: 'On the bench an LED with no resistor really does burn out when the sketch drives it. Use Undo, or take the LED out and place a new one.' },
    ],
  },
  {
    id: 'resistor', group: 'parts', title: 'Resistors', lede: 'They hold the current back. The bigger the number, the less flows.',
    blocks: [
      { p: 'A resistor makes it harder for current to flow, like a narrow section of pipe. It has no direction, so it works either way round. Its size is measured in ohms (Ω), and 1 kΩ is 1000 Ω.' },
      { table: [
        ['220 Ω', 'Protecting an LED. The one you will use most.'],
        ['1 kΩ', 'A dimmer LED, or limiting a signal.'],
        ['10 kΩ', 'Gently pulling an input pin towards HIGH or LOW so it is never left floating.'],
      ], head: ['Value', 'Typical job'] },
      { p: 'Two parts are <b>in series</b> when the current has to go through one and then the other, with no other way round. A resistor only protects an LED when it is in series with it, in the same single loop.' },
    ],
  },
  {
    id: 'button', group: 'parts', title: 'Push buttons', lede: 'A gap in the circuit that closes while you hold it.',
    blocks: [
      { p: 'A push button joins its two sides only while it is pressed. Let go and they are apart again. On the bench it sits across the gap in the middle of the breadboard and takes up three columns: one side is in the first column and the other side is two columns along.' },
      { p: 'The usual wiring needs just two wires:' },
      { list: ['One side of the button to a <b>digital pin</b>.', 'The other side to <b>GND</b>.', 'In the sketch: <code>pinMode(pin, INPUT_PULLUP)</code>.'] },
      { p: 'Not pressed, the pull-up holds the pin HIGH. Pressed, the button joins the pin to GND and it reads LOW. So <b>pressed is <code>LOW</code></b>.' },
      { code: `if (digitalRead(BUTTON_PIN) == LOW) {
  // the button is being held down
}` },
      { tip: 'Wiring both wires to the same side of the button does nothing: those legs are always joined. Use the first and third of its columns.' },
      { p: 'A real button\'s metal contacts bounce for a few thousandths of a second, which can look like several quick presses. A short <code>delay(20)</code> in the loop is enough to ignore it.' },
    ],
  },
  {
    id: 'knob', group: 'parts', title: 'Knobs (potentiometers)', lede: 'Turn it to get any voltage between 0 V and the supply.',
    blocks: [
      { p: 'A potentiometer is a resistor with a slider that moves along it. It has three legs in a row:' },
      { list: ['One outer leg to <b>+</b> (5 V on the Uno, <b>3V3</b> on the ESP32).', 'The other outer leg to <b>GND</b>.', 'The <b>middle</b> leg to an <b>analog input</b>, such as A0.'] },
      { p: 'Turning the knob moves the middle leg\'s voltage smoothly from 0 V up to the supply voltage, and <code>analogRead()</code> turns that into 0 to 1023 (or 0 to 4095 on the ESP32).' },
      { p: 'In the missions a knob often stands in for a real sensor, such as a light sensor or a soil probe. Those work the same way: they give the board a voltage that rises and falls.' },
      { tip: 'On the ESP32, never feed a pin more than 3.3 V. Power a knob from <b>3V3</b>, not from VIN.' },
    ],
  },
  {
    id: 'ldr', group: 'parts', title: 'Light sensors (LDR)', lede: 'A resistor that changes with the light on it.',
    blocks: [
      { p: 'A light-dependent resistor, or <b>LDR</b>, has two legs and no front or back. The more light falls on it, the <b>less</b> it resists: about 1 kΩ in bright light and 100 kΩ in the dark.' },
      { p: 'A pin cannot read resistance, only voltage. So pair the LDR with a fixed resistor to make a <b>voltage divider</b>: 5V, then the LDR, then a 10 kΩ resistor, then GND. The pin reads the point where they meet.' },
      { table: [
        ['Bright', 'The LDR is about 1 kΩ, so most of the 5 V is across the 10 kΩ. The pin reads <b>high</b>, around 930 on the Uno.'],
        ['Dim', 'The LDR is about 10 kΩ, so the voltage splits evenly. The pin reads about 512.'],
        ['Dark', 'The LDR is about 100 kΩ, so most of the 5 V is across the LDR. The pin reads <b>low</b>, around 90.'],
      ], head: ['Light', 'What the pin reads'] },
      { code: `const int SENSOR_PIN = A0;
const int LAMP_PIN = 9;

void setup() {
  pinMode(LAMP_PIN, OUTPUT);
}

void loop() {
  int light = analogRead(SENSOR_PIN);
  if (light < 300) {
    digitalWrite(LAMP_PIN, HIGH);   // dark: lamp on
  } else {
    digitalWrite(LAMP_PIN, LOW);    // bright: lamp off
  }
  delay(50);
}` },
      { p: 'A single limit has a problem. At dusk the light hovers around it, and the lamp flickers. Use <b>two limits</b> and a variable that remembers what the lamp is doing. Between the limits, change nothing:' },
      { code: `if (light < 250) {
  lampOn = true;            // properly dark
} else if (light > 450) {
  lampOn = false;           // properly bright
}                           // in between: leave it as it is` },
      { tip: 'Swap the LDR and the fixed resistor and the numbers flip: the pin then reads <b>high in the dark</b>. Either way works, as long as the sketch knows which it is.' },
    ],
  },
  {
    id: 'temp', group: 'parts', title: 'Temperature sensor (TMP36)', lede: 'A three-legged sensor that gives a voltage for each degree.',
    blocks: [
      { p: 'The TMP36 looks like a small black half-cylinder with three legs. Facing the flat side:' },
      { table: [['Left', 'Power: 5V on the Uno, 3V3 on the ESP32. Anything from 2.7 V up works.'], ['Middle', 'The output. Wire it to an analog pin.'], ['Right', 'GND']], head: ['Leg', 'Goes to'] },
      { p: 'Its output is <b>0.5 V at 0 °C</b>, and <b>10 mV (0.01 V) more for each degree</b>. So 25 °C gives 0.75 V and 40 °C gives 0.9 V. To get the temperature, turn the reading into volts, then volts into degrees:' },
      { code: `void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(A0);                 // 0 to 1023 on the Uno
  float volts = raw * 5.0 / 1023.0;         // 0 to 5 V
  float celsius = (volts - 0.5) * 100.0;    // 0.5 V is 0 degrees, 10 mV per degree
  Serial.println(celsius);
  delay(500);
}` },
      { list: [
        'Write the numbers as <code>5.0</code> and <code>100.0</code>. With <code>5</code> and <code>100</code> the sum is done in whole numbers and throws the decimals away.',
        'On the ESP32 the reading counts to 4095 and the supply is 3.3 V, so the first sum is <code>raw * 3.3 / 4095.0</code>.',
        'The sensor is small and its voltage is small, so the reading jumps around by about half a degree. That is normal.',
      ] },
      { tip: 'Wire it backwards, with GND on the left leg and power on the right, and a real TMP36 gets hot enough to burn a finger. Check the flat side before you power it up.' },
    ],
  },
  {
    id: 'buzzer', group: 'parts', title: 'Buzzers', lede: 'A pin switching on and off very fast becomes a sound.',
    blocks: [
      { p: 'A piezo buzzer has a thin disc that bends each time the voltage across it changes. Switch it hundreds of times a second and the disc pushes the air into a note. Wire one leg to a digital pin and the other to GND.' },
      { table: [
        ['<code>tone(pin, hertz)</code>', 'Starts a note that plays until you stop it. A bigger number is a higher note: 262 is middle C, 440 is the A above it.'],
        ['<code>tone(pin, hertz, ms)</code>', 'Plays the note for that many milliseconds, then stops by itself.'],
        ['<code>noTone(pin)</code>', 'Silence.'],
      ], head: ['Code', 'What it does'] },
      { code: `tone(8, 659);    // start the first note
delay(250);      // let it sound
tone(8, 523);    // change to the second
delay(350);
noTone(8);       // stop` },
      { tip: '<code>tone()</code> does not wait. The note starts and the sketch moves straight on, so add a <code>delay()</code> to give it time to be heard. Turn the sound on with the speaker button on the bench.' },
    ],
  },
  {
    id: 'sonar', group: 'parts', title: 'The distance sensor', lede: 'It measures distance by timing an echo, like a bat.',
    blocks: [
      { p: 'The HC-SR04 sends out a burst of sound too high to hear and listens for it to bounce back. The further away the wall, the longer the echo takes. It has four legs in a row:' },
      { table: [['VCC', '5 V power'], ['Trig', 'A digital <b>output</b> pin. A short HIGH pulse here sends the ping.'], ['Echo', 'A digital <b>input</b> pin. It stays HIGH for as long as the sound was travelling.'], ['GND', 'Ground']], head: ['Leg', 'Goes to'] },
      { code: `const int TRIG_PIN = 7;
const int ECHO_PIN = 6;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

void loop() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);          // send the ping
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long time = pulseIn(ECHO_PIN, HIGH);   // how long the echo pin stayed HIGH, in microseconds
  long cm = time / 58;                   // sound takes about 58 microseconds per centimetre, there and back

  Serial.println(cm);
  delay(100);
}` },
      { list: [
        '<code>pulseIn(pin, HIGH)</code> waits for the pin to go HIGH and measures how long it stays there.',
        'The sensor needs a full 5 V. On the ESP32 take it from <b>VIN</b>.',
        'On the bench, the slider under the view moves the wall.',
      ] },
    ],
  },
  {
    id: 'servo', group: 'parts', title: 'Servo motors', lede: 'A motor that turns to an angle you choose and holds it.',
    blocks: [
      { p: 'An ordinary motor just spins. A servo turns its arm to an exact angle between 0° and 180° and stays there. It has three wires:' },
      { table: [['Brown', 'GND'], ['Red', '+, which must be <b>5 V</b>. From the 5V pin, never from a digital pin.'], ['Orange', 'The signal, from a digital pin.']], head: ['Wire', 'Goes to'] },
      { p: 'The signal is a short pulse sent fifty times a second, and the length of the pulse is the angle. The <code>Servo</code> library does that for you:' },
      { code: `#include <Servo.h>

Servo arm;                // make a servo and give it a name

void setup() {
  arm.attach(9);          // its signal wire is on pin 9
}

void loop() {
  arm.write(0);           // barrier down
  delay(1000);
  arm.write(90);          // barrier up
  delay(1000);
}` },
      { list: [
        'On the ESP32 the first line is <code>#include &lt;ESP32Servo.h&gt;</code>. Everything else is the same.',
        'A servo takes a moment to move. Give it a <code>delay()</code> before the next command.',
        'A motor needs much more current than a pin can give, which is why its red wire goes to the 5V pin (VIN on the ESP32).',
      ] },
    ],
  },
  {
    id: 'touch', group: 'parts', title: 'The touch pad (ESP32)', lede: 'A bare piece of metal that senses a finger.',
    blocks: [
      { p: 'Some ESP32 pins can sense touch with no button at all. Your body holds a little electric charge, and a finger near the metal changes what the pin measures. Wire the pad to a touch pin, such as <b>D4</b>.' },
      { p: '<code>touchRead(pin)</code> gives a number that <b>drops</b> when the pad is touched: around 60 or more when nothing is near, and under about 15 with a finger on it. Compare it with a threshold in between:' },
      { code: `const int TOUCH_PIN = 4;
const int LED_PIN = 5;
const int THRESHOLD = 40;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int value = touchRead(TOUCH_PIN);
  digitalWrite(LED_PIN, value < THRESHOLD);   // touched: the number is small
  delay(100);
}` },
      { tip: 'The reading wobbles a little even when nothing changes. Print it with <code>Serial.println(value)</code> to see the real numbers before choosing a threshold. The Uno has no touch pins.' },
    ],
  },
  {
    id: 'boards', group: 'parts', title: 'Choosing a board', lede: 'Boards differ most in what they can connect to, not in how fast they are.',
    blocks: [
      { p: 'Every board in this workshop runs a sketch the same way: <code>setup()</code> once, then <code>loop()</code> for ever. What changes from one board to the next is what it can be connected to. Before choosing a board for a project, write down what the project needs, then check each board against the list.' },
      { table: [
        ['Voltage', 'The Uno and the Nano run at <b>5&nbsp;V</b>. The ESP boards run at <b>3.3&nbsp;V</b>, and 5&nbsp;V straight into one of their pins can damage it. A 5 V part needs a 5 V board, or a level converter in between.'],
        ['Wi-Fi and Bluetooth', 'Only the ESP boards have a radio. The ESP32 has Wi-Fi and Bluetooth, the ESP32-C3 has Wi-Fi and Bluetooth LE, and the ESP8266 has Wi-Fi only.'],
        ['Analog inputs', 'Each sensor read with <code>analogRead()</code> needs its own analog pin, so count the sensors. On the ESP32 only 6 analog pins work while Wi-Fi is on.'],
        ['Touch pins', 'The ESP32 can feel a finger on a bare pad with <code>touchRead()</code>. The other boards here cannot.'],
        ['Size', 'Measure the space first. An Uno is 69 × 53 mm, and the smallest board here is 23 × 18 mm.'],
        ['Shields', 'A shield is an add-on board made to plug onto the Uno\'s header layout. Other boards need wires instead.'],
      ], head: ['What to check', 'Why it matters'] },
      { tip: 'There is often more than one right answer. Any board that meets every need will work, and then you can choose by price, or by what you already have.' },
      { p: 'To see five boards side by side, drawn to scale, and to try a list of needs against them, open <a href="#boards">Compare boards</a>.' },
    ],
  },
];

export const chapterOf = (id: string | null) => GUIDE.find(c => c.id === id) ?? null;
