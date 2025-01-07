import { withinProjectEnvironment } from '../tests/functional/helpers';

jest.setTimeout(10_000);

describe('auto-changelog (functional)', () => {
  describe('validate', () => {
    it('fails if --pr-links-present is given and not all changelog entries have associated PR links', async () => {
      await withinProjectEnvironment(async (environment) => {
        await expect(
          environment.runTool({ args: ['validate', '--ensure-pr-links'] }),
        ).rejects.toThrow('Not all changelog entries have associated PR links');
      });
    });
  });
});
