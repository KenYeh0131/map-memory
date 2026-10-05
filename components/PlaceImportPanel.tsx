"use client";
import { useEffect, useRef, useState } from "react";
import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { IMPORT_HEADERS, validateImportRows, type ImportIssue, type ImportRow } from "@/lib/place-import";

export function PlaceImportPanel({ groupId, groupName, onBlockedChange }: { groupId: string; groupName: string; onBlockedChange: (blocked: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [records, setRecords] = useState<ImportRow[]>([]);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { onBlockedChange(busy || records.length > 0); return () => onBlockedChange(false); }, [busy, records.length, onBlockedChange]);
  const inputRef = useRef<HTMLInputElement>(null);
  const downloadTemplate = async () => {
    try {
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook();
      const sheet = workbook.addWorksheet("地點"); sheet.addRow(IMPORT_HEADERS);
      sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.columns.forEach((column, index) => { column.width = index === 1 ? 36 : 22; });
      const guide = workbook.addWorksheet("填寫說明");
      ["地點名稱、地址必填；其餘欄位選填。", "喜歡程度為 0～5 整數，空白視為 0。", "標籤、適合月份以逗號分隔；月份例如 3,4,5。", "日期使用 YYYY-MM-DD 文字，開始與結束日期一起填。", "緯度與經度一起填或一起留空；留空將查詢 Google 地址座標。", "不匯入照片。每次最多 400 筆，任一錯誤整批不寫入。", "Excel 內同名稱＋同地址視為錯誤；與既有地點重複仍新增。"].forEach(text => guide.addRow([text]));
      guide.getColumn(1).width = 100;
      const bytes = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a"); link.href = url; link.download = "回憶地圖-地點匯入範本.xlsx"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setMessage("範本下載失敗，請再試一次"); }
  };
  const readFile = async (file?: File) => {
    if (!file) return;
    setBusy(true); setRecords([]); setIssues([]); setMessage("讀取 Excel 中…");
    try {
      if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("請使用下載的 .xlsx 範本");
      if (file.size > 5 * 1024 * 1024) throw new Error("檔案超過 5 MB，請分成較小的檔案");
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook(); await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet("地點");
      if (!sheet) throw new Error("找不到「地點」工作表，請使用固定範本");
      if (IMPORT_HEADERS.some((header, index) => sheet.getRow(1).getCell(index + 1).text.trim() !== header)) throw new Error("欄位名稱或順序與範本不同，請勿修改標題列");
      const rows: { row: number; cells: string[] }[] = [];
      const cellIssues: ImportIssue[] = [];
      sheet.eachRow((excelRow, row) => {
        if (row === 1) return;
        const cells = IMPORT_HEADERS.map((_, index) => excelRow.getCell(index + 1).text);
        if (!cells.some(text => text.trim())) return;
        excelRow.eachCell(cell => { if (cell.type === 6 || cell.type === 4 || cell.type === 10) cellIssues.push({ row, reason: "請填入文字或數字，不支援公式或 Excel 日期儲存格；日期請設為文字" }); });
        rows.push({ row, cells });
      });
      if (!rows.length) throw new Error("沒有可匯入的地點");
      if (rows.length > 400) throw new Error("每次最多 400 筆，請分檔匯入，以確保整批一次寫入");
      const result = validateImportRows(rows); result.issues.push(...cellIssues);
      if (!result.issues.length) {
        const needsCoordinates = result.records.filter(record => record.place.lat === undefined);
        if (needsCoordinates.length && (typeof google === "undefined" || !google.maps?.Geocoder)) throw new Error("地圖尚未載入，無法查詢地址，請稍後重試");
        const cache = new Map<string, { lat: number; lng: number }>();
        for (const record of needsCoordinates) {
          setMessage(`查詢地址座標：第 ${record.row} 列…`);
          try {
            let coordinates = cache.get(record.place.address);
            if (!coordinates) {
              const response = await new google.maps.Geocoder().geocode({ address: record.place.address, region: "TW" });
              const match = response.results[0];
              if (!match || match.partial_match || match.geometry.location_type === "APPROXIMATE") throw new Error("地址不夠明確");
              coordinates = { lat: match.geometry.location.lat(), lng: match.geometry.location.lng() }; cache.set(record.place.address, coordinates);
            }
            Object.assign(record.place, coordinates);
          } catch { result.issues.push({ row: record.row, reason: "地址無法取得明確座標，請補完整地址或直接填緯度與經度" }); }
        }
      }
      setRecords(result.records); setIssues(result.issues);
      setMessage(result.issues.length ? "檢查失敗，全部資料尚未寫入。請修正 Excel 後重新上傳。" : `全部 ${result.records.length} 筆檢查通過，請確認預覽後匯入。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Excel 讀取失敗"); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  const importAll = async () => {
    if (busy || issues.length || !records.length) return;
    setBusy(true);
    try {
      const batch = writeBatch(db); const now = new Date().toISOString();
      records.forEach(record => { const reference = doc(collection(db, "groups", groupId, "places")); batch.set(reference, { ...record.place, id: reference.id, createdAt: now, updatedAt: now }); });
      await batch.commit(); setMessage(`已新增 ${records.length} 筆地點到「${groupName}」`); setRecords([]);
    } catch { setMessage("整批寫入失敗，沒有部分寫入。請確認網路及 Firestore 權限後重試。"); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-2xl border bg-white p-4">
    <h3 className="text-sm font-bold">Excel 新增地點</h3>
    <p className="text-xs text-slate-500">匯入「{groupName}」。不含照片；任一筆錯誤，整批不寫入。每次最多 400 筆。</p>
    <button type="button" disabled={busy} onClick={downloadTemplate} className="rounded-xl bg-slate-100 px-3 py-2 text-sm">下載範本</button>
    <input ref={inputRef} type="file" accept=".xlsx" disabled={busy} onChange={event => readFile(event.target.files?.[0])} className="block w-full text-sm" />
    {(records.length > 0 || issues.length > 0) && <button type="button" disabled={busy} onClick={() => { setRecords([]); setIssues([]); setMessage(""); }} className="rounded-xl bg-slate-100 px-3 py-2 text-sm">取消匯入</button>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {!!issues.length && <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{issues.map((issue, index) => <li key={index}>第 {issue.row} 列：{issue.reason}</li>)}</ul>}
    {!!records.length && !issues.length && <><div className="max-h-56 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>列</th><th>地點</th><th>地址／座標</th></tr></thead><tbody>{records.map(record => <tr key={record.row} className="border-t"><td className="p-1">{record.row}</td><td className="p-1">{record.place.name}</td><td className="p-1">{record.place.address}<br />{record.place.lat}, {record.place.lng}</td></tr>)}</tbody></table></div><button type="button" disabled={busy} onClick={importAll} className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "寫入中…" : `確認匯入 ${records.length} 筆`}</button></>}
  </section>;
}
