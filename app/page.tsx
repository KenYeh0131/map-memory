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
  tag: "all",
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
    return parsed;
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
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    () => loadInitialPlaces()[0]?.id ?? null
  );
  const [filters, setFilters] = useState<PlaceFilters>(defaultFilters);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPlace, setEditingPlace] = useState<PlaceItem | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  }, [places]);

  const availableTags = useMemo(() => {
    const uniqueTags = new Set<string>();
    places.forEach((place) => {
      place.tags.forEach((tag) => uniqueTags.add(tag));
    });
    return Array.from(uniqueTags).sort((a, b) => a.localeCompare(b));
  }, [places]);

  const filteredPlaces = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return places.filter((place) => {
      const matchesKeyword =
        keyword.length === 0 ||
        place.name.toLowerCase().includes(keyword) ||
        place.address.toLowerCase().includes(keyword) ||
        place.notes.toLowerCase().includes(keyword);

      const matchesStatus =
        filters.status === "all" || place.status === filters.status;

      const matchesRating =
        filters.minRating === "all" || place.rating >= filters.minRating;

      const matchesTag =
        filters.tag === "all" || place.tags.some((tag) => tag === filters.tag);

      return matchesKeyword && matchesStatus && matchesRating && matchesTag;
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
        tags: normalizeTags(values.tagsText),
        navigationTarget: values.navigationTarget.trim(),
        notes: values.notes.trim(),
        markerX: Math.floor(Math.random() * 80) + 10,
        markerY: Math.floor(Math.random() * 80) + 10,
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
    <main className="mx-auto min-h-screen w-full max-w-md bg-slate-50 px-4 pb-24 pt-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">我們的地圖回憶</h1>
        <p className="mt-1 text-sm text-slate-500">
          第一版：Google Maps + 本機儲存，不串 Firebase。
        </p>
      </header>

      {activeTab === "map" ? (
        <MapView
          places={places}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={setSelectedPlaceId}
          onCreatePlace={openCreateForm}
          onEditPlace={openEditForm}
        />
      ) : null}

      {activeTab === "list" ? (
        <PlaceListView
          places={filteredPlaces}
          filters={filters}
          availableTags={availableTags}
          onFiltersChange={setFilters}
          onEditPlace={openEditForm}
          onDeletePlace={handleDeletePlace}
        />
      ) : null}

      {activeTab === "settings" ? <SettingsView /> : null}

      <PlaceFormModal
        key={`${formMode}-${editingPlace?.id ?? "new"}-${isFormOpen ? "open" : "closed"}`}
        isOpen={isFormOpen}
        mode={formMode}
        initialPlace={editingPlace}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmitForm}
      />

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}