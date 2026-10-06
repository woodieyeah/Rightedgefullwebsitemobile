// Check cricket gating on the live site from a clean, logged-out browser.
const PORT = process.env.CDP_PORT || "9226";

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
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    return r.result?.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");

  for (const url of ["https://rightedge.com.au/", "https://rightedge.com.au/#cricket"]) {
    await send("Page.navigate", { url });
    // Give the SPA time to hydrate and resolve auth.
    await new Promise((r) => setTimeout(r, 20000));

    const text: string = (await evaluate("document.body.innerText")) ?? "";
    const cricketButton = await evaluate(`
      [...document.querySelectorAll('button')]
        .filter(b => /^cricket$/i.test((b.textContent||'').trim())).length
    `);
    console.log("\nURL:", url);
    console.log("  body length:          ", text.length);
    console.log("  'Cricket' nav buttons:", cricketButton);
    console.log("  mentions 'private':   ", /private/i.test(text));
    console.log("  shows fixture data:   ", /\$\d/.test(text));
    console.log("  first 160 chars:      ", JSON.stringify(text.slice(0, 160)));
  }
  ws.close();
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
