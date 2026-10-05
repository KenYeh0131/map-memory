"use client";

import { useSessionState } from "@/lib/use-session-state";
import { localDateText } from "@/lib/dates";
import { openGoogleMapsDirections } from "@/lib/navigation";

import { useCallback, useMemo, useState } from "react";
import { PlaceCard } from "@/components/PlaceCard";
import type { BestTimingItem, PlaceItem, PlaceStatus } from "@/lib/places";

export type PlaceFilters = {
  keyword: string;
  status: "all" | PlaceStatus;
  minRating: number | "all";
  tags: string[];
  suitableNow?: boolean;
};

type CopyTargetGroup = {
  id: string;
  name: string;
};

type PlaceListViewProps = {
  places: PlaceItem[];
  filters: PlaceFilters;
  availableTags: string[];
  onFiltersChange: (next: PlaceFilters) => void;
  onEditPlace: (place: PlaceItem) => void;
  onDeletePlace: (placeId: string) => void;
  onAddVisit: (place: PlaceItem) => void;
  onEditVisit: (placeId: string, visitId: string) => void;
  onDeleteVisit: (placeId: string, visitId: string) => void;
  copyTargetGroups: CopyTargetGroup[];
  currentGroupId: string;
  onCopyPlaceToGroup: (
    place: PlaceItem,
    targetGroupId: string
  ) => Promise<boolean>;
};

type PhotoPreviewState = {
  photos: string[];
  index: number;
} | null;

type CopyModalState = {
  place: PlaceItem;
  selectedGroupId: string;
  isCopying: boolean;
} | null;

type TimingDisplayInfo = {
  hasTiming: boolean;
  isActive: boolean;
  detailText: string;
};

const RATING_CHIPS = [0, 1, 2, 3, 4, 5] as const;
const TIMELINE_PHOTO_LIMIT = 2;



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
  return localDateText();
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

function getTimingDisplayInfo(
  place: PlaceItem,
  today: string
): TimingDisplayInfo {
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
      getTimingItemSortValue(b, today)
    )
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
  return Array.from({ length: 5 }).map((_, i) => (
    <span
      key={i}
      className={i < (rating ?? 0) ? "text-red-500" : "text-gray-300"}
    >
      ♥
    </span>
  ));
}

export function PlaceListView({
  places,
  filters,
  availableTags,
  onFiltersChange,
  onEditPlace,
  onDeletePlace,
  onAddVisit,
  onEditVisit,
  onDeleteVisit,
  copyTargetGroups,
  currentGroupId,
  onCopyPlaceToGroup,
}: PlaceListViewProps) {
  const [detailPlaceId, setDetailPlaceId] = useState<string | null>(null);
  const [selectedRatings, setSelectedRatings] = useSessionState<number[]>("map-memory-list-ratings", [...RATING_CHIPS]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreviewState>(null);
  const [copyModal, setCopyModal] = useState<CopyModalState>(null);

  const todayText = useMemo(() => getTodayDateText(), []);

  const availableCopyTargetGroups = useMemo(() => {
    return copyTargetGroups.filter((group) => group.id !== currentGroupId);
  }, [copyTargetGroups, currentGroupId]);

  const selectedTags = useMemo(() => {
    return Array.isArray(filters.tags) ? filters.tags : [];
  }, [filters.tags]);

  const visibleTags = useMemo(() => {
    return Array.isArray(availableTags)
      ? [...availableTags].sort((a, b) => a.localeCompare(b))
      : [];
  }, [availableTags]);

  const ratingOptions = useMemo(() => {
    return [...RATING_CHIPS];
  }, []);

  const detailPlace = useMemo(() => {
    if (!detailPlaceId) return null;
    return places.find((place) => place.id === detailPlaceId) ?? null;
  }, [places, detailPlaceId]);

  const detailTimingInfo = useMemo(() => {
    if (!detailPlace) {
      return {
        hasTiming: false,
        isActive: false,
        detailText: "",
      };
    }

    return getTimingDisplayInfo(detailPlace, todayText);
  }, [detailPlace, todayText]);

  const sortedVisits = useMemo(() => {
    if (!detailPlace?.visits) return [];

    return [...detailPlace.visits].sort((a, b) =>
      b.visitDate.localeCompare(a.visitDate)
    );
  }, [detailPlace]);

  const visiblePlaces = useMemo(() => {
    return places.filter((place) =>
      selectedRatings.includes(getSafeRating(place.rating))
    );
  }, [places, selectedRatings]);

  const hasActiveFilters = useMemo(() => {
    const hasRatingFilter = selectedRatings.length !== RATING_CHIPS.length;

    return (
      filters.keyword.trim().length > 0 ||
      selectedTags.length > 0 ||
      hasRatingFilter || Boolean(filters.suitableNow)
    );
  }, [filters.keyword, filters.suitableNow, selectedRatings.length, selectedTags.length]);

  const updateFilters = useCallback(
    (next: PlaceFilters) => {
      const currentTags = Array.isArray(filters.tags) ? filters.tags : [];
      const nextTags = Array.isArray(next.tags) ? next.tags : [];

      const sameTags =
        currentTags.length === nextTags.length &&
        currentTags.every((tag, index) => tag === nextTags[index]);

      const isSame =
        filters.keyword === next.keyword &&
        filters.status === next.status &&
        filters.minRating === next.minRating &&
        filters.suitableNow === next.suitableNow &&
        sameTags;

      if (isSame) return;

      onFiltersChange(next);
    },
    [filters, onFiltersChange]
  );

  const handleToggleFilterPanel = useCallback(() => {
    setIsFilterOpen((prev) => !prev);
  }, []);

  const handleKeywordChange = useCallback(
    (keyword: string) => {
      updateFilters({
        ...filters,
        keyword,
      });
    },
    [filters, updateFilters]
  );


  const handleMinRatingChange = useCallback((rating: number) => {
    setSelectedRatings((prev) => {
      if (prev.includes(rating)) {
        return prev.filter((item) => item !== rating);
      }

      return [...prev, rating].sort((a, b) => a - b);
    });
  }, [setSelectedRatings]);

  const handleToggleTag = useCallback(
    (tag: string) => {
      const nextTags = selectedTags.includes(tag)
        ? selectedTags.filter((item) => item !== tag)
        : [...selectedTags, tag];

      updateFilters({
        ...filters,
        tags: nextTags,
      });
    },
    [filters, selectedTags, updateFilters]
  );

  const handleStartNavigation = useCallback((place: PlaceItem) => {
    const ok = openGoogleMapsDirections(place);

    if (!ok) {
      alert("未設定導航資訊");
    }
  }, []);

  const handleOpenDetail = useCallback((placeId: string) => {
    setDetailPlaceId(placeId);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailPlaceId(null);
  }, []);

  const handleOpenCopyModal = useCallback(
    (place: PlaceItem) => {
      if (availableCopyTargetGroups.length === 0) {
        window.alert("目前沒有其他可複製的地圖群，請先建立或加入其他地圖群");
        return;
      }

      setCopyModal({
        place,
        selectedGroupId: availableCopyTargetGroups[0]?.id ?? "",
        isCopying: false,
      });
    },
    [availableCopyTargetGroups]
  );

  const handleCloseCopyModal = useCallback(() => {
    setCopyModal(null);
  }, []);

  const handleConfirmCopy = useCallback(async () => {
    if (!copyModal) return;

    if (!copyModal.selectedGroupId) {
      window.alert("請選擇要複製到哪一個地圖群");
      return;
    }

    setCopyModal((prev) => (prev ? { ...prev, isCopying: true } : prev));

    try {
      const ok = await onCopyPlaceToGroup(
        copyModal.place,
        copyModal.selectedGroupId
      );

      if (ok) {
        const targetGroup = copyTargetGroups.find(
          (group) => group.id === copyModal.selectedGroupId
        );

        window.alert(
          targetGroup
            ? `已複製到「${targetGroup.name}」`
            : "已複製到其他地圖群"
        );

        setCopyModal(null);
      } else {
        setCopyModal((prev) => (prev ? { ...prev, isCopying: false } : prev));
      }
    } catch (error) {
      console.error(error);
      window.alert("複製失敗，請稍後再試");
      setCopyModal((prev) => (prev ? { ...prev, isCopying: false } : prev));
    }
  }, [copyModal, copyTargetGroups, onCopyPlaceToGroup]);

  const handleOpenPhotoPreview = useCallback((photos: string[], index: number) => {
    setPhotoPreview({ photos, index });
  }, []);

  const handleClosePhotoPreview = useCallback(() => {
    setPhotoPreview(null);
  }, []);

  const showPrevPhoto = useCallback(() => {
    setPhotoPreview((prev) => {
      if (!prev) return prev;

      return {
        photos: prev.photos,
        index: (prev.index - 1 + prev.photos.length) % prev.photos.length,
      };
    });
  }, []);

  const showNextPhoto = useCallback(() => {
    setPhotoPreview((prev) => {
      if (!prev) return prev;

      return {
        photos: prev.photos,
        index: (prev.index + 1) % prev.photos.length,
      };
    });
  }, []);

  return (
    <section className="space-y-4 px-3 pb-28 pt-3">
      <div className="rounded-2xl border bg-white p-4 shadow-lg">
        <button
          type="button"
          onClick={handleToggleFilterPanel}
          className="flex w-full justify-between text-left"
        >
          <span className="font-bold">
            地點清單 ({visiblePlaces.length})
            {hasActiveFilters ? " · 已篩選" : ""}
          </span>

          <span>{isFilterOpen ? "▲" : "▼"}</span>
        </button>

        {isFilterOpen ? (
          <div className="mt-3 space-y-3">
            <button type="button" onClick={() => onFiltersChange({ ...filters, suitableNow: !filters.suitableNow })} className={`rounded-full px-3 py-2 text-xs font-bold ${filters.suitableNow ? "bg-amber-400" : "bg-slate-100"}`}>✨ 現在適合去</button>
            <input
              value={filters.keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              placeholder="搜尋地點、地址、筆記..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            <div className="flex flex-wrap gap-1">
              {ratingOptions.map((star) => {
                const active = selectedRatings.includes(star);

                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleMinRatingChange(star)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
                      active ? "bg-red-500 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                    title={`${star} - ${getRatingLabel(star)}`}
                  >
                    <span>{star === 0 ? "♡" : "♥"}</span>
                    <span>{star}</span>
                  </button>
                );
              })}
            </div>

            {visibleTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {visibleTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className={`rounded-full px-2 py-1 text-xs ${
                      selectedTags.includes(tag)
                        ? "bg-black text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {visiblePlaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          沒有符合條件的地點。
        </div>
      ) : (
        visiblePlaces.map((place) => (
          <PlaceCard
            key={place.id}
            place={place}
            onOpenDetail={() => handleOpenDetail(place.id)}
            onEditPlace={onEditPlace}
            onDeletePlace={onDeletePlace}
            onAddVisit={onAddVisit}
            onCopyPlace={handleOpenCopyModal}
          />
        ))
      )}

      {detailPlace ? (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 px-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-3"
          onClick={handleCloseDetail}
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold">{detailPlace.name}</h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {detailPlace.address}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-500"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">

                  <div className="flex items-center gap-0.5 text-sm">
                    {renderRating(detailPlace.rating)}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {detailPlace.tags?.length > 0 ? (
                      detailPlace.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-600"
                        >
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">無標籤</span>
                    )}
                  </div>
                </div>

                {detailTimingInfo.hasTiming ? (
                  <div
                    className={`mt-2 rounded-xl px-2 py-1.5 text-xs font-semibold ${
                      detailTimingInfo.isActive
                        ? "bg-amber-50 text-amber-700"
                        : "bg-white text-slate-500"
                    }`}
                  >
                    {detailTimingInfo.detailText}
                  </div>
                ) : null}

                <div className="mt-2 max-h-16 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">
                  {detailPlace.notes || "沒有地點筆記"}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartNavigation(detailPlace)}
                    className="rounded-xl bg-blue-500 px-3 py-2.5 text-xs font-bold text-white"
                  >
                    🚕 立刻出發
                  </button>

                  <button
                    type="button"
                    onClick={() => onEditPlace(detailPlace)}
                    className="rounded-xl bg-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700"
                  >
                    📝 編輯地點
                  </button>

                  <button
                    type="button"
                    onClick={() => onAddVisit(detailPlace)}
                    className="rounded-xl bg-orange-500 px-3 py-2.5 text-xs font-bold text-white"
                  >
                    ＋ 新增回憶
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenCopyModal(detailPlace)}
                    className="rounded-xl bg-emerald-100 px-3 py-2.5 text-xs font-bold text-emerald-700"
                  >
                    📋 複製地點
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <h3 className="mb-3 text-base font-bold text-slate-900">
                  回憶時間軸
                </h3>

                {sortedVisits.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                    還沒有回憶紀錄
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sortedVisits.map((visit) => {
                      const photos = Array.isArray(visit.photos)
                        ? visit.photos
                        : [];
                      const visiblePhotos = photos.slice(
                        0,
                        TIMELINE_PHOTO_LIMIT
                      );
                      const hiddenPhotoCount = Math.max(
                        0,
                        photos.length - TIMELINE_PHOTO_LIMIT
                      );

                      return (
                        <div
                          key={visit.id}
                          className="relative grid h-36 grid-cols-[1.35fr_1fr] gap-3 rounded-2xl border bg-white p-3 shadow-sm"
                        >
                          <div className="absolute right-2 top-2 z-10 flex gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                onEditVisit(detailPlace.id, visit.id)
                              }
                              className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700"
                            >
                              📝
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onDeleteVisit(detailPlace.id, visit.id)
                              }
                              className="rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-600"
                            >
                              🗑️
                            </button>
                          </div>

                          <div className="min-w-0 pr-12">
                            <div className="flex items-center gap-2">
                              <div className="shrink-0 text-sm font-bold text-slate-900">
                                {formatDate(visit.visitDate)}
                              </div>

                              <div className="flex items-center gap-0.5 text-xs">
                                {renderRating(visit.rating)}
                              </div>
                            </div>

                            <div className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-sm leading-5 text-slate-700">
                              {visit.note || "沒有文字紀錄"}
                            </div>
                          </div>

                          <div className="grid h-20 grid-cols-2 gap-2 self-center">
                            {visiblePhotos.map((photo, index) => (
                              <button
                                key={`${photo}-${index}`}
                                type="button"
                                onClick={() =>
                                  handleOpenPhotoPreview(photos, index)
                                }
                                className="relative h-20 overflow-hidden rounded-xl"
                              >
                                <img
                                  src={photo}
                                  alt={`visit-photo-${index + 1}`}
                                  className="h-full w-full object-cover"
                                />

                                {index === 1 && hiddenPhotoCount > 0 ? (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-bold text-white">
                                    +{hiddenPhotoCount}
                                  </div>
                                ) : null}
                              </button>
                            ))}

                            {visiblePhotos.length === 0 ? (
                              <>
                                <div className="flex h-20 items-center justify-center rounded-xl bg-slate-100 text-[10px] text-slate-400">
                                  無照片
                                </div>
                                <div className="flex h-20 items-center justify-center rounded-xl bg-slate-100 text-[10px] text-slate-400">
                                  無照片
                                </div>
                              </>
                            ) : null}

                            {visiblePhotos.length === 1 ? (
                              <div className="flex h-20 items-center justify-center rounded-xl bg-slate-100 text-[10px] text-slate-400">
                                無照片
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {copyModal ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 px-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-3"
          onClick={copyModal.isCopying ? undefined : handleCloseCopyModal}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900">
                  複製到其他群組
                </h2>

                <p className="mt-1 truncate text-sm text-slate-500">
                  {copyModal.place.name}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseCopyModal}
                disabled={copyModal.isCopying}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-500 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-800">
                  目標地圖群
                </span>

                <select
                  value={copyModal.selectedGroupId}
                  onChange={(event) =>
                    setCopyModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            selectedGroupId: event.target.value,
                          }
                        : prev
                    )
                  }
                  disabled={copyModal.isCopying}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                >
                  {availableCopyTargetGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                會複製地點資訊、照片、標籤、筆記與適合期間；不會複製回憶紀錄與拜訪次數。
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCloseCopyModal}
                  disabled={copyModal.isCopying}
                  className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-50"
                >
                  取消
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCopy}
                  disabled={copyModal.isCopying}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:bg-slate-400"
                >
                  {copyModal.isCopying ? "複製中..." : "確認複製"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {photoPreview ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4"
          onClick={handleClosePhotoPreview}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-5xl items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleClosePhotoPreview}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/60 px-3 py-1.5 text-sm font-bold text-white"
            >
              ✕
            </button>

            {photoPreview.photos.length > 1 ? (
              <button
                type="button"
                onClick={showPrevPhoto}
                className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl font-bold text-white"
              >
                ‹
              </button>
            ) : null}

            <img
              src={photoPreview.photos[photoPreview.index]}
              alt={`preview-${photoPreview.index + 1}`}
              className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain"
            />

            {photoPreview.photos.length > 1 ? (
              <button
                type="button"
                onClick={showNextPhoto}
                className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl font-bold text-white"
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
    </section>
  );
}
