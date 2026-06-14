const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Tell Metro to resolve symlinks/junctions to their real path so that
// apps/mobile/node_modules/react-native (junction) and
// node_modules/react-native (original) are treated as ONE module,
// not two separate instances.
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
