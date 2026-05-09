"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { BottomNav } from "@/components/BottomNav";
import { MapView } from "@/components/MapView";
import {
  PlaceFormModal,
  type PlaceFormValues,
} from "@/components/PlaceFormModal";
import { PlaceListView, type PlaceFilters } from "@/components/PlaceListView";
import { SettingsView } from "@/components/SettingsView";
import { db } from "@/lib/firebase";
import type { PlaceItem } from "@/lib/places";

type TabId = "map" | "list" | "settings";

const GROUP_ID = "family";

const defaultFilters: PlaceFilters = {
  keyword: "",
  status: "all",
  minRating: "all",
  tags: [],
};

function normalizeTags(tagsText: string) {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizePlace(id: string, data: Partial<PlaceItem>): PlaceItem {
  return {
    id,
    name: data.name ?? "",
    status: data.status ?? "wantToGo",
    address: data.address ?? "",
    rating: data.rating ?? 0,
    photos: Array.isArray(data.photos) ? data.photos : [],
    coverPhotoIndex: data.coverPhotoIndex ?? 0,
    completedDate: data.completedDate ?? "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    navigationTarget: data.navigationTarget ?? "",
    notes: data.notes ?? "",
    lat: data.lat,
    lng: data.lng,
    createdAt: data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("map");
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [filters, setFilters] = useState<PlaceFilters>(() => defaultFilters);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPlace, setEditingPlace] = useState<PlaceItem | null>(null);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);

  const placesCollectionRef = useMemo(
    () => collection(db, "groups", GROUP_ID, "places"),
    []
  );

  useEffect(() => {
    const placesQuery = query(placesCollectionRef, orderBy("updatedAt", "desc"));

    const unsubscribe = onSnapshot(
      placesQuery,
      (snapshot) => {
        const nextPlaces = snapshot.docs.map((document) =>
          normalizePlace(document.id, document.data() as Partial<PlaceItem>)
        );

        setPlaces(nextPlaces);
        setIsLoadingPlaces(false);
      },
      (error) => {
        console.error(error);
        window.alert("讀取雲端地點失敗，請確認 Firebase 規則是否為測試模式");
        setIsLoadingPlaces(false);
      }
    );

    return () => unsubscribe();
  }, [placesCollectionRef]);

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

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingPlace(null);
  };

  const handleSubmitForm = async (values: PlaceFormValues) => {
    const now = new Date().toISOString();

    try {
      if (formMode === "create") {
        const placeId = `p-${Date.now()}`;

        const newPlace: PlaceItem = {
          id: placeId,
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
          lat: values.lat ?? 25.052013567893294,
          lng: values.lng ?? 121.36444898053523,
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(doc(db, "groups", GROUP_ID, "places", placeId), newPlace);
        setSelectedPlaceId(placeId);
      } else if (editingPlace) {
        const updatedPlace: Partial<PlaceItem> = {
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
          lat: values.lat ?? editingPlace.lat,
          lng: values.lng ?? editingPlace.lng,
          updatedAt: now,
        };

        await updateDoc(
          doc(db, "groups", GROUP_ID, "places", editingPlace.id),
          updatedPlace
        );

        setSelectedPlaceId(editingPlace.id);
      }

      closeForm();
    } catch (error) {
      console.error(error);
      window.alert("儲存地點失敗，請確認 Firebase Firestore 規則是否為測試模式");
    }
  };

  const handleDeletePlace = async (placeId: string) => {
    try {
      await deleteDoc(doc(db, "groups", GROUP_ID, "places", placeId));
      setSelectedPlaceId((prev) => (prev === placeId ? null : prev));
    } catch (error) {
      console.error(error);
      window.alert("刪除地點失敗，請稍後再試");
    }
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
              Google Maps · 雲端共享
            </p>
          </div>
        </div>
      </header>

      {isLoadingPlaces ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
          雲端地點載入中...
        </div>
      ) : null}

      {!isLoadingPlaces && activeTab === "map" && (
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

      {!isLoadingPlaces && activeTab === "list" && (
        <PlaceListView
          places={filteredPlaces}
          filters={filters}
          availableTags={availableTags}
          onFiltersChange={setFilters}
          onEditPlace={openEditForm}
          onDeletePlace={handleDeletePlace}
        />
      )}

      {!isLoadingPlaces && activeTab === "settings" && <SettingsView />}

      <PlaceFormModal
        key={`${formMode}-${editingPlace?.id ?? "new"}-${
          isFormOpen ? "open" : "closed"
        }`}
        isOpen={isFormOpen}
        mode={formMode}
        initialPlace={editingPlace}
        availableTags={availableTags}
        onClose={closeForm}
        onSubmit={handleSubmitForm}
      />

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}