/**
 * Expand Betr's collapsed "Totals Markets" section on the RLWC opener and read
 * the actual over/under lines. The affiliate API returns only 3 markets; the
 * site shows 41 behind accordions.
 */

const PORT = process.env.CDP_PORT || "9227";
const URL = "https://www.betr.com.au/sports/Rugby-League/102/World/Rugby-League-World-Cup/Australia-v-New-Zealand/2292811/All-Markets";

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
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 3000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: URL });
  await new Promise((r) => setTimeout(r, 20000));

  // Expand every collapsed section.
  const expanded = await evaluate(`
    (() => {
      const targets = [...document.querySelectorAll('*')].filter(el => {
        if (el.children.length > 2) return false;
        const t = (el.textContent || '').trim();
        return /^(Totals Markets|Margin Markets|Both Team Points|1st Half Markets)$/i.test(t);
      });
      let clicked = 0;
      for (const t of targets) {
        const clickable = t.closest('button, [role="button"], [class*="accordion"], [class*="collapse"], div');
        if (clickable) { (clickable as HTMLElement).click(); clicked++; }
      }
      return 'expanded ' + clicked + ' section(s)';
    })()
  `);
  console.log(expanded);
  await new Promise((r) => setTimeout(r, 9000));

  const text: string = (await evaluate("document.body.innerText")) ?? "";
  console.log("body length after expand:", text.length);

  // Any over/under line with a number.
  const totals = await evaluate(`
    (() => {
      const t = document.body.innerText;
      const lines = t.split('\\n').map(s => s.trim()).filter(Boolean);
      const hits = [];
      for (let i = 0; i < lines.length; i++) {
        if (/^(over|under)\\b/i.test(lines[i]) || /total/i.test(lines[i])) {
          hits.push(lines.slice(i, i + 4).join(' | '));
        }
      }
      return hits.slice(0, 20);
    })()
  `);
  console.log("\n--- totals / over-under lines ---");
  const arr = (totals as string[]) || [];
  if (!arr.length) console.log("  NONE FOUND");
  for (const h of arr) console.log("   ", h);

  ws.close();
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
