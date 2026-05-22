class AutomationError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'AUTOMATION_ERROR';
    this.details = options.details || {};
    Error.captureStackTrace(this, this.constructor);
  }
}

class ConfigError extends AutomationError {
  constructor(message, options = {}) {
    super(message, { code: 'CONFIG_ERROR', ...options });
  }
}

class WorkflowError extends AutomationError {
  constructor(message, options = {}) {
    super(message, { code: 'WORKFLOW_ERROR', ...options });
  }
}

class ExcelParseError extends AutomationError {
  constructor(message, options = {}) {
    super(message, { code: 'EXCEL_PARSE_ERROR', ...options });
  }
}

class SelectorError extends AutomationError {
  constructor(message, options = {}) {
    super(message, { code: 'SELECTOR_ERROR', ...options });
  }
}

class BrowserError extends AutomationError {
  constructor(message, options = {}) {
    super(message, { code: 'BROWSER_ERROR', ...options });
  }
}

module.exports = {
  AutomationError,
  ConfigError,
  WorkflowError,
  ExcelParseError,
  SelectorError,
  BrowserError
};
