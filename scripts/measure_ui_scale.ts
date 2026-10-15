/**
 * Measure real computed typography and spacing in a browser.
 *
 * The UI "looks zoomed" — this reports the actual computed pixel values so the
 * fix is driven by measurement rather than guesswork, and so before/after can
 * be compared objectively.
 *
 * Usage: CDP_PORT=9250 TARGET=https://... npx tsx scripts/measure_ui_scale.ts
 */

const PORT = process.env.CDP_PORT ?? "9250";
const TARGET = process.env.TARGET ?? "https://rightedge.com.au/";

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t: any) => t.type === "page");
  if (!page) throw new Error("no page target");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map<number, (v: any) => void>();
  const send = (method: string, params: any = {}) =>
    new Promise<any>((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e: any) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)!(m.result);
      pending.delete(m.id);
    }
  };

  const evaluate = async (expression: string) =>
    (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))
      .result?.value;

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: TARGET });
  await new Promise((r) => setTimeout(r, 7000));

  const report = await evaluate(`(() => {
    const out = {};
    out.rootFontSize = getComputedStyle(document.documentElement).fontSize;
    out.bodyFontSize = getComputedStyle(document.body).fontSize;
    out.viewport = innerWidth + "x" + innerHeight;

    // Distribution of rendered font sizes across every visible text node.
    const sizes = {};
    for (const el of document.querySelectorAll("*")) {
      if (!el.offsetParent && el.tagName !== "BODY") continue;
      const direct = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 1,
      );
      if (!direct) continue;
      const fs = getComputedStyle(el).fontSize;
      sizes[fs] = (sizes[fs] || 0) + 1;
    }
    out.fontSizes = Object.entries(sizes)
      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
      .map(([size, count]) => size + " x" + count);

    // Largest headings actually on screen.
    const big = [];
    for (const el of document.querySelectorAll("h1,h2,h3,h4")) {
      if (!el.offsetParent) continue;
      big.push(getComputedStyle(el).fontSize + "  " + el.textContent.trim().slice(0, 36));
    }
    out.headings = big.slice(0, 10);

    // Padding on the main content containers, which drives perceived density.
    const pads = {};
    for (const el of document.querySelectorAll("section,article,div")) {
      if (!el.offsetParent) continue;
      const cs = getComputedStyle(el);
      if (cs.borderStyle === "none" && cs.backgroundColor === "rgba(0, 0, 0, 0)") continue;
      const p = cs.paddingTop + "/" + cs.paddingLeft;
      pads[p] = (pads[p] || 0) + 1;
    }
    out.containerPadding = Object.entries(pads)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([p, c]) => p + " x" + c);

    return JSON.stringify(out, null, 2);
  })()`);

  console.log(report);
  ws.close();
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
