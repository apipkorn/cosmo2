import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Part } from '../lib/catalog';
import { APP_NAME, FOOTER_TEXT, TAGLINE } from '../lib/config';
import { colors, type Hover } from '../lib/theme';
import { BrandMark } from './BrandMark';

type Props = {
  parts: Part[];
  active: string | null;
  onSelect: (categoryId: string) => void;
  savedCount: number;
  savedOnly: boolean;
  onToggleSaved: () => void;
};

/** Black navigation column: brand, categories with counts, small print. */
export function Sidebar({ parts, active, onSelect, savedCount, savedOnly, onToggleSaved }: Props) {
  return (
    <View style={styles.side}>
      <View style={styles.brand}>
        <BrandMark />
        <View style={styles.brandText}>
          <Text style={styles.name}>{APP_NAME}</Text>
          <Text style={styles.tagline}>{TAGLINE}</Text>
        </View>
      </View>
      <ScrollView style={styles.nav} contentContainerStyle={styles.navContent}>
        <NavLink label="★ Saved" count={savedCount} on={savedOnly} onPress={onToggleSaved} />
        {parts.map((part) => (
          <View key={part.name}>
            <Text style={styles.part}>{part.name}</Text>
            {part.categories.map((c) => (
              <NavLink key={c.id} label={c.name} count={c.count} on={active === c.id} onPress={() => onSelect(c.id)} />
            ))}
          </View>
        ))}
      </ScrollView>
      <Text style={styles.foot}>{FOOTER_TEXT}</Text>
    </View>
  );
}

function NavLink({ label, count, on, onPress }: { label: string; count: number; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label}, ${count}`}
      style={({ hovered, pressed }: Hover) => [styles.link, on && styles.linkOn, (hovered || pressed) && styles.linkHover]}>
      <Text style={[styles.linkText, on && styles.linkTextOn]}>{label}</Text>
      <Text style={[styles.count, on && styles.countOn]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  side: { flex: 1, backgroundColor: colors.black },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.sideLine },
  brandText: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 19 },
  tagline: { color: colors.sideMuted, fontSize: 11.5, marginTop: 2 },
  nav: { flex: 1 },
  navContent: { paddingTop: 10, paddingBottom: 24 },
  part: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: colors.red },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 9, paddingLeft: 21, paddingRight: 20, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  linkOn: { borderLeftColor: colors.red, backgroundColor: colors.sideHover },
  linkHover: { backgroundColor: colors.sideHover },
  linkText: { flex: 1, color: colors.sideText, fontSize: 13.5 },
  linkTextOn: { color: '#fff', fontWeight: '600' },
  count: { backgroundColor: colors.pill, color: colors.pillText, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, overflow: 'hidden' },
  countOn: { backgroundColor: colors.red, color: '#fff' },
  foot: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.sideLine, fontSize: 11, lineHeight: 16, color: colors.sideMuted },
});
