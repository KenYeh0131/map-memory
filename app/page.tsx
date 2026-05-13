"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  deleteField,
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
import {
  VisitFormModal,
  type VisitFormValues,
} from "@/components/VisitFormModal";
import { db } from "@/lib/firebase";
import type { PlaceItem } from "@/lib/places";

type TabId = "map" | "list" | "settings";

export type MapGroup = {
  id: string;
  name: string;
  inviteCode?: string;
  ownerDeviceId?: string;
};

export type JoinRequest = {
  id: string;
  nickname: string;
  deviceId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string;
};

type VisitItem = NonNullable<PlaceItem["visits"]>[number];

const FALLBACK_GROUPS: MapGroup[] = [];

const DEFAULT_GROUP_ID = "initializing";
const CURRENT_GROUP_STORAGE_KEY = "map-memory-current-group-v1";
const JOINED_GROUPS_STORAGE_KEY = "map-memory-joined-groups-v1";
const DEVICE_ID_STORAGE_KEY = "map-memory-device-id-v1";
const NICKNAME_STORAGE_KEY = "map-memory-nickname-v1";

const PHOTO_LIMIT = 10;

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
    tags: Array.isArray(data.tags) ? data.tags : [],
    navigationTarget: data.navigationTarget ?? "",
    notes: data.notes ?? "",
    lat: data.lat,
    lng: data.lng,
    visits: Array.isArray(data.visits) ? data.visits : [],
    visitCount: data.visitCount ?? 0,
    firstVisitedAt: data.firstVisitedAt,
    lastVisitedAt: data.lastVisitedAt,
    bestTiming: data.bestTiming,
    createdAt: data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

function loadJoinedGroupIds() {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(JOINED_GROUPS_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as string[];

    if (!Array.isArray(parsed)) {
      throw new Error("invalid joined groups");
    }

    return parsed.filter(
      (groupId) => typeof groupId === "string" && groupId.trim().length > 0
    );
  } catch {
    return [];
  }
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined") {
    return "device-server";
  }

  const existingDeviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const newDeviceId = `device-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, newDeviceId);

  return newDeviceId;
}

function loadNickname() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "";
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
  const mergedGroups: MapGroup[] = [...FALLBACK_GROUPS];

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

function getVisitDates(visits: VisitItem[]) {
  return visits.map((visit) => visit.visitDate).filter(Boolean).sort();
}

function buildVisitSummaryUpdate(visits: VisitItem[]) {
  const sortedDates = getVisitDates(visits);
  const updateData: Record<string, unknown> = {
    visits,
    visitCount: visits.length,
    updatedAt: new Date().toISOString(),
  };

  if (sortedDates.length > 0) {
    updateData.firstVisitedAt = sortedDates[0];
    updateData.lastVisitedAt = sortedDates[sortedDates.length - 1];
  } else {
    updateData.firstVisitedAt = deleteField();
    updateData.lastVisitedAt = deleteField();
  }

  return updateData;
}

export default function Home() {
  const hasCreatedInitialGroupRef = useRef(false);
  const [activeTab, setActiveTab] = useState<TabId>("map");
  const [allGroups, setAllGroups] = useState<MapGroup[]>(FALLBACK_GROUPS);
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>(() =>
    loadJoinedGroupIds()
  );
  const [currentGroupId, setCurrentGroupId] = useState(DEFAULT_GROUP_ID);
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [nickname, setNickname] = useState(() => loadNickname());
  const [newGroupName, setNewGroupName] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [selectedDeleteTags, setSelectedDeleteTags] = useState<string[]>([]);
  const [isJoinRequestPopupOpen, setIsJoinRequestPopupOpen] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);
  const [isApprovingRequestId, setIsApprovingRequestId] =
    useState<string | null>(null);
  const [isRejectingRequestId, setIsRejectingRequestId] =
    useState<string | null>(null);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [filters, setFilters] = useState<PlaceFilters>(() => defaultFilters);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPlace, setEditingPlace] = useState<PlaceItem | null>(null);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [visitFormMode, setVisitFormMode] = useState<"create" | "edit">(
    "create"
  );
  const [visitTargetPlace, setVisitTargetPlace] = useState<PlaceItem | null>(
    null
  );
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editingVisitValues, setEditingVisitValues] =
    useState<VisitFormValues | null>(null);

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
    mapGroups.find((group) => group.id === safeCurrentGroupId) ?? mapGroups[0];

  const currentGroupName = currentGroup?.name ?? "建立你的回憶地圖中...";
  const currentInviteCode = currentGroup?.inviteCode ?? "";
  const isGroupOwner = currentGroup?.ownerDeviceId === deviceId;

  const groupsCollectionRef = useMemo(() => collection(db, "groups"), []);

  const placesCollectionRef = useMemo(
    () => collection(db, "groups", safeCurrentGroupId, "places"),
    [safeCurrentGroupId]
  );

  const joinRequestsCollectionRef = useMemo(
    () => collection(db, "groups", safeCurrentGroupId, "joinRequests"),
    [safeCurrentGroupId]
  );

  useEffect(() => {
    if (joinedGroupIds.length > 0) {
      return;
    }

    if (hasCreatedInitialGroupRef.current) {
      return;
    }

    hasCreatedInitialGroupRef.current = true;

    const createInitialPrivateGroup = async () => {
      const now = new Date().toISOString();

      const newGroup: MapGroup = {
        id: createGroupId("我的回憶地圖"),
        name: "我的回憶地圖",
        inviteCode: createInviteCode(),
        ownerDeviceId: deviceId,
      };

      try {
        await setDoc(doc(db, "groups", newGroup.id), {
          createdAt: now,
          ownerDeviceId: deviceId,
        });

        await setDoc(doc(db, "groups", newGroup.id, "info", "meta"), {
          name: newGroup.name,
          inviteCode: newGroup.inviteCode,
          ownerDeviceId: deviceId,
          createdAt: now,
        });

        setAllGroups((prev) => mergeGroups([...prev, newGroup]));
        setJoinedGroupIds([newGroup.id]);
        setCurrentGroupId(newGroup.id);
        setIsLoadingPlaces(true);

        if (typeof window !== "undefined") {
          window.localStorage.setItem(CURRENT_GROUP_STORAGE_KEY, newGroup.id);
          window.localStorage.setItem(
            JOINED_GROUPS_STORAGE_KEY,
            JSON.stringify([newGroup.id])
          );
        }
      } catch (error) {
        console.error(error);
        window.alert("建立你的私人回憶地圖失敗，請重新整理後再試");
      }
    };

    createInitialPrivateGroup();
  }, [deviceId, joinedGroupIds.length]);

  useEffect(() => {
    const savedGroupId = window.localStorage.getItem(CURRENT_GROUP_STORAGE_KEY);

    if (!savedGroupId) {
      return;
    }

    window.setTimeout(() => {
      setCurrentGroupId(savedGroupId);
    }, 0);
  }, []);

  useEffect(() => {
    if (currentGroupId === DEFAULT_GROUP_ID) {
      return;
    }

    window.localStorage.setItem(CURRENT_GROUP_STORAGE_KEY, currentGroupId);
  }, [currentGroupId]);

  useEffect(() => {
    window.localStorage.setItem(
      JOINED_GROUPS_STORAGE_KEY,
      JSON.stringify(joinedGroupIds)
    );
  }, [joinedGroupIds]);

  useEffect(() => {
    window.localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
  }, [nickname]);

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
              ownerDeviceId:
                typeof data.ownerDeviceId === "string"
                  ? data.ownerDeviceId
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

      setAllGroups(mergeGroups(firebaseGroups));
    });

    return () => unsubscribe();
  }, [groupsCollectionRef]);

  useEffect(() => {
    if (allGroups.length === 0) {
      return;
    }

    const unsubscribes = allGroups.map((group) => {
      const requestRef = doc(
        db,
        "groups",
        group.id,
        "joinRequests",
        deviceId
      );

      return onSnapshot(requestRef, (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }

        const data = snapshot.data();

        if (data.status === "approved") {
          setJoinedGroupIds((prev) => {
            if (prev.includes(group.id)) {
              return prev;
            }

            return [...prev, group.id];
          });
        }
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [allGroups, deviceId]);

  useEffect(() => {
    const requestsQuery = query(
      joinRequestsCollectionRef,
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const nextRequests = snapshot.docs
        .map((documentSnapshot) => {
          const data = documentSnapshot.data();

          return {
            id: documentSnapshot.id,
            nickname:
              typeof data.nickname === "string" ? data.nickname : "未命名",
            deviceId:
              typeof data.deviceId === "string" ? data.deviceId : "unknown",
            status:
              data.status === "approved" || data.status === "rejected"
                ? data.status
                : "pending",
            createdAt:
              typeof data.createdAt === "string"
                ? data.createdAt
                : new Date().toISOString(),
            updatedAt:
              typeof data.updatedAt === "string" ? data.updatedAt : undefined,
            reviewedAt:
              typeof data.reviewedAt === "string" ? data.reviewedAt : undefined,
          } satisfies JoinRequest;
        })
        .filter((request) => request.status === "pending");

      setJoinRequests(nextRequests);
    });

    return () => unsubscribe();
  }, [joinRequestsCollectionRef]);

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

  const openVisitModal = (place: PlaceItem) => {
    setVisitFormMode("create");
    setVisitTargetPlace(place);
    setEditingVisitId(null);
    setEditingVisitValues(null);
    setIsVisitModalOpen(true);
  };

  const openEditVisitModal = (placeId: string, visitId: string) => {
    const targetPlace = places.find((place) => place.id === placeId);

    if (!targetPlace) {
      window.alert("找不到這個地點");
      return;
    }

    const targetVisit = Array.isArray(targetPlace.visits)
      ? targetPlace.visits.find((visit) => visit.id === visitId)
      : null;

    if (!targetVisit) {
      window.alert("找不到這筆回憶");
      return;
    }

    setVisitFormMode("edit");
    setVisitTargetPlace(targetPlace);
    setEditingVisitId(visitId);
    setEditingVisitValues({
      visitDate: targetVisit.visitDate,
      note: targetVisit.note ?? "",
      photos: Array.isArray(targetVisit.photos) ? targetVisit.photos : [],
      rating: targetVisit.rating ?? 0,
    });
    setIsVisitModalOpen(true);
  };

  const closeVisitModal = () => {
    setVisitTargetPlace(null);
    setEditingVisitId(null);
    setEditingVisitValues(null);
    setVisitFormMode("create");
    setIsVisitModalOpen(false);
  };

  const handleChangeGroup = (groupId: string) => {
    setSelectedPlaceId(null);
    setEditingPlace(null);
    setIsFormOpen(false);
    setPlaces([]);
    setIsLoadingPlaces(true);
    setCurrentGroupId(groupId);
    setSelectedDeleteTags([]);
    setIsJoinRequestPopupOpen(false);
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
      ownerDeviceId: deviceId,
    };

    try {
      await setDoc(doc(db, "groups", newGroup.id), {
        createdAt: new Date().toISOString(),
        ownerDeviceId: deviceId,
      });

      await setDoc(doc(db, "groups", newGroup.id, "info", "meta"), {
        name: newGroup.name,
        inviteCode: newGroup.inviteCode,
        ownerDeviceId: deviceId,
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

  const handleRequestJoinGroup = async () => {
    const normalizedInviteCode = joinInviteCode.trim().toUpperCase();
    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      window.alert("請先輸入你的暱稱，這樣對方才知道是誰申請加入");
      return;
    }

    if (!normalizedInviteCode) {
      window.alert("請輸入邀請碼");
      return;
    }

    setIsRequestingJoin(true);

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
            inviteCode:
              typeof data.inviteCode === "string" ? data.inviteCode : "",
            ownerDeviceId:
              typeof data.ownerDeviceId === "string"
                ? data.ownerDeviceId
                : undefined,
          };
          break;
        }
      }

      if (!matchedGroup) {
        window.alert("找不到這個邀請碼，請確認是否輸入正確");
        return;
      }

      if (joinedGroupIds.includes(matchedGroup.id)) {
        window.alert("你已經加入這個地圖群了");
        handleChangeGroup(matchedGroup.id);
        return;
      }

      await setDoc(
        doc(db, "groups", matchedGroup.id, "joinRequests", deviceId),
        {
          nickname: trimmedNickname,
          deviceId,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );

      setJoinInviteCode("");
      window.alert("已送出加入申請，請等待對方同意");
    } catch (error) {
      console.error(error);
      window.alert("送出加入申請失敗，請稍後再試");
    } finally {
      setIsRequestingJoin(false);
    }
  };

  const handleApproveJoinRequest = async (requestId: string) => {
    setIsApprovingRequestId(requestId);

    try {
      await updateDoc(
        doc(db, "groups", safeCurrentGroupId, "joinRequests", requestId),
        {
          status: "approved",
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error(error);
      window.alert("同意加入失敗，請稍後再試");
    } finally {
      setIsApprovingRequestId(null);
    }
  };

  const handleRejectJoinRequest = async (requestId: string) => {
    setIsRejectingRequestId(requestId);

    try {
      await updateDoc(
        doc(db, "groups", safeCurrentGroupId, "joinRequests", requestId),
        {
          status: "rejected",
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error(error);
      window.alert("拒絕加入失敗，請稍後再試");
    } finally {
      setIsRejectingRequestId(null);
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

    if (!isGroupOwner) {
      window.alert("只有建立這個地圖群的人可以刪除地圖群");
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
          deleteDoc(
            doc(db, "groups", currentGroup.id, "places", placeDocument.id)
          )
        )
      );

      const requestsSnapshot = await getDocs(
        collection(db, "groups", currentGroup.id, "joinRequests")
      );

      await Promise.all(
        requestsSnapshot.docs.map((requestDocument) =>
          deleteDoc(
            doc(
              db,
              "groups",
              currentGroup.id,
              "joinRequests",
              requestDocument.id
            )
          )
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
          photos: values.photos.slice(0, PHOTO_LIMIT),
          coverPhotoIndex: values.coverPhotoIndex ?? 0,
          tags: normalizeTags(values.tagsText),
          navigationTarget: values.navigationTarget.trim(),
          notes: values.notes.trim(),
          lat: values.lat ?? 25.052013567893294,
          lng: values.lng ?? 121.36444898053523,
          visits: [],
          visitCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(
          doc(db, "groups", safeCurrentGroupId, "places", placeId),
          newPlace
        );

        setSelectedPlaceId(placeId);
      } else if (editingPlace) {
        const updatedPlace: Partial<PlaceItem> = {
          name: values.name.trim(),
          status: values.status,
          address: values.address.trim(),
          rating: values.rating,
          photos: values.photos.slice(0, PHOTO_LIMIT),
          coverPhotoIndex: values.coverPhotoIndex ?? 0,
          tags: normalizeTags(values.tagsText),
          navigationTarget: values.navigationTarget.trim(),
          notes: values.notes.trim(),
          lat: values.lat ?? editingPlace.lat,
          lng: values.lng ?? editingPlace.lng,
          updatedAt: now,
        };

        await updateDoc(
          doc(db, "groups", safeCurrentGroupId, "places", editingPlace.id),
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

  const handleAddVisit = async (values: VisitFormValues) => {
    if (!visitTargetPlace) return;

    try {
      const now = new Date().toISOString();

      if (visitFormMode === "edit" && editingVisitId) {
        const currentVisits = Array.isArray(visitTargetPlace.visits)
          ? visitTargetPlace.visits
          : [];

        const nextVisits = currentVisits.map((visit) =>
          visit.id === editingVisitId
            ? {
                ...visit,
                visitDate: values.visitDate,
                note: values.note,
                photos: values.photos,
                rating: values.rating ?? 0,
                updatedAt: now,
              }
            : visit
        );

        await updateDoc(
          doc(db, "groups", safeCurrentGroupId, "places", visitTargetPlace.id),
          buildVisitSummaryUpdate(nextVisits)
        );

        setSelectedPlaceId(visitTargetPlace.id);
        closeVisitModal();
        return;
      }

      const nextVisit = {
        id: `visit-${Date.now()}`,
        visitDate: values.visitDate,
        note: values.note,
        photos: values.photos,
        rating: values.rating ?? 0,
        createdAt: now,
      };

      const currentVisits = Array.isArray(visitTargetPlace.visits)
        ? visitTargetPlace.visits
        : [];

      const nextVisits = [nextVisit, ...currentVisits];
      const updatedPlace = buildVisitSummaryUpdate(nextVisits);

      if (visitTargetPlace.status === "wantToGo") {
        updatedPlace.status = "wantToReturn";
      }

      await updateDoc(
        doc(db, "groups", safeCurrentGroupId, "places", visitTargetPlace.id),
        updatedPlace
      );

      setSelectedPlaceId(visitTargetPlace.id);
      closeVisitModal();
    } catch (error) {
      console.error(error);
      window.alert(
        visitFormMode === "edit" ? "更新回憶失敗，請稍後再試" : "新增回憶失敗，請稍後再試"
      );
    }
  };

  const handleDeleteVisit = async (placeId: string, visitId: string) => {
    const targetPlace = places.find((place) => place.id === placeId);

    if (!targetPlace) {
      window.alert("找不到這個地點");
      return;
    }

    const confirmDelete = window.confirm("確定要刪除這筆回憶嗎？");

    if (!confirmDelete) {
      return;
    }

    try {
      const currentVisits = Array.isArray(targetPlace.visits)
        ? targetPlace.visits
        : [];

      const nextVisits = currentVisits.filter((visit) => visit.id !== visitId);

      await updateDoc(
        doc(db, "groups", safeCurrentGroupId, "places", placeId),
        buildVisitSummaryUpdate(nextVisits)
      );

      setSelectedPlaceId((prev) => (prev === placeId ? placeId : prev));
    } catch (error) {
      console.error(error);
      window.alert("刪除回憶失敗，請稍後再試");
    }
  };

  const handleDeletePlace = async (placeId: string) => {
    try {
      await deleteDoc(doc(db, "groups", safeCurrentGroupId, "places", placeId));
      setSelectedPlaceId((prev) => (prev === placeId ? null : prev));
    } catch (error) {
      console.error(error);
      window.alert("刪除地點失敗，請稍後再試");
    }
  };

  const handleToggleDeleteTag = (tag: string) => {
    setSelectedDeleteTags((prev) =>
      prev.includes(tag)
        ? prev.filter((item) => item !== tag)
        : [...prev, tag]
    );
  };

  const handleDeleteSelectedTags = async () => {
    if (selectedDeleteTags.length === 0) {
      window.alert("請先選擇要刪除的標籤");
      return;
    }

    const confirmDelete = window.confirm(
      `確定要刪除 ${selectedDeleteTags.length} 個標籤嗎？`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const targetPlaces = places.filter((place) =>
        place.tags.some((tag) => selectedDeleteTags.includes(tag))
      );

      await Promise.all(
        targetPlaces.map((place) =>
          updateDoc(doc(db, "groups", safeCurrentGroupId, "places", place.id), {
            tags: place.tags.filter((tag) => !selectedDeleteTags.includes(tag)),
            updatedAt: new Date().toISOString(),
          })
        )
      );

      setSelectedDeleteTags([]);
    } catch (error) {
      console.error(error);
      window.alert("刪除標籤失敗，請稍後再試");
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

            <button
              type="button"
              onClick={() => setIsJoinRequestPopupOpen(true)}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm ring-1 ring-slate-200"
              aria-label="加入申請通知"
            >
              🔔

              {joinRequests.length > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {joinRequests.length}
                </span>
              ) : null}
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-2">
            <span className="shrink-0 text-xs font-semibold text-slate-500">
              地圖群
            </span>

            <select
              value={safeCurrentGroupId}
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
            onAddVisit={openVisitModal}
            onEditVisit={openEditVisitModal}
            onDeleteVisit={handleDeleteVisit}
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
          onAddVisit={openVisitModal}
          onEditVisit={openEditVisitModal}
          onDeleteVisit={handleDeleteVisit}
        />
      )}

      {!isLoadingPlaces && activeTab === "settings" && (
        <SettingsView
          currentGroupName={currentGroupName}
          nickname={nickname}
          newGroupName={newGroupName}
          joinInviteCode={joinInviteCode}
          joinRequests={joinRequests}
          availableTags={availableTags}
          selectedTags={selectedDeleteTags}
          isGroupOwner={isGroupOwner}
          onToggleDeleteTag={handleToggleDeleteTag}
          onDeleteSelectedTags={handleDeleteSelectedTags}
          isCreatingGroup={isCreatingGroup}
          isRequestingJoin={isRequestingJoin}
          isApprovingRequestId={isApprovingRequestId}
          isRejectingRequestId={isRejectingRequestId}
          isLeavingGroup={isLeavingGroup}
          isDeletingGroup={isDeletingGroup}
          onNicknameChange={setNickname}
          onNewGroupNameChange={setNewGroupName}
          onJoinInviteCodeChange={setJoinInviteCode}
          onCreateGroup={handleCreateGroup}
          onRequestJoinGroup={handleRequestJoinGroup}
          onApproveJoinRequest={handleApproveJoinRequest}
          onRejectJoinRequest={handleRejectJoinRequest}
          onLeaveGroup={handleLeaveCurrentGroup}
          onDeleteGroup={handleDeleteCurrentGroup}
        />
      )}

      <PlaceFormModal
        key={`${safeCurrentGroupId}-${formMode}-${editingPlace?.id ?? "new"}-${
          isFormOpen ? "open" : "closed"
        }`}
        isOpen={isFormOpen}
        mode={formMode}
        initialPlace={editingPlace}
        availableTags={availableTags}
        onClose={closeForm}
        onSubmit={handleSubmitForm}
      />

      <VisitFormModal
        isOpen={isVisitModalOpen}
        mode={visitFormMode}
        placeName={visitTargetPlace?.name ?? ""}
        initialValues={editingVisitValues}
        onClose={closeVisitModal}
        onSubmit={handleAddVisit}
      />

      {isJoinRequestPopupOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">加入申請</h2>

              <button
                type="button"
                onClick={() => setIsJoinRequestPopupOpen(false)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                關閉
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {joinRequests.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">
                  目前沒有新的申請
                </div>
              ) : (
                joinRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-slate-200 p-3"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {request.nickname}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      申請加入「{currentGroupName}」
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleApproveJoinRequest(request.id)}
                        disabled={Boolean(isApprovingRequestId)}
                        className="flex-1 rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                      >
                        {isApprovingRequestId === request.id
                          ? "同意中..."
                          : "同意"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRejectJoinRequest(request.id)}
                        disabled={Boolean(isRejectingRequestId)}
                        className="flex-1 rounded-xl bg-red-500 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                      >
                        {isRejectingRequestId === request.id
                          ? "拒絕中..."
                          : "拒絕"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}
