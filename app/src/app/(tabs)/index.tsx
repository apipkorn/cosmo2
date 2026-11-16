import { FlatList, Text } from 'react-native';

import { FolderRow, listStyles } from '../../components/rows';
import { useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';

export default function Browse() {
  const { index } = useStore();
  const t = useTheme();
  return (
    <FlatList
      data={index.roots}
      keyExtractor={(f) => f.id}
      contentContainerStyle={listStyles.content}
      ListHeaderComponent={
        <Text style={[listStyles.heading, { color: t.muted }]}>{index.assets.size} items in {index.roots.length} sections</Text>
      }
      renderItem={({ item }) => <FolderRow folder={item} count={index.totals.get(item.id) ?? 0} />}
    />
  );
}
