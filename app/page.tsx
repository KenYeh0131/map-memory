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

type MapGroup = {
  id: string;
  name: string;
};

const DEFAULT_GROUPS: MapGroup[] = [
  { id: "family", name: "家庭地圖" },
  { id: "friends", name: "朋友地圖" },
  { id: "personal", name: "我的地圖" },
];

const DEFAULT_GROUP_ID = "family";
const GROUPS_STORAGE_KEY = "map-memory-groups-v1";
const CURRENT_GROUP_STORAGE_KEY = "map-memory-current-group-v1";

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

function loadGroups(): MapGroup[] {
  if (typeof window === "undefined") {
    return DEFAULT_GROUPS;
  }

  const raw = window.localStorage.getItem(GROUPS_STORAGE_KEY);

  if (!raw) {
    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(DEFAULT_GROUPS));
    return DEFAULT_GROUPS;
  }

  try {
    const parsed = JSON.parse(raw) as MapGroup[];

    if (!Array.isArray(parsed)) {
      throw new Error("invalid groups");
    }

    const validGroups = parsed.filter(
      (group) =>
        typeof group.id === "string" &&
        group.id.trim().length > 0 &&
        typeof group.name === "string" &&
        group.name.trim().length > 0
    );

    if (validGroups.length === 0) {
      window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(DEFAULT_GROUPS));
      return DEFAULT_GROUPS;
    }

    const mergedGroups = [...DEFAULT_GROUPS];

    validGroups.forEach((group) => {
      if (!mergedGroups.some((existingGroup) => existingGroup.id === group.id)) {
        mergedGroups.push(group);
      }
    });

    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(mergedGroups));
    return mergedGroups;
  } catch {
    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(DEFAULT_GROUPS));
    return DEFAULT_GROUPS;
  }
}

function getInitialGroupId(groups: MapGroup[]) {
  if (typeof window === "undefined") {
    return DEFAULT_GROUP_ID;
  }

  const savedGroupId = window.localStorage.getItem(CURRENT_GROUP_STORAGE_KEY);
  const isValidGroup = groups.some((group) => group.id === savedGroupId);

  return isValidGroup && savedGroupId ? savedGroupId : DEFAULT_GROUP_ID;
}

function createGroupId(groupName: string) {
  const safeName =
    groupName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "")
      .slice(0, 20) || "group";

  return `${safeName}-${Date.now()}`;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("map");
  const [mapGroups, setMapGroups] = useState<MapGroup[]>(() => loadGroups());
  const [currentGroupId, setCurrentGroupId] = useState(() =>
    getInitialGroupId(loadGroups())
  );
  const [newGroupName, setNewGroupName] = useState("");
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [filters, setFilters] = useState<PlaceFilters>(() => defaultFilters);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPlace, setEditingPlace] = useState<PlaceItem | null>(null);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);

  const currentGroupName =
    mapGroups.find((group) => group.id === currentGroupId)?.name ?? "家庭地圖";

  const placesCollectionRef = useMemo(
    () => collection(db, "groups", currentGroupId, "places"),
    [currentGroupId]
  );

  useEffect(() => {
    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(mapGroups));
  }, [mapGroups]);

  useEffect(() => {
    window.localStorage.setItem(CURRENT_GROUP_STORAGE_KEY, currentGroupId);
  }, [currentGroupId]);

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

  const handleChangeGroup = (groupId: string) => {
    setSelectedPlaceId(null);
    setEditingPlace(null);
    setIsFormOpen(false);
    setPlaces([]);
    setIsLoadingPlaces(true);
    setCurrentGroupId(groupId);
  };

  const handleCreateGroup = () => {
    const trimmedName = newGroupName.trim();

    if (!trimmedName) {
      window.alert("請輸入地圖群名稱");
      return;
    }

    const isDuplicate = mapGroups.some((group) => group.name === trimmedName);

    if (isDuplicate) {
      window.alert("這個地圖群名稱已經存在");
      return;
    }

    const newGroup: MapGroup = {
      id: createGroupId(trimmedName),
      name: trimmedName,
    };

    setMapGroups((prev) => [...prev, newGroup]);
    setNewGroupName("");
    handleChangeGroup(newGroup.id);
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

        await setDoc(
          doc(db, "groups", currentGroupId, "places", placeId),
          newPlace
        );

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
          doc(db, "groups", currentGroupId, "places", editingPlace.id),
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
      await deleteDoc(doc(db, "groups", currentGroupId, "places", placeId));
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
        <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 text-lg text-white">
              ♥
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">
                我們的地圖回憶
              </h1>

              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Google Maps · 雲端共享
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-2">
            <span className="shrink-0 text-xs font-semibold text-slate-500">
              地圖群
            </span>

            <select
              value={currentGroupId}
              onChange={(event) => handleChangeGroup(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 outline-none focus:border-orange-400"
              aria-label="切換地圖群"
            >
              {mapGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-2">
            <input
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleCreateGroup();
                }
              }}
              placeholder="新增地圖群，例如：大阪旅行"
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-orange-400"
            />

            <button
              type="button"
              onClick={handleCreateGroup}
              className="shrink-0 rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm active:scale-95"
            >
              新增
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            目前顯示：{currentGroupName}
          </p>
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
        key={`${currentGroupId}-${formMode}-${editingPlace?.id ?? "new"}-${
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