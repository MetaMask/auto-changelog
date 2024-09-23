import { createEmptyChangelog } from './init';

const exampleRepoUrl =
  'https://github.com/ExampleUsernameOrOrganization/ExampleRepository/';

const emptyChangelog = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

[Unreleased]: ${exampleRepoUrl}
`;

describe('createEmptyChangelog', () => {
  it('creates an empty changelog', async () => {
    expect(
      await createEmptyChangelog({ repoUrl: exampleRepoUrl }),
    ).toStrictEqual(emptyChangelog);
  });

  it('creates an empty changelog with a custom tag prefix', async () => {
    expect(
      await createEmptyChangelog({ repoUrl: exampleRepoUrl, tagPrefix: 'foo' }),
    ).toStrictEqual(emptyChangelog);
  });
});
