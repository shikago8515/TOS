class Logger {
  constructor(options = {}) {
    this.handlers = options.handlers || [];
    this.prefix = options.prefix || '';
  }

  addHandler(handler) {
    this.handlers.push(handler);
  }

  log(message, level = 'info') {
    const formattedMessage = this.prefix ? `${this.prefix} ${message}` : message;
    this.handlers.forEach(handler => handler(formattedMessage, level));
  }

  info(message) {
    this.log(message, 'info');
  }

  warn(message) {
    this.log(message, 'warn');
  }

  error(message) {
    this.log(message, 'error');
  }

  debug(message) {
    this.log(message, 'debug');
  }

  createChild(prefix) {
    return new Logger({
      handlers: this.handlers,
      prefix: this.prefix ? `${this.prefix} ${prefix}` : prefix
    });
  }
}

function createLogger(onLog, prefix = '') {
  const logger = new Logger({ prefix });
  if (onLog) {
    logger.addHandler((msg) => onLog(msg));
  }
  logger.addHandler((msg, level) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${msg}`);
  });

  const callableLogger = (message, level = 'info') => logger.log(message, level);
  callableLogger.log = (message, level = 'info') => logger.log(message, level);
  callableLogger.info = (message) => logger.info(message);
  callableLogger.warn = (message) => logger.warn(message);
  callableLogger.error = (message) => logger.error(message);
  callableLogger.debug = (message) => logger.debug(message);
  callableLogger.createChild = (childPrefix) => {
    const child = logger.createChild(childPrefix);
    const childLogger = (message, level = 'info') => child.log(message, level);
    childLogger.log = (message, level = 'info') => child.log(message, level);
    childLogger.info = (message) => child.info(message);
    childLogger.warn = (message) => child.warn(message);
    childLogger.error = (message) => child.error(message);
    childLogger.debug = (message) => child.debug(message);
    return childLogger;
  };

  return callableLogger;
}

module.exports = { Logger, createLogger };
