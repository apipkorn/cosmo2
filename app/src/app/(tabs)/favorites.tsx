import { useMemo } from 'react';
import { FlatList } from 'react-native';

import { AssetRow, Empty, listStyles } from '../../components/rows';
import type { Asset } from '../../lib/catalog';
import { useStore } from '../../lib/store';

export default function Favorites() {
  const { index, favorites } = useStore();
  // Favourites whose asset has since left the catalog are skipped.
  const assets = useMemo(
    () => favorites.map((id) => index.assets.get(id)).filter((a): a is Asset => !!a),
    [index, favorites],
  );
  return (
    <FlatList
      data={assets}
      keyExtractor={(a) => a.id}
      contentContainerStyle={listStyles.content}
      ListEmptyComponent={<Empty icon="star-outline" title="No favourites yet" hint="Tap the star on any item to keep it here." />}
      renderItem={({ item }) => <AssetRow asset={item} />}
    />
  );
}
