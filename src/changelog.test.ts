import _outdent from 'outdent';

import Changelog from './changelog';
import { ChangeCategory } from './constants';

const outdent = _outdent({ trimTrailingNewline: false });

const emptyChangelog = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

[Unreleased]: fake://metamask.io/
`;

describe('Changelog', () => {
  it('should allow creating an empty changelog', async () => {
    const changelog = new Changelog({
      repoUrl: 'fake://metamask.io',
    });

    expect(await changelog.toString()).toStrictEqual(emptyChangelog);
  });

  it('should allow creating an empty changelog with a custom tag prefix', async () => {
    const changelog = new Changelog({
      repoUrl: 'fake://metamask.io',
      tagPrefix: 'example@v',
    });

    expect(await changelog.toString()).toStrictEqual(emptyChangelog);
  });

  it('should recreate pull request links for change entries based on the repo URL', async () => {
    const changelog = new Changelog({
      repoUrl: 'https://github.com/MetaMask/fake-repo',
    });
    changelog.addRelease({ version: '1.0.0' });
    changelog.addChange({
      version: '1.0.0',
      category: ChangeCategory.Changed,
      description: 'This is a cool change\n  - This is a sub-bullet',
      prNumbers: ['100', '200'],
    });
    changelog.addChange({
      version: '1.0.0',
      category: ChangeCategory.Changed,
      description: 'This is a very cool change\nAnd another line',
      prNumbers: ['300'],
    });

    expect(await changelog.toString()).toStrictEqual(outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      ## [1.0.0]
      ### Changed
      - This is a very cool change ([#300](https://github.com/MetaMask/fake-repo/pull/300))
      And another line
      - This is a cool change ([#100](https://github.com/MetaMask/fake-repo/pull/100), [#200](https://github.com/MetaMask/fake-repo/pull/200))
        - This is a sub-bullet

      [Unreleased]: https://github.com/MetaMask/fake-repo/compare/v1.0.0...HEAD
      [1.0.0]: https://github.com/MetaMask/fake-repo/releases/tag/v1.0.0
    `);
  });

  describe('addChange with dependencyBump', () => {
    it('auto-generates description from dependencyBump', async () => {
      const changelog = new Changelog({
        repoUrl: 'https://github.com/MetaMask/fake-repo',
      });
      changelog.addChange({
        category: ChangeCategory.Changed,
        dependencyBump: {
          dependency: '@scope/b',
          isBreaking: false,
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        },
      });

      const content = await changelog.toString();
      expect(content).toContain('Bump `@scope/b` from `1.0.0` to `2.0.0`');
    });

    it('adds BREAKING prefix for peerDependencies', async () => {
      const changelog = new Changelog({
        repoUrl: 'https://github.com/MetaMask/fake-repo',
      });
      changelog.addChange({
        category: ChangeCategory.Changed,
        dependencyBump: {
          dependency: '@scope/b',
          isBreaking: true,
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        },
      });

      const content = await changelog.toString();
      expect(content).toContain(
        '**BREAKING:** Bump `@scope/b` from `1.0.0` to `2.0.0`',
      );
    });

    it('throws when neither description nor dependencyBump provided', () => {
      const changelog = new Changelog({
        repoUrl: 'https://github.com/MetaMask/fake-repo',
      });

      expect(() => {
        // @ts-expect-error — testing runtime guard for missing description
        changelog.addChange({
          category: ChangeCategory.Changed,
        });
      }).toThrow('Description required');
    });
  });

  describe('updateChange', () => {
    it('updates description of an existing change', () => {
      const changelog = new Changelog({
        repoUrl: 'https://github.com/MetaMask/fake-repo',
      });
      changelog.addChange({
        category: ChangeCategory.Changed,
        description: 'Old description',
      });

      changelog.updateChange({
        category: ChangeCategory.Changed,
        entryIndex: 0,
        description: 'New description',
      });

      const changes = changelog.getUnreleasedChanges();
      expect(changes[ChangeCategory.Changed]?.[0].description).toBe(
        'New description',
      );
    });

    it('updates PR numbers of an existing change', () => {
      const changelog = new Changelog({
        repoUrl: 'https://github.com/MetaMask/fake-repo',
      });
      changelog.addChange({
        category: ChangeCategory.Changed,
        description: 'Some change',
        prNumbers: ['100'],
      });

      changelog.updateChange({
        category: ChangeCategory.Changed,
        entryIndex: 0,
        prNumbers: ['100', '200'],
      });

      const changes = changelog.getUnreleasedChanges();
      expect(changes[ChangeCategory.Changed]?.[0].prNumbers).toStrictEqual([
        '100',
        '200',
      ]);
    });

    it('updates dependencyBump and auto-generates description', () => {
      const changelog = new Changelog({
        repoUrl: 'https://github.com/MetaMask/fake-repo',
      });
      changelog.addChange({
        category: ChangeCategory.Changed,
        description: 'Bump `@scope/b` from `1.0.0` to `1.5.0`',
        dependencyBump: {
          dependency: '@scope/b',
          isBreaking: false,
          oldVersion: '1.0.0',
          newVersion: '1.5.0',
        },
      });

      changelog.updateChange({
        category: ChangeCategory.Changed,
        entryIndex: 0,
        dependencyBump: {
          dependency: '@scope/b',
          isBreaking: false,
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        },
      });

      const changes = changelog.getUnreleasedChanges();
      const entry = changes[ChangeCategory.Changed]?.[0];
      expect(entry?.description).toBe(
        'Bump `@scope/b` from `1.0.0` to `2.0.0`',
      );
      expect(entry?.dependencyBump?.newVersion).toBe('2.0.0');
    });

    it('uses explicit description over dependencyBump when both provided', () => {
      const changelog = new Changelog({
        repoUrl: 'https://github.com/MetaMask/fake-repo',
      });
      changelog.addChange({
        category: ChangeCategory.Changed,
        description: 'Bump `@scope/b` from `1.0.0` to `1.5.0`',
        dependencyBump: {
          dependency: '@scope/b',
          isBreaking: false,
          oldVersion: '1.0.0',
          newVersion: '1.5.0',
        },
      });

      changelog.updateChange({
        category: ChangeCategory.Changed,
        entryIndex: 0,
        description: 'Custom description',
        dependencyBump: {
          dependency: '@scope/b',
          isBreaking: false,
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        },
      });

      const changes = changelog.getUnreleasedChanges();
      const entry = changes[ChangeCategory.Changed]?.[0];
      expect(entry?.description).toBe('Custom description');
      expect(entry?.dependencyBump?.newVersion).toBe('2.0.0');
    });

    it('throws when version does not exist', () => {
      const changelog = new Changelog({
        repoUrl: 'https://github.com/MetaMask/fake-repo',
      });

      expect(() => {
        changelog.updateChange({
          version: '9.9.9',
          category: ChangeCategory.Changed,
          entryIndex: 0,
        });
      }).toThrow("Could not find release: '9.9.9'");
    });

    it('throws when entryIndex is out of bounds (positive)', () => {
      const changelog = new Changelog({
        repoUrl: 'https://github.com/MetaMask/fake-repo',
      });
      changelog.addChange({
        category: ChangeCategory.Changed,
        description: 'Only entry',
      });

      expect(() => {
        changelog.updateChange({
          category: ChangeCategory.Changed,
          entryIndex: 5,
        });
      }).toThrow("No change at index 5 in category 'Changed'");
    });

    it('throws when entryIndex is negative', () => {
      const changelog = new Changelog({
        repoUrl: 'https://github.com/MetaMask/fake-repo',
      });
      changelog.addChange({
        category: ChangeCategory.Changed,
        description: 'Only entry',
      });

      expect(() => {
        changelog.updateChange({
          category: ChangeCategory.Changed,
          entryIndex: -1,
        });
      }).toThrow("No change at index -1 in category 'Changed'");
    });

    it('throws when category has no entries', () => {
      const changelog = new Changelog({
        repoUrl: 'https://github.com/MetaMask/fake-repo',
      });

      expect(() => {
        changelog.updateChange({
          category: ChangeCategory.Changed,
          entryIndex: 0,
        });
      }).toThrow(
        "Could not find category 'Changed' in release section 'Unreleased'",
      );
    });

    it('updates a change in a specific release version', () => {
      const changelog = new Changelog({
        repoUrl: 'https://github.com/MetaMask/fake-repo',
      });
      changelog.addRelease({ version: '1.0.0' });
      changelog.addChange({
        version: '1.0.0',
        category: ChangeCategory.Changed,
        description: 'Original',
      });

      changelog.updateChange({
        version: '1.0.0',
        category: ChangeCategory.Changed,
        entryIndex: 0,
        description: 'Updated',
      });

      const changes = changelog.getReleaseChanges('1.0.0');
      expect(changes[ChangeCategory.Changed]?.[0].description).toBe('Updated');
    });
  });
});
