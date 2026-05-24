"use client";

import { useCallback, useMemo, useState } from "react";
import type { PlaceItem } from "@/lib/places";

type TimelineViewProps = {
  places: PlaceItem[];
  availableTags: string[];
  currentDeviceId: string;
  onEditVisit: (placeId: string, visitId: string) => void;
  onDeleteVisit: (placeId: string, visitId: string) => void;
  onReorderVisits: (
    visitDate: string,
    orderedItems: { placeId: string; visitId: string }[],
  ) => void | Promise<void>;
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

function formatDotDate(dateText?: string) {
  if (!dateText) return "";
  return dateText.replaceAll("-", ".");
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

function getVisitKey(item: TimelineItem) {
  return `${item.place.id}__${item.visit.id}`;
}

function getVisitSortValue(item: TimelineItem, fallbackIndex: number) {
  const sortOrder = item.visit.sortOrder;

  if (typeof sortOrder === "number" && Number.isFinite(sortOrder)) {
    return sortOrder;
  }

  return fallbackIndex;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [target] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, target);
  return nextItems;
}

export function TimelineView({
  places,
  availableTags,
  currentDeviceId,
  onEditVisit,
  onDeleteVisit,
  onReorderVisits,
}: TimelineViewProps) {
  const [keyword, setKeyword] = useState("");
  const [month, setMonth] = useState<string>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreviewState>(null);
  const [movingVisitKey, setMovingVisitKey] = useState<string | null>(null);

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
            (visit.note ?? "").toLowerCase().includes(q) ||
            (visit.authorName ?? "").toLowerCase().includes(q) ||
            (Array.isArray(visit.memoryNotes)
              ? visit.memoryNotes.some(
                  (memoryNote) =>
                    (memoryNote.text ?? "").toLowerCase().includes(q) ||
                    (memoryNote.authorName ?? "").toLowerCase().includes(q),
                )
              : false);

          if (!matchedKeyword) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateCompare = b.visit.visitDate.localeCompare(a.visit.visitDate);

        if (dateCompare !== 0) return dateCompare;

        const sortCompare = getVisitSortValue(a, 0) - getVisitSortValue(b, 0);

        if (sortCompare !== 0) return sortCompare;

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

    return Array.from(groups.entries()).map(([date, items]) => [
      date,
      items.map((item, index) => ({ item, fallbackIndex: index })),
    ] as const);
  }, [timelineItems]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
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

  const handleMoveVisit = useCallback(
    async (
      visitDate: string,
      items: TimelineItem[],
      currentIndex: number,
      direction: "up" | "down",
    ) => {
      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex < 0 || nextIndex >= items.length) return;

      const movingItem = items[currentIndex];
      const movingKey = getVisitKey(movingItem);
      const nextItems = moveItem(items, currentIndex, nextIndex);

      setMovingVisitKey(movingKey);

      try {
        await onReorderVisits(
          visitDate,
          nextItems.map((item) => ({
            placeId: item.place.id,
            visitId: item.visit.id,
          })),
        );
      } finally {
        setMovingVisitKey(null);
      }
    },
    [onReorderVisits],
  );

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
              placeholder="搜尋地點、地址、填寫者、回憶文字..."
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
        <div className="space-y-6">
          {groupedTimelineItems.map(([date, wrappedItems]) => {
            const items = wrappedItems.map(({ item }) => item);

            return (
              <div key={date} className="space-y-3">
                <div className="sticky top-2 z-10 flex items-center justify-center gap-3 py-1">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-200 to-orange-300" />
                  <div className="rounded-full bg-gradient-to-r from-orange-400 to-rose-400 px-4 py-1.5 text-xs font-black text-white shadow-lg shadow-orange-200/70 ring-4 ring-white">
                    ✨ {formatDate(date)} ✨
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-orange-200 to-orange-300" />
                </div>

                {wrappedItems.map(({ item: { place, visit } }, index) => {
                  const item: TimelineItem = { place, visit };
                  const visitKey = getVisitKey(item);
                  const photos = Array.isArray(visit.photos) ? visit.photos : [];
                  const visiblePhotos = photos.slice(0, PHOTO_LIMIT);
                  const hiddenPhotoCount = Math.max(0, photos.length - PHOTO_LIMIT);
                  const coverIndex = place.coverPhotoIndex ?? 0;
                  const coverPhoto = place.photos?.[coverIndex] ?? place.photos?.[0];
                  const rawMemoryNotes = Array.isArray(visit.memoryNotes)
                    ? visit.memoryNotes
                    : [];
                  const displayMemoryNotes =
                    rawMemoryNotes.length > 0
                      ? rawMemoryNotes
                      : visit.note?.trim()
                        ? [
                            {
                              id: "legacy-note",
                              noteDate: visit.visitDate,
                              text: visit.note,
                              authorName: visit.authorName,
                              authorDeviceId: visit.authorDeviceId,
                              createdAt: visit.createdAt,
                            },
                          ]
                        : [];
                  const isFirst = index === 0;
                  const isLast = index === wrappedItems.length - 1;
                  const isMoving = movingVisitKey === visitKey;
                  const canDeleteVisit =
                    Boolean(visit.authorDeviceId) &&
                    visit.authorDeviceId === currentDeviceId;

                  return (
                    <article
                      key={visitKey}
                      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                        isMoving ? "scale-[0.99] opacity-60" : ""
                      }`}
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
                            <div className="flex h-full w-full items-center justify-center text-3xl text-red-500">
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

                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveVisit(date, items, index, "up")}
                                disabled={isFirst || Boolean(movingVisitKey)}
                                className="rounded-full bg-orange-50 px-2 py-1 text-xs font-black text-orange-600 disabled:bg-slate-100 disabled:text-slate-300"
                                aria-label="上移回憶"
                              >
                                ↑
                              </button>

                              <button
                                type="button"
                                onClick={() => handleMoveVisit(date, items, index, "down")}
                                disabled={isLast || Boolean(movingVisitKey)}
                                className="rounded-full bg-orange-50 px-2 py-1 text-xs font-black text-orange-600 disabled:bg-slate-100 disabled:text-slate-300"
                                aria-label="下移回憶"
                              >
                                ↓
                              </button>
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
                            <div className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-sm leading-5 text-slate-700">
                              {displayMemoryNotes.length > 0 ? (
                                <div className="space-y-1.5">
                                  {displayMemoryNotes.map((memoryNote) => (
                                    <div key={memoryNote.id}>
                                      <span className="font-bold text-slate-900">
                                        {formatDotDate(memoryNote.noteDate || visit.visitDate)} {memoryNote.authorName || "未命名"}：
                                      </span>
                                      {memoryNote.text || "沒有文字紀錄"}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                "沒有文字紀錄"
                              )}
                            </div>
                          </div>

                          <div className="grid h-24 grid-cols-2 gap-2 self-center">
                            {visiblePhotos.map((photo, photoIndex) => (
                              <button
                                key={`${photo}-${photoIndex}`}
                                type="button"
                                onClick={() => handleOpenPhotoPreview(photos, photoIndex)}
                                className="relative h-24 overflow-hidden rounded-xl"
                              >
                                <img
                                  src={photo}
                                  alt={`timeline-photo-${photoIndex + 1}`}
                                  className="h-full w-full object-cover"
                                />

                                {photoIndex === 1 && hiddenPhotoCount > 0 ? (
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

                        <div className={`mt-3 grid gap-2 ${canDeleteVisit ? "grid-cols-2" : "grid-cols-1"}`}>
                          <button
                            type="button"
                            onClick={() => onEditVisit(place.id, visit.id)}
                            className="rounded-xl bg-slate-200 px-2 py-2 text-xs font-bold text-slate-700"
                          >
                            📝 編輯
                          </button>

                          {canDeleteVisit ? (
                            <button
                              type="button"
                              onClick={() => onDeleteVisit(place.id, visit.id)}
                              className="rounded-xl bg-rose-100 px-2 py-2 text-xs font-bold text-rose-600"
                            >
                              🗑️ 刪除
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })}
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
