"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { MapView } from "@/components/MapView";
import {
  PlaceFormModal,
  type PlaceFormValues,
} from "@/components/PlaceFormModal";
import { PlaceListView, type PlaceFilters } from "@/components/PlaceListView";
import { SettingsView } from "@/components/SettingsView";
import { defaultPlacesSeed, type PlaceItem } from "@/lib/places";

type TabId = "map" | "list" | "settings";

const STORAGE_KEY = "map-memory-places-v1";

const defaultFilters: PlaceFilters = {
  keyword: "",
  status: "all",
  minRating: "all",
  tags: [],
};

function loadInitialPlaces(): PlaceItem[] {
  if (typeof window === "undefined") {
    return defaultPlacesSeed;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPlacesSeed));
    return defaultPlacesSeed;
  }

  try {
    const parsed = JSON.parse(raw) as PlaceItem[];

    if (!Array.isArray(parsed)) {
      throw new Error("invalid places");
    }

    return parsed.map((place) => ({
      ...place,
      photos: Array.isArray(place.photos) ? place.photos : [],
      tags: Array.isArray(place.tags) ? place.tags : [],
      coverPhotoIndex: place.coverPhotoIndex ?? 0,
      completedDate: place.completedDate ?? "",
    }));
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPlacesSeed));
    return defaultPlacesSeed;
  }
}

function normalizeTags(tagsText: string) {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("map");
  const [places, setPlaces] = useState<PlaceItem[]>(() => loadInitialPlaces());
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [filters, setFilters] = useState<PlaceFilters>(() => defaultFilters);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPlace, setEditingPlace] = useState<PlaceItem | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  }, [places]);

  const availableTags = useMemo(() => {
    const uniqueTags = new Set<string>();

    places.forEach((place) => {
      if (Array.isArray(place.tags)) {
        place.tags.forEach((tag) => uniqueTags.add(tag));
      }
    });

    return Array.from(uniqueTags).sort((a, b) => a.localeCompare(b));
  }, [places]);

  const filteredPlaces = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    const selectedTags = Array.isArray(filters.tags) ? filters.tags : [];

    return places.filter((place) => {
      const placeTags = Array.isArray(place.tags) ? place.tags : [];

      const matchesKeyword =
        keyword.length === 0 ||
        place.name.toLowerCase().includes(keyword) ||
        place.address.toLowerCase().includes(keyword) ||
        place.notes.toLowerCase().includes(keyword);

      const matchesStatus =
        filters.status === "all" || place.status === filters.status;

      const matchesRating =
        filters.minRating === "all" || place.rating >= filters.minRating;

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => placeTags.includes(tag));

      return matchesKeyword && matchesStatus && matchesRating && matchesTags;
    });
  }, [filters, places]);

  const openCreateForm = () => {
    setFormMode("create");
    setEditingPlace(null);
    setIsFormOpen(true);
  };

  const openEditForm = (place: PlaceItem) => {
    setFormMode("edit");
    setEditingPlace(place);
    setIsFormOpen(true);
  };

  const handleSubmitForm = (values: PlaceFormValues) => {
    const now = new Date().toISOString();

    if (formMode === "create") {
      const newPlace: PlaceItem = {
        id: `p-${Date.now()}`,
        name: values.name.trim(),
        status: values.status,
        address: values.address.trim(),
        rating: values.rating,
        photos: values.photos.slice(0, 5),
        coverPhotoIndex: values.coverPhotoIndex ?? 0,
        completedDate: values.status === "visited" ? values.completedDate : "",
        tags: normalizeTags(values.tagsText),
        navigationTarget: values.navigationTarget.trim(),
        notes: values.notes.trim(),
        lat: values.lat ?? 25.052013567893294,
        lng: values.lng ?? 121.36444898053523,
        createdAt: now,
        updatedAt: now,
      };

      setPlaces((prev) => [newPlace, ...prev]);
      setSelectedPlaceId(newPlace.id);
    } else if (editingPlace) {
      setPlaces((prev) =>
        prev.map((place) =>
          place.id === editingPlace.id
            ? {
                ...place,
                name: values.name.trim(),
                status: values.status,
                address: values.address.trim(),
                rating: values.rating,
                photos: values.photos.slice(0, 5),
                coverPhotoIndex: values.coverPhotoIndex ?? 0,
                completedDate:
                  values.status === "visited" ? values.completedDate : "",
                tags: normalizeTags(values.tagsText),
                navigationTarget: values.navigationTarget.trim(),
                notes: values.notes.trim(),
                updatedAt: now,
              }
            : place
        )
      );
    }

    setIsFormOpen(false);
  };

  const handleDeletePlace = (placeId: string) => {
    setPlaces((prev) => prev.filter((place) => place.id !== placeId));
    setSelectedPlaceId((prev) => (prev === placeId ? null : prev));
  };

  return (
    <main
      className={`mx-auto w-full max-w-md bg-slate-50 ${
        activeTab === "map"
          ? "flex h-[100dvh] min-h-0 flex-col overflow-hidden"
          : "min-h-screen px-4 pb-24 pt-4"
      }`}
    >
      <header
        className={
          activeTab === "map"
            ? "shrink-0 border-b border-slate-100/90 bg-white/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md"
            : "mb-4"
        }
      >
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 text-lg text-white">
            ♥
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">
              我們的地圖回憶
            </h1>

            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Google Maps · 本地資料
            </p>
          </div>
        </div>
      </header>

      {activeTab === "map" && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <MapView
            places={places}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={setSelectedPlaceId}
            onCreatePlace={openCreateForm}
            onEditPlace={openEditForm}
          />
        </div>
      )}

      {activeTab === "list" && (
        <PlaceListView
          places={filteredPlaces}
          filters={filters}
          availableTags={availableTags}
          onFiltersChange={setFilters}
          onEditPlace={openEditForm}
          onDeletePlace={handleDeletePlace}
        />
      )}

      {activeTab === "settings" && <SettingsView />}

      <PlaceFormModal
        key={`${formMode}-${editingPlace?.id ?? "new"}-${
          isFormOpen ? "open" : "closed"
        }`}
        isOpen={isFormOpen}
        mode={formMode}
        initialPlace={editingPlace}
        availableTags={availableTags}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmitForm}
      />

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}