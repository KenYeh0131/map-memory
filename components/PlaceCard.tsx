"use client";

import type { MouseEvent, TouchEvent } from "react";
import { useRef, useState } from "react";
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

type PhotoPreviewState = {
  photos: string[];
  index: number;
} | null;

function normalizeExternalUrl(url?: string) {
  const value = url?.trim() ?? "";
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function openPlaceUrl(place: PlaceItem) {
  const url = normalizeExternalUrl(place.placeUrl);
  if (!url) return false;

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

function buildDirectionsUrl(place: PlaceItem) {
  if (
    typeof place.navigationTargetLat === "number" &&
    Number.isFinite(place.navigationTargetLat) &&
    typeof place.navigationTargetLng === "number" &&
    Number.isFinite(place.navigationTargetLng)
  ) {
    const destination = `${place.navigationTargetLat},${place.navigationTargetLng}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  }

  const navigationTarget = place.navigationTarget?.trim();
  if (navigationTarget) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(navigationTarget)}`;
  }

  if (
    typeof place.lat === "number" &&
    Number.isFinite(place.lat) &&
    typeof place.lng === "number" &&
    Number.isFinite(place.lng)
  ) {
    const destination = `${place.lat},${place.lng}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  }

  if (place.address?.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.address.trim())}`;
  }

  return "";
}

function openSmartGoogleMapsDirections(place: PlaceItem) {
  const url = buildDirectionsUrl(place);
  if (!url) return false;

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

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

  if (item.startDate) return `${formatShortDate(item.startDate)} 起`;
  if (item.endDate) return `${formatShortDate(item.endDate)} 前`;

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
  if (item.kind === "months") return getMonthText(item.months, today);
  return getDateRangeText(item);
}

function getTimingDisplayText(item: BestTimingItem, today: string) {
  const periodText = getTimingPeriodText(item, today);
  const note = item.note?.trim() ?? "";

  if (periodText && note) return `最近適合去：${periodText}　${note}`;
  if (periodText) return `最近適合去：${periodText}`;
  if (note) return `最近適合去：${note}`;

  return "最近適合去";
}

function getNormalizedBestTimings(place: PlaceItem): BestTimingItem[] {
  const newTimings = Array.isArray(place.bestTimings) ? place.bestTimings : [];
  if (newTimings.length > 0) return newTimings;

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
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreviewState>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const didLongPressRef = useRef(false);

  const todayText = getTodayDateText();
  const coverIndex = place.coverPhotoIndex ?? 0;
  const coverPhoto = place.photos?.[coverIndex] ?? place.photos?.[0];
  const timingInfo = getTimingDisplayInfo(place, todayText);
  const lastVisitedText = formatDate(place.lastVisitedAt);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openActionMenu = () => {
    didLongPressRef.current = true;
    setIsActionMenuOpen(true);
  };

  const handleCardClick = () => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }

    onOpenDetail?.(place);
  };

  const handleMouseDown = () => {
    clearLongPressTimer();
    didLongPressRef.current = false;

    longPressTimerRef.current = window.setTimeout(() => {
      openActionMenu();
    }, 600);
  };

  const handleMouseUp = () => {
    clearLongPressTimer();
  };

  const handleMouseLeave = () => {
    clearLongPressTimer();
  };

  const handleTouchStart = (_event: TouchEvent<HTMLElement>) => {
    clearLongPressTimer();
    didLongPressRef.current = false;

    longPressTimerRef.current = window.setTimeout(() => {
      openActionMenu();
    }, 600);
  };

  const handleTouchEnd = () => {
    clearLongPressTimer();
  };

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    openActionMenu();
  };

  const handleStartNavigation = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const ok = openSmartGoogleMapsDirections(place);
    if (!ok) window.alert("未設定導航資訊");
  };

  const handleViewPlace = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const ok = openPlaceUrl(place);
    if (!ok) window.alert("尚未設定地點介紹網址");
  };

  const handleAddVisit = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onAddVisit(place);
  };

  const handleOpenPhotoPreview = (
    event: MouseEvent<HTMLButtonElement>,
    index: number,
  ) => {
    event.stopPropagation();

    if (!Array.isArray(place.photos) || place.photos.length === 0) return;

    setPhotoPreview({
      photos: place.photos,
      index,
    });
  };

  const handleEditFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsActionMenuOpen(false);
    onEditPlace(place);
  };

  const handleCopyFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsActionMenuOpen(false);
    onCopyPlace(place);
  };

  const handleDeleteFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsActionMenuOpen(false);

    if (window.confirm(`確定刪除「${place.name}」？`)) {
      onDeletePlace(place.id);
    }
  };

  const handleCloseActionMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsActionMenuOpen(false);
  };

  const closePhotoPreview = () => {
    setPhotoPreview(null);
  };

  const showPrevPhoto = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    setPhotoPreview((prev) =>
      prev
        ? {
            photos: prev.photos,
            index: (prev.index - 1 + prev.photos.length) % prev.photos.length,
          }
        : prev,
    );
  };

  const showNextPhoto = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    setPhotoPreview((prev) =>
      prev
        ? {
            photos: prev.photos,
            index: (prev.index + 1) % prev.photos.length,
          }
        : prev,
    );
  };

  return (
    <>
      <article
        onClick={handleCardClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        className={`relative overflow-hidden rounded-3xl bg-white shadow-2xl ${
          timingInfo.isActive ? "ring-4 ring-amber-300" : ""
        } ${onOpenDetail ? "cursor-pointer" : ""} ${className}`}
      >
        {isActionMenuOpen ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/35 px-4">
            <div className="w-full max-w-xs rounded-2xl bg-white p-3 shadow-2xl">
              <div className="mb-2 text-center text-sm font-bold text-slate-700">
                地點操作
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={handleEditFromMenu}
                  className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700"
                >
                  📝 編輯地點
                </button>

                <button
                  type="button"
                  onClick={handleCopyFromMenu}
                  className="rounded-xl bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-700"
                >
                  📋 複製地點
                </button>

                <button
                  type="button"
                  onClick={handleDeleteFromMenu}
                  className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600"
                >
                  🗑️ 刪除地點
                </button>

                <button
                  type="button"
                  onClick={handleCloseActionMenu}
                  className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-bold text-slate-600"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-stretch">
          <div className="w-32 shrink-0 overflow-hidden bg-slate-100">
            {coverPhoto ? (
              <div className="relative h-full min-h-32">
                <button
                  type="button"
                  onClick={(event) =>
                    handleOpenPhotoPreview(event, coverIndex)
                  }
                  className="block h-full w-full"
                  aria-label="查看照片"
                >
                  <img
                    src={coverPhoto}
                    alt={place.name}
                    className="h-full w-full object-cover"
                  />
                </button>

                {place.photos?.length > 1 ? (
                  <span className="absolute bottom-1 right-1 rounded-full bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {(coverIndex % place.photos.length) + 1}/{place.photos.length}
                  </span>
                ) : null}
              </div>
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
              <div className="min-w-0 flex-1 pr-1">
                <div className="truncate text-lg font-bold text-slate-900">
                  {place.name}
                </div>

                <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {place.address}
                </div>
              </div>

              <button
                type="button"
                onClick={handleViewPlace}
                className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
                aria-label="查看地點"
                title="查看地點"
              >
                🔍
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

            <div className="mt-auto flex gap-2 pt-3">
              <button
                type="button"
                onClick={handleStartNavigation}
                className="flex-1 rounded-xl bg-blue-500 px-2 py-2.5 text-xs font-bold text-white"
                aria-label="立刻出發"
              >
                🚕 立刻出發
              </button>

              <button
                type="button"
                onClick={handleAddVisit}
                className="flex-1 rounded-xl bg-orange-500 px-2 py-2.5 text-xs font-bold text-white"
                aria-label="新增回憶"
              >
                ＋ 新增回憶
              </button>
            </div>
          </div>
        </div>
      </article>

      {photoPreview ? (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/85 p-4"
          onClick={closePhotoPreview}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-5xl items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closePhotoPreview}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/60 px-3 py-1.5 text-sm font-bold text-white"
              aria-label="關閉照片"
            >
              ✕
            </button>

            {photoPreview.photos.length > 1 ? (
              <button
                type="button"
                onClick={showPrevPhoto}
                className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl font-bold text-white"
                aria-label="上一張"
              >
                ‹
              </button>
            ) : null}

            <img
              src={photoPreview.photos[photoPreview.index]}
              alt={`preview-${photoPreview.index + 1}`}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            />

            {photoPreview.photos.length > 1 ? (
              <button
                type="button"
                onClick={showNextPhoto}
                className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl font-bold text-white"
                aria-label="下一張"
              >
                ›
              </button>
            ) : null}

            {photoPreview.photos.length > 1 ? (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                {photoPreview.index + 1} / {photoPreview.photos.length}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}