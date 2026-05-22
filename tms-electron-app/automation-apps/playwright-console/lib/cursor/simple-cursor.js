const { BaseCursor } = require('./base-cursor');
const { delay } = require('../core');

class SimpleCursor extends BaseCursor {
  constructor(page, options = {}) {
    super(page, options);
    this.moveSteps = options.moveSteps || 10;
    this.clickDelay = options.clickDelay || 100;
  }

  async move(target) {
    const element = typeof target === 'string' ? this.page.locator(target) : target;
    const box = await element.boundingBox();
    
    if (!box) {
      throw new Error('Element not visible for cursor movement');
    }

    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;

    await this.page.mouse.move(targetX, targetY, {
      steps: this.moveSteps
    });
  }

  async click(target) {
    await this.page.mouse.down();
    await delay(this.clickDelay);
    await this.page.mouse.up();
  }
}

module.exports = { SimpleCursor };
