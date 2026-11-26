/* The phone beside the bench. It is on the workshop's Wi-Fi, like the ESP32, and opens the pages the running sketch serves:
   type the board's address and press Go, then tap the links and buttons on the page. It shows up when the sketch on the ESP32 has a WebServer. */
import { useEffect, useMemo, useState, type FormEvent, type SyntheticEvent } from 'react';
import { BOARD_IP, offlineWords, resolveAddress, statusLine, WIFI_NAME, withArgs, type Answer } from '../sim/network';
import { browse } from '../state/actions';
import { codeOf, useLab } from '../state/store';
import { Icon } from './Icons';

type Page = Extract<Answer, { kind: 'page' }>;

/** Put in front of every page. It stops the page from fetching anything by itself (the phone's Wi-Fi has no internet, and nothing on a page runs),
    and gives a page with no style of its own the plain look of a phone's browser. */
const HEAD = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'"><style>html{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color-scheme:light;background:#fff;color:#111}body{margin:12px;overflow-wrap:anywhere}</style>`;
const escape = (s: string) => s.replace(/[&<>]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
/** A web page as the board sent it, or plain text the way a browser shows it. */
const srcdocOf = (a: Page) =>
  HEAD + (/html/i.test(a.type) ? a.body.replace(/^\s*<!doctype[^>]*>/i, '') : `<pre style="white-space:pre-wrap;font:14px/1.45 ui-monospace,monospace;margin:0">${escape(a.body)}</pre>`);

const hostOf = (url: string) => { try { return new URL(url).host; } catch { return url; } };
const capital = (s: string) => s[0].toUpperCase() + s.slice(1);
/** What the phone says when there is no page to show: the heading a browser would give, then what is wrong in the sketch. */
function trouble(a: Exclude<Answer, Page>, url: string): [title: string, text: string] {
  const host = hostOf(url);
  switch (a.kind) {
    case 'offline': return a.why === 'stopped' ? ['The board is not running', 'Press Run to start the sketch, then press Go again.'] : [`Can't reach ${host}`, `${capital(offlineWords(a.why, a.tried))}.`];
    case 'refused': return [`${host} refused to connect`, `The board is on the Wi-Fi, but no web server is listening on port ${a.port}. Call server.begin() in setup().`];
    case 'timeout': return [`${host} took too long to answer`, 'The board answers only while server.handleClient() runs. Call it on every pass of loop(), and keep delays short.'];
    case 'silent': return [`${host} sent no data`, 'The board ran the function for this address, but that function never called server.send().'];
    case 'elsewhere': return ['No internet', `The phone is on the workshop's Wi-Fi, which has no internet. Only the board answers here, at ${BOARD_IP}.`];
    case 'bad': return ['Not an address', `Type the board's address, such as http://${BOARD_IP}/`];
  }
}

/** The page itself, in a frame where nothing on it can run. A tap on a link, or a form sent, goes to the board as the phone's next request. */
function PageView({ answer, url }: { answer: Page; url: string }) {
  const doc = useMemo(() => srcdocOf(answer), [answer]);
  const hook = (e: SyntheticEvent<HTMLIFrameElement>) => {
    const d = e.currentTarget.contentDocument;
    if (!d) return;
    d.addEventListener('click', ev => {
      const link = (ev.target as Element | null)?.closest?.('a[href]');
      if (!link) return;
      ev.preventDefault();
      browse(resolveAddress(link.getAttribute('href') ?? '', url));
    }, true);
    d.addEventListener('submit', ev => {
      ev.preventDefault();
      const form = ev.target as HTMLFormElement, fields: [string, string][] = [];
      new FormData(form, (ev as SubmitEvent).submitter).forEach((v, k) => fields.push([k, typeof v === 'string' ? v : v.name]));
      const action = resolveAddress(form.getAttribute('action') ?? '', url);
      if (form.method.toLowerCase() === 'post') browse(action, { method: 'POST', form: fields });
      else browse(withArgs(action, fields));
    }, true);
  };
  return <iframe className="phone-page" title="The page the board sent" sandbox="allow-same-origin allow-forms" srcDoc={doc} onLoad={hook} />;
}

export function Phone() {
  const shown = useLab(s => s.board === 'esp32' && /\bWebServer\b/.test(codeOf(s)));
  return shown ? <PhoneBody /> : null;
}

const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches;

function PhoneBody() {
  const { url, answer, loading } = useLab(s => s.phone), running = useLab(s => s.running);
  /* Until the student says otherwise, the phone stays in the pocket while they build (it would cover the board) and comes out when the sketch runs.
     On a small screen it would cover the whole bench, so there it only comes out when asked. */
  const [chosen, setChosen] = useState<boolean | null>(null), open = chosen ?? ((running || !!answer) && !narrow());
  const [typed, setTyped] = useState(url);
  useEffect(() => setTyped(url), [url]);
  const go = (e: FormEvent) => { e.preventDefault(); browse(typed); };
  const [title, text] = answer && answer.kind !== 'page' ? trouble(answer, url) : ['', ''];
  return (
    <section className={open ? 'phone' : 'phone shut'} aria-label="Phone on the workshop Wi-Fi">
      <div className="phone-top">
        <span className="phone-net" title={`On the Wi-Fi called ${WIFI_NAME}`}><Icon name="wifi" />{WIFI_NAME}</span>
        <button type="button" aria-expanded={open} onClick={() => setChosen(!open)} title={open ? 'Put the phone away' : 'Take out the phone'}>
          <Icon name="phone" /><span>{open ? 'Hide' : 'Phone'}</span>
        </button>
      </div>
      {open && (
        <>
          <form className="phone-bar" onSubmit={go}>
            <label className="sr-only" htmlFor="phone-url">Address</label>
            <input id="phone-url" value={typed} onChange={e => setTyped(e.target.value)} inputMode="url" autoComplete="off" spellCheck={false} autoCapitalize="off" />
            <button type="submit" title="Open this address on the phone">Go</button>
          </form>
          <div className={loading ? 'phone-screen loading' : 'phone-screen'} aria-busy={loading}>
            {loading && <div className="phone-progress" role="status"><span className="sr-only">Waiting for {hostOf(url)} to answer</span></div>}
            {answer?.kind === 'page' ? <PageView answer={answer} url={url} />
              : answer ? <div className="phone-note" role="status"><b>{title}</b><p>{text}</p></div>
                : <div className="phone-note"><b>Ready</b><p>{running ? 'Press Go to open the board\'s page. The board prints its address in the Serial Monitor once it is on the Wi-Fi.' : `The phone is on the ${WIFI_NAME} Wi-Fi. Run the sketch, then press Go to open the board's page.`}</p></div>}
          </div>
          {answer?.kind === 'page' && <p className="phone-status">{statusLine(answer.status)} · {answer.type}</p>}
        </>
      )}
    </section>
  );
}
