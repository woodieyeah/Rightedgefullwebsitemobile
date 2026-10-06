// Probe the preview: console errors, failed requests, and what data landed.
const PORT = process.env.CDP_PORT || "9225";
const TARGET = process.env.SHOT_URL || "http://localhost:4201/";

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t: any) => t.type === "page");
  if (!page) throw new Error("no page target");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map<number, (v: any) => void>();
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

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
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
      consoleErrors.push((msg.params.args || []).map((a: any) => a.value ?? a.description).join(" "));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push("EXCEPTION: " + (msg.params?.exceptionDetails?.text ?? "") +
        " " + (msg.params?.exceptionDetails?.exception?.description ?? ""));
    }
    if (msg.method === "Network.loadingFailed") {
      failedRequests.push(msg.params?.errorText ?? "unknown");
    }
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.navigate", { url: TARGET });
  await new Promise((r) => setTimeout(r, 17000));

  const evaluate = async (expr: string) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    return r.result?.value;
  };

  const text = (await evaluate("document.body.innerText")) ?? "";
  console.log("text length:", text.length);
  console.log("has AUSTRALIA:", String(text).includes("AUSTRALIA"));
  console.log("has 'The NRL Predictive Model':", String(text).includes("Predictive Model"));

  console.log("\nconsole errors:", consoleErrors.length);
  for (const e of consoleErrors.slice(0, 6)) console.log("  -", e.slice(0, 200));

  console.log("\nfailed requests:", failedRequests.length);
  for (const f of [...new Set(failedRequests)].slice(0, 6)) console.log("  -", f);

  // Did the Supabase view actually answer in this browser?
  const supa = await evaluate(`
    fetch('https://spahmuawycgohcznathc.supabase.co/rest/v1/public_fixtures?competition=eq.rlwc&limit=1', {
      headers: {
        apikey: '${process.env.PROBE_ANON ?? ""}',
        Authorization: 'Bearer ${process.env.PROBE_ANON ?? ""}'
      }
    }).then(r => r.status).catch(e => 'fetch error: ' + e.message)
  `);
  console.log("\nsupabase status from page:", supa);
  ws.close();
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
