"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { openGoogleMapsDirections } from "@/lib/navigation";
import type { PlaceItem } from "@/lib/places";

type MapViewProps = {
  places: PlaceItem[];
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string | null) => void;
  onCreatePlace: () => void;
  onEditPlace: (place: PlaceItem) => void;
  onAddVisit: (place: PlaceItem) => void;
  onEditVisit: (placeId: string, visitId: string) => void;
  onDeleteVisit: (placeId: string, visitId: string) => void;
};

type MapFilterState = {
  showWantToGo: boolean;
  showWantToReturn: boolean;
  showMemory: boolean;
  query: string;
  stars: number[];
  tags: string[];
};

type PhotoPreviewState = {
  photos: string[];
  index: number;
} | null;

const defaultMapFilters: MapFilterState = {
  showWantToGo: true,
  showWantToReturn: true,
  showMemory: true,
  query: "",
  stars: [],
  tags: [],
};

const RATING_CHIPS = [0, 1, 2, 3, 4, 5] as const;
const GOOGLE_MAP_LIBRARIES: "places"[] = ["places"];

function formatDate(dateText?: string) {
  if (!dateText) return "";
  return dateText.replaceAll("-", "/");
}

function renderRating(rating?: number) {
  return Array.from({ length: 5 }).map((_, i) => (
    <span
      key={i}
      className={i < (rating ?? 0) ? "text-red-500" : "text-slate-300"}
    >
      ♥
    </span>
  ));
}

function getStatusInfo(status?: string) {
  if (status === "wantToReturn")  {
    return {
      label: "✨ 還想去",
      className: "bg-orange-100 text-orange-600",
      emptyEmoji: "💖",
      markerFill: "#f97316",
      heart: "♡",
    };
  }

  if (status === "memory") {
    return {
      label: "🫧 打卡完成",
      className: "bg-slate-200 text-slate-600",
      emptyEmoji: "🤍",
      markerFill: "#94a3b8",
      heart: "♡",
    };
  }

  return {
    label: "♥ 想去",
    className: "bg-red-100 text-red-600",
    emptyEmoji: "🥺",
    markerFill: "#ef4444",
    heart: "♥",
  };
}

function buildMarkerIcon(
  heart: string,
  fillHex: string,
  selected: boolean
): google.maps.Icon {
  const dim = selected ? 58 : 50;
  const cx = dim / 2;
  const cy = dim / 2;
  const pinBottom = dim - 3;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}">
    <path
      d="M${cx} ${pinBottom}
      C${cx - 12} ${cy + 8},
      ${cx - 18} ${cy},
      ${cx - 18} ${cy - 8}
      A18 18 0 1 1 ${cx + 18} ${cy - 8}
      C${cx + 18} ${cy},
      ${cx + 12} ${cy + 8},
      ${cx} ${pinBottom} Z"
      fill="${fillHex}"
      stroke="white"
      stroke-width="3"
    />
    <text
      x="${cx}"
      y="${cy + 4}"
      font-size="20"
      text-anchor="middle"
      font-family="Arial"
      font-weight="700"
      fill="white"
    >
      ${heart}
    </text>
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(dim, dim),
    anchor: new google.maps.Point(dim / 2, dim - 2),
  };
}

export function MapView({
  places,
  selectedPlaceId,
  onSelectPlace,
  onCreatePlace,
  onEditPlace,
  onAddVisit,
  onEditVisit,
  onDeleteVisit,
}: MapViewProps) {
  const [mapFilters, setMapFilters] =
    useState<MapFilterState>(defaultMapFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPosition, setCurrentPosition] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [timelinePlace, setTimelinePlace] = useState<PlaceItem | null>(null);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreviewState>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const hasRequestedLocationRef = useRef(false);

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
    if (!isLoaded) return;
    if (!navigator.geolocation) return;
    if (hasRequestedLocationRef.current) return;

    hasRequestedLocationRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        setCurrentPosition(nextPosition);

        const map = mapRef.current;
        if (map) {
          map.panTo(nextPosition);
          map.setZoom(14);
        }
      },
      () => {
        console.log("定位失敗");
      }
    );
  }, [isLoaded]);

  const selectedPlace = useMemo(() => {
    return places.find((place) => place.id === selectedPlaceId) ?? null;
  }, [places, selectedPlaceId]);

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
      if (place.status === "wantToGo" && !mapFilters.showWantToGo) return false;

      if (
        place.status === "wantToReturn"  &&
        !mapFilters.showWantToReturn
      ) {
        return false;
      }

      if (place.status === "memory" && !mapFilters.showMemory) return false;

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

  const selectedStatusInfo = useMemo(() => {
    if (!selectedPlace) return null;
    return getStatusInfo(selectedPlace.status);
  }, [selectedPlace]);

  const sortedTimelineVisits = useMemo(() => {
    if (!timelinePlace?.visits) return [];

    return [...timelinePlace.visits].sort((a, b) =>
      b.visitDate.localeCompare(a.visitDate)
    );
  }, [timelinePlace]);

  const markerIcons = useMemo(() => {
    if (!isLoaded || typeof google === "undefined") {
      return new Map<string, google.maps.Icon>();
    }

    const nextIcons = new Map<string, google.maps.Icon>();

    filteredPlaces.forEach((place) => {
      const info = getStatusInfo(place.status);

      nextIcons.set(
        place.id,
        buildMarkerIcon(info.heart, info.markerFill, selectedPlaceId === place.id)
      );
    });

    return nextIcons;
  }, [filteredPlaces, isLoaded, selectedPlaceId]);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleMapClick = useCallback(() => {
    onSelectPlace(null);
  }, [onSelectPlace]);

  const handleLocate = useCallback(() => {
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
  }, [mapCenter]);

  const toggleStar = useCallback((star: number) => {
    setMapFilters((prev) => ({
      ...prev,
      stars: prev.stars.includes(star)
        ? prev.stars.filter((s) => s !== star)
        : [...prev.stars, star],
    }));
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setMapFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  }, []);

  const handleOpenTimeline = useCallback((place: PlaceItem) => {
    const hasVisits = Array.isArray(place.visits) && place.visits.length > 0;

    if (!hasVisits) return;

    setTimelinePlace(place);
  }, []);

  const handleCloseTimeline = useCallback(() => {
    setTimelinePlace(null);
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

  const shouldShowFloatingButtons = !selectedPlace && !timelinePlace;

  return (
    <section className="relative min-h-0 w-full min-w-0 flex-1">
      <div className="absolute inset-0 overflow-hidden bg-slate-100">
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
              mapContainerStyle={{
                width: "100%",
                height: "100%",
              }}
              center={mapCenter}
              zoom={11}
              options={mapOptions}
              onLoad={handleMapLoad}
              onUnmount={handleMapUnmount}
              onClick={handleMapClick}
            >
              {filteredPlaces.map((place) => (
                <MarkerF
                  key={place.id}
                  position={{
                    lat: place.lat ?? mapCenter.lat,
                    lng: place.lng ?? mapCenter.lng,
                  }}
                  onClick={() => onSelectPlace(place.id)}
                  icon={markerIcons.get(place.id)}
                />
              ))}

              {currentPosition ? <MarkerF position={currentPosition} /> : null}
            </GoogleMap>

            <div className="absolute left-3 right-3 top-3 z-20">
              <div className="rounded-2xl border bg-white p-4 shadow-lg">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen((open) => !open)}
                  className="flex w-full justify-between text-left"
                >
                  <span className="font-bold">
                    地圖搜尋 ({filteredPlaces.length})
                  </span>
                  <span>{isFilterOpen ? "▲" : "▼"}</span>
                </button>

                {isFilterOpen ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setMapFilters((f) => ({
                            ...f,
                            showWantToGo: !f.showWantToGo,
                          }))
                        }
                        className={`rounded-xl px-2 py-2 text-xs font-bold ${
                          mapFilters.showWantToGo
                            ? "bg-red-100 text-red-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        ♥ 想去
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setMapFilters((f) => ({
                            ...f,
                            showWantToReturn: !f.showWantToReturn,
                          }))
                        }
                        className={`rounded-xl px-2 py-2 text-xs font-bold ${
                          mapFilters.showWantToReturn
                            ? "bg-orange-100 text-orange-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        ✨ 還想去
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setMapFilters((f) => ({
                            ...f,
                            showMemory: !f.showMemory,
                          }))
                        }
                        className={`rounded-xl px-2 py-2 text-xs font-bold ${
                          mapFilters.showMemory
                            ? "bg-slate-300 text-slate-700"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        🫧 打卡完成
                      </button>
                    </div>

                    <input
                      type="search"
                      value={mapFilters.query}
                      onChange={(e) =>
                        setMapFilters((f) => ({
                          ...f,
                          query: e.target.value,
                        }))
                      }
                      placeholder="搜尋地點、地址、筆記..."
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />

                    <div className="flex flex-wrap gap-1">
                      {RATING_CHIPS.map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => toggleStar(star)}
                          className={`rounded-full px-2 py-1 text-xs ${
                            mapFilters.stars.includes(star)
                              ? "bg-red-500 text-white"
                              : "bg-slate-200"
                          }`}
                        >
                          {star}♥
                        </button>
                      ))}
                    </div>

                    {allTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {allTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`rounded-full px-2 py-1 text-xs ${
                              mapFilters.tags.includes(tag)
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
            </div>

            {selectedPlace && selectedStatusInfo ? (
              <div className="absolute bottom-24 left-3 right-3 z-40">
                <div
                  className="overflow-hidden rounded-3xl bg-white shadow-2xl"
                  onClick={() => handleOpenTimeline(selectedPlace)}
                >
                  <div className="flex">
                    <div className="w-32 shrink-0 bg-slate-100">
                      {selectedPlace.photos?.length > 0 ? (
                        <img
                          src={
                            selectedPlace.photos[
                              selectedPlace.coverPhotoIndex ?? 0
                            ] ?? selectedPlace.photos[0]
                          }
                          alt={selectedPlace.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full min-h-32 items-center justify-center text-5xl">
                          {selectedStatusInfo.emptyEmoji}
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-lg font-bold">
                            {selectedPlace.name}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {selectedPlace.address}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectPlace(null);
                          }}
                          className="rounded-full bg-slate-100 px-2 py-1 text-xs"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="mt-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${selectedStatusInfo.className}`}
                        >
                          {selectedStatusInfo.label}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedPlace.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="mt-2 text-xs text-slate-500">
                        拜訪次數：
                        <span className="font-bold text-slate-700">
                          {selectedPlace.visitCount ?? 0}
                        </span>
                      </div>

                      {selectedPlace.lastVisitedAt ? (
                        <div className="mt-1 text-xs text-slate-500">
                          最近拜訪：
                          <span className="font-bold text-slate-700">
                            {formatDate(selectedPlace.lastVisitedAt)}
                          </span>
                        </div>
                      ) : null}

                      <div className="mt-2 flex items-center gap-0.5">
                        {renderRating(selectedPlace.rating)}
                      </div>

                      <div className="mt-auto grid grid-cols-3 gap-2 pt-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openGoogleMapsDirections(selectedPlace);
                          }}
                          className="rounded-xl bg-blue-500 px-2 py-2 text-xs font-bold text-white"
                        >
                          🚕 出發
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onAddVisit(selectedPlace);
                          }}
                          className="rounded-xl bg-orange-500 px-2 py-2 text-xs font-bold text-white"
                        >
                          ＋回憶
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditPlace(selectedPlace);
                          }}
                          className="rounded-xl bg-slate-200 px-2 py-2 text-xs font-bold text-slate-700"
                        >
                          📝 編輯
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {timelinePlace ? (
              <div
                className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 px-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-3"
                onClick={handleCloseTimeline}
              >
                <div
                  className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-xl font-bold">
                          {timelinePlace.name}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          地圖回憶
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleCloseTimeline}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-500"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-5 space-y-3">
                      {sortedTimelineVisits.map((visit) => {
                        const photos = Array.isArray(visit.photos)
                          ? visit.photos
                          : [];
                        const firstPhoto = photos[0];
                        const secondPhoto = photos[1];
                        const hiddenPhotoCount = Math.max(0, photos.length - 2);

                        return (
                          <div
                            key={visit.id}
                            className="grid h-36 grid-cols-[1fr_7rem] gap-3 rounded-2xl border bg-white p-3 shadow-sm"
                          >
                            <div className="min-w-0">
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

                            <div className="grid grid-rows-2 gap-2">
                              {firstPhoto ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenPhotoPreview(photos, 0)
                                  }
                                  className="overflow-hidden rounded-xl"
                                >
                                  <img
                                    src={firstPhoto}
                                    alt="visit-photo-1"
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ) : (
                                <div className="flex items-center justify-center rounded-xl bg-slate-100 text-[10px] text-slate-400">
                                  無照片
                                </div>
                              )}

                              {secondPhoto ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenPhotoPreview(photos, 1)
                                  }
                                  className="relative overflow-hidden rounded-xl"
                                >
                                  <img
                                    src={secondPhoto}
                                    alt="visit-photo-2"
                                    className="h-full w-full object-cover"
                                  />

                                  {hiddenPhotoCount > 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-bold text-white">
                                      +{hiddenPhotoCount}
                                    </div>
                                  ) : null}
                                </button>
                              ) : (
                                <div className="flex items-center justify-center rounded-xl bg-slate-100 text-[10px] text-slate-400">
                                  無照片
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
          </>
        ) : null}
      </div>

      {shouldShowFloatingButtons ? (
        <>
          <button
            type="button"
            onClick={onCreatePlace}
            className="absolute bottom-24 left-4 z-30 flex h-14 w-14 items-center justify-center rounded-full border-2 border-orange-400 bg-white text-4xl text-orange-500 shadow-2xl"
          >
            +
          </button>

          <button
            type="button"
            onClick={handleLocate}
            className="absolute bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full border-2 border-orange-400 bg-white shadow-2xl"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#ef4444">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
            </svg>
          </button>
        </>
      ) : null}
    </section>
  );
}
