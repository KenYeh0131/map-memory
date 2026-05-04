"use client";

import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  useJsApiLoader,
} from "@react-google-maps/api";
import { openGoogleMapsDirections } from "@/lib/navigation";
import type { PlaceItem } from "@/lib/places";
import { STATUS_LABELS } from "@/lib/places";

type MapViewProps = {
  places: PlaceItem[];
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  onCreatePlace: () => void;
  onEditPlace: (place: PlaceItem) => void;
};

export function MapView({
  places,
  selectedPlaceId,
  onSelectPlace,
  onCreatePlace,
  onEditPlace,
}: MapViewProps) {
  const selectedPlace =
    places.find((place) => place.id === selectedPlaceId) ?? null;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "map-memory-google-map-script",
    googleMapsApiKey: apiKey,
  });

  const mapCenter = { lat: 25.033964, lng: 121.564468 };

  const markerPositions = places.map((place) => {
    // Convert existing mock marker coordinates to nearby points around Taipei.
    const latOffset = (place.markerY - 50) * 0.0032;
    const lngOffset = (place.markerX - 50) * 0.004;
    return {
      placeId: place.id,
      position: { lat: mapCenter.lat - latOffset, lng: mapCenter.lng + lngOffset },
    };
  });

  const selectedPosition =
    markerPositions.find((item) => item.placeId === selectedPlaceId)?.position ??
    null;

  const handleStartNavigation = (place: PlaceItem) => {
    const hasNavigationInfo = openGoogleMapsDirections(place);
    if (!hasNavigationInfo) {
      window.alert("此地點尚未設定導航資訊");
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm text-slate-500">Google Maps 地圖瀏覽</p>
        <div className="h-80 overflow-hidden rounded-xl bg-slate-100">
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
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={mapCenter}
              zoom={11}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            >
              {places.map((place, index) => {
                const markerData = markerPositions[index];
                return (
                  <MarkerF
                    key={place.id}
                    position={markerData.position}
                    onClick={() => onSelectPlace(place.id)}
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: selectedPlaceId === place.id ? 9 : 7,
                      fillColor: place.status === "wantToGo" ? "#f97316" : "#ef4444",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 2,
                    }}
                  />
                );
              })}

              {selectedPlace && selectedPosition ? (
                <InfoWindowF position={selectedPosition}>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-slate-900">
                      {selectedPlace.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStartNavigation(selectedPlace)}
                      className="rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white"
                    >
                      出發
                    </button>
                  </div>
                </InfoWindowF>
              ) : null}
            </GoogleMap>
          ) : null}
        </div>
      </div>

      {selectedPlace ? (
        <article className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm shadow-sm">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              {selectedPlace.name}
            </h2>
            <button
              type="button"
              onClick={() => onEditPlace(selectedPlace)}
              className="rounded-md bg-white px-3 py-1 text-xs font-medium text-slate-700"
            >
              編輯
            </button>
          </div>
          <p className="text-slate-600">{selectedPlace.address}</p>
          <p className="mt-2 text-slate-700">
            狀態：{STATUS_LABELS[selectedPlace.status]}｜喜歡程度：
            {selectedPlace.rating}
          </p>
          <p className="mt-2 text-slate-700 line-clamp-2">{selectedPlace.notes}</p>
        </article>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          點擊地標可查看地點摘要卡片。
        </div>
      )}

      <button
        type="button"
        onClick={onCreatePlace}
        className="fixed bottom-24 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-3xl text-white shadow-lg"
        aria-label="新增地點"
      >
        +
      </button>
    </section>
  );
}
