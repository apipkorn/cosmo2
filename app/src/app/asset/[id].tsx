import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Empty } from '../../components/rows';
import { openAsset, shareAsset } from '../../lib/actions';
import { folderPath, formatSize, KIND_LABEL } from '../../lib/catalog';
import { thumbUrl, useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';

export default function AssetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { index, isFavorite, toggleFavorite } = useStore();
  const t = useTheme();
  const [note, setNote] = useState('');
  const asset = index.assets.get(id);

  if (!asset) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Empty icon="document-outline" title="This item is no longer available" />
      </>
    );
  }

  const fav = isFavorite(asset.id);
  const thumb = thumbUrl(asset.thumb);
  const facts = [
    ['Type', KIND_LABEL[asset.kind]],
    ['Size', formatSize(asset.size)],
    ['Literature no.', asset.lit],
    ['Added', asset.created],
  ].filter((row): row is [string, string] => !!row[1]);
  const share = async () => {
    const result = await shareAsset(asset);
    setNote(result === 'copied' ? 'Link copied' : '');
  };

  return (
    <>
      <Stack.Screen options={{ title: KIND_LABEL[asset.kind] }} />
      <ScrollView contentContainerStyle={styles.content}>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={[styles.preview, { backgroundColor: t.chip }]}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Text style={[styles.title, { color: t.text }]}>{asset.title}</Text>
        {asset.description ? <Text style={[styles.body, { color: t.muted }]}>{asset.description}</Text> : null}

        <Pressable
          onPress={() => openAsset(asset)}
          style={[styles.primary, { backgroundColor: t.accent }]}
          accessibilityRole="button">
          <Ionicons name={asset.kind === 'video' ? 'play' : 'open-outline'} size={20} color={t.onAccent} />
          <Text style={[styles.primaryText, { color: t.onAccent }]}>
            {asset.kind === 'video' ? 'Play video' : `Open ${KIND_LABEL[asset.kind]}`}
          </Text>
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            onPress={() => toggleFavorite(asset.id)}
            style={[styles.secondary, { backgroundColor: t.card, borderColor: t.border }]}
            accessibilityRole="button"
            accessibilityState={{ selected: fav }}>
            <Ionicons name={fav ? 'star' : 'star-outline'} size={18} color={fav ? t.star : t.text} />
            <Text style={[styles.secondaryText, { color: t.text }]}>{fav ? 'Favourited' : 'Favourite'}</Text>
          </Pressable>
          <Pressable
            onPress={share}
            style={[styles.secondary, { backgroundColor: t.card, borderColor: t.border }]}
            accessibilityRole="button">
            <Ionicons name="share-outline" size={18} color={t.text} />
            <Text style={[styles.secondaryText, { color: t.text }]}>{note || 'Share link'}</Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          {facts.map(([label, value]) => (
            <View key={label} style={styles.fact}>
              <Text style={[styles.factLabel, { color: t.muted }]}>{label}</Text>
              <Text style={[styles.factValue, { color: t.text }]} selectable>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {(index.placements.get(asset.id) ?? []).map((folder) => (
          <Link key={folder.id} href={{ pathname: '/folder/[id]', params: { id: folder.id } }} asChild>
            <Pressable style={StyleSheet.flatten([styles.card, styles.found, { backgroundColor: t.card, borderColor: t.border }])}
              accessibilityRole="link">
              <Ionicons name="folder-outline" size={18} color={t.accent} />
              <Text style={[styles.foundText, { color: t.text }]}>
                {folderPath(index, folder.id).map((f) => f.name).join(' › ')}
              </Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, width: '100%', maxWidth: 760, alignSelf: 'center' },
  preview: { width: '100%', height: 260, borderRadius: 12 },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  body: { fontSize: 15, lineHeight: 22 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 15, borderRadius: 12 },
  primaryText: { fontSize: 17, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12 },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 4 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 10 },
  factLabel: { fontSize: 15 },
  factValue: { fontSize: 15, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  found: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  foundText: { flex: 1, fontSize: 14, lineHeight: 19 },
});
