const { BaseCursor } = require('./base-cursor');
const { createCursor: createGhostCursor } = require('ghost-cursor-playwright-port');
const { delay } = require('../core');

class HumanCursor extends BaseCursor {
  constructor(page, options = {}) {
    super(page, options);
    this.cursor = createGhostCursor(page, null, true, {
      noise: options.noise || 20,
      overshootRadius: options.overshootRadius || 2,
      randomizeClickPosition: options.randomizeClickPosition !== false
    });
    this.moveDelay = options.moveDelay || 300;
  }

  async move(target) {
    const element = typeof target === 'string' ? this.page.locator(target) : target;
    await this.cursor.move(element);
    await delay(this.moveDelay);
  }

  async click(target) {
    const element = typeof target === 'string' ? this.page.locator(target) : target;
    await this.cursor.click(element);
  }
}

module.exports = { HumanCursor };
