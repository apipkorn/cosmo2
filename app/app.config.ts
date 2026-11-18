// Fills in app.json with the settings of the edition being built
// (EXPO_PUBLIC_EDITION, default "graphics"), so both apps share one project.
import type { ConfigContext, ExpoConfig } from 'expo/config';

import editions from './editions.json';

type Edition = keyof typeof editions;

export default ({ config }: ConfigContext): ExpoConfig => {
  const requested = process.env.EXPO_PUBLIC_EDITION;
  if (requested && !(requested in editions)) {
    throw new Error(`Unknown EXPO_PUBLIC_EDITION "${requested}". app/editions.json has: ${Object.keys(editions).join(', ')}`);
  }
  const edition = (requested ?? 'graphics') as Edition;
  const e = editions[edition];
  return {
    ...config,
    name: e.name,
    slug: e.slug,
    scheme: e.scheme,
    experiments: { ...config.experiments, baseUrl: `/cosmo2${e.webPath ? `/${e.webPath}` : ''}` },
  };
};
