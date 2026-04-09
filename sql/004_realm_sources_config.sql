-- RealmManager: Configurable realm source repositories
-- Applied to the acore_auth database

CREATE TABLE IF NOT EXISTS `realm_sources_config` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY COMMENT 'Source identifier (e.g. azerothcore-wotlk)',
  `name` VARCHAR(128) NOT NULL COMMENT 'Display name',
  `url` VARCHAR(512) NOT NULL COMMENT 'Git repository URL',
  `default_branch` VARCHAR(128) NOT NULL DEFAULT 'master' COMMENT 'Default git branch',
  `github_token_enc` TEXT NULL COMMENT 'AES-256-GCM encrypted GitHub token (iv:tag:ciphertext)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RealmManager: realm source repository configuration';
