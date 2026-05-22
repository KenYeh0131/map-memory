"use client";

import { useEffect, useMemo, useState } from "react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
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

function todayText() {
  return new Date().toISOString().slice(0, 10);
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
  const [uploadStatus, setUploadStatus] =
    useState<UploadStatus>(idleUploadStatus);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && initialValues) {
      setVisitDate(initialValues.visitDate || todayText());
      setNote(initialValues.note || "");
      setPhotos(
        Array.isArray(initialValues.photos) ? initialValues.photos : [],
      );
      setRating(initialValues.rating ?? 0);
    } else {
      setVisitDate(todayText());
      setNote("");
      setPhotos([]);
      setRating(0);
    }

    setIsUploading(false);
    setIsSaving(false);
    setUploadStatus(idleUploadStatus);
  }, [isOpen, mode, initialValues]);

  const previewPhotos = useMemo(() => {
    return photos.slice(0, PREVIEW_LIMIT);
  }, [photos]);

  const remainPhotoCount = useMemo(() => {
    return Math.max(0, photos.length - PREVIEW_LIMIT);
  }, [photos.length]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remain = Math.max(0, MAX_PHOTOS - photos.length);

    if (remain === 0) {
      window.alert(`每次回憶最多 ${MAX_PHOTOS} 張照片`);
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remain);
    const localPreviewUrls = selectedFiles.map((file) =>
      URL.createObjectURL(file),
    );

    setIsUploading(true);
    setUploadStatus({
      stage: "preview",
      progress: 5,
      message: "建立照片預覽中...",
    });

    setPhotos((prev) => [...prev, ...localPreviewUrls].slice(0, MAX_PHOTOS));

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      const uploadedUrls: string[] = [];

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        const baseProgress = Math.round((index / selectedFiles.length) * 100);

        setUploadStatus({
          stage: "compressing",
          progress: Math.max(10, baseProgress),
          message: `照片壓縮中... ${index + 1}/${selectedFiles.length}`,
        });

        const compressedFile = await compressImage(file);

        const downloadUrl = await uploadFileWithProgress(
          compressedFile,
          "visits",
          (progress) => {
            const totalProgress = Math.round(
              ((index + progress / 100) / selectedFiles.length) * 100,
            );

            setUploadStatus({
              stage: "uploading",
              progress: Math.max(10, totalProgress),
              message: `照片上傳中... ${index + 1}/${selectedFiles.length}（${progress}%）`,
            });
          },
        );

        uploadedUrls.push(downloadUrl);
      }

      setPhotos((prev) => {
        const withoutLocalPreview = prev.filter(
          (photo) => !localPreviewUrls.includes(photo),
        );

        return [...withoutLocalPreview, ...uploadedUrls].slice(0, MAX_PHOTOS);
      });

      setUploadStatus({
        stage: "done",
        progress: 100,
        message: "照片上傳完成",
      });
    } catch (error) {
      console.error(error);
      setPhotos((prev) =>
        prev.filter((photo) => !localPreviewUrls.includes(photo)),
      );
      setUploadStatus({
        stage: "error",
        progress: 0,
        message: "照片上傳失敗，請重新上傳",
      });
      window.alert("照片上傳失敗");
    } finally {
      setIsUploading(false);

      window.setTimeout(() => {
        localPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        setUploadStatus(idleUploadStatus);
      }, 1200);
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
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 px-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-3">
      <div className="flex max-h-[calc(100dvh-7rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="shrink-0 border-b border-slate-100 bg-white p-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900">
                {mode === "edit" ? "編輯回憶" : "加入回憶"}
              </h2>

              <p className="mt-1 truncate text-xs text-slate-500">
                {placeName}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
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
                    {isUploading
                      ? uploadStatus.message || "照片上傳中..."
                      : "新增回憶照片"}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    最多 {MAX_PHOTOS} 張
                  </div>

                  {uploadStatus.stage !== "idle" ? (
                    <div className="mt-3 w-44">
                      <div className="h-2 overflow-hidden rounded-full bg-orange-100">
                        <div
                          className="h-full rounded-full bg-orange-500 transition-all duration-200"
                          style={{ width: `${uploadStatus.progress}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
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
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white p-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUploading || isSaving}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg disabled:bg-slate-400"
          >
            {isSaving ? "儲存中..." : mode === "edit" ? "更新回憶" : "儲存回憶"}
          </button>
        </div>
      </div>
    </div>
  );
}
