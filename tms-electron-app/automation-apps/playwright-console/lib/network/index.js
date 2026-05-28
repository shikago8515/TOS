const sanitizer = require('./sanitizer');
const analyzer = require('./api-template-analyzer');

module.exports = { ...sanitizer, ...analyzer };
