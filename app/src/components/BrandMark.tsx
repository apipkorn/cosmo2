import { StyleSheet, Text, View } from 'react-native';

import { BRAND_MARK } from '../lib/config';
import { colors } from '../lib/theme';

export function BrandMark({ small }: { small?: boolean }) {
  return (
    <View style={[styles.mark, small && styles.small]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={[styles.text, small && styles.smallText]}>{BRAND_MARK}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { width: 52, height: 30, backgroundColor: colors.red, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  small: { width: 44, height: 26 },
  text: { color: '#fff', fontWeight: '800', fontSize: 21, letterSpacing: -1, fontStyle: 'italic' },
  smallText: { fontSize: 18 },
});
