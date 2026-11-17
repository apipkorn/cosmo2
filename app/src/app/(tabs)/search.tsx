import { Ionicons } from '@expo/vector-icons';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AssetRow, Empty, listStyles } from '../../components/rows';
import { search } from '../../lib/catalog';
import { useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';

export default function Search() {
  const { index } = useStore();
  const t = useTheme();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const results = useMemo(() => search(index, deferred), [index, deferred]);
  const typed = deferred.trim().length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.boxWrap}>
      <View style={[styles.box, { backgroundColor: t.card, borderColor: t.border }]}>
        <Ionicons name="search" size={18} color={t.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Product, title or literature number"
          placeholderTextColor={t.muted}
          style={[styles.input, { color: t.text }]}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={t.muted} />
          </Pressable>
        ) : null}
      </View>
      </View>
      <FlatList
        data={results}
        keyExtractor={(a) => a.id}
        contentContainerStyle={listStyles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        ListHeaderComponent={
          typed && results.length > 0 ? (
            <Text style={[listStyles.heading, { color: t.muted }]}>
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          typed ? (
            <Empty icon="search-outline" title="No matches" hint="Try fewer or different words." />
          ) : (
            <Empty icon="search-outline" title="Search everything" hint="Titles, descriptions and literature numbers." />
          )
        }
        renderItem={({ item }) => <AssetRow asset={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  boxWrap: { padding: 12, paddingBottom: 0, width: '100%', maxWidth: 760, alignSelf: 'center' },
  // The box already shows focus, so drop the browser's own outline on web.
  input: { flex: 1, fontSize: 16, paddingVertical: 12, ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }) },
});
