import { prettier } from './formatters';

describe('oxfmt', () => {
  // Oxfmt is ESM-only, and Jest doesn't work well with ESM. We'll want to
  // switch to Vitest eventually anyway, so for now we'll just skip this test.
  it.todo('formats changelog with Oxfmt when installed');

  // Not easy to test with Jest, since Oxfmt is dynamically imported.
  it.todo('throws an error with a clear message when Oxfmt is not installed');
});

describe('prettier', () => {
  it('formats changelog with Prettier when installed', async () => {
    const input = '# Changelog\n\n- Initial release';

    expect(await prettier(input)).toBe('# Changelog\n\n- Initial release\n');
  });

  // Not easy to test with Jest, since Prettier is dynamically imported.
  it.todo(
    'throws an error with a clear message when Prettier is not installed',
  );
});
