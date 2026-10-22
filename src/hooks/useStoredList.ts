// Petite liste persistée sur l'appareil (favoris, recherches récentes). Jamais de position GPS.
import { useCallback, useEffect, useState } from 'react';

function read<T>(key: string): T[] {
  try {
    const v = localStorage.getItem(key);
    const parsed = v ? (JSON.parse(v) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch { return []; }
}

export function useStoredList<T extends { id: string }>(key: string, max = 20) {
  const [items, setItems] = useState<T[]>(() => read<T>(key));
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* stockage indisponible */ }
  }, [key, items]);
  const add = useCallback((it: T) => setItems((l) => [it, ...l.filter((x) => x.id !== it.id)].slice(0, max)), [max]);
  const remove = useCallback((id: string) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const toggle = useCallback((it: T) => setItems((l) => (l.some((x) => x.id === it.id) ? l.filter((x) => x.id !== it.id) : [it, ...l].slice(0, max))), [max]);
  const has = useCallback((id: string) => items.some((x) => x.id === id), [items]);
  const clear = useCallback(() => setItems([]), []);
  return { items, add, remove, toggle, has, clear };
}
