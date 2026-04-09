-- RealmManager: Persist realm source repository and branch info
-- Applied to the acore_auth database

CREATE TABLE IF NOT EXISTS `realm_source` (
  `realmid` INT UNSIGNED NOT NULL PRIMARY KEY COMMENT 'FK to realmlist.id',
  `source_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'Repository source identifier (e.g. azerothcore-wotlk)',
  `source_branch` VARCHAR(128) NOT NULL DEFAULT 'master' COMMENT 'Git branch name'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RealmManager: realm build source tracking';
