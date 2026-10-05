import type { BestTimingItem, PlaceItem } from "@/lib/places";
export const IMPORT_HEADERS = ["地點名稱", "地址", "喜歡程度", "標籤", "地點筆記", "參考網址", "導航目標", "緯度", "經度", "適合月份", "適合開始日期", "適合結束日期", "適合期間備註"];
export type ImportRow = { row: number; place: Omit<PlaceItem, "id" | "createdAt" | "updatedAt"> };
export type ImportIssue = { row: number; reason: string };

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function isUrl(value: string) {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}
export function validateImportRows(rows: { row: number; cells: string[] }[]) {
  const issues: ImportIssue[] = [];
  const records: ImportRow[] = [];
  const seen = new Map<string, number>();
  rows.forEach(({ row, cells }) => {
    const [name, address, ratingText, tags, notes, placeUrl, navigationTarget, latText, lngText, monthText, startDate, endDate, timingNote] = IMPORT_HEADERS.map((_, i) => (cells[i] ?? "").trim());
    const add = (reason: string) => issues.push({ row, reason });
    if (!name) add("地點名稱必填");
    if (!address) add("地址必填");
    const key = JSON.stringify([name, address]);
    if (seen.has(key)) add(`地點名稱與地址和第 ${seen.get(key)} 列重複`); else seen.set(key, row);
    const rating = ratingText === "" ? 0 : Number(ratingText);
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) add("喜歡程度必須為 0～5 的整數");
    if (placeUrl && !isUrl(placeUrl)) add("參考網址必須是完整的 http 或 https 網址");
    const lat = latText === "" ? undefined : Number(latText);
    const lng = lngText === "" ? undefined : Number(lngText);
    if ((latText === "") !== (lngText === "")) add("緯度與經度須一起填寫或一起留空");
    if (lat !== undefined && (!Number.isFinite(lat) || lat < -90 || lat > 90)) add("緯度必須介於 -90～90");
    if (lng !== undefined && (!Number.isFinite(lng) || lng < -180 || lng > 180)) add("經度必須介於 -180～180");
    const months = monthText ? monthText.split(/[,，、\s]+/).filter(Boolean).map(Number) : [];
    if (months.some(month => !Number.isInteger(month) || month < 1 || month > 12)) add("適合月份須為 1～12，以逗號分隔");
    if (Boolean(startDate) !== Boolean(endDate)) add("適合開始與結束日期須一起填寫");
    if (startDate && !isDate(startDate)) add("適合開始日期格式須為 YYYY-MM-DD，且日期有效");
    if (endDate && !isDate(endDate)) add("適合結束日期格式須為 YYYY-MM-DD，且日期有效");
    if (startDate && endDate && startDate > endDate) add("適合開始日期不可晚於結束日期");
    const bestTimings: BestTimingItem[] = [];
    if (months.length) bestTimings.push({ id: `months-${row}`, kind: "months", title: "月份提醒", months: [...new Set(months)], note: timingNote });
    if (startDate && endDate) bestTimings.push({ id: `range-${row}`, kind: "dateRange", title: "日期區間提醒", startDate, endDate, note: timingNote });
    const coordinates = navigationTarget.match(/^(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$/);
    const navLat = coordinates ? Number(coordinates[1]) : undefined;
    const navLng = coordinates ? Number(coordinates[2]) : undefined;
    if (coordinates && (Math.abs(navLat!) > 90 || Math.abs(navLng!) > 180)) add("導航目標座標超出有效範圍");
    records.push({ row, place: {
      name, address, rating, status: "wantToGo", tags: tags.split(/[,，、]/).map(tag => tag.trim()).filter(Boolean), notes,
      placeUrl, navigationTarget: /^[.。．]+$/.test(navigationTarget) ? "" : navigationTarget,
      ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
      ...(coordinates ? { navigationTargetLat: navLat, navigationTargetLng: navLng } : {}),
      photos: [], coverPhotoIndex: 0, visits: [], visitCount: 0, bestTimings,
    } });
  });
  return { records, issues };
}
