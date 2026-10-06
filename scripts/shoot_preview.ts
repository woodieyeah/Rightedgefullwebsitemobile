// Screenshot the local preview over CDP, bypassing the browser tool.
import { writeFileSync } from "node:fs";

const TARGET = "http://localhost:4200/#matches";

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

  await send("Page.enable");
  await send("Page.navigate", { url: TARGET });
  await new Promise((r) => setTimeout(r, 12000));

  const text = await send("Runtime.evaluate", {
    expression: "document.body.innerText",
    returnByValue: true,
  });
  const body: string = text.result?.value ?? "";

  for (const probe of ["Australia", "New Zealand", "Allianz", "ROOSTERS", "RLWC"]) {
    console.log(`  ${probe.padEnd(14)} ${body.toLowerCase().includes(probe.toLowerCase())}`);
  }

  await send("Emulation.setDeviceMetricsOverride", {
    width: 1400, height: 2400, deviceScaleFactor: 2, mobile: false,
  });
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const path = "/tmp/rlwc-preview.png";
  writeFileSync(path, Buffer.from(shot.data, "base64"));
  console.log("\nscreenshot:", path);
  ws.close();
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
