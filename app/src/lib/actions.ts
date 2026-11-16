import * as WebBrowser from 'expo-web-browser';
import { Platform, Share } from 'react-native';

import type { Asset } from './catalog';

/** Opens the PDF or video: in-app browser on phones, a new tab on the web. */
export async function openAsset(asset: Asset): Promise<void> {
  if (Platform.OS === 'web') {
    window.open(asset.url, '_blank', 'noopener');
  } else {
    await WebBrowser.openBrowserAsync(asset.url);
  }
}

/** Shares the link. Returns 'copied' when it fell back to the clipboard. */
export async function shareAsset(asset: Asset): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Platform.OS !== 'web') {
      await Share.share(Platform.OS === 'ios' ? { url: asset.url, title: asset.title } : { message: `${asset.title}\n${asset.url}` });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title: asset.title, url: asset.url });
      return 'shared';
    }
    await navigator.clipboard.writeText(asset.url);
    return 'copied';
  } catch {
    return 'failed'; // includes the user closing the share sheet
  }
}
