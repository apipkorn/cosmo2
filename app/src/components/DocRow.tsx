import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { openAsset } from '../lib/actions';
import { badge, dateLabel, isRecent, type Asset } from '../lib/catalog';
import { colors, type Hover } from '../lib/theme';

type Props = {
  asset: Asset;
  saved: boolean;
  showBadge: boolean;
  onToggleSaved: (id: string) => void;
  onShare: (asset: Asset) => void;
};

/** One document: title (opens it), type badge, date, save and share buttons. */
export const DocRow = memo(function DocRow({ asset, saved, showBadge, onToggleSaved, onShare }: Props) {
  const b = badge(asset);
  const date = dateLabel(asset.created);
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => openAsset(asset)}
        accessibilityRole="link"
        accessibilityLabel={`${asset.title}, ${b.text}, ${date}`}
        style={({ hovered, pressed }: Hover) => [styles.main, (hovered || pressed) && styles.hover]}>
        {({ hovered }: Hover) => (
          <>
            <Text style={[styles.title, hovered && styles.titleHover]}>{asset.title}</Text>
            {showBadge ? (
              <Text style={[styles.badge, b.style === 'red' && styles.badgeRed, b.style === 'outline' && styles.badgeOutline]} numberOfLines={1}>
                {b.text}
              </Text>
            ) : null}
            <Text style={[styles.date, isRecent(asset.created) && styles.dateNew]}>{date}</Text>
          </>
        )}
      </Pressable>
      <Pressable
        onPress={() => onToggleSaved(asset.id)}
        hitSlop={6}
        style={styles.icon}
        accessibilityRole="button"
        accessibilityLabel={saved ? `Remove ${asset.title} from saved` : `Save ${asset.title}`}>
        <Ionicons name={saved ? 'star' : 'star-outline'} size={18} color={saved ? colors.red : colors.muted} />
      </Pressable>
      <Pressable onPress={() => onShare(asset)} hitSlop={6} style={styles.icon} accessibilityRole="button" accessibilityLabel={`Share ${asset.title}`}>
        <Ionicons name="share-outline" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, paddingHorizontal: 8 },
  hover: { backgroundColor: colors.grey },
  title: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink, lineHeight: 20 },
  titleHover: { textDecorationLine: 'underline', textDecorationColor: colors.red },
  badge: {
    maxWidth: 190,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.black,
    color: '#fff',
    borderWidth: 2,
    borderColor: colors.black,
  },
  badgeRed: { backgroundColor: colors.red, borderColor: colors.red },
  badgeOutline: { backgroundColor: '#fff', color: colors.black },
  date: { width: 72, textAlign: 'right', fontSize: 12.5, fontWeight: '700', color: colors.muted, fontVariant: ['tabular-nums'] },
  dateNew: { color: colors.red },
  icon: { paddingHorizontal: 7, paddingVertical: 10 },
});
