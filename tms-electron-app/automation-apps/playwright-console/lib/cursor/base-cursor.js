class BaseCursor {
  constructor(page, options = {}) {
    this.page = page;
    this.options = options;
  }

  async move(target) {
    throw new Error('move() must be implemented by subclass');
  }

  async click(target) {
    throw new Error('click() must be implemented by subclass');
  }

  async moveAndClick(target) {
    await this.move(target);
    await this.click(target);
  }
}

module.exports = { BaseCursor };
