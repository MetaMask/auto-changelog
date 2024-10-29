import _outdent from 'outdent';

import { updateChangelog } from './update-changelog';

const outdent = _outdent({ trimTrailingNewline: false });

describe('updateChangelog', () => {
  it('should call git fetch by default', () => {
    const cmdMock = jest.fn();
    updateChangelog({
      changelogContent: outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        [Unreleased]:https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
        `,
      isReleaseCandidate: true,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      run: cmdMock,
    });
    expect(cmdMock).toHaveBeenCalledWith('git', ['fetch', '--tags'])
  });
  it('should not call git fetch when ', () => {
    const cmdMock = jest.fn();
    updateChangelog({
      changelogContent: outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        [Unreleased]:https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
        `,
      isReleaseCandidate: true,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      fetchRemote: false,
      run: cmdMock,
    });
    expect(cmdMock).not.toHaveBeenCalledWith(['git'], ['fetch', '--tags'])
  });
});
