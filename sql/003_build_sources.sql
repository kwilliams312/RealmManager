-- RealmManager: Global build sources — manages git repositories for building worldserver images
-- Applied to the acore_auth database

CREATE TABLE IF NOT EXISTS `build_sources` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `source_id` VARCHAR(64) NOT NULL UNIQUE COMMENT 'Human-readable slug (e.g. azerothcore-wotlk)',
  `name` VARCHAR(128) NOT NULL COMMENT 'Display name',
  `url` VARCHAR(512) NOT NULL COMMENT 'Git repository URL',
  `default_branch` VARCHAR(128) NOT NULL DEFAULT 'master' COMMENT 'Default git branch',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_source_id` (`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RealmManager: build source repositories';
