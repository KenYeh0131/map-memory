"use client";
import { useCallback, useEffect, useState } from "react";
import { APP_BUILD_ID, APP_VERSION } from "@/lib/version";
export function UpdateNotice({ blocked, showVersion }: { blocked: boolean; showVersion: boolean }) {
  const [nextVersion, setNextVersion] = useState<{ version: string; notes: string } | null>(null);
  const [status, setStatus] = useState("");
  const check = useCallback(async (manual = false) => {
    try {
      const response = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (typeof data.buildId !== "string" || typeof data.version !== "string") throw new Error();
      if (data.buildId !== APP_BUILD_ID) { setNextVersion(data); setStatus(""); }
      else if (manual) setStatus("目前已是最新版本");
    } catch { if (manual) setStatus("無法檢查更新，請確認網路後重試"); }
  }, []);
  useEffect(() => {
    const checkVisible = () => { if (document.visibilityState === "visible") void check(); };
    const initialCheck = window.setTimeout(() => void check(), 0); const timer = window.setInterval(checkVisible, 60000);
    document.addEventListener("visibilitychange", checkVisible); window.addEventListener("pageshow", checkVisible); window.addEventListener("online", checkVisible);
    return () => { window.clearTimeout(initialCheck); window.clearInterval(timer); document.removeEventListener("visibilitychange", checkVisible); window.removeEventListener("pageshow", checkVisible); window.removeEventListener("online", checkVisible); };
  }, [check]);
  return <>
    {showVersion && <div className="mx-3 my-3 rounded-xl bg-white p-3 text-xs"><span>版本 {APP_VERSION}</span><button type="button" onClick={() => check(true)} className="ml-3 underline">檢查更新</button>{status && <p className="mt-2" role="status">{status}</p>}</div>}
    {nextVersion && <aside className="fixed bottom-24 left-1/2 z-[110] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-orange-200 bg-white p-4 shadow-xl"><p className="text-sm font-bold">有新版本 {nextVersion.version}</p><p className="mt-1 text-xs text-slate-600">{nextVersion.notes}</p>{blocked && <p className="mt-2 text-xs">請先儲存或關閉目前操作，再更新。</p>}<button type="button" disabled={blocked} onClick={() => { sessionStorage.setItem("map-memory-scroll-before-reload", String(window.scrollY)); window.location.reload(); }} className="mt-3 rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">立即更新</button></aside>}
  </>;
}
