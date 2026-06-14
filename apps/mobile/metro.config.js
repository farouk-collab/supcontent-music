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

// Required: prevents Metro from finding react-native from two paths
// (the junction in apps/mobile/node_modules AND root/node_modules),
// which would create two module instances and break the app.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
