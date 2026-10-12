'use strict';
// Read-only access to the local Steam install: libraries, installed games and achievement unlocks.
module.exports = {
  ...require('./paths'),
  ...require('./library'),
  ...require('./achievements'),
  ...require('./watcher'),
  selfStats: require('./selfStats'),
};
