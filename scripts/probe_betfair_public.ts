/**
 * Read Betfair's public RLWC exchange prices.
 *
 * Betfair is the only independent price source confirmed to carry RLWC, and an
 * independent source is required for a value scan: de-vigging BlueBet and then
 * scanning BlueBet returns a negative edge on both sides by construction.
 *
 * Public pages only — no login, no bets. Captures back/lay and matched volume
 * so spread and liquidity can be judged rather than assumed.
 */

const PORT = process.env.CDP_PORT || "9228";
const URL = "https://www.betfair.com.au/exchange/plus/rugby-league";

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t: any) => t.type === "page");
  if (!page) throw new Error("no page target");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map<number, (v: any) => void>();
  const apiCalls: string[] = [];

  const send = (m: string, p: any = {}) =>
    new Promise<any>((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });

  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e: any) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)!(m.result); pending.delete(m.id); return; }
    if (m.method === "Network.requestWillBeSent") {
      const u = m.params?.request?.url || "";
      if (/betfair/i.test(u) && /(api|market|price|nav)/i.test(u) && !/\.(png|jpg|svg|woff2?|css|js)(\?|$)/i.test(u)) {
        apiCalls.push(u);
      }
    }
  };
  const ev = async (x: string) =>
    (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.value;

  await send("Page.enable");
  await send("Network.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 2200, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: URL });
  await new Promise((r) => setTimeout(r, 25000));

  const text = String((await ev("document.body.innerText")) ?? "");
  console.log("body length:", text.length);
  console.log("blocked:", /access denied|forbidden|unusual traffic|captcha/i.test(text));

  const idx = text.search(/world cup/i);
  if (idx >= 0) {
    console.log("\n--- text around 'World Cup' ---");
    console.log(text.slice(Math.max(0, idx - 100), idx + 1100));
  } else {
    console.log("\n--- first 700 chars ---");
    console.log(text.slice(0, 700));
  }

  console.log("\n--- betfair API calls observed ---");
  for (const u of [...new Set(apiCalls)].slice(0, 12)) console.log("  ", u.slice(0, 200));

  ws.close();
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
