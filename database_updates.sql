ALTER TABLE `kyc_documents`
  CHANGE COLUMN `document_type` `document_type` ENUM('CNI','PASSPORT','PERMIT_CONDUIT','SELFIE') NULL DEFAULT NULL COLLATE 'utf8mb4_uca1400_ai_ci' AFTER `user_id`;

ALTER TABLE `kyc_documents`
  CHANGE COLUMN `status` `status` ENUM('pending','approved','rejected','in_submission') NULL DEFAULT NULL COLLATE 'utf8mb4_uca1400_ai_ci' AFTER `selfie_url`;

ALTER TABLE `kyc_documents`
  CHANGE COLUMN `document_type` `document_type` ENUM('CNI','PASSPORT','PERMIT_CONDUIT') NULL DEFAULT NULL COLLATE 'utf8mb4_uca1400_ai_ci' AFTER `user_id`;

ALTER TABLE users
  ADD COLUMN kyc_level INT DEFAULT 1,
  ADD COLUMN kyc_status ENUM('NOT_STARTED','PENDING_IN_REVIEW','LEVEL_1_VERIFIED','REJECTED') DEFAULT 'NOT_STARTED';


INSERT INTO kyc_level
(id, level, single_limit, daily_limit, monthly_limit, balance_limit, is_active, created_at, updated_at)
VALUES
  (1, 1, 100000, 200000, 500000, 200000, TRUE, CURRENT_DATE, CURRENT_DATE),
  (2, 2, 500000, 2000000, 2000000, 3000000, TRUE, CURRENT_DATE, CURRENT_DATE);

ALTER TABLE payments
  DROP COLUMN fees;

ALTER TABLE payments
  DROP COLUMN amount;

ALTER TABLE payments
  DROP COLUMN total_amount;

ALTER TABLE payments
  DROP COLUMN currency_code_from;

ALTER TABLE payments
  DROP COLUMN currency_code_to;

ALTER TABLE payments
  DROP COLUMN exchange_rate;

ALTER TABLE payments
  DROP COLUMN callback_status;

ALTER TABLE payments
  DROP FOREIGN KEY payments_receiver_id_foreign;

ALTER TABLE payments
  DROP COLUMN receiver_id;

ALTER TABLE payments
  DROP FOREIGN KEY payments_users_id_foreign;

ALTER TABLE payments
  DROP COLUMN users_id;

ALTER TABLE payments
  DROP FOREIGN KEY payments_users_uid_foreign;

ALTER TABLE payments
  DROP COLUMN users_uid;

ALTER TABLE transactions
  DROP COLUMN balance_before;

ALTER TABLE transactions
  DROP COLUMN balance_after;

DROP TABLE documents;

DROP TABLE exchange_rates;

DROP TABLE currencies;

DROP TABLE operator_fees;

DROP TABLE operators;

DROP TABLE receivers;

DROP TABLE service_fees;

ALTER TABLE transactions
  DROP FOREIGN KEY transactions_services_id_foreign;

DROP INDEX transactions_services_id_foreign ON transactions;

DROP TABLE services;

DROP TABLE type_payments;

ALTER TABLE transactions
  DROP COLUMN services_id;

ALTER TABLE transactions
  ADD idempotency VARCHAR(64) NULL;

CREATE INDEX transactions_idempotency_index
  ON transactions (idempotency);

ALTER TABLE users
  MODIFY kyc_status ENUM('NOT_STARTED', 'PENDING_IN_REVIEW', 'VERIFIED', 'REJECTED') NULL
    DEFAULT 'NOT_STARTED';

ALTER TABLE kyc_documents
  MODIFY document_type ENUM('CNI', 'PASSPORT', 'PERMIS_CONDUIT') NULL;

ALTER TABLE kyc_attemps
  MODIFY document_type ENUM('CNI', 'PASSPORT', 'PERMIS_CONDUIT', 'SELFI') NULL;

ALTER TABLE `devices`
  ADD COLUMN `is_primary` BOOLEAN NOT NULL DEFAULT FALSE
    AFTER `status`;

alter table devices
  add constraint devices_fingerprint_hash_pk
  unique (fingerprint_hash);

alter table devices
  add constraint devices_device_uid_pk
  unique (device_uid);

