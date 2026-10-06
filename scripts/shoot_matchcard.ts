// Navigate the preview like a user: land, click into predictions, screenshot.
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:4200";

async function main() {
  const list = await (await fetch("http://127.0.0.1:9223/json/list")).json();
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
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)!(msg.result);
      pending.delete(msg.id);
    }
  };

  const evaluate = async (expression: string) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true });
    return r.result?.value;
  };

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1500, height: 3200, deviceScaleFactor: 2, mobile: false,
  });

  // Go straight to the app shell. The landing page's CTA scrolls rather than
  // routing, so navigate by hash and let the app's own router handle it.
  await send("Page.navigate", { url: `${BASE}/#matches` });
  await new Promise((r) => setTimeout(r, 11000));

  const entered = await evaluate(`
    (() => {
      // The app renders the landing view until the shell is entered.
      const els = [...document.querySelectorAll('button, a')];
      const target = els.find(b => /^predictions$/i.test((b.textContent || '').trim()));
      if (target) { target.click(); return 'entered via Predictions nav'; }
      return 'no Predictions nav button';
    })()
  `);
  console.log(entered);
  await new Promise((r) => setTimeout(r, 8000));

  // The app shell is behind an email gate (hasEmailAccess -> tier free/premium).
  // Submit a throwaway address the way a new visitor would, so the real match
  // card renders.
  const gated = await evaluate(`
    (() => {
      const input = document.querySelector('input[type="email"], input[placeholder*="email" i]');
      if (!input) return 'no email input found';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'preview+rlwc@rightedge.com.au');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const btn = [...document.querySelectorAll('button')]
        .find(b => /access the model/i.test(b.textContent || ''));
      if (!btn) return 'no submit button';
      btn.click();
      return 'submitted email gate';
    })()
  `);
  console.log(gated);
  await new Promise((r) => setTimeout(r, 9000));

  const onMatches = await evaluate(`
    (() => {
      const els = [...document.querySelectorAll('button, a')];
      const tab = els.find(b => /^matches$/i.test((b.textContent || '').trim()));
      if (tab) { tab.click(); return 'clicked Matches tab'; }
      return 'no Matches tab (may already be on it)';
    })()
  `);
  console.log(onMatches);
  await new Promise((r) => setTimeout(r, 7000));

  // An email-capture modal gates the predictions view. Its close button is an
  // icon with no text or aria-label, so target it structurally.
  const dismissed = await evaluate(`
    (() => {
      const overlay = [...document.querySelectorAll('div')]
        .find(d => d.className && typeof d.className === 'string'
                && d.className.includes('fixed') && d.className.includes('z-[100]'));
      if (!overlay) return 'no modal present';
      const btn = overlay.querySelector('button');
      if (btn) { btn.click(); return 'dismissed via close button'; }
      return 'modal present but no button';
    })()
  `);
  console.log(dismissed);
  await new Promise((r) => setTimeout(r, 5000));

  const body: string = (await evaluate("document.body.innerText")) ?? "";
  console.log("\n--- content probes ---");
  for (const probe of ["Australia", "New Zealand", "Allianz", "Roosters", "Knights", "Proj score", "AEDT"]) {
    console.log(`  ${probe.padEnd(14)} ${body.toLowerCase().includes(probe.toLowerCase())}`);
  }

  // How many match cards rendered, and in what order.
  const cardOrder = await evaluate(`
    (() => {
      const t = document.body.innerText;
      const names = ['AUSTRALIA','NEW ZEALAND','ROOSTERS','KNIGHTS'];
      return names.filter(n => t.includes(n)).join(' | ');
    })()
  `);
  console.log("\nteams on page:", cardOrder);

  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const path = "/tmp/rlwc-matchcard.png";
  writeFileSync(path, Buffer.from(shot.data, "base64"));
  console.log("screenshot:", path);
  ws.close();
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
