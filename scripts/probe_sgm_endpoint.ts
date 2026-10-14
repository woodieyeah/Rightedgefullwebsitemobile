/**
 * Discover Betr's Same Game Multi pricing endpoint.
 *
 * Betr prices SGMs with its own correlation model, so the combined price must
 * be read from them rather than computed by multiplying legs — correlated legs
 * multiply to an overstated payout.
 *
 * Opens the real match page, clicks two SGM-eligible selections, and records
 * every request that fires. Read-only: no account, no bet placed.
 */

const PORT = process.env.CDP_PORT || "9232";
const URL =
  "https://www.betr.com.au/sports/Rugby-League/102/World/Rugby-League-World-Cup/Australia-v-New-Zealand/2292811/All-Markets";

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t: any) => t.type === "page");
  if (!page) throw new Error("no page target");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map<number, (v: any) => void>();
  const posts: { url: string; body: string }[] = [];
  const gets: string[] = [];

  const send = (m: string, p: any = {}) =>
    new Promise<any>((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });

  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e: any) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)!(m.result); pending.delete(m.id); return; }
    if (m.method === "Network.requestWillBeSent") {
      const req = m.params?.request ?? {};
      const u = String(req.url ?? "");
      if (!/bluebet|betr/i.test(u)) return;
      if (req.method === "POST") posts.push({ url: u, body: String(req.postData ?? "").slice(0, 600) });
      else if (/multi|sgm|price|bet/i.test(u)) gets.push(u);
    }
  };

  const ev = async (x: string) =>
    (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.value;

  await send("Page.enable");
  await send("Network.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 2400, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: URL });
  await new Promise((r) => setTimeout(r, 22000));

  // Dismiss any promo overlay so clicks land on the market buttons.
  await ev(`
    (() => {
      const overlay = [...document.querySelectorAll('div')].find(d =>
        typeof d.className === 'string' && d.className.includes('z-[100]'));
      if (overlay) { const b = overlay.querySelector('button'); if (b) { b.click(); return 'dismissed'; } }
      return 'none';
    })()
  `);
  await new Promise((r) => setTimeout(r, 3000));

  posts.length = 0;
  gets.length = 0;

  // Click two price buttons: any two selections should trigger SGM pricing.
  const clicked = await ev(`
    (() => {
      const btns = [...document.querySelectorAll('button')]
        .filter(b => /^\\$?\\d+\\.\\d{2}$/.test((b.textContent || '').trim()));
      const picked = btns.slice(0, 2).map(b => (b.textContent || '').trim());
      for (const b of btns.slice(0, 2)) b.click();
      return JSON.stringify({ found: btns.length, picked });
    })()
  `);
  console.log("clicked:", clicked);
  await new Promise((r) => setTimeout(r, 12000));

  console.log("\n--- POST requests after selecting legs ---");
  for (const p of posts.slice(0, 8)) {
    console.log("  URL :", p.url.slice(0, 160));
    console.log("  BODY:", p.body);
    console.log();
  }
  console.log("--- price-ish GETs ---");
  for (const g of [...new Set(gets)].slice(0, 10)) console.log("  ", g.slice(0, 180));

  ws.close();
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
