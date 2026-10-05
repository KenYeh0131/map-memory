import type { PlaceItem } from "@/lib/places";
import { localDateText } from "@/lib/dates";

export function isSuitableNow(place: PlaceItem, today = localDateText()) {
  const month = Number(today.slice(5, 7));
  if (place.bestTimings?.length) {
    return place.bestTimings.some(item => item.kind === "months"
      ? item.months?.includes(month)
      : Boolean((item.startDate || item.endDate) && (!item.startDate || today >= item.startDate) && (!item.endDate || today <= item.endDate)));
  }
  return Boolean(place.bestTiming?.months?.includes(month) || place.bestTiming?.timeRanges?.some(range =>
    (range.start || range.end) && (!range.start || today >= range.start) && (!range.end || today <= range.end)));
}
