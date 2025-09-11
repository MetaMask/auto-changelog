#!/usr/bin/env node
(async () => {
  try {
    await import('../dist/cli.mjs');
  } catch (error) {
    try {
      // Fallback to CommonJS build if ESM import fails
      // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-commonjs, @typescript-eslint/no-require-imports
      require('../dist/cli.cjs');
    } catch (fallbackError) {
      // Prefer showing the original error if present
      // eslint-disable-next-line no-console
      console.error(error || fallbackError);
      process.exit(1);
    }
  }
})();
