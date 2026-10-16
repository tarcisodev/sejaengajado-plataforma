// Karma configuration for Angular unit tests (CI + local).
// CHROME_BIN: set in CI (setup-chrome / puppeteer); falls back to puppeteer locally.

try {
  if (!process.env.CHROME_BIN) {
    // Optional when puppeteer is installed (local / npm ci).
    process.env.CHROME_BIN = require('puppeteer').executablePath();
  }
} catch {
  // CHROME_BIN must come from the environment (e.g. browser-actions/setup-chrome).
}

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {},
      clearContext: false,
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    coverageReporter: {
      dir: require('node:path').join(__dirname, './coverage/web'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
    singleRun: false,
  });
};
