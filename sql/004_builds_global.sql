-- RealmManager: Global builds — shared Docker images built from sources
-- Applied to the acore_auth database

CREATE TABLE IF NOT EXISTS `builds` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `source_id` VARCHAR(64) NOT NULL COMMENT 'FK to build_sources.source_id',
  `image_tag` VARCHAR(128) NOT NULL COMMENT 'Docker image tag (e.g. azerothcore-wotlk-20260408-120000)',
  `source_branch` VARCHAR(128) NOT NULL DEFAULT 'master',
  `status` VARCHAR(16) NOT NULL DEFAULT 'building' COMMENT 'building, success, failed',
  `build_log` MEDIUMTEXT COMMENT 'Persisted build log output',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_source` (`source_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RealmManager: global build history';
