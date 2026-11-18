// Bundles the catalog of the edition being built (EXPO_PUBLIC_EDITION,
// default "graphics") under the import name "bundled-catalog", so each app
// only carries its own content.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const edition = process.env.EXPO_PUBLIC_EDITION || 'graphics';
const catalogFile = path.join(__dirname, 'assets', 'catalogs', `${edition}.json`);

const resolveDefault = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'bundled-catalog') return { type: 'sourceFile', filePath: catalogFile };
  return (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
