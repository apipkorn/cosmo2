import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { AssetRow, Empty, FolderRow, listStyles } from '../../components/rows';
import { folderPath, KIND_LABEL, type Asset, type Folder, type Kind } from '../../lib/catalog';
import { useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';

type Row = { key: string; folder?: Folder; asset?: Asset };

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { index } = useStore();
  const t = useTheme();
  const [filter, setFilter] = useState<Kind | null>(null);

  const folder = index.folders.get(id);
  const subfolders = useMemo(() => index.children.get(id) ?? [], [index, id]);
  const assets = useMemo(
    () => (folder?.assetIds ?? []).map((a) => index.assets.get(a)).filter((a): a is Asset => !!a),
    [index, folder],
  );
  const kinds = useMemo(() => [...new Set(assets.map((a) => a.kind))], [assets]);
  const shown = filter && kinds.includes(filter) ? assets.filter((a) => a.kind === filter) : assets;

  if (!folder) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Empty icon="folder-open-outline" title="This folder is no longer available" />
      </>
    );
  }

  const sections = [
    { title: 'Folders', data: subfolders.map((f): Row => ({ key: `f-${f.id}`, folder: f })) },
    { title: 'Items', data: shown.map((a): Row => ({ key: `a-${a.id}`, asset: a })) },
  ].filter((s) => s.data.length > 0);
  const trail = folderPath(index, id).slice(0, -1).map((f) => f.name).join(' › ');

  return (
    <>
      <Stack.Screen options={{ title: folder.name }} />
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.key}
        contentContainerStyle={listStyles.content}
        stickySectionHeadersEnabled={false}
        initialNumToRender={12}
        ListHeaderComponent={
          <View>
            {trail ? <Text style={[styles.trail, { color: t.muted }]}>{trail}</Text> : null}
            {folder.description ? <Text style={[styles.description, { color: t.text }]}>{folder.description}</Text> : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View>
            <Text style={[listStyles.heading, { color: t.muted }]}>
              {section.title} ({section.title === 'Items' ? assets.length : section.data.length})
            </Text>
            {section.title === 'Items' && kinds.length > 1 ? (
              <View style={styles.chips}>
                {[null, ...kinds].map((kind) => {
                  const on = filter === kind;
                  return (
                    <Pressable
                      key={kind ?? 'all'}
                      onPress={() => setFilter(kind)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.chip, { backgroundColor: on ? t.accent : t.chip }]}>
                      <Text style={[styles.chipText, { color: on ? t.onAccent : t.text }]}>{kind ? KIND_LABEL[kind] : 'All'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        )}
        renderItem={({ item }) =>
          item.folder ? (
            <FolderRow folder={item.folder} count={index.totals.get(item.folder.id) ?? 0} />
          ) : (
            <AssetRow asset={item.asset!} />
          )
        }
        ListEmptyComponent={<Empty icon="folder-open-outline" title="Nothing here yet" />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  trail: { fontSize: 13, marginLeft: 4 },
  description: { fontSize: 15, lineHeight: 21, margin: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  chipText: { fontSize: 14, fontWeight: '600' },
});
