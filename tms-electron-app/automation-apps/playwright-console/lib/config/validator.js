const { ConfigError } = require('../core/errors');
const { isConfigured } = require('../core/utils');

function validateConfig(config) {
  const errors = [];

  if (!config) {
    throw new ConfigError('Config is required');
  }

  if (!config.app || !config.app.port) {
    errors.push('app.port is required');
  }

  if (!config.browser) {
    errors.push('browser config is required');
  } else {
    if (!config.browser.channel) {
      errors.push('browser.channel is required');
    }
    if (!config.browser.userDataDir) {
      errors.push('browser.userDataDir is required');
    }
  }

  if (config.n8n?.enabled && !config.n8n.baseUrl) {
    errors.push('n8n.baseUrl is required when n8n.enabled is true');
  }

  if (!config.workflows || typeof config.workflows !== 'object') {
    errors.push('workflows config is required');
  } else {
    Object.entries(config.workflows).forEach(([workflowId, workflowConfig]) => {
      validateWorkflowConfig(workflowId, workflowConfig, errors);
    });
  }

  if (errors.length > 0) {
    throw new ConfigError('Config validation failed', {
      details: { errors }
    });
  }

  return config;
}

function validateWorkflowConfig(workflowId, workflowConfig, errors) {
  if (!workflowConfig.name) {
    errors.push(`workflows.${workflowId}.name is required`);
  }

  if (!workflowConfig.selectors) {
    errors.push(`workflows.${workflowId}.selectors is required`);
  }

  if (!workflowConfig.excel || !workflowConfig.excel.headerAliases) {
    errors.push(`workflows.${workflowId}.excel.headerAliases is required`);
  }
}

function collectMissingSelectors(workflowConfig, requiredSelectors = []) {
  const missing = [];
  const selectors = workflowConfig.selectors || {};

  requiredSelectors.forEach(selector => {
    if (!isConfigured(selectors[selector])) {
      missing.push(selector);
    }
  });

  return missing;
}

module.exports = {
  validateConfig,
  validateWorkflowConfig,
  collectMissingSelectors
};
