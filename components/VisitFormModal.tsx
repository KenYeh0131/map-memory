"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { RATING_OPTIONS } from "@/lib/places";

export type VisitFormValues = {
  visitDate: string;
  note: string;
  photos: string[];
  rating?: number;
};

type VisitFormModalProps = {
  isOpen: boolean;
  mode?: "create" | "edit";
  placeName: string;
  initialValues?: VisitFormValues | null;
  onClose: () => void;
  onSubmit: (values: VisitFormValues) => void | Promise<void>;
};

const MAX_PHOTOS = 10;
const PREVIEW_LIMIT = 3;

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

function isFutureDate(dateText: string) {
  return dateText > todayText();
}

export function VisitFormModal({
  isOpen,
  mode = "create",
  placeName,
  initialValues,
  onClose,
  onSubmit,
}: VisitFormModalProps) {
  const [visitDate, setVisitDate] = useState(todayText());
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [rating, setRating] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && initialValues) {
      setVisitDate(initialValues.visitDate || todayText());
      setNote(initialValues.note || "");
      setPhotos(Array.isArray(initialValues.photos) ? initialValues.photos : []);
      setRating(initialValues.rating ?? 0);
    } else {
      setVisitDate(todayText());
      setNote("");
      setPhotos([]);
      setRating(0);
    }

    setIsUploading(false);
    setIsSaving(false);
  }, [isOpen, mode, initialValues]);

  const previewPhotos = useMemo(() => {
    return photos.slice(0, PREVIEW_LIMIT);
  }, [photos]);

  const remainPhotoCount = useMemo(() => {
    return Math.max(0, photos.length - PREVIEW_LIMIT);
  }, [photos.length]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files) return;

    const remain = Math.max(0, MAX_PHOTOS - photos.length);

    if (remain === 0) {
      window.alert(`每次回憶最多 ${MAX_PHOTOS} 張照片`);
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remain);

    setIsUploading(true);

    try {
      const uploadedUrls = await Promise.all(
        selectedFiles.map(async (file) => {
          const safeFileName = file.name.replace(/[^\w.\-]/g, "_");

          const fileName = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}-${safeFileName}`;

          const storageRef = ref(storage, `visits/${fileName}`);

          await uploadBytes(storageRef, file);

          return await getDownloadURL(storageRef);
        })
      );

      setPhotos((prev) => [...prev, ...uploadedUrls].slice(0, MAX_PHOTOS));
    } catch (error) {
      console.error(error);
      window.alert("照片上傳失敗");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = (photoUrl: string) => {
    setPhotos((prev) => prev.filter((photo) => photo !== photoUrl));
  };

  const handleSubmit = async () => {
    if (!visitDate) {
      window.alert("請選擇拜訪日期");
      return;
    }

    if (isFutureDate(visitDate)) {
      window.alert("回憶日期不能是未來日期");
      return;
    }

    if (isUploading) {
      window.alert("照片上傳中，請稍候");
      return;
    }

    if (isSaving) return;

    setIsSaving(true);

    try {
      await onSubmit({
        visitDate,
        note: note.trim(),
        photos,
        rating,
      });
    } catch (error) {
      console.error(error);
      window.alert("儲存回憶失敗");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === "edit" ? "編輯回憶" : "加入回憶"}
            </h2>

            <p className="mt-1 text-xs text-slate-500">{placeName}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-800">
              拜訪日期
            </span>

            <input
              type="date"
              value={visitDate}
              max={todayText()}
              onChange={(event) => setVisitDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />

            <p className="mt-1 text-xs text-slate-500">
              只能記錄今天以前已發生的回憶
            </p>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-800">
              這次的回憶
            </span>

            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="記錄這次去的感受、發生的事、想留下的回憶..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-800">
              這次喜歡程度
            </span>

            <select
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              {RATING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} 顆心
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1 block text-sm font-semibold text-slate-800">
              回憶照片
            </span>

            <label className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 px-4 py-6 text-center hover:bg-orange-100">
              <div>
                <div className="text-3xl">📸</div>

                <div className="mt-2 text-sm font-bold text-orange-600">
                  {isUploading ? "照片上傳中..." : "新增回憶照片"}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  最多 {MAX_PHOTOS} 張
                </div>
              </div>

              <input
                type="file"
                accept="image/*"
                multiple
                disabled={isUploading}
                onChange={(event) => {
                  handlePhotoUpload(event.target.files);
                  event.target.value = "";
                }}
                className="hidden"
              />
            </label>

            {photos.length > 0 ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {previewPhotos.map((photo, index) => (
                  <div
                    key={`${photo}-${index}`}
                    className="relative overflow-hidden rounded-xl"
                  >
                    <img
                      src={photo}
                      alt={`visit-photo-${index + 1}`}
                      className="h-24 w-full object-cover"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {remainPhotoCount > 0 ? (
                  <div className="flex h-24 items-center justify-center rounded-xl bg-slate-200 text-lg font-bold text-slate-700">
                    +{remainPhotoCount}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isUploading || isSaving}
          className="mt-5 w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:bg-slate-400"
        >
          {isSaving
            ? "儲存中..."
            : mode === "edit"
            ? "更新回憶"
            : "儲存回憶"}
        </button>
      </div>
    </div>
  );
}