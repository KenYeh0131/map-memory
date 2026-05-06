"use client";

import { useState } from "react";
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
};

function formatDate(dateText?: string) {
  if (!dateText) return "";
  return dateText.replaceAll("-", "/");
}

export function PlaceListView({
  places,
  filters,
  availableTags,
  onFiltersChange,
  onEditPlace,
  onDeletePlace,
}: PlaceListViewProps) {
  const [detailPlace, setDetailPlace] = useState<PlaceItem | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const selectedTags = Array.isArray(filters.tags) ? filters.tags : [];

  const toggleTag = (tag: string) => {
    onFiltersChange({
      ...filters,
      tags: selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag],
    });
  };

  const handleStartNavigation = (place: PlaceItem) => {
    const ok = openGoogleMapsDirections(place);

    if (!ok) {
      alert("未設定導航資訊");
    }
  };

  return (
    <section className="space-y-4 px-4 pb-28 pt-3">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="flex w-full justify-between text-left"
        >
          <span className="font-bold">
            地點清單 ({places.length})
          </span>

          <span>{isFilterOpen ? "▲" : "▼"}</span>
        </button>

        {isFilterOpen && (
          <div className="mt-3 space-y-2">
            <input
              value={filters.keyword}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  keyword: e.target.value,
                })
              }
              placeholder="搜尋..."
              className="w-full rounded border px-3 py-2"
            />

            <select
              value={filters.status}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  status: e.target.value as PlaceFilters["status"],
                })
              }
              className="w-full rounded border px-3 py-2"
            >
              <option value="all">全部</option>
              <option value="wantToGo">想去</option>
              <option value="visited">我們完成了</option>
            </select>

            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
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
          </div>
        )}
      </div>

      {places.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          沒有符合條件的地點。
        </div>
      ) : (
        places.map((place) => {
          const coverIndex = place.coverPhotoIndex ?? 0;

          const coverPhoto =
            place.photos?.[coverIndex] ??
            place.photos?.[0];

          const isCompleted = place.status === "visited";

          const completedDateText = formatDate(place.completedDate);

          return (
            <article
              key={place.id}
              onClick={() => setDetailPlace(place)}
              className="cursor-pointer overflow-hidden rounded-2xl bg-white shadow"
            >
              <div className="flex items-stretch">
                {/* 左側封面 */}
                <div className="w-32 shrink-0 overflow-hidden bg-slate-100">
                  {coverPhoto ? (
                    <img
                      src={coverPhoto}
                      alt={place.name}
                      className="h-full w-full object-cover"
                    />
                  ) : isCompleted ? (
                    <div className="flex h-full items-center justify-center text-4xl">
                      ♡
                    </div>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-orange-50 text-center">
                      <div className="text-4xl">🥺</div>

                      <div className="mt-2 text-xs font-bold text-orange-500">
                        好想去~
                      </div>
                    </div>
                  )}
                </div>

                {/* 右側內容 */}
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
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                        isCompleted
                          ? "bg-red-100 text-red-600"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {isCompleted ? "♡ 完成" : "♥ 想去"}
                    </div>
                  </div>

                  {/* 標籤 */}
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

                  {/* 喜歡程度 + 完成日期 */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const active = i < place.rating;

                        return (
                          <span
                            key={i}
                            className={
                              active
                                ? "text-red-500"
                                : "text-gray-300"
                            }
                          >
                            ♥
                          </span>
                        );
                      })}
                    </div>

                    {isCompleted && completedDateText ? (
                      <span className="text-[11px] font-semibold text-red-500">
                        {completedDateText}
                      </span>
                    ) : null}
                  </div>

                  {/* 按鈕 */}
                  <div className="mt-auto flex gap-2 pt-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartNavigation(place);
                      }}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-500 px-2 py-2 text-xs font-bold text-white"
                    >
                      <span className="relative flex items-center self-center">
                        <span className="relative -top-[1px] text-2xl leading-none">
                          🚕
                        </span>

                        <span className="ml-1 mt-2 text-sm tracking-tight text-white/70">
                          ~
                        </span>
                      </span>

                      <span>出發</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditPlace(place);
                      }}
                      className="rounded-xl bg-slate-200 px-3 py-2 text-lg font-bold"
                      aria-label="編輯"
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
                      className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold text-rose-600"
                      aria-label="刪除"
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

      {/* 詳細視窗 */}
      {detailPlace && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 px-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-3"
          onClick={() => setDetailPlace(null)}
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {detailPlace.photos?.length > 0 ? (
              <img
                src={
                  detailPlace.photos[
                    detailPlace.coverPhotoIndex ?? 0
                  ] ?? detailPlace.photos[0]
                }
                alt={detailPlace.name}
                className="h-56 w-full object-cover"
              />
            ) : detailPlace.status === "wantToGo" ? (
              <div className="flex h-56 w-full flex-col items-center justify-center bg-orange-50">
                <div className="text-6xl">🥺</div>

                <div className="mt-3 text-lg font-bold text-orange-500">
                  好想去~
                </div>
              </div>
            ) : null}

            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold">
                    {detailPlace.name}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {detailPlace.address}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailPlace(null)}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-500"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    detailPlace.status === "visited"
                      ? "bg-red-100 text-red-600"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {detailPlace.status === "visited"
                    ? "♡ 我們完成了"
                    : "♥ 想去"}
                </span>

                {detailPlace.status === "visited" &&
                detailPlace.completedDate ? (
                  <span className="text-xs font-semibold text-red-500">
                    完成日：
                    {formatDate(detailPlace.completedDate)}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {detailPlace.tags?.length > 0 ? (
                  detailPlace.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2 py-1 text-xs"
                    >
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">
                    無標籤
                  </span>
                )}
              </div>

              <div className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
                {detailPlace.notes || "沒有筆記"}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStartNavigation(detailPlace)}
                  className="flex items-center justify-center gap-1 rounded-xl bg-blue-500 px-3 py-3 text-sm font-bold text-white"
                >
                  <span className="relative flex items-center self-center">
                    <span className="relative -top-[1px] text-2xl leading-none">
                      🚕
                    </span>

                    <span className="ml-1 mt-2 text-sm tracking-tight text-white/70">
                      ~
                    </span>
                  </span>

                  <span>出發</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDetailPlace(null);
                    onEditPlace(detailPlace);
                  }}
                  className="rounded-xl bg-slate-200 px-3 py-3 text-sm font-bold"
                >
                  📝 編輯
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}