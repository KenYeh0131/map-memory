"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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

export type MapGroup = {
  id: string;
  name: string;
  inviteCode?: string;
};

const FALLBACK_GROUPS: MapGroup[] = [
  { id: "family", name: "家庭地圖", inviteCode: "FAMILY888" },
  { id: "friends", name: "朋友地圖" },
  { id: "personal", name: "我的地圖" },
];

const DEFAULT_GROUP_ID = "family";
const CURRENT_GROUP_STORAGE_KEY = "map-memory-current-group-v1";
const JOINED_GROUPS_STORAGE_KEY = "map-memory-joined-groups-v1";

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

function getInitialGroupId() {
  if (typeof window === "undefined") {
    return DEFAULT_GROUP_ID;
  }

  return (
    window.localStorage.getItem(CURRENT_GROUP_STORAGE_KEY) ?? DEFAULT_GROUP_ID
  );
}

function loadJoinedGroupIds() {
  if (typeof window === "undefined") {
    return FALLBACK_GROUPS.map((group) => group.id);
  }

  const raw = window.localStorage.getItem(JOINED_GROUPS_STORAGE_KEY);

  if (!raw) {
    const fallbackIds = FALLBACK_GROUPS.map((group) => group.id);
    window.localStorage.setItem(
      JOINED_GROUPS_STORAGE_KEY,
      JSON.stringify(fallbackIds)
    );
    return fallbackIds;
  }

  try {
    const parsed = JSON.parse(raw) as string[];

    if (!Array.isArray(parsed)) {
      throw new Error("invalid joined groups");
    }

    const validIds = parsed.filter(
      (groupId) => typeof groupId === "string" && groupId.trim().length > 0
    );

    return validIds.length > 0
      ? validIds
      : FALLBACK_GROUPS.map((group) => group.id);
  } catch {
    return FALLBACK_GROUPS.map((group) => group.id);
  }
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

function createInviteCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    code += characters[Math.floor(Math.random() * characters.length)];
  }

  return code;
}

function mergeGroups(firebaseGroups: MapGroup[]) {
  const mergedGroups = [...FALLBACK_GROUPS];

  firebaseGroups.forEach((group) => {
    const existingIndex = mergedGroups.findIndex(
      (existingGroup) => existingGroup.id === group.id
    );

    if (existingIndex >= 0) {
      mergedGroups[existingIndex] = {
        ...mergedGroups[existingIndex],
        ...group,
      };
    } else {
      mergedGroups.push(group);
    }
  });

  return mergedGroups;
}

function getVisibleGroups(allGroups: MapGroup[], joinedGroupIds: string[]) {
  const joinedSet = new Set(joinedGroupIds);
  return allGroups.filter((group) => joinedSet.has(group.id));
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("map");
  const [allGroups, setAllGroups] = useState<MapGroup[]>(FALLBACK_GROUPS);
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>(() =>
    loadJoinedGroupIds()
  );
  const [currentGroupId, setCurrentGroupId] = useState(() =>
    getInitialGroupId()
  );
  const [newGroupName, setNewGroupName] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [filters, setFilters] = useState<PlaceFilters>(() => defaultFilters);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPlace, setEditingPlace] = useState<PlaceItem | null>(null);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);

  const mapGroups = useMemo(
    () => getVisibleGroups(allGroups, joinedGroupIds),
    [allGroups, joinedGroupIds]
  );

  const safeCurrentGroupId =
  mapGroups.some((group) => group.id === currentGroupId) ||
  mapGroups.length === 0
    ? currentGroupId
    : mapGroups[0].id;

const currentGroup =
  mapGroups.find((group) => group.id === safeCurrentGroupId) ??
  mapGroups[0];

const currentGroupName = currentGroup?.name ?? "尚未選擇地圖群";

const currentInviteCode = currentGroup?.inviteCode ?? "";

const groupsCollectionRef = useMemo(() => collection(db, "groups"), []);

const placesCollectionRef = useMemo(
  () => collection(db, "groups", safeCurrentGroupId, "places"),
  [safeCurrentGroupId]
);

  useEffect(() => {
    window.localStorage.setItem(CURRENT_GROUP_STORAGE_KEY, currentGroupId);
  }, [currentGroupId]);

  useEffect(() => {
    window.localStorage.setItem(
      JOINED_GROUPS_STORAGE_KEY,
      JSON.stringify(joinedGroupIds)
    );
  }, [joinedGroupIds]);

  useEffect(() => {
    const unsubscribe = onSnapshot(groupsCollectionRef, async (snapshot) => {
      const firebaseGroups: MapGroup[] = [];

      for (const documentSnapshot of snapshot.docs) {
        try {
          const metaRef = doc(
            db,
            "groups",
            documentSnapshot.id,
            "info",
            "meta"
          );

          const metaSnapshot = await getDoc(metaRef);

          if (metaSnapshot.exists()) {
            const data = metaSnapshot.data();

            firebaseGroups.push({
              id: documentSnapshot.id,
              name:
                typeof data.name === "string"
                  ? data.name
                  : documentSnapshot.id,
              inviteCode:
                typeof data.inviteCode === "string"
                  ? data.inviteCode
                  : undefined,
            });
          } else {
            firebaseGroups.push({
              id: documentSnapshot.id,
              name: documentSnapshot.id,
            });
          }
        } catch (error) {
          console.error(error);
        }
      }

      const nextGroups = mergeGroups(firebaseGroups);
      setAllGroups(nextGroups);
    });

    return () => unsubscribe();
  }, [groupsCollectionRef]);


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

  const handleCreateGroup = async () => {
    const trimmedName = newGroupName.trim();

    if (!trimmedName) {
      window.alert("請輸入地圖群名稱");
      return;
    }

    const isDuplicate = allGroups.some((group) => group.name === trimmedName);

    if (isDuplicate) {
      window.alert("這個地圖群名稱已經存在");
      return;
    }

    setIsCreatingGroup(true);

    const newGroup: MapGroup = {
      id: createGroupId(trimmedName),
      name: trimmedName,
      inviteCode: createInviteCode(),
    };

    try {
      await setDoc(doc(db, "groups", newGroup.id), {
        createdAt: new Date().toISOString(),
      });

      await setDoc(doc(db, "groups", newGroup.id, "info", "meta"), {
        name: newGroup.name,
        inviteCode: newGroup.inviteCode,
        createdAt: new Date().toISOString(),
      });

      setAllGroups((prev) => mergeGroups([...prev, newGroup]));
      setJoinedGroupIds((prev) => Array.from(new Set([...prev, newGroup.id])));
      setNewGroupName("");
      handleChangeGroup(newGroup.id);
    } catch (error) {
      console.error(error);
      window.alert("建立地圖群失敗，請稍後再試");
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleJoinGroup = async () => {
    const normalizedInviteCode = joinInviteCode.trim().toUpperCase();

    if (!normalizedInviteCode) {
      window.alert("請輸入邀請碼");
      return;
    }

    setIsJoiningGroup(true);

    try {
      const groupsSnapshot = await getDocs(collection(db, "groups"));
      let matchedGroup: MapGroup | null = null;

      for (const groupDocument of groupsSnapshot.docs) {
        const metaSnapshot = await getDoc(
          doc(db, "groups", groupDocument.id, "info", "meta")
        );

        if (!metaSnapshot.exists()) {
          continue;
        }

        const data = metaSnapshot.data();
        const inviteCode =
          typeof data.inviteCode === "string"
            ? data.inviteCode.toUpperCase()
            : "";

        if (inviteCode === normalizedInviteCode) {
          matchedGroup = {
            id: groupDocument.id,
            name:
              typeof data.name === "string" ? data.name : groupDocument.id,
            inviteCode: typeof data.inviteCode === "string" ? data.inviteCode : "",
          };
          break;
        }
      }

      if (!matchedGroup) {
        window.alert("找不到這個邀請碼，請確認是否輸入正確");
        return;
      }

      setAllGroups((prev) => mergeGroups([...prev, matchedGroup]));
      setJoinedGroupIds((prev) =>
        Array.from(new Set([...prev, matchedGroup.id]))
      );
      setJoinInviteCode("");
      handleChangeGroup(matchedGroup.id);
    } catch (error) {
      console.error(error);
      window.alert("加入地圖群失敗，請稍後再試");
    } finally {
      setIsJoiningGroup(false);
    }
  };

  const handleLeaveCurrentGroup = () => {
    if (!currentGroup) {
      return;
    }

    if (joinedGroupIds.length <= 1) {
      window.alert("至少需要保留一個地圖群");
      return;
    }

    const confirmLeave = window.confirm(
      `確定要退出「${currentGroupName}」嗎？\n\n退出後不會刪除地點資料，只是不再顯示這個地圖群。`
    );

    if (!confirmLeave) {
      return;
    }

    setIsLeavingGroup(true);

    const nextJoinedGroupIds = joinedGroupIds.filter(
      (groupId) => groupId !== currentGroup.id
    );

    setJoinedGroupIds(nextJoinedGroupIds);

    const nextGroup = allGroups.find((group) =>
      nextJoinedGroupIds.includes(group.id)
    );

    if (nextGroup) {
      handleChangeGroup(nextGroup.id);
    }

    setIsLeavingGroup(false);
  };

  const handleDeleteCurrentGroup = async () => {
    if (!currentGroup) {
      return;
    }

    const confirmDelete = window.confirm(
      `確定要刪除「${currentGroupName}」嗎？\n\n這會刪除這個地圖群的主資料與所有地點資料，無法復原。`
    );

    if (!confirmDelete) {
      return;
    }

    const secondConfirmDelete = window.confirm(
      `再次確認：真的要永久刪除「${currentGroupName}」嗎？`
    );

    if (!secondConfirmDelete) {
      return;
    }

    setIsDeletingGroup(true);

    try {
      const placesSnapshot = await getDocs(
        collection(db, "groups", currentGroup.id, "places")
      );

      await Promise.all(
        placesSnapshot.docs.map((placeDocument) =>
          deleteDoc(doc(db, "groups", currentGroup.id, "places", placeDocument.id))
        )
      );

      await deleteDoc(doc(db, "groups", currentGroup.id, "info", "meta"));
      await deleteDoc(doc(db, "groups", currentGroup.id));

      const nextJoinedGroupIds = joinedGroupIds.filter(
        (groupId) => groupId !== currentGroup.id
      );

      setJoinedGroupIds(nextJoinedGroupIds);
      setAllGroups((prev) =>
        prev.filter((group) => group.id !== currentGroup.id)
      );

      const nextGroup = allGroups.find(
        (group) =>
          group.id !== currentGroup.id && nextJoinedGroupIds.includes(group.id)
      );

      if (nextGroup) {
        handleChangeGroup(nextGroup.id);
      }
    } catch (error) {
      console.error(error);
      window.alert("刪除地圖群失敗，請稍後再試");
    } finally {
      setIsDeletingGroup(false);
    }
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

          <div className="rounded-lg bg-orange-50 px-2 py-1.5 text-[11px] text-orange-700">
            <div>目前顯示：{currentGroupName}</div>
            {currentInviteCode ? <div>邀請碼：{currentInviteCode}</div> : null}
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

      {!isLoadingPlaces && activeTab === "settings" && (
        <SettingsView
          currentGroupName={currentGroupName}
          currentInviteCode={currentInviteCode}
          newGroupName={newGroupName}
          joinInviteCode={joinInviteCode}
          isCreatingGroup={isCreatingGroup}
          isJoiningGroup={isJoiningGroup}
          isLeavingGroup={isLeavingGroup}
          isDeletingGroup={isDeletingGroup}
          onNewGroupNameChange={setNewGroupName}
          onJoinInviteCodeChange={setJoinInviteCode}
          onCreateGroup={handleCreateGroup}
          onJoinGroup={handleJoinGroup}
          onLeaveGroup={handleLeaveCurrentGroup}
          onDeleteGroup={handleDeleteCurrentGroup}
        />
      )}

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
