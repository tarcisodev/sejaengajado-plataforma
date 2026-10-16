process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';
require('tsx/cjs/api').register();
module.exports = require('./jest-int.global-setup.ts').default;
