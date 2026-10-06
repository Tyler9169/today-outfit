"use client";
import { useEffect, useState } from "react";
export function OfflineStatus() {
  const [message, setMessage] = useState("正在检查离线资源…");
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [update, setUpdate] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const report = (value: string) => { if (active) setMessage(value); };
    async function status() {
      const worker = navigator.serviceWorker.controller;
      if (!worker) return;
      const channel = new MessageChannel();
      timer = setTimeout(() => report("离线资源检查超时，请重试。"), 15_000);
      channel.port1.onmessage = e => { clearTimeout(timer); channel.port1.close(); report(e.data.ready ? "离线准备完成 · 可从主屏幕断网打开" : "缓存不完整，请联网后重试。"); };
      worker.postMessage({ type: "STATUS" }, [channel.port2]);
    }
    async function setup() {
      if (process.env.NODE_ENV !== "production") { report("开发预览：未启用离线缓存，请使用生产版本安装。"); return; }
      if (!window.isSecureContext || !("serviceWorker" in navigator)) { report("当前环境无法安装离线版，请使用 HTTPS 地址与支持的浏览器。"); return; }
      try {
        const reg = await navigator.serviceWorker.register(new URL("sw.js", document.baseURI).pathname, { scope: new URL(".", document.baseURI).pathname, updateViaCache: "none" });
        if (!active) return;
        setRegistration(reg); setUpdate(Boolean(reg.waiting));
        reg.onupdatefound = () => { const worker = reg.installing; if (!worker) return; worker.onstatechange = () => { if (worker.state === "installed" && active) { setUpdate(Boolean(reg.waiting)); void status(); } if (worker.state === "redundant") report("离线缓存失败，请联网后重试。"); }; };
        navigator.serviceWorker.addEventListener("controllerchange", status);
        await status();
        if (!navigator.serviceWorker.controller) report("正在缓存离线资源，请保持页面打开…");
      } catch { report("离线缓存失败，请检查网络或可用空间后重试。"); }
    }
    void setup();
    return () => { active = false; clearTimeout(timer); if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("controllerchange", status); };
  }, [retry]);
  return <section className="tool-panel"><p role="status" className="text-sm">{message}</p><div className="flex gap-3 flex-wrap mt-2"><button className="small-button" onClick={() => { void registration?.update().catch(() => {}); setRetry(n => n+1); }}>重新检查</button>{update && <button className="small-button" onClick={() => { if (!window.confirm("启用新版本将刷新页面，请先保存正在填写的衣服。继续？")) return; navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true }); registration?.waiting?.postMessage({ type: "ACTIVATE" }); }}>新版本已就绪 · 刷新启用</button>}</div><details className="hint mt-3"><summary>手机安装与离线使用</summary><p className="mt-2">iPhone/iPad：Safari 打开 HTTPS 地址，等待离线准备完成，分享 → 添加到主屏幕。Android：Chrome 菜单 → 安装应用或添加到主屏幕。安装后先在线打开一次，再关闭并断网重开测试。衣橱按浏览器和地址独立保存，换设备前请导出备份。</p></details></section>;
}
