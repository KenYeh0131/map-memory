"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { openGoogleMapsDirections } from "@/lib/navigation";
import type { PlaceItem } from "@/lib/places";

type MapViewProps = {
  places: PlaceItem[];
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string | null) => void;
  onCreatePlace: () => void;
  onEditPlace: (place: PlaceItem) => void;
};

type MapFilterState = {
  showWant: boolean;
  showCompleted: boolean;
  query: string;
  stars: number[];
  tags: string[];
};

type PhotoPreviewState = {
  photos: string[];
  index: number;
} | null;

const defaultMapFilters: MapFilterState = {
  showWant: true,
  showCompleted: true,
  query: "",
  stars: [],
  tags: [],
};

const RATING_CHIPS = [0, 1, 2, 3, 4, 5] as const;

const GOOGLE_MAP_LIBRARIES: ("places")[] = ["places"];

function formatDate(dateText?: string) {
  if (!dateText) return "";
  return dateText.replaceAll("-", "/");
}

function buildHeartMarkerIcon(
  heart: "♥" | "♡",
  fillHex: string,
  selected: boolean
): google.maps.Icon {
  const dim = selected ? 56 : 48;
  const cx = dim / 2;
  const cy = dim / 2;
  const r = selected ? 23 : 19;
  const stroke = selected ? 3.5 : 3;
  const fontPx = selected ? 30 : 26;
  const textY = cy + fontPx * 0.35;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fillHex}" stroke="#ffffff" stroke-width="${stroke}"/>
    <text x="${cx}" y="${textY}" font-size="${fontPx}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#ffffff">${heart}</text>
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(dim, dim),
    anchor: new google.maps.Point(dim / 2, dim / 2),
  };
}

function markerIconForPlace(
  place: PlaceItem,
  selected: boolean
): google.maps.Icon {
  const want = place.status === "wantToGo";

  return buildHeartMarkerIcon(
    want ? "♥" : "♡",
    want ? "#64748b" : "#ef4444",
    selected
  );
}


export function MapView({
  places,
  selectedPlaceId,
  onSelectPlace,
  onCreatePlace,
  onEditPlace,
}: MapViewProps) {
  const [mapFilters, setMapFilters] =
    useState<MapFilterState>(defaultMapFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoPreviewState>(null);
  const [currentPosition, setCurrentPosition] =
    useState<google.maps.LatLngLiteral | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);

  const selectedPlace =
    places.find((place) => place.id === selectedPlaceId) ?? null;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const { isLoaded, loadError } = useJsApiLoader({
    id: "map-memory-google-script",
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const mapCenter = useMemo(
    () => ({
      lat: 25.033964,
      lng: 121.564468,
    }),
    []
  );

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      zoomControl: false,
      gestureHandling: "greedy",
    }),
    []
  );

  useEffect(() => {
    if (!isLoaded || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        setCurrentPosition(nextPosition);
        mapRef.current?.panTo(nextPosition);
        mapRef.current?.setZoom(14);
      },
      () => {
        console.log("定位失敗");
      }
    );
  }, [isLoaded]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();

    places.forEach((place) => {
      place.tags.forEach((tag) => tags.add(tag));
    });

    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [places]);

  const filteredPlaces = useMemo(() => {
    const q = mapFilters.query.trim().toLowerCase();

    return places.filter((place) => {
      if (place.status === "wantToGo" && !mapFilters.showWant) return false;
      if (place.status === "visited" && !mapFilters.showCompleted) return false;

      if (
        mapFilters.stars.length > 0 &&
        !mapFilters.stars.includes(place.rating)
      ) {
        return false;
      }

      if (
        mapFilters.tags.length > 0 &&
        !mapFilters.tags.some((tag) => place.tags.includes(tag))
      ) {
        return false;
      }

      if (q.length > 0) {
        const match =
          place.name.toLowerCase().includes(q) ||
          place.address.toLowerCase().includes(q) ||
          place.notes.toLowerCase().includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [mapFilters, places]);

  useEffect(() => {
    if (
      selectedPlaceId &&
      !filteredPlaces.some((place) => place.id === selectedPlaceId)
    ) {
      onSelectPlace(null);
    }
  }, [filteredPlaces, onSelectPlace, selectedPlaceId]);

  const markerPositions = useMemo(() => {
    return filteredPlaces.map((place) => ({
      placeId: place.id,
      position: {
        lat: place.lat ?? mapCenter.lat,
        lng: place.lng ?? mapCenter.lng,
      },
      }));
  }, [filteredPlaces, mapCenter]);

  const showStatusBlocker = !mapFilters.showWant && !mapFilters.showCompleted;

  const hasActiveFilters =
    mapFilters.query.trim().length > 0 ||
    mapFilters.stars.length > 0 ||
    mapFilters.tags.length > 0;

  const closePreview = () => setPreviewPhoto(null);

  const showPrevPhoto = () => {
    setPreviewPhoto((prev) =>
      prev
        ? {
            ...prev,
            index: (prev.index - 1 + prev.photos.length) % prev.photos.length,
          }
        : prev
    );
  };

  const showNextPhoto = () => {
    setPreviewPhoto((prev) =>
      prev
        ? {
            ...prev,
            index: (prev.index + 1) % prev.photos.length,
          }
        : prev
    );
  };

  const handleStartNavigation = (place: PlaceItem) => {
    const hasNavigationInfo = openGoogleMapsDirections(place);

    if (!hasNavigationInfo) {
      window.alert("此地點尚未設定導航資訊");
    }
  };

  const handleLocate = () => {
    const map = mapRef.current;

    if (!map) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nextPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };

          setCurrentPosition(nextPosition);
          map.panTo(nextPosition);
          map.setZoom(14);
        },
        () => {
          map.panTo(mapCenter);
          map.setZoom(11);
        }
      );
    } else {
      map.panTo(mapCenter);
      map.setZoom(11);
    }
  };

  const toggleStar = (star: number) => {
    setMapFilters((prev) => ({
      ...prev,
      stars: prev.stars.includes(star)
        ? prev.stars.filter((s) => s !== star)
        : [...prev.stars, star],
    }));
  };

  const toggleTag = (tag: string) => {
    setMapFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const clearTextAndChips = () => {
    setMapFilters((prev) => ({
      ...prev,
      query: "",
      stars: [],
      tags: [],
    }));
  };

  const wantCount = places.filter((p) => p.status === "wantToGo").length;
  const doneCount = places.filter((p) => p.status === "visited").length;

  return (
    <section className="relative min-h-0 w-full min-w-0 flex-1">
      <div className="absolute inset-0 min-h-0 overflow-hidden bg-slate-100">
        {loadError ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-rose-600">
            地圖載入失敗，請確認 Google Maps API Key 是否正確。
          </div>
        ) : null}

        {!loadError && !apiKey ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-600">
            尚未設定 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY，請先加入 `.env.local`。
          </div>
        ) : null}

        {!loadError && apiKey && !isLoaded ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-600">
            地圖載入中...
          </div>
        ) : null}

        {!loadError && apiKey && isLoaded ? (
          <>
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={mapCenter}
              zoom={11}
              options={mapOptions}
              onLoad={(map) => {
                mapRef.current = map;
              }}
              onUnmount={() => {
                mapRef.current = null;
              }}
              onClick={() => onSelectPlace(null)}
            >
              {filteredPlaces.map((place, index) => {
                const markerData = markerPositions[index];

                return (
                  <MarkerF
                    key={place.id}
                    position={markerData.position}
                    onClick={() => onSelectPlace(place.id)}
                    icon={markerIconForPlace(
                      place,
                      selectedPlaceId === place.id
                    )}
                  />
                );
              })}

              {currentPosition ? (
                <>
                  <MarkerF
                    position={currentPosition}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 16,
                      fillColor: "#3b82f6",
                      fillOpacity: 0.18,
                      strokeColor: "#3b82f6",
                      strokeOpacity: 0.35,
                      strokeWeight: 1,
                    }}
                    zIndex={998}
                  />
                  <MarkerF
                    position={currentPosition}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 7,
                      fillColor: "#3b82f6",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 3,
                    }}
                    zIndex={999}
                  />
                </>
              ) : null}
            </GoogleMap>

            <div
              className="pointer-events-none absolute right-2 top-2 z-[15] rounded-full bg-slate-900/75 px-2 py-1 text-[10px] font-semibold text-white"
              aria-hidden
            >
              使用本地資料
            </div>

            <div className="pointer-events-none absolute left-2 top-2 z-20 max-w-[min(100%,17.5rem)]">
              <div className="pointer-events-auto flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setIsFilterPanelOpen((open) => !open)}
                  className={`flex items-center gap-2 rounded-2xl border bg-white/95 px-3 py-2.5 text-left shadow-lg backdrop-blur-sm transition-colors ${
                    isFilterPanelOpen
                      ? "border-orange-300 ring-1 ring-orange-200"
                      : "border-slate-100"
                  }`}
                >
                  <span className="text-slate-400" aria-hidden>
                    🔍
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-700">
                    快速篩選與搜尋
                  </span>
                  <span className="ml-auto text-slate-400">
                    {isFilterPanelOpen ? "✕" : "▾"}
                  </span>
                </button>

                {isFilterPanelOpen ? (
                  <div className="max-h-[min(42vh,16rem)] space-y-3 overflow-y-auto rounded-[1.25rem] border border-slate-100 bg-white/95 p-3.5 shadow-xl backdrop-blur-sm">
                    <div>
                      <p className="mb-2 pl-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                        顯示狀態
                      </p>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setMapFilters((f) => ({
                              ...f,
                              showWant: !f.showWant,
                            }))
                          }
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-[10px] font-bold transition-colors ${
                            mapFilters.showWant
                              ? "border-slate-300 bg-slate-50 text-slate-700"
                              : "border-slate-100 bg-white text-slate-300"
                          }`}
                        >
                          <span aria-hidden>♥</span>
                          想去 ({wantCount})
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setMapFilters((f) => ({
                              ...f,
                              showCompleted: !f.showCompleted,
                            }))
                          }
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-[10px] font-bold transition-colors ${
                            mapFilters.showCompleted
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-slate-100 bg-white text-slate-300"
                          }`}
                        >
                          <span aria-hidden>♡</span>
                          完成 ({doneCount})
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <span
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400"
                        aria-hidden
                      >
                        🔍
                      </span>
                      <input
                        type="search"
                        value={mapFilters.query}
                        onChange={(e) =>
                          setMapFilters((f) => ({
                            ...f,
                            query: e.target.value,
                          }))
                        }
                        placeholder="搜尋名稱、地址、筆記..."
                        className="w-full rounded-xl border-2 border-transparent bg-slate-50 py-2 pl-8 pr-3 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-orange-200/80 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <p className="mb-2 pl-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                        喜歡程度
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {RATING_CHIPS.map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => toggleStar(star)}
                            className={`rounded-xl border-2 py-1.5 text-[10px] font-bold transition-colors ${
                              mapFilters.stars.includes(star)
                                ? "border-red-400 bg-red-400 text-white shadow-sm"
                                : "border-slate-100 bg-white text-slate-400"
                            }`}
                          >
                            {star}♥
                          </button>
                        ))}
                      </div>
                    </div>

                    {allTags.length > 0 ? (
                      <div>
                        <p className="mb-2 pl-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                          標籤
                        </p>
                        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-0.5">
                          {allTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleTag(tag)}
                              className={`rounded-xl border-2 px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                                mapFilters.tags.includes(tag)
                                  ? "border-slate-800 bg-slate-800 text-white shadow-sm"
                                  : "border-slate-100 bg-white text-slate-500"
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={clearTextAndChips}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-200"
                      >
                        清除關鍵字與星級／標籤
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {showStatusBlocker ? (
              <div className="pointer-events-auto absolute inset-0 z-[25] flex items-center justify-center bg-slate-50/70 px-4 backdrop-blur-[2px]">
                <div className="max-w-xs rounded-3xl border border-orange-100 bg-white p-6 text-center shadow-2xl">
                  <p className="text-base font-bold text-slate-800">
                    目前未顯示任何狀態
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    請至少開啟「想去」或「完成」其中一種，地圖才會顯示地標。
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setMapFilters((f) => ({
                        ...f,
                        showWant: true,
                        showCompleted: true,
                      }))
                    }
                    className="mt-4 w-full rounded-2xl bg-orange-500 py-3 text-[10px] font-bold uppercase tracking-widest text-white shadow-md"
                  >
                    全部顯示
                  </button>
                </div>
              </div>
            ) : null}

            {selectedPlace &&
            filteredPlaces.some((p) => p.id === selectedPlace.id) ? (
              <div className="pointer-events-none absolute bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[19] flex justify-center">
                <div className="pointer-events-auto w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
                  <div className="flex items-stretch">
                    <div className="w-28 shrink-0 overflow-hidden bg-slate-100">
                      {selectedPlace.photos?.length > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewPhoto({
                              photos: selectedPlace.photos,
                              index: selectedPlace.coverPhotoIndex ?? 0,
                            })
                          }
                          className="h-full w-full"
                        >
                          <img
                            src={
                              selectedPlace.photos[
                                selectedPlace.coverPhotoIndex ?? 0
                              ] ?? selectedPlace.photos[0]
                            }
                            alt={`${selectedPlace.name}-photo`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : selectedPlace.status === "wantToGo" ? (
                        <div className="flex h-full min-h-32 w-full flex-col items-center justify-center bg-orange-50 text-center">
                          <div className="text-4xl">🥺</div>
                          <div className="mt-2 text-xs font-bold text-orange-500">
                            好想去~
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full min-h-32 w-full items-center justify-center text-3xl">
                          ♡
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-slate-900">
                            {selectedPlace.name}
                          </p>

                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {selectedPlace.address}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectPlace(null)}
                          className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500"
                          aria-label="關閉"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                            selectedPlace.status === "visited"
                              ? "bg-red-100 text-red-600"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {selectedPlace.status === "visited"
                            ? "♡ 完成"
                            : "♥ 想去"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedPlace.tags?.length > 0 ? (
                          selectedPlace.tags.map((tag) => (
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

                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => {
                            const active = i < selectedPlace.rating;

                            return (
                              <span
                                key={i}
                                className={
                                  active ? "text-red-500" : "text-gray-300"
                                }
                              >
                                ♥
                              </span>
                            );
                          })}
                        </div>

                        {selectedPlace.status === "visited" &&
                        selectedPlace.completedDate ? (
                          <span className="text-[11px] font-semibold text-red-500">
                            {formatDate(selectedPlace.completedDate)}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-auto flex gap-2 pt-3">
                        <button
                          type="button"
                          onClick={() => handleStartNavigation(selectedPlace)}
                          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-500 px-2 py-2 text-xs font-bold text-white"
                        >
                          <span className="text-2xl leading-none">🚕~</span>
                          <span>出發</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onEditPlace(selectedPlace)}
                          className="rounded-xl bg-slate-100 px-10 py-2 text-lg font-bold"
                          aria-label="編輯"
                        >
                          📝
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {previewPhoto ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/80 p-4"
          onClick={closePreview}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-5xl items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closePreview}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/60 px-3 py-1.5 text-sm font-bold text-white"
              aria-label="關閉預覽"
            >
              ✕
            </button>

            {previewPhoto.photos.length > 1 ? (
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
              src={previewPhoto.photos[previewPhoto.index]}
              alt={`photo-preview-${previewPhoto.index + 1}`}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            />

            {previewPhoto.photos.length > 1 ? (
              <button
                type="button"
                onClick={showNextPhoto}
                className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl font-bold text-white"
                aria-label="下一張"
              >
                ›
              </button>
            ) : null}

            {previewPhoto.photos.length > 1 ? (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                {previewPhoto.index + 1} / {previewPhoto.photos.length}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onCreatePlace}
        className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border-2 border-orange-400 bg-white text-3xl font-bold text-orange-500 shadow-lg transition active:scale-95 hover:scale-105"
        aria-label="新增地點"
        title="新增地點"
      >
        +
      </button>

      <button
        type="button"
        onClick={handleLocate}
        className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border-2 border-orange-400 bg-white shadow-lg transition active:scale-95 hover:scale-105"
        aria-label="回到目前位置"
        title="回到目前位置"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="#ef4444"
          className="drop-shadow"
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
        </svg>
      </button>
    </section>
  );
}