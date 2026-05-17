"use client";

import { useCallback, useMemo, useState } from "react";
import { openGoogleMapsDirections } from "@/lib/navigation";
import type { PlaceItem } from "@/lib/places";

type TimelineViewProps = {
  places: PlaceItem[];
  availableTags: string[];
  onAddVisit: (place: PlaceItem) => void;
  onEditVisit: (placeId: string, visitId: string) => void;
  onDeleteVisit: (placeId: string, visitId: string) => void;
};

type TimelineItem = {
  place: PlaceItem;
  visit: NonNullable<PlaceItem["visits"]>[number];
};

type PhotoPreviewState = {
  photos: string[];
  index: number;
} | null;

const MONTH_OPTIONS = [
  { value: "all", label: "全部月份" },
  { value: "01", label: "1月" },
  { value: "02", label: "2月" },
  { value: "03", label: "3月" },
  { value: "04", label: "4月" },
  { value: "05", label: "5月" },
  { value: "06", label: "6月" },
  { value: "07", label: "7月" },
  { value: "08", label: "8月" },
  { value: "09", label: "9月" },
  { value: "10", label: "10月" },
  { value: "11", label: "11月" },
  { value: "12", label: "12月" },
] as const;

const PHOTO_LIMIT = 2;

function formatDate(dateText?: string) {
  if (!dateText) return "";
  return dateText.replaceAll("-", "/");
}

function renderRating(rating?: number) {
  return Array.from({ length: 5 }).map((_, index) => (
    <span
      key={index}
      className={index < (rating ?? 0) ? "text-red-500" : "text-slate-300"}
    >
      ♥
    </span>
  ));
}

function buildTimelineItems(places: PlaceItem[]): TimelineItem[] {
  return places.flatMap((place) => {
    const visits = Array.isArray(place.visits) ? place.visits : [];

    return visits.map((visit) => ({
      place,
      visit,
    }));
  });
}

function getVisitMonth(visitDate?: string) {
  if (!visitDate || visitDate.length < 7) return "";
  return visitDate.slice(5, 7);
}

export function TimelineView({
  places,
  availableTags,
  onAddVisit,
  onEditVisit,
  onDeleteVisit,
}: TimelineViewProps) {
  const [keyword, setKeyword] = useState("");
  const [month, setMonth] = useState<string>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreviewState>(null);

  const visibleTags = useMemo(() => {
    return Array.isArray(availableTags)
      ? [...availableTags].sort((a, b) => a.localeCompare(b))
      : [];
  }, [availableTags]);

  const timelineItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const allItems = buildTimelineItems(places);

    return allItems
      .filter(({ place, visit }) => {
        if (month !== "all" && getVisitMonth(visit.visitDate) !== month) {
          return false;
        }

        if (selectedTags.length > 0) {
          const placeTags = Array.isArray(place.tags) ? place.tags : [];
          const matchedTag = selectedTags.some((tag) => placeTags.includes(tag));

          if (!matchedTag) return false;
        }

        if (q.length > 0) {
          const matchedKeyword =
            place.name.toLowerCase().includes(q) ||
            place.address.toLowerCase().includes(q) ||
            place.notes.toLowerCase().includes(q) ||
            (visit.note ?? "").toLowerCase().includes(q);

          if (!matchedKeyword) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateCompare = b.visit.visitDate.localeCompare(a.visit.visitDate);

        if (dateCompare !== 0) return dateCompare;

        return b.visit.createdAt.localeCompare(a.visit.createdAt);
      });
  }, [keyword, month, places, selectedTags]);

  const hasActiveFilters =
    keyword.trim().length > 0 || month !== "all" || selectedTags.length > 0;

  const groupedTimelineItems = useMemo(() => {
    const groups = new Map<string, TimelineItem[]>();

    timelineItems.forEach((item) => {
      const groupDate = item.visit.visitDate || "未設定日期";
      const currentItems = groups.get(groupDate) ?? [];

      currentItems.push(item);
      groups.set(groupDate, currentItems);
    });

    return Array.from(groups.entries());
  }, [timelineItems]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setKeyword("");
    setMonth("all");
    setSelectedTags([]);
  }, []);

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

  const handleStartNavigation = useCallback((place: PlaceItem) => {
    const ok = openGoogleMapsDirections(place);

    if (!ok) {
      alert("未設定導航資訊");
    }
  }, []);

  return (
    <section className="space-y-4 px-4 pb-28 pt-3">
      <div className="rounded-2xl border bg-white p-4 shadow-lg">
        <button
          type="button"
          onClick={() => setIsFilterOpen((open) => !open)}
          className="flex w-full justify-between text-left"
        >
          <span className="font-bold">
            回憶時間軸 ({timelineItems.length})
            {hasActiveFilters ? " · 已篩選" : ""}
          </span>

          <span>{isFilterOpen ? "▲" : "▼"}</span>
        </button>

        {isFilterOpen ? (
          <div className="mt-3 space-y-3">
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜尋地點、地址、地點筆記、回憶文字..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {visibleTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {visibleTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-2 py-1 text-xs ${
                      selectedTags.includes(tag)
                        ? "bg-black text-white"
                        : "bg-gray-200 text-slate-700"
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            ) : null}

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="w-full rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
              >
                清除篩選
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {timelineItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          目前沒有符合條件的回憶。
        </div>
      ) : (
        <div className="space-y-5">
          {groupedTimelineItems.map(([date, items]) => (
            <div key={date} className="space-y-3">
              <div className="sticky top-2 z-10 inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white shadow">
                {formatDate(date)}
              </div>

              {items.map(({ place, visit }) => {
                const photos = Array.isArray(visit.photos) ? visit.photos : [];
                const visiblePhotos = photos.slice(0, PHOTO_LIMIT);
                const hiddenPhotoCount = Math.max(0, photos.length - PHOTO_LIMIT);
                const coverIndex = place.coverPhotoIndex ?? 0;
                const coverPhoto = place.photos?.[coverIndex] ?? place.photos?.[0];

                return (
                  <article
                    key={`${place.id}-${visit.id}`}
                    className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                  >
                    <div className="flex gap-3 p-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                        {coverPhoto ? (
                          <img
                            src={coverPhoto}
                            alt={place.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-3xl">
                            ♥
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-bold text-slate-900">
                              {place.name}
                            </h3>

                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {place.address}
                            </p>
                          </div>

                          <div className="shrink-0 text-xs font-bold text-slate-600">
                            {formatDate(visit.visitDate)}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-0.5 text-xs">
                          {renderRating(visit.rating)}
                        </div>

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
                            <span className="text-[10px] text-slate-400">
                              無標籤
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 px-3 py-3">
                      <div className="grid grid-cols-[1.35fr_1fr] gap-3">
                        <div className="min-w-0">
                          <div className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-sm leading-5 text-slate-700">
                            {visit.note || "沒有文字紀錄"}
                          </div>
                        </div>

                        <div className="grid h-24 grid-cols-2 gap-2 self-center">
                          {visiblePhotos.map((photo, index) => (
                            <button
                              key={`${photo}-${index}`}
                              type="button"
                              onClick={() => handleOpenPhotoPreview(photos, index)}
                              className="relative h-24 overflow-hidden rounded-xl"
                            >
                              <img
                                src={photo}
                                alt={`timeline-photo-${index + 1}`}
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
                              <div className="flex h-24 items-center justify-center rounded-xl bg-slate-100 text-[10px] text-slate-400">
                                無照片
                              </div>
                              <div className="flex h-24 items-center justify-center rounded-xl bg-slate-100 text-[10px] text-slate-400">
                                無照片
                              </div>
                            </>
                          ) : null}

                          {visiblePhotos.length === 1 ? (
                            <div className="flex h-24 items-center justify-center rounded-xl bg-slate-100 text-[10px] text-slate-400">
                              無照片
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartNavigation(place)}
                          className="rounded-xl bg-blue-500 px-2 py-2 text-xs font-bold text-white"
                        >
                          🚕 出發
                        </button>

                        <button
                          type="button"
                          onClick={() => onAddVisit(place)}
                          className="rounded-xl bg-orange-500 px-2 py-2 text-xs font-bold text-white"
                        >
                          ＋回憶
                        </button>

                        <button
                          type="button"
                          onClick={() => onEditVisit(place.id, visit.id)}
                          className="rounded-xl bg-slate-200 px-2 py-2 text-xs font-bold text-slate-700"
                        >
                          📝 編輯
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteVisit(place.id, visit.id)}
                          className="rounded-xl bg-rose-100 px-2 py-2 text-xs font-bold text-rose-600"
                        >
                          🗑️ 刪除
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {photoPreview ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4"
          onClick={handleClosePhotoPreview}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-5xl items-center justify-center"
            onClick={(event) => event.stopPropagation()}
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
