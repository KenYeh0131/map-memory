"use client";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
export function useSessionState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { const raw = sessionStorage.getItem(key); if (raw) setValue(JSON.parse(raw)); } catch { /* Restore only valid JSON. */ }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key]);
  useEffect(() => { if (ready) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Browsing remains usable if storage is full. */ } } }, [key, ready, value]);
  return [value, setValue];
}
