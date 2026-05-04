"use client";

import { useMemo, useState } from "react";
import {
  RATING_OPTIONS,
  STATUS_OPTIONS,
  type PlaceItem,
  type PlaceStatus,
} from "@/lib/places";

export type PlaceFormValues = {
  name: string;
  status: PlaceStatus;
  address: string;
  rating: number;
  tagsText: string;
  navigationTarget: string;
  notes: string;
};

type PlaceFormModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  initialPlace: PlaceItem | null;
  onClose: () => void;
  onSubmit: (values: PlaceFormValues) => void;
};

function buildInitialValues(initialPlace: PlaceItem | null): PlaceFormValues {
  return {
    name: initialPlace?.name ?? "",
    status: initialPlace?.status ?? "wantToGo",
    address: initialPlace?.address ?? "",
    rating: initialPlace?.rating ?? 0,
    tagsText: initialPlace?.tags.join(", ") ?? "",
    navigationTarget: initialPlace?.navigationTarget ?? "",
    notes: initialPlace?.notes ?? "",
  };
}

export function PlaceFormModal({
  isOpen,
  mode,
  initialPlace,
  onClose,
  onSubmit,
}: PlaceFormModalProps) {
  const [formValues, setFormValues] = useState<PlaceFormValues>(() =>
    buildInitialValues(initialPlace)
  );
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});

  const title = useMemo(
    () => (mode === "create" ? "新增地點" : "編輯地點"),
    [mode]
  );

  if (!isOpen) {
    return null;
  }

  const handleChange = <K extends keyof PlaceFormValues>(
    key: K,
    value: PlaceFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleValidateAndSubmit = () => {
    const nextErrors: { name?: string; address?: string } = {};
    if (!formValues.name.trim()) {
      nextErrors.name = "地點名稱為必填";
    }
    if (!formValues.address.trim()) {
      nextErrors.address = "地址為必填";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    onSubmit(formValues);
  };

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/50 p-3">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-500"
          >
            關閉
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">地點名稱 *</span>
            <input
              value={formValues.name}
              onChange={(event) => handleChange("name", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            {errors.name ? (
              <span className="mt-1 block text-xs text-rose-600">{errors.name}</span>
            ) : null}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">狀態 *</span>
            <select
              value={formValues.status}
              onChange={(event) =>
                handleChange("status", event.target.value as PlaceStatus)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">地址 *</span>
            <input
              value={formValues.address}
              onChange={(event) => handleChange("address", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            {errors.address ? (
              <span className="mt-1 block text-xs text-rose-600">
                {errors.address}
              </span>
            ) : null}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">喜歡程度（0~5）</span>
            <select
              value={formValues.rating}
              onChange={(event) =>
                handleChange("rating", Number(event.target.value))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {RATING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">標籤（逗號分隔）</span>
            <input
              value={formValues.tagsText}
              onChange={(event) => handleChange("tagsText", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="海景, 約會, 晚上"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">導航目標</span>
            <input
              value={formValues.navigationTarget}
              onChange={(event) =>
                handleChange("navigationTarget", event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">筆記</span>
            <textarea
              value={formValues.notes}
              onChange={(event) => handleChange("notes", event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleValidateAndSubmit}
          className="mt-4 w-full rounded-lg bg-orange-500 px-3 py-3 text-sm font-semibold text-white"
        >
          {mode === "create" ? "新增地點" : "儲存變更"}
        </button>
      </div>
    </div>
  );
}
