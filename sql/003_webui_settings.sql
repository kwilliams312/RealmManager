-- RealmManager: Key-value settings store for branding, getting started, etc.
-- Applied to the acore_auth database

CREATE TABLE IF NOT EXISTS `webui_settings` (
  `key` VARCHAR(128) NOT NULL PRIMARY KEY COMMENT 'Setting key (e.g. branding, getting_started)',
  `value` JSON NOT NULL COMMENT 'Setting value as JSON',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RealmManager: key-value settings store';
