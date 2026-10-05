"use client";
import { useEffect, useState } from "react";
import { createTransferCode, mergeIdentity, type IdentityProfile } from "@/lib/identity";

type Props = { deviceId: string; groupIds: string[]; nickname: string; onMerged: (profile: IdentityProfile) => void; onBlockedChange: (blocked: boolean) => void };
export function IdentityPanel({ deviceId, groupIds, nickname, onMerged, onBlockedChange }: Props) {
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { onBlockedChange(busy || Boolean(input.trim())); return () => onBlockedChange(false); }, [busy, input, onBlockedChange]);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await operation(); } catch (error) { setMessage(error instanceof Error && !error.message.startsWith("Firebase") ? error.message : "操作失敗，請確認網路與雲端規則允許身分合併"); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-2xl border bg-white p-4">
    <h3 className="text-sm font-bold">換手機／合併身分</h3>
    <p className="text-xs leading-5 text-slate-500">在舊手機產生移轉碼，再到新手機輸入。保留雙方群組、群主資格與回憶／留言權限，兩支手機都能繼續使用。暱稱採用新手機的暱稱。</p>
    <button type="button" disabled={busy} onClick={() => run(async () => setCode(await createTransferCode(deviceId, groupIds, nickname)))} className="rounded-xl bg-slate-100 px-3 py-2 text-sm disabled:opacity-50">產生移轉碼</button>
    {code && <div className="rounded-xl bg-orange-50 p-3"><p className="break-all font-mono text-sm">{code}</p><p className="mt-1 text-xs">10 分鐘內有效，限用一次。只交給自己的新裝置。</p><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(code); setMessage("已複製移轉碼"); } catch { setMessage("請長按移轉碼複製"); } }} className="mt-2 text-sm underline">複製</button></div>}
    <input value={input} onChange={e => setInput(e.target.value)} placeholder="在新手機貼上移轉碼" className="w-full rounded-xl border px-3 py-2 text-sm" disabled={busy} />
    <button type="button" disabled={busy || !input.trim()} onClick={() => run(async () => {
      const profile = await mergeIdentity(input, deviceId, groupIds, nickname); onMerged(profile); setInput(""); setMessage("身分合併完成，原有資料已保留");
    })} className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "處理中…" : "合併身分"}</button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
