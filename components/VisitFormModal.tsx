
"use client";

import { useEffect, useMemo, useState } from "react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
  RATING_LABELS,
  RATING_OPTIONS,
  type MemoryNoteItem,
} from "@/lib/places";

export type VisitFormValues = {
  visitDate: string;
  note: string;
  photos: string[];
  rating?: number;
  memoryNotes: MemoryNoteItem[];
  authorName?: string;
  authorDeviceId?: string;
};

type VisitFormModalProps = {
  isOpen: boolean;
  mode?: "create" | "edit";
  placeName: string;
  currentAuthorName: string;
  currentDeviceId: string;
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

function createMemoryNoteId() {
  return `memory-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDotDate(dateText?: string) {
  if (!dateText) return "";
  return dateText.replaceAll("-", ".");
}

function normalizeMemoryNotes(
  initialValues: VisitFormValues | null | undefined,
): MemoryNoteItem[] {
  const memoryNotes = Array.isArray(initialValues?.memoryNotes)
    ? initialValues.memoryNotes
    : [];

  if (memoryNotes.length > 0) {
    return memoryNotes
      .filter((item) => item && typeof item.text === "string")
      .map((item) => ({
        id: item.id || createMemoryNoteId(),
        noteDate: item.noteDate || initialValues?.visitDate || todayText(),
        text: item.text || "",
        authorName: item.authorName || initialValues?.authorName || "",
        authorDeviceId: item.authorDeviceId || initialValues?.authorDeviceId || "",
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt,
      }));
  }

  const legacyNote = initialValues?.note?.trim() ?? "";

  if (!legacyNote) return [];

  return [
    {
      id: "legacy-note",
      noteDate: initialValues?.visitDate || todayText(),
      text: legacyNote,
      authorName: initialValues?.authorName || "",
      authorDeviceId: initialValues?.authorDeviceId || "",
      createdAt: initialValues?.visitDate || new Date().toISOString(),
    },
  ];
}

function buildLegacyNote(memoryNotes: MemoryNoteItem[]) {
  return memoryNotes
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join("\n");
}

function canEditMemoryNote(note: MemoryNoteItem, currentDeviceId: string) {
  if (!note.authorDeviceId) return true;
  return note.authorDeviceId === currentDeviceId;
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
  currentAuthorName,
  currentDeviceId,
  initialValues,
  onClose,
  onSubmit,
}: VisitFormModalProps) {
  const [visitDate, setVisitDate] = useState(todayText());
  const [memoryNotes, setMemoryNotes] = useState<MemoryNoteItem[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
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
      setMemoryNotes(normalizeMemoryNotes(initialValues));
      setPhotos(
        Array.isArray(initialValues.photos) ? initialValues.photos : [],
      );
      setRating(initialValues.rating ?? 0);
    } else {
      setVisitDate(todayText());
      setMemoryNotes([]);
      setPhotos([]);
      setRating(0);
    }

    setNewNoteText("");
    setEditingNoteId(null);
    setEditingNoteText("");
    setIsUploading(false);
    setIsSaving(false);
    setUploadStatus(idleUploadStatus);
  }, [isOpen, mode, initialValues]);

  const previewPhotos = useMemo(() => photos.slice(0, PREVIEW_LIMIT), [photos]);
  const remainPhotoCount = useMemo(
    () => Math.max(0, photos.length - PREVIEW_LIMIT),
    [photos.length],
  );

  if (!isOpen) return null;

  const addCurrentNoteDraft = () => {
    const trimmedText = newNoteText.trim();

    if (!trimmedText) return;

    const now = new Date().toISOString();

    setMemoryNotes((prev) => [
      ...prev,
      {
        id: createMemoryNoteId(),
        noteDate: visitDate,
        text: trimmedText,
        authorName: currentAuthorName.trim() || "未命名",
        authorDeviceId: currentDeviceId,
        createdAt: now,
      },
    ]);
    setNewNoteText("");
  };

  const startEditMemoryNote = (note: MemoryNoteItem) => {
    if (!canEditMemoryNote(note, currentDeviceId)) return;

    setEditingNoteId(note.id);
    setEditingNoteText(note.text);
  };

  const saveEditMemoryNote = () => {
    if (!editingNoteId) return;

    const trimmedText = editingNoteText.trim();

    if (!trimmedText) {
      window.alert("留言內容不能空白");
      return;
    }

    setMemoryNotes((prev) =>
      prev.map((note) =>
        note.id === editingNoteId && canEditMemoryNote(note, currentDeviceId)
          ? {
              ...note,
              text: trimmedText,
              noteDate: visitDate,
              updatedAt: new Date().toISOString(),
            }
          : note,
      ),
    );
    setEditingNoteId(null);
    setEditingNoteText("");
  };

  const deleteMemoryNote = (noteId: string) => {
    const targetNote = memoryNotes.find((note) => note.id === noteId);

    if (!targetNote || !canEditMemoryNote(targetNote, currentDeviceId)) return;

    const ok = window.confirm("確定要刪除你寫的這段回憶嗎？");

    if (!ok) return;

    setMemoryNotes((prev) => prev.filter((note) => note.id !== noteId));
  };

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

  const getComparableValues = () => ({
    visitDate,
    memoryNotes,
    newNoteText: newNoteText.trim(),
    photos,
    rating,
  });

  const getInitialComparableValues = () => {
    if (mode === "edit" && initialValues) {
      return {
        visitDate: initialValues.visitDate || todayText(),
        memoryNotes: normalizeMemoryNotes(initialValues),
        newNoteText: "",
        photos: Array.isArray(initialValues.photos) ? initialValues.photos : [],
        rating: initialValues.rating ?? 0,
      };
    }

    return {
      visitDate: todayText(),
      memoryNotes: [],
      newNoteText: "",
      photos: [],
      rating: 0,
    };
  };

  const isDirty = () =>
    JSON.stringify(getComparableValues()) !==
    JSON.stringify(getInitialComparableValues());

  const handleRequestClose = () => {
    if (isUploading) {
      window.alert("照片上傳中，請稍候");
      return;
    }

    if (isSaving) return;

    if (isDirty()) {
      const ok = window.confirm("尚未儲存內容，確定離開？");
      if (!ok) return;
    }

    onClose();
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

    const now = new Date().toISOString();
    const trimmedNewNoteText = newNoteText.trim();
    const nextMemoryNotes = trimmedNewNoteText
      ? [
          ...memoryNotes,
          {
            id: createMemoryNoteId(),
            noteDate: visitDate,
            text: trimmedNewNoteText,
            authorName: currentAuthorName.trim() || "未命名",
            authorDeviceId: currentDeviceId,
            createdAt: now,
          },
        ]
      : memoryNotes;

    setIsSaving(true);

    try {
      await onSubmit({
        visitDate,
        note: buildLegacyNote(nextMemoryNotes),
        photos,
        rating,
        memoryNotes: nextMemoryNotes,
        authorName: currentAuthorName.trim() || "未命名",
        authorDeviceId: currentDeviceId,
      });
    } catch (error) {
      console.error(error);
      window.alert("儲存回憶失敗");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 px-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-3"
      onClick={handleRequestClose}
    >
      <div
        className="flex max-h-[calc(100dvh-7rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
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
              onClick={handleRequestClose}
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

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-sm font-bold text-slate-800">
                這次的回憶留言
              </div>

              {memoryNotes.length > 0 ? (
                <div className="space-y-2">
                  {memoryNotes.map((memoryNote) => {
                    const canEdit = canEditMemoryNote(memoryNote, currentDeviceId);
                    const isEditing = editingNoteId === memoryNote.id;

                    return (
                      <div
                        key={memoryNote.id}
                        className="rounded-xl bg-white p-3 text-sm shadow-sm"
                      >
                        <div className="mb-1 text-xs font-bold text-slate-500">
                          {formatDotDate(memoryNote.noteDate || visitDate)} {memoryNote.authorName || "未命名"}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNoteText}
                              onChange={(event) => setEditingNoteText(event.target.value)}
                              rows={3}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2"
                            />

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={saveEditMemoryNote}
                                className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white"
                              >
                                儲存文字
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditingNoteText("");
                                }}
                                className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="whitespace-pre-wrap break-words leading-5 text-slate-700">
                              {memoryNote.text || "沒有文字紀錄"}
                            </div>

                            {canEdit ? (
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditMemoryNote(memoryNote)}
                                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"
                                >
                                  編輯我的文字
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteMemoryNote(memoryNote.id)}
                                  className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600"
                                >
                                  刪除我的文字
                                </button>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-white px-3 py-2 text-xs text-slate-500">
                  目前還沒有留言。
                </div>
              )}

              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-semibold text-slate-800">
                  新增我的回憶文字
                </span>

                <textarea
                  value={newNoteText}
                  onChange={(event) => setNewNoteText(event.target.value)}
                  rows={3}
                  placeholder="補充這次去的感受、發生的事、想留下的回憶..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                />
              </label>

              {newNoteText.trim() ? (
                <button
                  type="button"
                  onClick={addCurrentNoteDraft}
                  className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                >
                  先加入留言清單
                </button>
              ) : null}
            </div>

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
                    {option} - {RATING_LABELS[option]}
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
