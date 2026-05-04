import type { PlaceItem } from "@/lib/places";

export function buildNavigationDestination(place: PlaceItem): string {
  const target = place.navigationTarget.trim();
  if (target) {
    return target;
  }
  return place.address.trim();
}

export function openGoogleMapsDirections(place: PlaceItem): boolean {
  const destination = buildNavigationDestination(place);
  if (!destination) {
    return false;
  }
  const encodedDestination = encodeURIComponent(destination);
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
