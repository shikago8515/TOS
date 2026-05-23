const fs = require('node:fs');
const path = require('node:path');
const { ConfigError } = require('../core/errors');

const appRoot = path.resolve(__dirname, '../../');
const defaultConfigPath = path.join(appRoot, 'config', 'default.config.json');
const configPath = defaultConfigPath;

function loadConfig(configPathParam = defaultConfigPath) {
  try {
    if (!fs.existsSync(configPathParam)) {
      throw new ConfigError(`Config file not found at: ${configPathParam}`);
    }
    const raw = fs.readFileSync(configPathParam, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(`Failed to load config: ${error.message}`, {
      details: { path: configPathParam }
    });
  }
}

function saveConfig(config, configPathParam = defaultConfigPath) {
  try {
    fs.writeFileSync(configPathParam, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    throw new ConfigError(`Failed to save config: ${error.message}`, {
      details: { path: configPathParam }
    });
  }
}

module.exports = {
  appRoot,
  configPath,
  loadConfig,
  saveConfig,
  defaultConfigPath
};
