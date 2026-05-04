"use client";

import { openGoogleMapsDirections } from "@/lib/navigation";
import type { PlaceItem, PlaceStatus } from "@/lib/places";
import { RATING_OPTIONS, STATUS_LABELS } from "@/lib/places";

export type PlaceFilters = {
  keyword: string;
  status: "all" | PlaceStatus;
  minRating: number | "all";
  tag: string;
};

type PlaceListViewProps = {
  places: PlaceItem[];
  filters: PlaceFilters;
  availableTags: string[];
  onFiltersChange: (next: PlaceFilters) => void;
  onEditPlace: (place: PlaceItem) => void;
  onDeletePlace: (placeId: string) => void;
};

export function PlaceListView({
  places,
  filters,
  availableTags,
  onFiltersChange,
  onEditPlace,
  onDeletePlace,
}: PlaceListViewProps) {
  const handleStartNavigation = (place: PlaceItem) => {
    const hasNavigationInfo = openGoogleMapsDirections(place);
    if (!hasNavigationInfo) {
      window.alert("此地點尚未設定導航資訊");
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">篩選條件</h2>
        <div className="grid gap-3">
          <input
            value={filters.keyword}
            onChange={(event) =>
              onFiltersChange({ ...filters, keyword: event.target.value })
            }
            placeholder="搜尋名稱、地址、筆記..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={filters.status}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  status: event.target.value as PlaceFilters["status"],
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">全部狀態</option>
              <option value="wantToGo">{STATUS_LABELS.wantToGo}</option>
              <option value="visited">{STATUS_LABELS.visited}</option>
            </select>

            <select
              value={String(filters.minRating)}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  minRating:
                    event.target.value === "all"
                      ? "all"
                      : Number(event.target.value),
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">喜歡程度全部</option>
              {RATING_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} 以上
                </option>
              ))}
            </select>
          </div>

          <select
            value={filters.tag}
            onChange={(event) =>
              onFiltersChange({ ...filters, tag: event.target.value })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">全部標籤</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {places.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            沒有符合條件的地點。
          </div>
        ) : (
          places.map((place) => (
            <article
              key={place.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{place.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{place.address}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {STATUS_LABELS[place.status]}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                喜歡程度：{place.rating}
              </p>
              <p className="mt-2 text-sm text-slate-600">{place.notes || "無筆記"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {place.tags.length > 0 ? (
                  place.tags.map((tag) => (
                    <span
                      key={`${place.id}-${tag}`}
                      className="rounded-full bg-orange-100 px-2 py-1 text-xs text-orange-700"
                    >
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">無標籤</span>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleStartNavigation(place)}
                  className="rounded-md bg-orange-500 px-3 py-2 text-sm text-white"
                >
                  出發
                </button>
                <button
                  type="button"
                  onClick={() => onEditPlace(place)}
                  className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700"
                >
                  編輯
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePlace(place.id)}
                  className="rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-700"
                >
                  刪除
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
