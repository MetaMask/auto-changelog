const { updateChangelog } = require('./updateChangelog');
const {
  ChangelogFormattingError,
  validateChangelog,
} = require('./validateChangelog');

module.exports = {
  ChangelogFormattingError,
  updateChangelog,
  validateChangelog,
};
