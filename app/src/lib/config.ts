// The settings you are most likely to change live here.

/** Name shown in the app. Also update "name" in app.json to match. */
export const APP_NAME = 'CSD Content Hub';

/** Short text in the red badge next to the name. */
export const BRAND_MARK = '3M';

/** Second line under the name in the sidebar. */
export const TAGLINE = 'Commercial Solutions documents & videos';

/** Text under the title in the red banner. {count} becomes the number of items. */
export const HERO_TEXT =
  '{count} product bulletins, instruction bulletins, data sheets, sales literature and videos. ' +
  'Every title opens the official file on 3M’s servers.';

/** Small print at the bottom of the page and the sidebar. */
export const FOOTER_TEXT = `${APP_NAME} is separate from the 3M™ COSMO app. Documents remain © 3M and open from 3m.com.`;

/**
 * Where the published content lives (catalog.json).
 * The phone apps read from here; the web version reads from its own address.
 */
export const CONTENT_BASE_URL = 'https://apipkorn.github.io/cosmo2/';
