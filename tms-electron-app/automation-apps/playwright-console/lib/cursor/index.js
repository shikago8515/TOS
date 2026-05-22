const { BaseCursor } = require('./base-cursor');
const { SimpleCursor } = require('./simple-cursor');
const { HumanCursor } = require('./human-cursor');

const CursorType = {
  SIMPLE: 'simple',
  HUMAN: 'human'
};

function createCursor(page, type = CursorType.HUMAN, options = {}) {
  switch (type) {
    case CursorType.SIMPLE:
      return new SimpleCursor(page, options);
    case CursorType.HUMAN:
    default:
      return new HumanCursor(page, options);
  }
}

module.exports = {
  BaseCursor,
  SimpleCursor,
  HumanCursor,
  CursorType,
  createCursor
};
