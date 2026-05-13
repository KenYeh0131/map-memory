"use client";

import { useCallback, useMemo, useState } from "react";
import { openGoogleMapsDirections } from "@/lib/navigation";
import type { PlaceItem, PlaceStatus } from "@/lib/places";

export type PlaceFilters = {
  keyword: string;
  status: "all" | PlaceStatus;
  minRating: number | "all";
  tags: string[];
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
};

type PhotoPreviewState = {
  photos: string[];
  index: number;
} | null;

const RATING_CHIPS = [0, 1, 2, 3, 4, 5] as const;
const TIMELINE_PHOTO_LIMIT = 3;

function formatDate(dateText?: string) {
  if (!dateText) return "";
  return dateText.replaceAll("-", "/");
}

function getStatusInfo(status: PlaceStatus | string | undefined) {
  if (status === "wantToReturn" || status === "visited") {
    return {
      label: "✨ 還想去",
      className: "bg-orange-100 text-orange-600",
      emptyEmoji: "💖",
      emptyText: "一定還要再來",
    };
  }

  if (status === "memory") {
    return {
      label: "🫧 回憶中",
      className: "bg-slate-200 text-slate-600",
      emptyEmoji: "🤍",
      emptyText: "留在回憶裡",
    };
  }

  return {
    label: "♥ 想去",
    className: "bg-red-100 text-red-600",
    emptyEmoji: "🥺",
    emptyText: "好想去~",
  };
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
}: PlaceListViewProps) {
  const [detailPlaceId, setDetailPlaceId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreviewState>(null);

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

  const sortedVisits = useMemo(() => {
    if (!detailPlace?.visits) return [];

    return [...detailPlace.visits].sort((a, b) =>
      b.visitDate.localeCompare(a.visitDate)
    );
  }, [detailPlace?.visits]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.keyword.trim().length > 0 ||
      filters.status !== "all" ||
      filters.minRating !== "all" ||
      selectedTags.length > 0
    );
  }, [filters.keyword, filters.status, filters.minRating, selectedTags.length]);

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

  const handleStatusChange = useCallback(
    (status: "all" | PlaceStatus) => {
      updateFilters({
        ...filters,
        status: filters.status === status ? "all" : status,
      });
    },
    [filters, updateFilters]
  );

  const handleMinRatingChange = useCallback(
    (rating: number) => {
      updateFilters({
        ...filters,
        minRating: filters.minRating === rating ? "all" : rating,
      });
    },
    [filters, updateFilters]
  );

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
    <section className="space-y-4 px-4 pb-28 pt-3">
      <div className="rounded-2xl border bg-white p-4 shadow-lg">
        <button
          type="button"
          onClick={handleToggleFilterPanel}
          className="flex w-full justify-between text-left"
        >
          <span className="font-bold">
            地點清單 ({places.length})
            {hasActiveFilters ? " · 已篩選" : ""}
          </span>

          <span>{isFilterOpen ? "▲" : "▼"}</span>
        </button>

        {isFilterOpen ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange("wantToGo")}
                className={`rounded-xl px-2 py-2 text-xs font-bold ${
                  filters.status === "wantToGo"
                    ? "bg-red-100 text-red-600"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                ♥ 想去
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange("wantToReturn")}
                className={`rounded-xl px-2 py-2 text-xs font-bold ${
                  filters.status === "wantToReturn"
                    ? "bg-orange-100 text-orange-600"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                ✨ 還想再去
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange("memory")}
                className={`rounded-xl px-2 py-2 text-xs font-bold ${
                  filters.status === "memory"
                    ? "bg-slate-300 text-slate-700"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                🫧 打卡完成
              </button>
            </div>

            <input
              value={filters.keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              placeholder="搜尋地點、地址、筆記..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            <div className="flex flex-wrap gap-1">
              {ratingOptions.map((star) => {
                const active = filters.minRating === star;

                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleMinRatingChange(star)}
                    className={`rounded-full px-2 py-1 text-xs ${
                      active ? "bg-red-500 text-white" : "bg-slate-200"
                    }`}
                  >
                    {star}♥
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

      {places.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          沒有符合條件的地點。
        </div>
      ) : (
        places.map((place) => {
          const coverIndex = place.coverPhotoIndex ?? 0;
          const coverPhoto = place.photos?.[coverIndex] ?? place.photos?.[0];
          const statusInfo = getStatusInfo(place.status);
          const lastVisitedText = formatDate(place.lastVisitedAt);

          return (
            <article
              key={place.id}
              onClick={() => handleOpenDetail(place.id)}
              className="cursor-pointer overflow-hidden rounded-2xl bg-white shadow"
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
                    <div className="flex h-full w-full flex-col items-center justify-center text-center">
                      <div className="text-4xl">{statusInfo.emptyEmoji}</div>

                      <div className="mt-2 text-xs font-bold text-slate-500">
                        {statusInfo.emptyText}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-slate-900">
                        {place.name}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {place.address}
                      </p>
                    </div>

                    <div
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${statusInfo.className}`}
                    >
                      {statusInfo.label}
                    </div>
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

                  <div className="mt-2 flex items-center gap-0.5">
                    {renderRating(place.rating)}
                  </div>

                  <div className="mt-auto grid grid-cols-4 gap-2 pt-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartNavigation(place);
                      }}
                      className="rounded-xl bg-blue-500 px-2 py-2 text-xs font-bold text-white"
                    >
                      🚕
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddVisit(place);
                      }}
                      className="rounded-xl bg-orange-500 px-2 py-2 text-xs font-bold text-white"
                    >
                      ＋
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditPlace(place);
                      }}
                      className="rounded-xl bg-slate-200 px-2 py-2 text-xs font-bold text-slate-700"
                    >
                      📝
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();

                        if (confirm("確定刪除？")) {
                          onDeletePlace(place.id);
                        }
                      }}
                      className="rounded-xl bg-rose-100 px-2 py-2 text-xs font-bold text-rose-600"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })
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

              <div className="mt-6">
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
                      const visiblePhotos = photos.slice(0, TIMELINE_PHOTO_LIMIT);
                      const hiddenPhotoCount = Math.max(
                        0,
                        photos.length - TIMELINE_PHOTO_LIMIT
                      );

                      return (
                        <div
                          key={visit.id}
                          className="relative h-56 overflow-hidden rounded-2xl border bg-white p-3 shadow-sm"
                        >
                          <div className="absolute right-2 top-2 flex gap-1">
                            <button
                              type="button"
                              onClick={() => onEditVisit(detailPlace.id, visit.id)}
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

                          <div className="flex items-center gap-2 pr-20">
                            <div className="shrink-0 text-sm font-bold text-slate-900">
                              {formatDate(visit.visitDate)}
                            </div>

                            <div className="flex items-center gap-0.5 text-sm">
                              {renderRating(visit.rating)}
                            </div>
                          </div>

                          <div className="mt-2 h-12 overflow-hidden whitespace-pre-wrap text-sm text-slate-700">
                            {visit.note || "沒有文字紀錄"}
                          </div>

                          {photos.length > 0 ? (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              {visiblePhotos.map((photo, index) => (
                                <button
                                  key={`${photo}-${index}`}
                                  type="button"
                                  onClick={() =>
                                    handleOpenPhotoPreview(photos, index)
                                  }
                                  className="relative h-24 overflow-hidden rounded-xl"
                                >
                                  <img
                                    src={photo}
                                    alt={`visit-photo-${index + 1}`}
                                    className="h-full w-full object-cover"
                                  />

                                  {index === TIMELINE_PHOTO_LIMIT - 1 &&
                                  hiddenPhotoCount > 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-bold text-white">
                                      +{hiddenPhotoCount}
                                    </div>
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3 flex h-24 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
                              沒有照片
                            </div>
                          )}
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
