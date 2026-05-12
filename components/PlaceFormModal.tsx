"use client";

import { useMemo, useRef, useState } from "react";
import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
  RATING_OPTIONS,
  STATUS_OPTIONS,
  type PlaceItem,
  type PlaceStatus,
} from "@/lib/places";

const libraries: ("places")[] = ["places"];

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


async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.src = event.target?.result as string;
    };

    reader.onerror = reject;

    img.onload = () => {
      const maxSize = 1600;

      let width = img.width;
      let height = img.height;

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

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context not found"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }

          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".webp"),
            {
              type: "image/webp",
            }
          );

          resolve(compressedFile);
        },
        "image/webp",
        0.75
      );
    };

    img.onerror = reject;

    reader.readAsDataURL(file);
  });
}

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

function parseTags(tagsText: string) {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
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
  const addressAutocompleteRef =
    useRef<google.maps.places.Autocomplete | null>(null);

  const navigationAutocompleteRef =
    useRef<google.maps.places.Autocomplete | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const { isLoaded } = useJsApiLoader({
    id: "map-memory-google-script",
    googleMapsApiKey: apiKey,
    libraries,
  });

  const [previewPhoto, setPreviewPhoto] = useState<PhotoPreviewState>(null);

  const [formValues, setFormValues] = useState<PlaceFormValues>(() =>
    buildInitialValues(initialPlace)
  );

  const [newTagText, setNewTagText] = useState("");
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const title = useMemo(
    () => (mode === "create" ? "新增地點" : "編輯地點"),
    [mode]
  );

  const selectedTags = useMemo(
    () => parseTags(formValues.tagsText),
    [formValues.tagsText]
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
    value: PlaceFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
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

    setFormValues((prev) => ({
      ...prev,
      name: prev.name,
      address: prev.address,
      navigationTarget:
        place.name
          ?.replace(/[^\u4e00-\u9fa5（）()、・．.－\-\s]/g, "")
          .trim() || place.name || prev.navigationTarget,
      lat,
      lng,
    }));
  };

  const handleNavigationPlaceChanged = () => {
    const place = navigationAutocompleteRef.current?.getPlace();

    if (!place) {
      window.alert("沒有取得導航地點資料，請重新選擇一次");
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      name: prev.name,
      address: prev.address,
      lat: prev.lat,
      lng: prev.lng,
      navigationTarget:
        place.name
          ?.replace(/[^\u4e00-\u9fa5（）()、・．.－\-\s]/g, "")
          .trim() || place.name || prev.navigationTarget,
    }));
  };

  const handleStatusChange = (nextStatus: PlaceStatus) => {
    setFormValues((prev) => ({
      ...prev,
      status: nextStatus,
      completedDate:
      nextStatus === "wantToReturn" ? prev.completedDate || todayText() : "",
    }));
  };

  const syncTags = (nextTags: string[]) => {
    handleChange("tagsText", Array.from(new Set(nextTags)).join(", "));
  };

  const toggleTag = (tag: string) => {
    syncTags(
      selectedTags.includes(tag)
        ? selectedTags.filter((item) => item !== tag)
        : [...selectedTags, tag]
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
            formValues.photos.length - 1
          );

    await onSubmit({
      ...formValues,
      coverPhotoIndex: safeCoverPhotoIndex,
      completedDate:
        formValues.status === "wantToReturn" ? formValues.completedDate : "",
    });
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (formValues.photos.length >= PLACE_PHOTO_LIMIT) {
      window.alert("地點照片最多 1 張，請先刪除原本照片再重新上傳");
      return;
    }

    const selectedFiles = Array.from(files).slice(0, PLACE_PHOTO_LIMIT);

    setIsUploadingPhoto(true);

    try {
      const uploadedUrls = await Promise.all(
        selectedFiles.map(async (file) => {
          const compressedFile = await compressImage(file);
          const safeFileName = compressedFile.name.replace(/[^\w.\-]/g, "_");

          const fileName = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}-${safeFileName}`;

          const storageRef = ref(storage, `places/${fileName}`);

          await uploadBytes(storageRef, compressedFile);

          return await getDownloadURL(storageRef);
        })
      );

      setFormValues((prev) => ({
        ...prev,
        photos: uploadedUrls.slice(0, PLACE_PHOTO_LIMIT),
        coverPhotoIndex: 0,
      }));
    } catch (error) {
      console.error(error);
      window.alert("照片上傳失敗，請稍後再試");
    } finally {
      setIsUploadingPhoto(false);
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
        : prev
    );
  };

  const showNextPhoto = () => {
    setPreviewPhoto((prev) =>
      prev
        ? {
            ...prev,
            index: (prev.index + 1) % prev.photos.length,
          }
        : prev
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm font-semibold text-slate-700"
          >
            關閉
          </button>
        </div>

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
              狀態
              <span className="ml-1 font-bold text-red-500">(必填)</span>
            </span>

            <select
              value={formValues.status}
              onChange={(event) =>
                handleStatusChange(event.target.value as PlaceStatus)
              }
              className={inputClassName}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {formValues.status === "visited" ? (
            <label className="block text-sm">
              <span className={labelTitleClassName}>完成日期</span>

              <input
                type="date"
                value={formValues.completedDate || todayText()}
                onChange={(event) =>
                  handleChange("completedDate", event.target.value)
                }
                className={inputClassName}
              />
            </label>
          ) : null}

          <label className="block text-sm">
            <span className={labelTitleClassName}>
              地址
              <span className="ml-1 font-bold text-red-500">(必填)</span>
            </span>

            {isLoaded ? (
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
                    handleChange("address", event.target.value)
                  }
                  placeholder="輸入地址或地標，例如：淡水漁人碼頭"
                  className={inputClassName}
                />
              </Autocomplete>
            ) : (
              <input
                value={formValues.address}
                onChange={(event) =>
                  handleChange("address", event.target.value)
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
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="block text-sm">
            <span className={labelTitleClassName}>地點照片（最多 1 張）</span>

            <input
              type="file"
              accept="image/*"
              disabled={isUploadingPhoto || formValues.photos.length >= PLACE_PHOTO_LIMIT}
              onChange={(event) => {
                handlePhotoUpload(event.target.files).catch(() => {
                  window.alert("照片讀取失敗，請重新上傳");
                });

                event.target.value = "";
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 opacity-100 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white disabled:opacity-70"
            />

            <p className="mt-1 text-xs font-medium text-slate-600">
              {isUploadingPhoto
                ? "照片上傳中..."
                : `已上傳 ${formValues.photos.length}/1`}
            </p>

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
                      {checked ? "✓ " : ""}
                      #{tag}
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

            {isLoaded ? (
              <Autocomplete
                onLoad={(autocomplete) => {
                  navigationAutocompleteRef.current = autocomplete;
                }}
                onPlaceChanged={handleNavigationPlaceChanged}
                options={{
                  fields: ["name", "formatted_address", "geometry.location"],
                  componentRestrictions: { country: "tw" },
                }}
              >
                <input
                  value={formValues.navigationTarget}
                  onChange={(event) =>
                    handleChange("navigationTarget", event.target.value)
                  }
                  placeholder="輸入導航目標，例如：漁人碼頭"
                  className={inputClassName}
                />
              </Autocomplete>
            ) : (
              <input
                value={formValues.navigationTarget}
                onChange={(event) =>
                  handleChange("navigationTarget", event.target.value)
                }
                placeholder="輸入導航目標，例如：漁人碼頭"
                className={inputClassName}
              />
            )}
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

        <button
          type="button"
          onClick={handleValidateAndSubmit}
          disabled={isUploadingPhoto}
          className="mt-4 w-full rounded-lg bg-orange-500 px-3 py-3 text-sm font-bold text-white disabled:bg-slate-400"
        >
          {isUploadingPhoto
            ? "照片上傳中..."
            : mode === "create"
              ? "新增地點"
              : "儲存變更"}
        </button>
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