// Loads the catalog and remembers favourites.
//
// Catalog loading order, fastest first:
//   1. the snapshot bundled inside the app (instant, works offline)
//   2. the last catalog this device downloaded (also offline)
//   3. the published catalog.json (replaces the above if its version differs)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import bundled from 'bundled-catalog';
import { buildIndex, isCatalog, type Catalog, type Index } from './catalog';
import { CONTENT_BASE_URL, EDITION } from './config';

const CATALOG_KEY = `catalog.v1.${EDITION}`;
const FAVORITES_KEY = `favorites.v1.${EDITION}`;

/** Base address for catalog.json and thumbnails. */
export const contentBase =
  Platform.OS === 'web' ? `${process.env.EXPO_BASE_URL ?? ''}/` : CONTENT_BASE_URL;

type Store = {
  index: Index;
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(bundled as Catalog);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const use = (next: Catalog) => {
      if (!cancelled) setCatalog((current) => (current.version === next.version ? current : next));
    };
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(CATALOG_KEY);
        const parsed: unknown = saved ? JSON.parse(saved) : null;
        if (isCatalog(parsed)) use(parsed);
      } catch {
        // No saved copy, or it is unreadable: carry on with the bundled one.
      }
      try {
        const response = await fetch(`${contentBase}catalog.json`, { cache: 'no-cache' });
        if (!response.ok) return;
        const fresh: unknown = await response.json();
        if (!isCatalog(fresh)) return;
        use(fresh);
        await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(fresh));
      } catch {
        // Offline or the site is unreachable: keep what we have.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY)
      .then((saved) => {
        const parsed: unknown = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) setFavorites(parsed.filter((id) => typeof id === 'string'));
      })
      .catch(() => {});
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [id, ...current];
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const index = useMemo(() => buildIndex(catalog), [catalog]);
  const store = useMemo<Store>(() => {
    const set = new Set(favorites);
    return { index, favorites, isFavorite: (id) => set.has(id), toggleFavorite };
  }, [index, favorites, toggleFavorite]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
