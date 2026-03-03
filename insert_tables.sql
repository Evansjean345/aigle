CREATE TABLE `ledgers`
(
  `id`             INT UNSIGNED                       NOT NULL AUTO_INCREMENT,
  `transaction_id` INT UNSIGNED                       NULL,
  `wallet_id`      INT UNSIGNED                       NULL,
  `operation_type` VARCHAR(25)                        NULL,
  `direction`      ENUM ('DEBIT','CREDIT','EXTERNAL') NOT NULL,
  `description`    VARCHAR(255)                       NULL,
  `amount_brut`    DECIMAL(19, 2)                     NOT NULL,
  `fees`           DECIMAL(19, 2)                     NOT NULL DEFAULT 0,
  `total_amount`   DECIMAL(19, 2)                     NOT NULL,
  `balance_before` DECIMAL(19, 2)                     NOT NULL,
  `balance_after`  DECIMAL(19, 2)                     NOT NULL,
  `created_at`     TIMESTAMP                          NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `ledgers_transaction_id_foreign`
    FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`)
      ON DELETE CASCADE,
  CONSTRAINT `ledgers_wallet_id_foreign`
    FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`)
      ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;


CREATE TABLE `company_contacts`
(
  `id`         INT UNSIGNED                        NOT NULL AUTO_INCREMENT,
  `type`       ENUM ('phone', 'whatsapp', 'email') NOT NULL,
  `value`      VARCHAR(255)                        NOT NULL,
  `is_active`  TINYINT(1)                          NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP                           NULL,
  `updated_at` TIMESTAMP                           NULL,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;


CREATE TABLE kyc_attemps
(
  id                 int unsigned auto_increment
    primary key,
  user_id            char(36)                                    not null,
  document_type      enum ('CNI', 'PASSPORT', 'PERMIS', 'SELFI') null,
  attempt_number     int default 0                               null,
  status             enum ('pending', 'approved', 'rejected')    null,
  comment            text                                        null,
  next_action        varchar(255)                                null,
  created_at         timestamp                                   null,
  updated_at         timestamp                                   null,
  document_recto_url text                                        null,
  document_verso_url text                                        null,
  selfie_url         text                                        null,
  kyc_document_id    int unsigned                                null,
  constraint kyc_attemps_kyc_document_id
    foreign key (kyc_document_id) references kyc_documents (id)
      on delete cascade
)
  collate = utf8mb4_uca1400_ai_ci;

create table kyc_documents
(
  id                 int unsigned auto_increment
    primary key,
  user_id            char(36)                                                  null,
  document_type      enum ('CNI', 'PASSPORT', 'PERMIT_CONDUIT')                null,
  document_recto_url text                                                      null,
  document_verso_url text                                                      null,
  selfie_url         longtext                                                  null,
  status             enum ('pending', 'approved', 'rejected', 'in_submission') null,
  comment            text                                                      null,
  next_action        varchar(255)                                              null,
  created_at         timestamp                                                 null,
  updated_at         timestamp                                                 null
)
  collate = utf8mb4_uca1400_ai_ci;

create table kyc_level
(
  id            int unsigned auto_increment
    primary key,
  level         int        default 1 null,
  single_limit  int        default 0 null,
  daily_limit   int        default 0 null,
  monthly_limit int        default 0 null,
  balance_limit int        default 0 null,
  is_active     tinyint(1) default 1 null,
  created_at    timestamp            null,
  updated_at    timestamp            null
)
  collate = utf8mb4_uca1400_ai_ci;

create table devices
(
  user_id          varchar(255)                                                                                 not null,
  app_version      varchar(255)                                                                                 null,
  platform         varchar(255)                                                                                 null,
  created_at       timestamp                                                                                    null,
  id               char(36)                                          default 'UoA3ccOhJqg0OTEt_c26n-yWkBnLLgqH' not null
    primary key,
  fingerprint_hash varchar(255)                                                                                 not null,
  device_uid       char(36)                                                                                     not null,
  brand            varchar(255)                                                                                 null,
  model            varchar(255)                                                                                 null,
  os_version       varchar(255)                                                                                 null,
  is_emulator      tinyint(1)                                        default 0                                  null,
  is_rooted        tinyint(1)                                        default 0                                  null,
  ip_first_seen    varchar(255)                                                                                 null,
  ip_last_seen     varchar(255)                                                                                 null,
  status           enum ('pending', 'trusted', 'blocked', 'revoked') default 'pending'                          null,
  last_seen_at     timestamp                                                                                    null,
  push_token       varchar(255)                                                                                 null
)
  collate = utf8mb4_uca1400_ai_ci;

create table app_versions
(
  id              int unsigned auto_increment
    primary key,
  device_type     enum ('ios', 'android') not null,
  version_number  varchar(255)            not null,
  min_version     varchar(255)            not null,
  critical_update tinyint(1) default 0    null,
  release_date    date                    not null,
  download_url    varchar(255)            null,
  changelog       text                    null,
  created_at      timestamp               null,
  updated_at      timestamp               null
);

/**
  ADDED ON 3 Feb 2026
  Roles
  Permissions
  Role Permission
  Admins
  Admin Auth Access Tokens
 */
CREATE TABLE `roles`
(
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug`        VARCHAR(50)  NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `description` TEXT         NULL,
  `created_at`  TIMESTAMP    NULL,
  `updated_at`  TIMESTAMP    NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_slug_unique` (`slug`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

CREATE TABLE `permissions`
(
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug`        VARCHAR(50)  NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `description` TEXT         NULL,
  `created_at`  TIMESTAMP    NULL,
  `updated_at`  TIMESTAMP    NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_slug_unique` (`slug`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

CREATE TABLE `role_permission`
(
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_id`       INT UNSIGNED NULL,
  `permission_id` INT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_permission_role_id_permission_id_unique` (`role_id`, `permission_id`),
  CONSTRAINT `role_permission_role_id_foreign`
    FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_permission_permission_id_foreign`
    FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

CREATE TABLE `admins`
(
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `firstname`  VARCHAR(255) NOT NULL,
  `lastname`   VARCHAR(255) NOT NULL,
  `email`      VARCHAR(255) NOT NULL,
  `password`   VARCHAR(255) NOT NULL,
  `role_id` INT UNSIGNED NULL,
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1,
  'last_login_at' TIMESTAMP NULL DEFAULT NULL,
  'last_login_ip' VARCHAR(255) NULL DEFAULT NULL,
  `created_at` TIMESTAMP    NULL,
  `updated_at` TIMESTAMP    NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `admins_email_unique` (`email`),
  CONSTRAINT `admins_role_id_foreign`
    FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
);

CREATE TABLE `admin_auth_access_tokens`
(
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenable_id` INT UNSIGNED NOT NULL,
  `type`         VARCHAR(255) NOT NULL,
  `name`         VARCHAR(255) NULL,
  `hash`         VARCHAR(255) NOT NULL,
  `abilities`    TEXT         NOT NULL,
  `created_at`   TIMESTAMP    NULL,
  `updated_at`   TIMESTAMP    NULL,
  `last_used_at` TIMESTAMP    NULL,
  `expires_at`   TIMESTAMP    NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `admin_auth_access_tokens_tokenable_id_foreign`
    FOREIGN KEY (`tokenable_id`) REFERENCES `admins` (`id`)
      ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;


ALTER TABLE `admins`
  ADD COLUMN `last_login_at` TIMESTAMP NULL DEFAULT NULL AFTER `updated_at`,
  ADD COLUMN `last_login_ip` VARCHAR(255) NULL DEFAULT NULL AFTER `last_login_at`;



CREATE TABLE debit_phones (
                            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                            user_id CHAR(36) NOT NULL,
                            provider_id INT(10) UNSIGNED NOT NULL,
                            phone VARCHAR(20) NOT NULL,
                            label VARCHAR(255) NULL,
                            is_verified BOOLEAN DEFAULT FALSE,
                            is_active BOOLEAN DEFAULT TRUE,
                            verified_at TIMESTAMP NULL,
                            created_at TIMESTAMP NOT NULL,
                            updated_at TIMESTAMP NOT NULL,
                            UNIQUE (user_id, provider_id),
                            FOREIGN KEY (user_id) REFERENCES users(users_uid) ON DELETE CASCADE,
                            FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/**
  ADDED ON 09 Feb 2026
 */
alter table admins
  modify is_active tinyint(1) default 0 null;

alter table admins
  modify password varchar(255) null;

alter table admins
  add invitation_token text null;

alter table admins
  add invitation_expires_at DATETIME null comment 'invitation_expires_at';

alter table otps
  add email varchar(225) null;

alter table otps
  add target enum ('mobile', 'email') null;

alter table otps
  modify phone varchar(255) null;

alter table otps
  drop foreign key otps_users_users_uid_fk;

drop index otps_user_id_foreign on otps;

create index otps_email_index
  on otps (email);

create index otps_target_index
  on otps (target);
