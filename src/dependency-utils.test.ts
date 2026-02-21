/* eslint-disable @typescript-eslint/naming-convention */
import type { Change, DependencyBump } from './changelog';
import { ChangeCategory } from './constants';
import type { DependencyChange } from './dependency-types';
import { hasChangelogEntry } from './dependency-utils';

describe('dependency-utils', () => {
  describe('hasChangelogEntry', () => {
    const createReleaseChanges = (
      changes: {
        description: string;
        dependencyBump?: DependencyBump;
      }[],
    ): Partial<Record<ChangeCategory, Change[]>> => ({
      [ChangeCategory.Changed]: changes.map(
        ({ description, dependencyBump }) => ({
          description,
          prNumbers: [],
          dependencyBump,
        }),
      ),
    });

    describe('exact matches', () => {
      it('finds exact match for regular dependency', () => {
        const releaseChanges = createReleaseChanges([
          {
            description: 'Bump `@scope/b` from `1.0.0` to `2.0.0`',
            dependencyBump: {
              dependency: '@scope/b',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(true);
        expect(result.existingEntry?.dependencyBump?.dependency).toBe(
          '@scope/b',
        );
        expect(result.entryIndex).toBe(0);
      });

      it('finds exact match for peerDependency with BREAKING prefix', () => {
        const releaseChanges = createReleaseChanges([
          {
            description:
              '**BREAKING:** Bump `@scope/b` from `1.0.0` to `2.0.0`',
            dependencyBump: {
              dependency: '@scope/b',
              type: 'peerDependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'peerDependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(true);
        expect(result.existingEntry?.dependencyBump?.type).toBe(
          'peerDependencies',
        );
        expect(result.entryIndex).toBe(0);
      });

      it('does not match regular dependency entry when searching for peerDependency', () => {
        const releaseChanges = createReleaseChanges([
          {
            description: 'Bump `@scope/b` from `1.0.0` to `2.0.0`',
            dependencyBump: {
              dependency: '@scope/b',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'peerDependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(false);
      });

      it('does not match peerDependency entry when searching for regular dependency', () => {
        const releaseChanges = createReleaseChanges([
          {
            description:
              '**BREAKING:** Bump `@scope/b` from `1.0.0` to `2.0.0`',
            dependencyBump: {
              dependency: '@scope/b',
              type: 'peerDependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(false);
      });

      it('handles special characters in dependency name', () => {
        const releaseChanges = createReleaseChanges([
          {
            description: 'Bump `@scope/package-name` from `1.0.0` to `2.0.0`',
            dependencyBump: {
              dependency: '@scope/package-name',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/package-name',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(true);
      });

      it('handles special characters in version numbers', () => {
        const releaseChanges = createReleaseChanges([
          {
            description: 'Bump `@scope/b` from `1.0.0-beta.1` to `2.0.0-rc.1`',
            dependencyBump: {
              dependency: '@scope/b',
              type: 'dependencies',
              oldVersion: '1.0.0-beta.1',
              newVersion: '2.0.0-rc.1',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0-beta.1',
          newVersion: '2.0.0-rc.1',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(true);
      });

      it('finds correct entry when multiple entries exist', () => {
        const releaseChanges = createReleaseChanges([
          {
            description: 'Bump `@scope/a` from `1.0.0` to `2.0.0`',
            dependencyBump: {
              dependency: '@scope/a',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          },
          {
            description: 'Bump `@scope/b` from `1.0.0` to `2.0.0`',
            dependencyBump: {
              dependency: '@scope/b',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          },
          {
            description: 'Bump `@scope/c` from `1.0.0` to `2.0.0`',
            dependencyBump: {
              dependency: '@scope/c',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(true);
        expect(result.entryIndex).toBe(1);
        expect(result.existingEntry?.dependencyBump?.dependency).toBe(
          '@scope/b',
        );
      });
    });

    describe('any version matches', () => {
      it('finds any version match when exact version does not match', () => {
        const releaseChanges = createReleaseChanges([
          {
            description: 'Bump `@scope/b` from `1.0.0` to `1.5.0`',
            dependencyBump: {
              dependency: '@scope/b',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '1.5.0',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(false);
        expect(result.existingEntry?.dependencyBump?.newVersion).toBe('1.5.0');
        expect(result.entryIndex).toBe(0);
      });

      it('finds any version match for peerDependency with BREAKING prefix', () => {
        const releaseChanges = createReleaseChanges([
          {
            description:
              '**BREAKING:** Bump `@scope/b` from `1.0.0` to `1.5.0`',
            dependencyBump: {
              dependency: '@scope/b',
              type: 'peerDependencies',
              oldVersion: '1.0.0',
              newVersion: '1.5.0',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'peerDependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(false);
        expect(result.existingEntry?.dependencyBump?.type).toBe(
          'peerDependencies',
        );
      });

      it('does not match any version entry for regular dependency when searching for peerDependency', () => {
        const releaseChanges = createReleaseChanges([
          {
            description: 'Bump `@scope/b` from `1.0.0` to `1.5.0`',
            dependencyBump: {
              dependency: '@scope/b',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '1.5.0',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'peerDependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(false);
        expect(result.existingEntry).toBeUndefined();
      });

      it('does not match any version entry for peerDependency when searching for regular dependency', () => {
        const releaseChanges = createReleaseChanges([
          {
            description:
              '**BREAKING:** Bump `@scope/b` from `1.0.0` to `1.5.0`',
            dependencyBump: {
              dependency: '@scope/b',
              type: 'peerDependencies',
              oldVersion: '1.0.0',
              newVersion: '1.5.0',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(false);
        expect(result.existingEntry).toBeUndefined();
      });
    });

    describe('no matches', () => {
      it('returns no match when entry does not exist', () => {
        const releaseChanges = createReleaseChanges([
          {
            description: 'Bump `@scope/a` from `1.0.0` to `2.0.0`',
            dependencyBump: {
              dependency: '@scope/a',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(false);
        expect(result.existingEntry).toBeUndefined();
        expect(result.entryIndex).toBeUndefined();
      });

      it('returns no match when Changed array is empty', () => {
        const releaseChanges: Partial<Record<ChangeCategory, Change[]>> = {
          [ChangeCategory.Changed]: [],
        };

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(false);
        expect(result.existingEntry).toBeUndefined();
        expect(result.entryIndex).toBeUndefined();
      });

      it('returns no match when Changed category is missing', () => {
        const releaseChanges: Partial<Record<ChangeCategory, Change[]>> = {};

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(false);
        expect(result.existingEntry).toBeUndefined();
        expect(result.entryIndex).toBeUndefined();
      });

      it('skips entries without dependencyBump', () => {
        const releaseChanges: Partial<Record<ChangeCategory, Change[]>> = {
          [ChangeCategory.Changed]: [
            {
              description: 'Some manual change',
              prNumbers: [],
            },
          ],
        };

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(false);
        expect(result.existingEntry).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('handles dependency names with special characters', () => {
        const releaseChanges = createReleaseChanges([
          {
            description: 'Bump `@scope/package.name` from `1.0.0` to `2.0.0`',
            dependencyBump: {
              dependency: '@scope/package.name',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          },
        ]);

        const change: DependencyChange = {
          dependency: '@scope/package.name',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(true);
      });
    });
  });
});
