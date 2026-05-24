"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
  RATING_OPTIONS,
  RATING_LABELS,
  type BestTimingItem,
  type PlaceItem,
  type PlaceStatus,
} from "@/lib/places";

const libraries: "places"[] = ["places"];

export type PlaceFormValues = {
  name: string;
  status: PlaceStatus;
  address: string;
  rating: number;
  photos: string[];
  coverPhotoIndex: number;
  completedDate: string;
  lat?: number;
  lng?: number;
  tagsText: string;
  navigationTarget: string;
  notes: string;
  bestTimings: BestTimingItem[];
};

type PlaceFormModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  initialPlace: PlaceItem | null;
  availableTags?: string[];
  onClose: () => void;
  onSubmit: (values: PlaceFormValues) => void | Promise<void>;
};

type PhotoPreviewState = {
  photos: string[];
  index: number;
} | null;

const inputClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 opacity-100 placeholder:text-slate-500";

const labelTitleClassName = "mb-1 block font-semibold text-slate-800";
const PLACE_PHOTO_LIMIT = 1;
const AUTOCOMPLETE_MIN_LENGTH = 4;
const AUTOCOMPLETE_DEBOUNCE_MS = 400;
const PLACE_CACHE_STORAGE_KEY = "map-memory-place-autocomplete-cache-v1";

type UploadStatus = {
  stage: "idle" | "preview" | "compressing" | "uploading" | "done" | "error";
  progress: number;
  message: string;
};

const idleUploadStatus: UploadStatus = {
  stage: "idle",
  progress: 0,
  message: "",
};
const MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

type CachedPlaceInfo = {
  lat: number;
  lng: number;
  navigationTarget: string;
  address: string;
  updatedAt: string;
};

function buildPlaceCacheKey(name: string, address: string) {
  return `${name.trim().toLowerCase()}__${address.trim().toLowerCase()}`;
}

function readPlaceCache() {
  if (typeof window === "undefined") return {} as Record<string, CachedPlaceInfo>;

  try {
    const raw = window.localStorage.getItem(PLACE_CACHE_STORAGE_KEY);
    if (!raw) return {} as Record<string, CachedPlaceInfo>;

    const parsed = JSON.parse(raw) as Record<string, CachedPlaceInfo>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {} as Record<string, CachedPlaceInfo>;
  }
}

function readCachedPlace(name: string, address: string) {
  if (!name.trim() || !address.trim()) return null;

  const cache = readPlaceCache();
  const cached = cache[buildPlaceCacheKey(name, address)];

  if (!cached) return null;
  if (typeof cached.lat !== "number" || typeof cached.lng !== "number") return null;

  return cached;
}

function writeCachedPlace(name: string, address: string, value: Omit<CachedPlaceInfo, "updatedAt">) {
  if (typeof window === "undefined") return;
  if (!name.trim() || !address.trim()) return;

  const cache = readPlaceCache();
  const nextCache = {
    ...cache,
    [buildPlaceCacheKey(name, address)]: {
      ...value,
      updatedAt: new Date().toISOString(),
    },
  };

  window.localStorage.setItem(PLACE_CACHE_STORAGE_KEY, JSON.stringify(nextCache));
}


function loadImageFromObjectUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function compressImage(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await loadImageFromObjectUrl(objectUrl);
    const maxSize = 1600;

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (width > height && width > maxSize) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else if (height > maxSize) {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) {
      throw new Error("Canvas context not found");
    }

    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (nextBlob) => {
          if (!nextBlob) {
            reject(new Error("Compression failed"));
            return;
          }

          resolve(nextBlob);
        },
        "image/webp",
        0.75,
      );
    });

    return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
      type: "image/webp",
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function uploadFileWithProgress(
  file: File,
  folder: string,
  onProgress: (progress: number) => void,
): Promise<string> {
  const safeFileName = file.name.replace(/[^\w.\-]/g, "_");
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}-${safeFileName}`;
  const storageRef = ref(storage, `${folder}/${fileName}`);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type || "image/webp",
  });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 0;

        onProgress(progress);
      },
      reject,
      async () => {
        const downloadUrl = await getDownloadURL(task.snapshot.ref);
        resolve(downloadUrl);
      },
    );
  });
}


function parseTags(tagsText: string) {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function createBestTimingId() {
  return `timing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBestTimings(bestTimings: BestTimingItem[]) {
  return bestTimings
    .map((item) => {
      if (item.kind === "months") {
        return {
          id: item.id || createBestTimingId(),
          kind: "months" as const,
          title: "月份提醒",
          note: item.note?.trim() || "",
          months: Array.isArray(item.months)
            ? Array.from(new Set(item.months)).sort((a, b) => a - b)
            : [],
        };
      }

      return {
        id: item.id || createBestTimingId(),
        kind: "dateRange" as const,
        title: "日期區間提醒",
        note: item.note?.trim() || "",
        startDate: item.startDate ?? "",
        endDate: item.endDate ?? "",
      };
    })
    .filter((item) => {
      if (item.kind === "months") {
        return Array.isArray(item.months) && item.months.length > 0;
      }

      return Boolean(item.startDate || item.endDate);
    });
}

function migrateOldBestTiming(
  initialPlace: PlaceItem | null,
): BestTimingItem[] {
  if (!initialPlace) return [];

  if (Array.isArray(initialPlace.bestTimings)) {
    return initialPlace.bestTimings;
  }

  const oldBestTiming = initialPlace.bestTiming;

  if (!oldBestTiming) return [];

  const items: BestTimingItem[] = [];

  if (Array.isArray(oldBestTiming.months) && oldBestTiming.months.length > 0) {
    items.push({
      id: createBestTimingId(),
      kind: "months",
      title: "適合月份",
      note: "",
      months: oldBestTiming.months,
    });
  }

  if (Array.isArray(oldBestTiming.timeRanges)) {
    oldBestTiming.timeRanges.forEach((range) => {
      if (range.start || range.end) {
        items.push({
          id: createBestTimingId(),
          kind: "dateRange",
          title: "適合期間",
          note: "",
          startDate: range.start,
          endDate: range.end,
        });
      }
    });
  }

  return items;
}

function buildInitialValues(initialPlace: PlaceItem | null): PlaceFormValues {
  return {
    name: initialPlace?.name ?? "",
    status: initialPlace?.status ?? "wantToGo",
    address: initialPlace?.address ?? "",
    rating: initialPlace?.rating ?? 0,
    photos: (initialPlace?.photos ?? []).slice(0, PLACE_PHOTO_LIMIT),
    coverPhotoIndex: initialPlace?.coverPhotoIndex ?? 0,
    completedDate: initialPlace?.completedDate ?? "",
    lat: initialPlace?.lat,
    lng: initialPlace?.lng,
    tagsText: initialPlace?.tags.join(", ") ?? "",
    navigationTarget: initialPlace?.navigationTarget ?? "",
    notes: initialPlace?.notes ?? "",
    bestTimings: migrateOldBestTiming(initialPlace),
  };
}

export function PlaceFormModal({
  isOpen,
  mode,
  initialPlace,
  availableTags = [],
  onClose,
  onSubmit,
}: PlaceFormModalProps) {
  const addressAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(
    null,
  );
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const { isLoaded } = useJsApiLoader({
    id: "map-memory-google-script",
    googleMapsApiKey: apiKey,
    libraries,
  });

  const [previewPhoto, setPreviewPhoto] = useState<PhotoPreviewState>(null);
  const [formValues, setFormValues] = useState<PlaceFormValues>(() =>
    buildInitialValues(initialPlace),
  );
  const [newTagText, setNewTagText] = useState("");
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadStatus, setUploadStatus] =
    useState<UploadStatus>(idleUploadStatus);
  const [debouncedAddress, setDebouncedAddress] = useState(() =>
    buildInitialValues(initialPlace).address.trim(),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedAddress(formValues.address.trim());
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [formValues.address]);

  useEffect(() => {
    const cached = readCachedPlace(formValues.name, debouncedAddress);

    if (!cached) return;

    setFormValues((prev) => {
      if (prev.lat === cached.lat && prev.lng === cached.lng) return prev;

      return {
        ...prev,
        lat: cached.lat,
        lng: cached.lng,
        navigationTarget: cached.navigationTarget || prev.navigationTarget,
      };
    });
  }, [debouncedAddress, formValues.name]);

  const shouldUseAddressAutocomplete =
    isLoaded && debouncedAddress.length >= AUTOCOMPLETE_MIN_LENGTH;

  const title = useMemo(
    () => (mode === "create" ? "新增地點" : "編輯地點"),
    [mode],
  );

  const selectedTags = useMemo(
    () => parseTags(formValues.tagsText),
    [formValues.tagsText],
  );

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();

    availableTags.forEach((tag) => tags.add(tag));
    selectedTags.forEach((tag) => tags.add(tag));

    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [availableTags, selectedTags]);

  if (!isOpen) return null;

  const handleChange = <K extends keyof PlaceFormValues>(
    key: K,
    value: PlaceFormValues[K],
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddMonthTiming = () => {
    setFormValues((prev) => ({
      ...prev,
      bestTimings: [
        ...prev.bestTimings,
        {
          id: createBestTimingId(),
          kind: "months",
          title: "月份提醒",
          note: "",
          months: [],
        },
      ],
    }));
  };

  const handleAddDateRangeTiming = () => {
    setFormValues((prev) => ({
      ...prev,
      bestTimings: [
        ...prev.bestTimings,
        {
          id: createBestTimingId(),
          kind: "dateRange",
          title: "日期區間提醒",
          note: "",
          startDate: "",
          endDate: "",
        },
      ],
    }));
  };

  const updateBestTimingItem = <K extends keyof BestTimingItem>(
    timingId: string,
    key: K,
    value: BestTimingItem[K],
  ) => {
    setFormValues((prev) => ({
      ...prev,
      bestTimings: prev.bestTimings.map((item) =>
        item.id === timingId ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const deleteBestTimingItem = (timingId: string) => {
    setFormValues((prev) => ({
      ...prev,
      bestTimings: prev.bestTimings.filter((item) => item.id !== timingId),
    }));
  };

  const toggleBestTimingMonth = (timingId: string, month: number) => {
    setFormValues((prev) => ({
      ...prev,
      bestTimings: prev.bestTimings.map((item) => {
        if (item.id !== timingId || item.kind !== "months") {
          return item;
        }

        const currentMonths = Array.isArray(item.months) ? item.months : [];
        const nextMonths = currentMonths.includes(month)
          ? currentMonths.filter((targetMonth) => targetMonth !== month)
          : [...currentMonths, month].sort((a, b) => a - b);

        return {
          ...item,
          months: nextMonths,
        };
      }),
    }));
  };

  const handleAddressPlaceChanged = () => {
    const place = addressAutocompleteRef.current?.getPlace();

    if (!place) {
      window.alert("沒有取得地點資料，請重新選擇一次");
      return;
    }

    const lat = place.geometry?.location?.lat();
    const lng = place.geometry?.location?.lng();

    if (typeof lat !== "number" || typeof lng !== "number") {
      window.alert("沒有取得經緯度，請改選 Google 下拉建議中的地點");
      return;
    }

    const navigationTarget =
      place.name
        ?.replace(/[^\u4e00-\u9fa5（）()、・．.－\-\s]/g, "")
        .trim() ||
      place.name ||
      "";
    const pickedAddress = place.formatted_address || formValues.address;
    const placeNameForCache = formValues.name.trim() || navigationTarget;

    writeCachedPlace(placeNameForCache, pickedAddress, {
      lat,
      lng,
      navigationTarget,
      address: pickedAddress,
    });

    setFormValues((prev) => ({
      ...prev,
      address: pickedAddress,
      navigationTarget: navigationTarget || prev.navigationTarget,
      lat,
      lng,
    }));
  };

  const handleAddressInputChange = (nextAddress: string) => {
    const cached = readCachedPlace(formValues.name, nextAddress);

    if (cached) {
      setFormValues((prev) => ({
        ...prev,
        address: nextAddress,
        lat: cached.lat,
        lng: cached.lng,
        navigationTarget: cached.navigationTarget || prev.navigationTarget,
      }));
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      address: nextAddress,
      lat: undefined,
      lng: undefined,
    }));
  };


  const syncTags = (nextTags: string[]) => {
    handleChange("tagsText", Array.from(new Set(nextTags)).join(", "));
  };

  const toggleTag = (tag: string) => {
    syncTags(
      selectedTags.includes(tag)
        ? selectedTags.filter((item) => item !== tag)
        : [...selectedTags, tag],
    );
  };

  const addNewTag = () => {
    const nextTag = newTagText.trim();

    if (!nextTag) return;

    syncTags([...selectedTags, nextTag]);
    setNewTagText("");
  };

  const handleValidateAndSubmit = async () => {
    const nextErrors: { name?: string; address?: string } = {};

    if (!formValues.name.trim()) {
      nextErrors.name = "地點名稱為必填";
    }

    if (!formValues.address.trim()) {
      nextErrors.address = "地址為必填";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    if (isUploadingPhoto) {
      window.alert("照片上傳中，請稍候");
      return;
    }

    const safeCoverPhotoIndex =
      formValues.photos.length === 0
        ? 0
        : Math.min(
            Math.max(formValues.coverPhotoIndex, 0),
            formValues.photos.length - 1,
          );

    await onSubmit({
      ...formValues,
      coverPhotoIndex: safeCoverPhotoIndex,
      status: "wantToGo",
      completedDate: "",
      bestTimings: normalizeBestTimings(formValues.bestTimings),
    });
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (formValues.photos.length >= PLACE_PHOTO_LIMIT) {
      window.alert("地點照片最多 1 張，請先刪除原本照片再重新上傳");
      return;
    }

    const selectedFile = Array.from(files)[0];
    const localPreviewUrl = URL.createObjectURL(selectedFile);

    setIsUploadingPhoto(true);
    setUploadStatus({
      stage: "preview",
      progress: 5,
      message: "建立照片預覽中...",
    });

    setFormValues((prev) => ({
      ...prev,
      photos: [localPreviewUrl],
      coverPhotoIndex: 0,
    }));

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      setUploadStatus({
        stage: "compressing",
        progress: 15,
        message: "照片壓縮中...",
      });

      const compressedFile = await compressImage(selectedFile);

      setUploadStatus({
        stage: "uploading",
        progress: 25,
        message: "照片上傳中...",
      });

      const downloadUrl = await uploadFileWithProgress(
        compressedFile,
        "places",
        (progress) => {
          setUploadStatus({
            stage: "uploading",
            progress: Math.max(25, progress),
            message: `照片上傳中... ${progress}%`,
          });
        },
      );

      setFormValues((prev) => ({
        ...prev,
        photos: [downloadUrl],
        coverPhotoIndex: 0,
      }));

      setUploadStatus({
        stage: "done",
        progress: 100,
        message: "照片上傳完成",
      });
    } catch (error) {
      console.error(error);
      URL.revokeObjectURL(localPreviewUrl);
      setFormValues((prev) => ({
        ...prev,
        photos: [],
        coverPhotoIndex: 0,
      }));
      setUploadStatus({
        stage: "error",
        progress: 0,
        message: "照片上傳失敗，請重新上傳",
      });
      window.alert("照片上傳失敗，請稍後再試");
    } finally {
      setIsUploadingPhoto(false);

      window.setTimeout(() => {
        URL.revokeObjectURL(localPreviewUrl);
        setUploadStatus(idleUploadStatus);
      }, 1200);
    }
  };

  const handleDeletePhoto = (index: number) => {
    setFormValues((prev) => {
      const nextPhotos = prev.photos.filter((_, idx) => idx !== index);

      let nextCoverPhotoIndex = prev.coverPhotoIndex;

      if (nextPhotos.length === 0) {
        nextCoverPhotoIndex = 0;
      } else if (prev.coverPhotoIndex === index) {
        nextCoverPhotoIndex = Math.min(index, nextPhotos.length - 1);
      } else if (prev.coverPhotoIndex > index) {
        nextCoverPhotoIndex = prev.coverPhotoIndex - 1;
      }

      return {
        ...prev,
        photos: nextPhotos,
        coverPhotoIndex: nextCoverPhotoIndex,
      };
    });
  };

  const closePreview = () => setPreviewPhoto(null);

  const showPrevPhoto = () => {
    setPreviewPhoto((prev) =>
      prev
        ? {
            ...prev,
            index: (prev.index - 1 + prev.photos.length) % prev.photos.length,
          }
        : prev,
    );
  };

  const showNextPhoto = () => {
    setPreviewPhoto((prev) =>
      prev
        ? {
            ...prev,
            index: (prev.index + 1) % prev.photos.length,
          }
        : prev,
    );
  };

  const getComparableValues = (values: PlaceFormValues) => ({
    ...values,
    coverPhotoIndex:
      values.photos.length === 0
        ? 0
        : Math.min(Math.max(values.coverPhotoIndex, 0), values.photos.length - 1),
    status: "wantToGo" as PlaceStatus,
    completedDate: "",
    bestTimings: normalizeBestTimings(values.bestTimings),
  });

  const isDirty = () => {
    const initialValues = buildInitialValues(initialPlace);

    return (
      JSON.stringify(getComparableValues(formValues)) !==
      JSON.stringify(getComparableValues(initialValues))
    );
  };

  const handleRequestClose = () => {
    if (isUploadingPhoto) {
      window.alert("照片上傳中，請稍候");
      return;
    }

    if (isDirty()) {
      const ok = window.confirm("尚未儲存內容，確定離開？");
      if (!ok) return;
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[250] flex items-end justify-center bg-slate-900/50 px-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-3"
      onClick={handleRequestClose}
    >
      <div
        className="flex max-h-[calc(100dvh-7rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 p-4 pb-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>

            <button
              type="button"
              onClick={handleRequestClose}
              className="rounded-md px-2 py-1 text-sm font-semibold text-slate-700"
            >
              關閉
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-3 text-slate-800">
            <label className="block text-sm">
              <span className={labelTitleClassName}>
                地點名稱
                <span className="ml-1 font-bold text-red-500">(必填)</span>
              </span>

              <input
                value={formValues.name}
                onChange={(event) => handleChange("name", event.target.value)}
                className={inputClassName}
              />

              {errors.name ? (
                <span className="mt-1 block text-xs font-semibold text-rose-600">
                  {errors.name}
                </span>
              ) : null}
            </label>


            <label className="block text-sm">
              <span className={labelTitleClassName}>
                地址
                <span className="ml-1 font-bold text-red-500">(必填)</span>
              </span>

              {shouldUseAddressAutocomplete ? (
                <Autocomplete
                  onLoad={(autocomplete) => {
                    addressAutocompleteRef.current = autocomplete;
                  }}
                  onPlaceChanged={handleAddressPlaceChanged}
                  options={{
                    fields: ["name", "formatted_address", "geometry.location"],
                    componentRestrictions: { country: "tw" },
                  }}
                >
                  <input
                    value={formValues.address}
                    onChange={(event) =>
                      handleAddressInputChange(event.target.value)
                    }
                    placeholder="輸入地址或地標，例如：淡水漁人碼頭"
                    className={inputClassName}
                  />
                </Autocomplete>
              ) : (
                <input
                  value={formValues.address}
                  onChange={(event) =>
                    handleAddressInputChange(event.target.value)
                  }
                  placeholder="輸入地址或地標，例如：淡水漁人碼頭"
                  className={inputClassName}
                />
              )}

              {errors.address ? (
                <span className="mt-1 block text-xs font-semibold text-rose-600">
                  {errors.address}
                </span>
              ) : null}

              {formValues.lat && formValues.lng ? (
                <span className="mt-1 block text-[11px] font-medium text-slate-600">
                  已取得位置：{formValues.lat.toFixed(5)},{" "}
                  {formValues.lng.toFixed(5)}
                </span>
              ) : (
                <span className="mt-1 block text-[11px] font-bold text-amber-600">
                  請從搜尋建議中選擇地點，才能取得正確地標位置
                </span>
              )}
            </label>

            <label className="block text-sm">
              <span className={labelTitleClassName}>喜歡程度（0~5）</span>

              <select
                value={formValues.rating}
                onChange={(event) =>
                  handleChange("rating", Number(event.target.value))
                }
                className={inputClassName}
              >
                {RATING_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} - {RATING_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm">
              <div className="mb-2">
                <div className="font-bold text-slate-900">適合期間提醒</div>
                <div className="mt-0.5 text-xs text-slate-600">
                  可設定多個月份或日期區間；符合期間時，地圖地標會高亮提醒。
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleAddMonthTiming}
                  className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white"
                >
                  ＋新增月份提醒
                </button>

                <button
                  type="button"
                  onClick={handleAddDateRangeTiming}
                  className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white"
                >
                  ＋新增日期區間
                </button>
              </div>

              {formValues.bestTimings.length === 0 ? (
                <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-500">
                  尚未設定適合期間。
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {formValues.bestTimings.map((timing, index) => (
                    <div
                      key={timing.id}
                      className="rounded-xl border border-orange-100 bg-white p-3 shadow-sm"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-orange-600">
                          {timing.kind === "months"
                            ? `月份提醒 #${index + 1}`
                            : `日期區間 #${index + 1}`}
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteBestTimingItem(timing.id)}
                          className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-600"
                        >
                          刪除
                        </button>
                      </div>

                      {timing.kind === "months" ? (
                        <div>
                          <div className="mb-1 text-xs font-semibold text-slate-700">
                            適合月份
                          </div>

                          <div className="grid grid-cols-6 gap-1.5">
                            {MONTH_OPTIONS.map((month) => {
                              const checked = timing.months?.includes(month);

                              return (
                                <button
                                  key={month}
                                  type="button"
                                  onClick={() =>
                                    toggleBestTimingMonth(timing.id, month)
                                  }
                                  className={`rounded-lg border px-2 py-1.5 text-xs font-bold ${
                                    checked
                                      ? "border-orange-500 bg-orange-500 text-white"
                                      : "border-slate-200 bg-white text-slate-600"
                                  }`}
                                >
                                  {month}月
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-700">
                              開始日期
                            </span>

                            <input
                              type="date"
                              value={timing.startDate ?? ""}
                              onChange={(event) =>
                                updateBestTimingItem(
                                  timing.id,
                                  "startDate",
                                  event.target.value,
                                )
                              }
                              className={inputClassName}
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-700">
                              結束日期
                            </span>

                            <input
                              type="date"
                              value={timing.endDate ?? ""}
                              onChange={(event) =>
                                updateBestTimingItem(
                                  timing.id,
                                  "endDate",
                                  event.target.value,
                                )
                              }
                              className={inputClassName}
                            />
                          </label>
                        </div>
                      )}

                      <label className="mt-3 block">
                        <span className="mb-1 block text-xs font-semibold text-slate-700">
                          提醒文字
                        </span>

                        <input
                          value={timing.note ?? ""}
                          onChange={(event) =>
                            updateBestTimingItem(
                              timing.id,
                              "note",
                              event.target.value,
                            )
                          }
                          placeholder="例如：現在最漂亮、建議傍晚去、退潮時比較適合"
                          className={inputClassName}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="block text-sm">
              <span className={labelTitleClassName}>地點照片（最多 1 張）</span>

              <label
                className={`inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-bold text-white ${
                  isUploadingPhoto ||
                  formValues.photos.length >= PLACE_PHOTO_LIMIT
                    ? "bg-slate-300"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                選擇檔案
                <input
                  type="file"
                  accept="image/*"
                  disabled={
                    isUploadingPhoto ||
                    formValues.photos.length >= PLACE_PHOTO_LIMIT
                  }
                  onChange={(event) => {
                    handlePhotoUpload(event.target.files).catch(() => {
                      window.alert("照片讀取失敗，請重新上傳");
                    });

                    event.target.value = "";
                  }}
                  className="hidden"
                />
              </label>

              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-slate-600">
                  {uploadStatus.stage !== "idle"
                    ? uploadStatus.message
                    : `已上傳 ${formValues.photos.length}/1`}
                </p>

                {uploadStatus.stage !== "idle" ? (
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all duration-200"
                      style={{ width: `${uploadStatus.progress}%` }}
                    />
                  </div>
                ) : null}
              </div>

              {formValues.photos.length > 0 ? (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {formValues.photos.map((photo, index) => {
                    const isCover = formValues.coverPhotoIndex === index;

                    return (
                      <div
                        key={`${photo.slice(0, 32)}-${index}`}
                        className={`overflow-hidden rounded-lg border bg-slate-100 ${
                          isCover
                            ? "border-orange-500 ring-2 ring-orange-200"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                photos: formValues.photos,
                                index,
                              })
                            }
                            className="block w-full"
                          >
                            <img
                              src={photo}
                              alt={`photo-${index + 1}`}
                              className="h-40 w-full object-cover"
                            />
                          </button>

                          {isCover ? (
                            <span className="absolute left-1 top-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              封面
                            </span>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(index)}
                            className="absolute right-1 top-1 rounded-full bg-slate-900/75 px-1.5 py-0.5 text-xs text-white"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="bg-white px-2 py-1.5 text-center text-[11px] font-semibold text-slate-600">
                          地點封面照片
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-slate-800">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">
                  標籤（可複選）
                </span>

                <span className="text-xs font-medium text-slate-600">
                  已選 {selectedTags.length}
                </span>
              </div>

              {tagOptions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tagOptions.map((tag) => {
                    const checked = selectedTags.includes(tag);

                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          checked
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {checked ? "✓ " : ""}#{tag}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs font-medium text-slate-600">
                  尚無既有標籤，可在下方新增。
                </p>
              )}

              <div className="mt-3 flex gap-2">
                <input
                  value={newTagText}
                  onChange={(event) => setNewTagText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addNewTag();
                    }
                  }}
                  placeholder="新增標籤，例如：咖啡、景點"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 opacity-100 placeholder:text-slate-500"
                />

                <button
                  type="button"
                  onClick={addNewTag}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                >
                  新增
                </button>
              </div>
            </div>

            <label className="block text-sm">
              <span className={labelTitleClassName}>導航目標</span>

              <input
                value={formValues.navigationTarget}
                onChange={(event) =>
                  handleChange("navigationTarget", event.target.value)
                }
                placeholder="輸入導航目標，例如：漁人碼頭"
                className={inputClassName}
              />
            </label>

            <label className="block text-sm">
              <span className={labelTitleClassName}>筆記</span>

              <textarea
                value={formValues.notes}
                onChange={(event) => handleChange("notes", event.target.value)}
                rows={4}
                className={inputClassName}
              />
            </label>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white p-4">
          <button
            type="button"
            onClick={handleValidateAndSubmit}
            disabled={isUploadingPhoto}
            className="w-full rounded-lg bg-orange-500 px-3 py-3 text-sm font-bold text-white shadow-lg disabled:bg-slate-400"
          >
            {isUploadingPhoto
              ? "照片上傳中..."
              : mode === "create"
                ? "新增地點"
                : "儲存變更"}
          </button>
        </div>
      </div>

      {previewPhoto ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 p-4"
          onClick={closePreview}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-5xl items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closePreview}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/60 px-3 py-1.5 text-sm font-bold text-white"
              aria-label="關閉預覽"
            >
              ✕
            </button>

            {previewPhoto.photos.length > 1 ? (
              <button
                type="button"
                onClick={showPrevPhoto}
                className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl font-bold text-white"
                aria-label="上一張"
              >
                ‹
              </button>
            ) : null}

            <img
              src={previewPhoto.photos[previewPhoto.index]}
              alt={`preview-${previewPhoto.index + 1}`}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            />

            {previewPhoto.photos.length > 1 ? (
              <button
                type="button"
                onClick={showNextPhoto}
                className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl font-bold text-white"
                aria-label="下一張"
              >
                ›
              </button>
            ) : null}

            {previewPhoto.photos.length > 1 ? (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                {previewPhoto.index + 1} / {previewPhoto.photos.length}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
