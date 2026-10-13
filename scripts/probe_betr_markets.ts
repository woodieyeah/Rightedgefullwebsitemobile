/**
 * Open Betr's RLWC list page, click into the first match, and enumerate every
 * market name. Purpose: determine whether a TOTAL (over/under) exists for RLWC
 * anywhere on the site, since the affiliate API returns only 3 markets.
 */

const PORT = process.env.CDP_PORT || "9227";

async function main() {
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
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 2400, deviceScaleFactor: 1, mobile: false });

  await send("Page.navigate", { url: "https://betr.com.au/sports/Rugby-League/102/World/Rugby-League-World-Cup/40028" });
  await new Promise((r) => setTimeout(r, 20000));

  // Click the "41 Markets" link for the opener.
  const clicked = await evaluate(`
    (() => {
      const els = [...document.querySelectorAll('a, button, [role="link"]')];
      const target = els.find(e => /\\d+\\s*Markets/i.test(e.textContent || ''));
      if (!target) return 'no markets link found';
      target.click();
      return 'clicked: ' + (target.textContent || '').trim();
    })()
  `);
  console.log(clicked);
  await new Promise((r) => setTimeout(r, 20000));

  const url = await evaluate("location.href");
  console.log("url now:", url);

  const text: string = (await evaluate("document.body.innerText")) ?? "";
  console.log("body length:", text.length);

  const lower = text.toLowerCase();
  console.log("\n--- market signals ---");
  console.log("  total points :", /total\s*(match\s*)?points/.test(lower));
  console.log("  over/under   :", /\bover\b|\bunder\b/.test(lower));
  console.log("  margin       :", /margin/.test(lower));
  console.log("  handicap     :", /handicap/.test(lower));

  // Every market-ish heading on the page.
  const markets = await evaluate(`
    (() => {
      const out = new Set();
      for (const el of document.querySelectorAll('*')) {
        if (el.children.length) continue;
        const t = (el.textContent || '').trim();
        if (t.length > 3 && t.length < 55 && /total|over|under|margin|handicap|winning|score|points|result|half/i.test(t)) {
          out.add(t);
        }
      }
      return [...out].slice(0, 45);
    })()
  `);
  console.log("\n--- market-like text on page ---");
  for (const m of (markets as string[]) || []) console.log("   -", m);

  ws.close();
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
