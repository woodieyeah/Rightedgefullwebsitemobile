/**
 * Watch TAB's RLWC match page and capture the API calls behind it.
 *
 * TAB prices a full-match Total Points Over/Under, which BlueBet does not
 * expose for most RLWC fixtures, and is an independent book — both of which
 * the model needs.
 */

const PORT = process.env.CDP_PORT || "9229";
const URL =
  "https://www.tab.com.au/sports/betting/Rugby%20League/competitions/World%20Cup/matches/Australia%20v%20New%20Zealand";

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
      if (/tab\.com\.au/i.test(u) && !/\.(png|jpg|jpeg|svg|gif|woff2?|css|js|ico)(\?|$)/i.test(u)) {
        apiCalls.push(u);
      }
    }
  };
  const ev = async (x: string) =>
    (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.value;

  await send("Page.enable");
  await send("Network.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 2400, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: URL });
  await new Promise((r) => setTimeout(r, 25000));

  const text = String((await ev("document.body.innerText")) ?? "");
  console.log("body length:", text.length);
  console.log("has 'Total Points':", /total points/i.test(text));
  console.log("has '38.5':", text.includes("38.5"));

  console.log("\n--- tab.com.au requests ---");
  for (const u of [...new Set(apiCalls)].slice(0, 25)) console.log("  ", u.slice(0, 210));

  ws.close();
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
