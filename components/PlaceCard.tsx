"use client";

import type { MouseEvent } from "react";
import { openGoogleMapsDirections } from "@/lib/navigation";
import type { BestTimingItem, PlaceItem } from "@/lib/places";

type PlaceCardProps = {
  place: PlaceItem;
  onOpenDetail?: (place: PlaceItem) => void;
  onEditPlace: (place: PlaceItem) => void;
  onDeletePlace: (placeId: string) => void;
  onAddVisit: (place: PlaceItem) => void;
  onCopyPlace: (place: PlaceItem) => void;
  className?: string;
};

type TimingDisplayInfo = {
  hasTiming: boolean;
  isActive: boolean;
  detailText: string;
};

function formatDate(dateText?: string) {
  if (!dateText) return "";
  return dateText.replaceAll("-", "/");
}

function formatShortDate(dateText?: string) {
  if (!dateText) return "";

  const parts = dateText.split("-");
  if (parts.length !== 3) return formatDate(dateText);

  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!month || !day) return formatDate(dateText);

  return `${month}/${day}`;
}

function getTodayDateText() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonth(today: string) {
  return Number(today.slice(5, 7));
}

function isDateInRange(today: string, startDate?: string, endDate?: string) {
  if (startDate && today < startDate) return false;
  if (endDate && today > endDate) return false;
  return true;
}

function getNearestMonth(months: number[] | undefined, today: string) {
  if (!Array.isArray(months) || months.length === 0) return null;

  const currentMonth = getCurrentMonth(today);
  const sortedMonths = Array.from(new Set(months))
    .filter((month) => month >= 1 && month <= 12)
    .sort((a, b) => a - b);

  if (sortedMonths.length === 0) return null;

  return sortedMonths.find((month) => month >= currentMonth) ?? sortedMonths[0];
}

function getMonthText(months: number[] | undefined, today: string) {
  const nearestMonth = getNearestMonth(months, today);

  if (!nearestMonth) return "";

  return `${nearestMonth}月`;
}

function getDateRangeText(item: BestTimingItem) {
  if (item.startDate && item.endDate) {
    return `${formatShortDate(item.startDate)}~${formatShortDate(item.endDate)}`;
  }

  if (item.startDate) {
    return `${formatShortDate(item.startDate)} 起`;
  }

  if (item.endDate) {
    return `${formatShortDate(item.endDate)} 前`;
  }

  return "";
}

function isTimingItemActive(item: BestTimingItem, today: string) {
  if (item.kind === "months") {
    const months = Array.isArray(item.months) ? item.months : [];

    if (months.length === 0) return false;

    return months.includes(getCurrentMonth(today));
  }

  return isDateInRange(today, item.startDate, item.endDate);
}

function getTimingItemSortValue(item: BestTimingItem, today: string) {
  if (item.kind === "dateRange") {
    if (item.startDate && item.startDate >= today) return item.startDate;
    if (item.endDate && item.endDate >= today) return item.endDate;
    return "9999-12-31";
  }

  const nearestMonth = getNearestMonth(item.months, today);

  if (!nearestMonth) return "9999-12-31";

  const currentMonth = getCurrentMonth(today);
  const sortMonth =
    nearestMonth >= currentMonth ? nearestMonth : nearestMonth + 12;

  return `${String(sortMonth).padStart(2, "0")}`;
}

function getTimingPeriodText(item: BestTimingItem, today: string) {
  if (item.kind === "months") {
    return getMonthText(item.months, today);
  }

  return getDateRangeText(item);
}

function getTimingDisplayText(item: BestTimingItem, today: string) {
  const periodText = getTimingPeriodText(item, today);
  const note = item.note?.trim() ?? "";

  if (periodText && note) {
    return `最近適合去：${periodText}　${note}`;
  }

  if (periodText) {
    return `最近適合去：${periodText}`;
  }

  if (note) {
    return `最近適合去：${note}`;
  }

  return "最近適合去";
}

function getNormalizedBestTimings(place: PlaceItem): BestTimingItem[] {
  const newTimings = Array.isArray(place.bestTimings) ? place.bestTimings : [];

  if (newTimings.length > 0) {
    return newTimings;
  }

  const oldBestTiming = place.bestTiming;
  const oldItems: BestTimingItem[] = [];

  if (oldBestTiming?.months?.length) {
    oldItems.push({
      id: "legacy-months",
      kind: "months",
      title: "適合月份",
      months: oldBestTiming.months,
    });
  }

  if (oldBestTiming?.timeRanges?.length) {
    oldBestTiming.timeRanges.forEach((range, index) => {
      oldItems.push({
        id: `legacy-range-${index}`,
        kind: "dateRange",
        title: "適合期間",
        startDate: range.start,
        endDate: range.end,
      });
    });
  }

  return oldItems;
}

function getTimingDisplayInfo(place: PlaceItem, today: string): TimingDisplayInfo {
  const timings = getNormalizedBestTimings(place);

  if (timings.length === 0) {
    return {
      hasTiming: false,
      isActive: false,
      detailText: "",
    };
  }

  const activeTiming = timings.find((item) => isTimingItemActive(item, today));

  if (activeTiming) {
    return {
      hasTiming: true,
      isActive: true,
      detailText: getTimingDisplayText(activeTiming, today),
    };
  }

  const nextTiming = [...timings].sort((a, b) =>
    getTimingItemSortValue(a, today).localeCompare(
      getTimingItemSortValue(b, today),
    ),
  )[0];

  return {
    hasTiming: true,
    isActive: false,
    detailText: nextTiming ? getTimingDisplayText(nextTiming, today) : "",
  };
}

function getSafeRating(rating?: number) {
  const value = Number(rating ?? 0);

  if (!Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(5, Math.round(value)));
}

function getRatingLabel(rating?: number) {
  const safeRating = getSafeRating(rating);

  if (safeRating === 0) return "沒去過";
  if (safeRating === 1) return "CP值極低";
  if (safeRating === 2) return "體驗過就好";
  if (safeRating === 3) return "可去可不去";
  if (safeRating === 4) return "值得再去";

  return "我還要去";
}

function renderRating(rating?: number) {
  const safeRating = getSafeRating(rating);

  return Array.from({ length: 5 }).map((_, i) => (
    <span
      key={i}
      className={i < safeRating ? "text-red-500" : "text-slate-300"}
    >
      ♥
    </span>
  ));
}

export function PlaceCard({
  place,
  onOpenDetail,
  onEditPlace,
  onDeletePlace,
  onAddVisit,
  onCopyPlace,
  className = "",
}: PlaceCardProps) {
  const todayText = getTodayDateText();
  const coverIndex = place.coverPhotoIndex ?? 0;
  const coverPhoto = place.photos?.[coverIndex] ?? place.photos?.[0];
  const timingInfo = getTimingDisplayInfo(place, todayText);
  const lastVisitedText = formatDate(place.lastVisitedAt);

  const handleCardClick = () => {
    onOpenDetail?.(place);
  };

  const handleDeletePlace = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (window.confirm(`確定刪除「${place.name}」？`)) {
      onDeletePlace(place.id);
    }
  };

  const handleStartNavigation = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const ok = openGoogleMapsDirections(place);

    if (!ok) {
      window.alert("未設定導航資訊");
    }
  };

  const handleEditPlace = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onEditPlace(place);
  };

  const handleAddVisit = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onAddVisit(place);
  };

  const handleCopyPlace = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onCopyPlace(place);
  };

  return (
    <article
      onClick={handleCardClick}
      className={`overflow-hidden rounded-3xl bg-white shadow-2xl ${
        timingInfo.isActive ? "ring-4 ring-amber-300" : ""
      } ${onOpenDetail ? "cursor-pointer" : ""} ${className}`}
    >
      <div className="flex items-stretch">
        <div className="w-32 shrink-0 overflow-hidden bg-slate-100">
          {coverPhoto ? (
            <img
              src={coverPhoto}
              alt={place.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-32 flex-col items-center justify-center px-2 text-center">
              <div className="text-xs font-bold text-slate-600">
                {getRatingLabel(place.rating)}
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-slate-900">
                {place.name}
              </div>

              <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                {place.address}
              </div>
            </div>

            <button
              type="button"
              onClick={handleDeletePlace}
              className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600"
              aria-label="刪除地點"
            >
              🗑️ 刪除
            </button>
          </div>

          {timingInfo.hasTiming ? (
            <div
              className={`mt-2 rounded-xl px-2 py-1.5 text-xs font-semibold ${
                timingInfo.isActive
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-50 text-slate-500"
              }`}
            >
              {timingInfo.detailText}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1">
            {place.tags?.length > 0 ? (
              place.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                >
                  #{tag}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-slate-400">無標籤</span>
            )}
          </div>

          <div className="mt-2 space-y-1 text-[11px] text-slate-500">
            <div>
              拜訪次數：
              <span className="font-bold text-slate-700">
                {place.visitCount ?? 0}
              </span>
            </div>

            {lastVisitedText ? (
              <div>
                最近拜訪：
                <span className="font-semibold text-slate-700">
                  {lastVisitedText}
                </span>
              </div>
            ) : null}
          </div>

          <div className="mt-2 flex items-center gap-0.5 text-sm">
            {renderRating(place.rating)}
          </div>

          <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
            <button
              type="button"
              onClick={handleStartNavigation}
              className="rounded-xl bg-blue-500 px-2 py-2.5 text-xs font-bold text-white"
              aria-label="立刻出發"
            >
              🚕 立刻出發
            </button>

            <button
              type="button"
              onClick={handleEditPlace}
              className="rounded-xl bg-slate-200 px-2 py-2.5 text-xs font-bold text-slate-700"
              aria-label="編輯地點"
            >
              📝 編輯地點
            </button>

            <button
              type="button"
              onClick={handleAddVisit}
              className="rounded-xl bg-orange-500 px-2 py-2.5 text-xs font-bold text-white"
              aria-label="新增回憶"
            >
              ＋ 新增回憶
            </button>

            <button
              type="button"
              onClick={handleCopyPlace}
              className="rounded-xl bg-emerald-100 px-2 py-2.5 text-xs font-bold text-emerald-700"
              aria-label="複製地點"
            >
              📋 複製地點
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
