const fs = require('node:fs');
const path = require('node:path');
const { ConfigError } = require('../core/errors');
const { runtimeDataRoot } = require('../core/utils');

const appRoot = path.resolve(__dirname, '../../');
const defaultConfigPath = path.join(appRoot, 'config', 'default.config.json');
const localConfigPath = path.join(runtimeDataRoot, 'config.local.json');
const configPath = localConfigPath;

function loadConfig(configPathParam = defaultConfigPath) {
  try {
    if (!fs.existsSync(configPathParam)) {
      throw new ConfigError(`Config file not found at: ${configPathParam}`);
    }
    const raw = fs.readFileSync(configPathParam, 'utf8');
    const baseConfig = JSON.parse(raw);

    if (!fs.existsSync(localConfigPath)) {
      return baseConfig;
    }

    const overrideRaw = fs.readFileSync(localConfigPath, 'utf8');
    const overrideConfig = JSON.parse(overrideRaw);
    return mergeConfig(baseConfig, overrideConfig);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(`Failed to load config: ${error.message}`, {
      details: { path: configPathParam }
    });
  }
}

function saveConfig(config, configPathParam = localConfigPath) {
  try {
    fs.mkdirSync(path.dirname(configPathParam), { recursive: true });
    fs.writeFileSync(configPathParam, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    throw new ConfigError(`Failed to save config: ${error.message}`, {
      details: { path: configPathParam }
    });
  }
}

function mergeConfig(baseConfig, overrideConfig) {
  if (Array.isArray(baseConfig) || Array.isArray(overrideConfig)) {
    return Array.isArray(overrideConfig) ? overrideConfig : baseConfig;
  }

  if (!isPlainObject(baseConfig) || !isPlainObject(overrideConfig)) {
    return overrideConfig === undefined ? baseConfig : overrideConfig;
  }

  const merged = { ...baseConfig };

  for (const [key, value] of Object.entries(overrideConfig)) {
    merged[key] = key in merged
      ? mergeConfig(merged[key], value)
      : value;
  }

  return merged;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  appRoot,
  configPath,
  loadConfig,
  saveConfig,
  defaultConfigPath,
  localConfigPath
};
