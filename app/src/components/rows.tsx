import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatSize, KIND_LABEL, type Asset, type Folder, type Kind } from '../lib/catalog';
import { thumbUrl, useStore } from '../lib/store';
import { useTheme } from '../lib/theme';

const KIND_ICON: Record<Kind, keyof typeof Ionicons.glyphMap> = {
  pdf: 'document-text-outline',
  video: 'play-circle-outline',
  image: 'image-outline',
  doc: 'document-outline',
  file: 'archive-outline',
  link: 'link-outline',
};

export function Thumb({ asset, size = 56 }: { asset: Asset; size?: number }) {
  const t = useTheme();
  const uri = thumbUrl(asset.thumb);
  return (
    <View style={[styles.thumb, { width: size, height: size, backgroundColor: t.chip }]}>
      <Ionicons name={KIND_ICON[asset.kind]} size={size * 0.45} color={t.muted} />
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" recyclingKey={asset.id} transition={100} />
      ) : null}
    </View>
  );
}

export const AssetRow = memo(function AssetRow({ asset }: { asset: Asset }) {
  const t = useTheme();
  const { isFavorite, toggleFavorite } = useStore();
  const fav = isFavorite(asset.id);
  const meta = [KIND_LABEL[asset.kind], formatSize(asset.size), asset.lit].filter(Boolean).join(' · ');
  return (
    <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
      <Link href={{ pathname: '/asset/[id]', params: { id: asset.id } }} asChild>
        <Pressable style={styles.rowMain} accessibilityRole="link" accessibilityLabel={`${asset.title}, ${meta}`}>
          <Thumb asset={asset} />
          <View style={styles.rowText}>
            <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
              {asset.title}
            </Text>
            <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
              {meta}
            </Text>
          </View>
        </Pressable>
      </Link>
      <Pressable
        onPress={() => toggleFavorite(asset.id)}
        hitSlop={8}
        style={styles.star}
        accessibilityRole="button"
        accessibilityLabel={fav ? 'Remove from favourites' : 'Add to favourites'}>
        <Ionicons name={fav ? 'star' : 'star-outline'} size={22} color={fav ? t.star : t.muted} />
      </Pressable>
    </View>
  );
});

export function FolderRow({ folder, count }: { folder: Folder; count: number }) {
  const t = useTheme();
  return (
    <Link href={{ pathname: '/folder/[id]', params: { id: folder.id } }} asChild>
      {/* Under <Link asChild> the style must be one object, not an array (web). */}
      <Pressable
        style={StyleSheet.flatten([styles.row, styles.folderRow, { backgroundColor: t.card, borderColor: t.border }])}
        accessibilityRole="link"
        accessibilityLabel={`${folder.name}, ${count} items`}>
        <Ionicons name="folder-outline" size={22} color={t.accent} />
        <Text style={[styles.title, styles.rowText, { color: t.text }]} numberOfLines={2}>
          {folder.name}
        </Text>
        <Text style={[styles.meta, { color: t.muted }]}>{count}</Text>
        <Ionicons name="chevron-forward" size={18} color={t.muted} />
      </Pressable>
    </Link>
  );
}

export function Empty({ icon, title, hint }: { icon: keyof typeof Ionicons.glyphMap; title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={t.muted} />
      <Text style={[styles.title, { color: t.text, marginTop: 12 }]}>{title}</Text>
      {hint ? <Text style={[styles.meta, { color: t.muted, textAlign: 'center' }]}>{hint}</Text> : null}
    </View>
  );
}

export const listStyles = StyleSheet.create({
  content: { padding: 12, gap: 8, width: '100%', maxWidth: 760, alignSelf: 'center' },
  heading: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8, marginBottom: 2, marginLeft: 4 },
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  folderRow: { gap: 12, paddingHorizontal: 14, paddingVertical: 16 },
  rowText: { flex: 1 },
  thumb: { borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  meta: { fontSize: 13, marginTop: 3 },
  star: { paddingHorizontal: 14, paddingVertical: 10 },
  empty: { alignItems: 'center', padding: 40, gap: 4 },
});
