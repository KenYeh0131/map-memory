import type { PlaceItem } from "@/lib/places";

export function buildNavigationDestination(place: PlaceItem): string {
  if (Number.isFinite(place.navigationTargetLat) && Number.isFinite(place.navigationTargetLng)) {
    return `${place.navigationTargetLat},${place.navigationTargetLng}`;
  }
  const target = place.navigationTarget?.trim();
  if (target && !/^[.。．]+$/.test(target)) return target;
  if (Number.isFinite(place.lat) && Number.isFinite(place.lng)) return `${place.lat},${place.lng}`;
  return place.address?.trim() ?? "";
}

export function openGoogleMapsDirections(place: PlaceItem): boolean {
  const destination = buildNavigationDestination(place);
  if (!destination) return false;
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, "_blank", "noopener,noreferrer");
  return true;
}
