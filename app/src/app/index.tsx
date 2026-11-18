// The whole library on one page, laid out like the 3M CBTD Technical
// Document Library: black sidebar of categories, red banner, sticky search
// bar, then every category with its documents.
import { Ionicons } from '@expo/vector-icons';
import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '../components/BrandMark';
import { DocRow } from '../components/DocRow';
import { Sidebar } from '../components/Sidebar';
import { shareAsset } from '../lib/actions';
import { buildLibrary, search, type Asset, type Sort } from '../lib/catalog';
import { APP_NAME, FOOTER_TEXT, HERO_TEXT, SEARCH_EXAMPLE } from '../lib/config';
import { useStore } from '../lib/store';
import { colors, SIDEBAR_WIDTH, WIDE } from '../lib/theme';

const web = Platform.OS === 'web';

export default function Library() {
  const { index, favorites, isFavorite, toggleFavorite } = useStore();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= WIDE;

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [sort, setSort] = useState<Sort>('new');
  const [savedOnly, setSavedOnly] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [showTop, setShowTop] = useState(false);
  const [toast, setToast] = useState('');

  // Navigation counts never change with the search box.
  const nav = useMemo(() => buildLibrary(index, () => true, 'new'), [index]);
  const total = index.assets.size;

  const matches = useMemo(() => {
    const q = deferredQuery.trim();
    return q ? new Set(search(index, q).map((a) => a.id)) : null;
  }, [index, deferredQuery]);
  const savedSet = useMemo(() => new Set(favorites), [favorites]);
  const parts = useMemo(
    () => buildLibrary(index, (a) => (!matches || matches.has(a.id)) && (!savedOnly || savedSet.has(a.id)), sort),
    [index, matches, savedOnly, savedSet, sort],
  );
  // An item filed in two folders is listed twice but counted once.
  const shown = useMemo(
    () => new Set(parts.flatMap((p) => p.categories.flatMap((c) => c.groups.flatMap((g) => g.assets.map((a) => a.id))))).size,
    [parts],
  );
  const filtering = !!matches || savedOnly;

  // ---- scrolling to a category, and highlighting the one in view ----------
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const heroHeight = useRef(0);
  const offsets = useRef(new Map<string, number>());
  const pending = useRef<string | null>(null);
  /** The category last picked from the sidebar or the address. */
  const chosen = useRef<string | null>(null);
  const order = useMemo(() => parts.flatMap((p) => p.categories.map((c) => c.id)), [parts]);

  const scrollTo = useCallback((id: string) => {
    const y = offsets.current.get(id);
    if (y === undefined) return false;
    // The content starts below the banner and the toolbar; the toolbar stays pinned on top.
    scrollRef.current?.scrollTo({ y: Math.max(0, heroHeight.current + y), animated: true });
    return true;
  }, []);

  const selectCategory = useCallback(
    (id: string) => {
      setNavOpen(false);
      setActive(id);
      chosen.current = id;
      if (web) window.history.replaceState(null, '', `#${id}`);
      // A search or the saved filter may hide the category: clear them first.
      if (filtering) {
        pending.current = id;
        setQuery('');
        setSavedOnly(false);
      } else if (!scrollTo(id)) {
        pending.current = id;
      }
    },
    [filtering, scrollTo],
  );

  const onSectionLayout = (id: string) => (e: LayoutChangeEvent) => {
    offsets.current.set(id, e.nativeEvent.layout.y);
    if (pending.current === id && !filtering) {
      // Wait a frame so the banner and toolbar have been measured too.
      requestAnimationFrame(() => {
        if (pending.current === id && scrollTo(id)) {
          pending.current = null;
          chosen.current = id;
          setActive(id);
        }
      });
    }
  };

  // Web: open at the category named in the address, e.g. ...#csd-product-information-signage
  useEffect(() => {
    if (web && window.location.hash.length > 1) pending.current = decodeURIComponent(window.location.hash.slice(1));
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    setShowTop(y > 600);
    let current: string | null = null;
    for (const id of order) {
      const top = offsets.current.get(id);
      if (top !== undefined && heroHeight.current + top - 20 <= y) current = id;
    }
    // At the very bottom the last categories can't reach the top; show the one chosen.
    const atBottom = y + layoutMeasurement.height >= contentSize.height - 4;
    const chosenId = chosen.current;
    if (atBottom && chosenId && order.indexOf(chosenId) > order.indexOf(current ?? '')) current = chosenId;
    if (current !== active) setActive(current);
  };

  const onShare = useCallback(async (asset: Asset) => {
    const result = await shareAsset(asset);
    if (result === 'copied') {
      setToast('Link copied');
      setTimeout(() => setToast(''), 1800);
    }
  }, []);

  // ---- layout ----------------------------------------------------------------
  const sidebar = (
    <Sidebar
      parts={nav}
      active={savedOnly ? null : active}
      onSelect={selectCategory}
      savedCount={favorites.length}
      savedOnly={savedOnly}
      onToggleSaved={() => {
        setNavOpen(false);
        setSavedOnly((s) => !s);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }}
    />
  );

  return (
    <View style={styles.screen}>
      {wide ? <View style={[styles.sideFixed, { paddingTop: insets.top }]}>{sidebar}</View> : null}

      <View style={styles.mainCol}>
        {!wide ? (
          <View style={[styles.topbar, { paddingTop: insets.top, height: 56 + insets.top }]}>
            <Pressable
              onPress={() => setNavOpen((o) => !o)}
              style={styles.menuBtn}
              accessibilityRole="button"
              accessibilityLabel={navOpen ? 'Close navigation' : 'Open navigation'}
              accessibilityState={{ expanded: navOpen }}>
              <Ionicons name={navOpen ? 'close' : 'menu'} size={22} color="#fff" />
            </Pressable>
            <BrandMark small />
            <Text style={styles.topTitle} numberOfLines={1}>
              {APP_NAME}
            </Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          stickyHeaderIndices={[1]}
          onScroll={onScroll}
          scrollEventThrottle={32}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <View style={[styles.hero, !wide && styles.heroNarrow]} onLayout={(e) => (heroHeight.current = e.nativeEvent.layout.height)}>
            <Text style={[styles.heroTitle, !wide && styles.heroTitleNarrow]}>{APP_NAME}</Text>
            <Text style={styles.heroText}>{HERO_TEXT.replace('{count}', String(total))}</Text>
          </View>

          <View style={[styles.toolbar, !wide && styles.toolbarNarrow]}>
            <View style={styles.search}>
              <Ionicons name="search" size={16} color={colors.muted} style={styles.searchIcon} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${total} items… (e.g. ${SEARCH_EXAMPLE})`}
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
                accessibilityLabel="Search documents"
              />
            </View>
            <View style={styles.sort} accessibilityRole="radiogroup" accessibilityLabel="Sort order">
              {(['new', 'az'] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSort(s)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sort === s }}
                  style={[styles.sortBtn, sort === s && styles.sortOn]}>
                  <Text style={[styles.sortText, sort === s && styles.sortTextOn]}>{s === 'new' ? 'Newest' : 'A–Z'}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.note}>
              {savedOnly ? `${shown} saved` : filtering ? `${shown} of ${total}` : `${total} items`}
            </Text>
          </View>

          {/* Part headings and categories are direct children of this View, so
              each category's measured position is relative to the content top. */}
          <View style={[styles.content, !wide && styles.contentNarrow]}>
            {parts.map((part) => (
              <Fragment key={part.name}>
                <Text style={styles.partHead}>{part.name}</Text>
                {part.categories.map((cat) => (
                  <View key={cat.id} style={styles.cat} onLayout={onSectionLayout(cat.id)} nativeID={cat.id}>
                    <View style={styles.catHead}>
                      <Text style={styles.catTitle}>{cat.name}</Text>
                      <Text style={styles.catCount}>
                        {cat.count} item{cat.count === 1 ? '' : 's'}
                      </Text>
                    </View>
                    {cat.groups.map((g) => (
                      <View key={g.label || 'own'}>
                        {g.label ? <Text style={styles.groupHead}>{g.label}</Text> : null}
                        {g.assets.map((a) => (
                          <DocRow
                            key={a.id}
                            asset={a}
                            saved={isFavorite(a.id)}
                            showBadge={wide}
                            onToggleSaved={toggleFavorite}
                            onShare={onShare}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                ))}
              </Fragment>
            ))}
            {shown === 0 ? (
              <Text style={styles.empty}>
                {savedOnly && !matches ? 'Nothing saved yet. Tap ☆ next to any item to keep it here.' : 'No items match your search.'}
              </Text>
            ) : null}
          </View>

          <View style={[styles.foot, !wide && styles.footNarrow, { paddingBottom: 26 + insets.bottom }]}>
            <Text style={styles.footText}>{FOOTER_TEXT}</Text>
          </View>
        </ScrollView>

        {showTop ? (
          <Pressable
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            style={[styles.toTop, { bottom: 18 + insets.bottom }]}
            accessibilityRole="button"
            accessibilityLabel="Back to top">
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        ) : null}
        {toast ? <Text style={[styles.toast, { bottom: 24 + insets.bottom }]}>{toast}</Text> : null}
      </View>

      {!wide && navOpen ? (
        <View style={[styles.drawerWrap, { top: 56 + insets.top }]}>
          <Pressable style={styles.scrim} onPress={() => setNavOpen(false)} accessibilityLabel="Close navigation" />
          <View style={styles.drawer}>{sidebar}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', backgroundColor: colors.paper },
  sideFixed: { width: SIDEBAR_WIDTH, backgroundColor: colors.black },
  mainCol: { flex: 1 },

  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, backgroundColor: colors.black },
  menuBtn: { width: 40, height: 36, borderWidth: 2, borderColor: '#fff', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },

  hero: { backgroundColor: colors.red, paddingHorizontal: 36, paddingTop: 30, paddingBottom: 26 },
  heroNarrow: { paddingHorizontal: 18, paddingVertical: 22 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.2 },
  heroTitleNarrow: { fontSize: 20 },
  heroText: { color: colors.heroText, fontSize: 13.5, lineHeight: 19, marginTop: 6, maxWidth: 760 },

  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 36,
    paddingVertical: 14,
    backgroundColor: colors.paper,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  toolbarNarrow: { paddingHorizontal: 14, paddingVertical: 10 },
  search: { flexGrow: 1, flexBasis: 220, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  input: {
    paddingVertical: 9,
    paddingLeft: 36,
    paddingRight: 12,
    fontSize: 14,
    color: colors.ink,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    backgroundColor: colors.paper,
  },
  sort: { flexDirection: 'row', borderWidth: 2, borderColor: colors.black, borderRadius: 8, overflow: 'hidden' },
  sortBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.paper },
  sortOn: { backgroundColor: colors.black },
  sortText: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  sortTextOn: { color: '#fff' },
  note: { fontSize: 12.5, fontWeight: '600', color: colors.muted },

  content: { paddingHorizontal: 36, paddingTop: 10, paddingBottom: 60 },
  contentNarrow: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 50 },
  partHead: { marginTop: 36, marginBottom: 6, paddingTop: 10, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', color: colors.red },
  cat: { marginTop: 18 },
  catHead: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 10, borderBottomWidth: 3, borderBottomColor: colors.black, paddingBottom: 8 },
  catTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  catCount: { fontSize: 12.5, fontWeight: '700', color: colors.muted },
  groupHead: { marginTop: 14, paddingHorizontal: 8, paddingBottom: 4, fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  empty: { paddingVertical: 50, textAlign: 'center', color: colors.muted, fontSize: 14 },

  foot: { backgroundColor: colors.black, paddingHorizontal: 36, paddingTop: 26 },
  footNarrow: { paddingHorizontal: 16, paddingTop: 20 },
  footText: { color: colors.pillText, fontSize: 12, lineHeight: 20 },

  toTop: {
    position: 'absolute',
    right: 18,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.black,
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },

  drawerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  drawer: { width: 290, maxWidth: '85%', backgroundColor: colors.black },
});
