/**
 * Playwright config for the browser end-to-end tests.
 *
 * The whole stack (memory MongoDB + CHEGG server + a preview of a client build)
 * is started in globalSetup on fixed ports, so a leftover process fails loudly
 * instead of silently moving to another port.
 */
module.exports = {
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  globalSetup: require.resolve('./e2e/global-setup.js'),
  globalTeardown: require.resolve('./e2e/global-teardown.js'),
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
};
