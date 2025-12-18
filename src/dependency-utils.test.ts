import type { Change } from './changelog';
import { ChangeCategory } from './constants';
import type { DependencyChange } from './dependency-types';
import { hasChangelogEntry } from './dependency-utils';

describe('dependency-utils', () => {
  describe('hasChangelogEntry', () => {
    const createReleaseChanges = (
      entries: string[],
    ): Partial<Record<ChangeCategory, Change[]>> => ({
      [ChangeCategory.Changed]: entries.map((description) => ({
        description,
        prNumbers: [],
      })),
    });

    describe('exact matches', () => {
      it('finds exact match for regular dependency', () => {
        const releaseChanges = createReleaseChanges([
          'Bump `@scope/b` from `1.0.0` to `2.0.0` ([#123](https://github.com/example/pull/123))',
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(true);
        expect(result.existingEntry).toBe(
          'Bump `@scope/b` from `1.0.0` to `2.0.0` ([#123](https://github.com/example/pull/123))',
        );
        expect(result.entryIndex).toBe(0);
      });

      it('finds exact match for peerDependency with BREAKING prefix', () => {
        const releaseChanges = createReleaseChanges([
          '**BREAKING:** Bump `@scope/b` from `1.0.0` to `2.0.0` ([#123](https://github.com/example/pull/123))',
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'peerDependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(true);
        expect(result.existingEntry).toBe(
          '**BREAKING:** Bump `@scope/b` from `1.0.0` to `2.0.0` ([#123](https://github.com/example/pull/123))',
        );
        expect(result.entryIndex).toBe(0);
      });

      it('does not match regular dependency entry when searching for peerDependency', () => {
        const releaseChanges = createReleaseChanges([
          'Bump `@scope/b` from `1.0.0` to `2.0.0` ([#123](https://github.com/example/pull/123))',
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
          '**BREAKING:** Bump `@scope/b` from `1.0.0` to `2.0.0` ([#123](https://github.com/example/pull/123))',
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
          'Bump `@scope/package-name` from `1.0.0` to `2.0.0` ([#123](https://github.com/example/pull/123))',
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
          'Bump `@scope/b` from `1.0.0-beta.1` to `2.0.0-rc.1` ([#123](https://github.com/example/pull/123))',
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
          'Bump `@scope/a` from `1.0.0` to `2.0.0` ([#123](https://github.com/example/pull/123))',
          'Bump `@scope/b` from `1.0.0` to `2.0.0` ([#124](https://github.com/example/pull/124))',
          'Bump `@scope/c` from `1.0.0` to `2.0.0` ([#125](https://github.com/example/pull/125))',
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
        expect(result.existingEntry).toBe(
          'Bump `@scope/b` from `1.0.0` to `2.0.0` ([#124](https://github.com/example/pull/124))',
        );
      });
    });

    describe('any version matches', () => {
      it('finds any version match when exact version does not match', () => {
        const releaseChanges = createReleaseChanges([
          'Bump `@scope/b` from `1.0.0` to `1.5.0` ([#123](https://github.com/example/pull/123))',
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(false);
        expect(result.existingEntry).toBe(
          'Bump `@scope/b` from `1.0.0` to `1.5.0` ([#123](https://github.com/example/pull/123))',
        );
        expect(result.entryIndex).toBe(0);
      });

      it('finds any version match for peerDependency with BREAKING prefix', () => {
        const releaseChanges = createReleaseChanges([
          '**BREAKING:** Bump `@scope/b` from `1.0.0` to `1.5.0` ([#123](https://github.com/example/pull/123))',
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
          type: 'peerDependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(false);
        expect(result.existingEntry).toBe(
          '**BREAKING:** Bump `@scope/b` from `1.0.0` to `1.5.0` ([#123](https://github.com/example/pull/123))',
        );
      });

      it('does not match any version entry for regular dependency when searching for peerDependency', () => {
        const releaseChanges = createReleaseChanges([
          'Bump `@scope/b` from `1.0.0` to `1.5.0` ([#123](https://github.com/example/pull/123))',
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
          '**BREAKING:** Bump `@scope/b` from `1.0.0` to `1.5.0` ([#123](https://github.com/example/pull/123))',
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
          'Bump `@scope/a` from `1.0.0` to `2.0.0` ([#123](https://github.com/example/pull/123))',
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
    });

    describe('edge cases', () => {
      it('handles dependency names with regex special characters', () => {
        const releaseChanges = createReleaseChanges([
          'Bump `package-name` from `1.0.0` to `2.0.0` ([#123](https://github.com/example/pull/123))',
        ]);

        const change: DependencyChange = {
          dependency: 'package-name',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        };

        const result = hasChangelogEntry(releaseChanges, change);

        expect(result.hasExactMatch).toBe(true);
      });

      it('handles scoped packages with special characters', () => {
        const releaseChanges = createReleaseChanges([
          'Bump `@scope/package.name` from `1.0.0` to `2.0.0` ([#123](https://github.com/example/pull/123))',
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

      it('handles entries with additional text after the bump description', () => {
        const releaseChanges = createReleaseChanges([
          'Bump `@scope/b` from `1.0.0` to `2.0.0` ([#123](https://github.com/example/pull/123)) - some additional note',
        ]);

        const change: DependencyChange = {
          dependency: '@scope/b',
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
