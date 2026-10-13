/**
 * Probe a bookmaker's RLWC page for market coverage.
 *
 * Purpose: find out which books price a TOTAL (over/under) for RLWC matches.
 * Without a total there is no projected scoreline, since the derivation needs
 * both total and margin.
 *
 * Read-only: loads public pages and reads text. No accounts, no bets.
 */

const PORT = process.env.CDP_PORT || "9227";
const URL_TO_PROBE = process.env.PROBE_URL || "";
const LABEL = process.env.PROBE_LABEL || URL_TO_PROBE;
const WAIT_MS = Number(process.env.PROBE_WAIT || 18000);

async function main() {
  if (!URL_TO_PROBE) throw new Error("PROBE_URL not set");

  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t: any) => t.type === "page");
  if (!page) throw new Error("no page target");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map<number, (v: any) => void>();
  const send = (method: string, params: any = {}) =>
    new Promise<any>((resolve) => {
      const msgId = ++id;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e: any) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)!(msg.result); pending.delete(msg.id); }
  };
  const evaluate = async (expr: string) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1500, height: 2200, deviceScaleFactor: 1, mobile: false,
  });
  await send("Page.navigate", { url: URL_TO_PROBE });
  await new Promise((r) => setTimeout(r, WAIT_MS));

  const text: string = (await evaluate("document.body.innerText")) ?? "";
  const lower = text.toLowerCase();

  console.log(`\n=== ${LABEL} ===`);
  console.log("  body length:", text.length);

  const signals: Record<string, boolean> = {
    "total points":   /total\s*(match\s*)?points|total\s*points/.test(lower),
    "over/under":     /over\s*\d|under\s*\d|\bover\/under\b/.test(lower),
    "handicap/line":  /handicap|line\b|\+\d+\.5|-\d+\.5/.test(lower),
    "head to head":   /head to head|match result|match winner|\bwin\b/.test(lower),
    "margin":         /margin/.test(lower),
    "blocked/denied": /access denied|forbidden|are you a robot|unusual traffic|captcha/.test(lower),
  };
  for (const [k, v] of Object.entries(signals)) {
    console.log(`  ${k.padEnd(16)} ${v}`);
  }

  // Pull any over/under line numbers actually shown.
  const totalsFound = await evaluate(`
    (() => {
      const t = document.body.innerText;
      const m = t.match(/(?:over|under)\\s*\\(?\\s*(\\d{2,3}(?:\\.5)?)/gi) || [];
      return [...new Set(m)].slice(0, 8);
    })()
  `);
  console.log("  totals seen:", Array.isArray(totalsFound) && totalsFound.length ? totalsFound : "none");

  // Market names if the page exposes headings.
  const headings = await evaluate(`
    (() => {
      const els = [...document.querySelectorAll('h1,h2,h3,h4,[class*="market"] [class*="title"],[data-automation-id*="market"]')];
      return [...new Set(els.map(e => (e.textContent||'').trim()).filter(s => s && s.length < 60))].slice(0, 25);
    })()
  `);
  if (Array.isArray(headings) && headings.length) {
    console.log("  headings:");
    for (const h of headings) console.log("     -", h);
  }

  ws.close();
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
