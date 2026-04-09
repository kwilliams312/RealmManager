-- RealmManager: Build versioning — track realm Docker image builds
-- Applied to the acore_auth database

CREATE TABLE IF NOT EXISTS `realm_builds` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `realmid` INT UNSIGNED NOT NULL COMMENT 'FK to realmlist.id',
  `image_tag` VARCHAR(64) NOT NULL COMMENT 'Docker image tag (YYYYMMDD-HHmmss)',
  `source_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'Repository source identifier',
  `source_branch` VARCHAR(128) NOT NULL DEFAULT 'master' COMMENT 'Git branch name',
  `status` VARCHAR(16) NOT NULL DEFAULT 'building' COMMENT 'building, success, failed',
  `is_active` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Currently selected build for this realm',
  `build_log` MEDIUMTEXT COMMENT 'Persisted build log output',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_realm_status` (`realmid`, `status`),
  INDEX `idx_realm_active` (`realmid`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RealmManager: realm build version tracking';
