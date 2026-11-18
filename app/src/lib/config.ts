// Which edition this build is, and its settings. The edition is chosen when
// the app is built, with EXPO_PUBLIC_EDITION (default "graphics"); names and
// texts for each edition live in app/editions.json.
import editions from '../../editions.json';

export type Edition = keyof typeof editions;

const requested = process.env.EXPO_PUBLIC_EDITION;
export const EDITION: Edition = requested && requested in editions ? (requested as Edition) : 'graphics';
const settings = editions[EDITION];

/** Name shown in the app. */
export const APP_NAME = settings.name;

/** Short text in the red badge next to the name. */
export const BRAND_MARK = '3M';

/** Second line under the name in the sidebar. */
export const TAGLINE = settings.tagline;

/** Text under the title in the red banner. {count} becomes the number of items. */
export const HERO_TEXT = settings.heroText;

/** Examples in the search box placeholder. */
export const SEARCH_EXAMPLE = settings.searchExample;

/** Small print at the bottom of the page and the sidebar. */
export const FOOTER_TEXT = `${APP_NAME} is separate from the 3M™ COSMO app. Documents remain © 3M and open from 3m.com.`;

/**
 * Where this edition's published content lives (catalog.json).
 * The phone apps read from here; the web version reads from its own address.
 */
export const CONTENT_BASE_URL = `https://apipkorn.github.io/cosmo2/${settings.webPath ? `${settings.webPath}/` : ''}`;
