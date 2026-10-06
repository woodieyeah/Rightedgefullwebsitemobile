// Screenshot the LIVE site root over CDP.
import { writeFileSync } from "node:fs";

const TARGET = process.env.SHOT_URL || "https://rightedge.com.au/";
const PORT = process.env.CDP_PORT || "9224";

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
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)!(msg.result);
      pending.delete(msg.id);
    }
  };

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1500, height: 2600, deviceScaleFactor: 2, mobile: false,
  });
  await send("Page.navigate", { url: TARGET });
  await new Promise((r) => setTimeout(r, 22000));

  const r = await send("Runtime.evaluate", {
    expression: "document.body.innerText",
    returnByValue: true,
  });
  const body: string = r.result?.value ?? "";
  console.log("url:", TARGET);
  console.log("text length:", body.length);
  for (const probe of ["Australia", "New Zealand", "Allianz", "AEDT", "Sydney", "Newcastle"]) {
    console.log(`  ${probe.padEnd(14)} ${body.toLowerCase().includes(probe.toLowerCase())}`);
  }

  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const path = "/tmp/live-rlwc.png";
  writeFileSync(path, Buffer.from(shot.data, "base64"));
  console.log("screenshot:", path);
  ws.close();
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
