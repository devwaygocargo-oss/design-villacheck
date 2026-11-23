-- Fresh Production schema only. No catalog, accounts, business settings or data.
-- Separate truthful history; never mark legacy migrations applied.

-- Source: 0001_legacy_baseline
CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('merchant','admin','user'))
    );

-- Source: 0001_legacy_baseline
CREATE TABLE IF NOT EXISTS subscriptions (
      owner_id TEXT PRIMARY KEY REFERENCES users(id), package_id TEXT NOT NULL,
      expires TEXT, payments INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL
    );

-- Source: 0001_legacy_baseline
CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      csrf TEXT NOT NULL, expires BIGINT NOT NULL
    );

-- Source: 0001_legacy_baseline
CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL, mime TEXT NOT NULL, bytes BYTEA NOT NULL
    );

-- Source: 0001_legacy_baseline
CREATE TABLE IF NOT EXISTS villas (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
      province TEXT NOT NULL, merchant TEXT NOT NULL, email TEXT NOT NULL, package_id TEXT NOT NULL,
      document_id TEXT NOT NULL REFERENCES documents(id),
      status TEXT NOT NULL CHECK(status IN ('pending','approved','changes','rejected')) DEFAULT 'pending',
      reason TEXT NOT NULL DEFAULT '', qr TEXT UNIQUE, expires TEXT, payments INTEGER NOT NULL DEFAULT 0,
      created TEXT NOT NULL
    );

-- Source: 0001_legacy_baseline
CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY, villa_id TEXT NOT NULL REFERENCES villas(id), amount INTEGER NOT NULL,
      months INTEGER NOT NULL CHECK(months IN (1,3)),
      status TEXT NOT NULL CHECK(status IN ('pending','submitted','paid')) DEFAULT 'pending',
      proof_id TEXT REFERENCES documents(id), reference TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '',
      created TEXT NOT NULL, paid_at TEXT, confirmed_by TEXT REFERENCES users(id)
    );

-- Source: 0001_legacy_baseline
CREATE UNIQUE INDEX IF NOT EXISTS one_open_invoice ON invoices(villa_id) WHERE status != 'paid';

-- Source: 0001_legacy_baseline
CREATE TABLE IF NOT EXISTS mails (
      id TEXT PRIMARY KEY, villa_id TEXT NOT NULL REFERENCES villas(id), invoice_id TEXT NOT NULL UNIQUE REFERENCES invoices(id),
      recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt BIGINT NOT NULL DEFAULT 0, last_error TEXT NOT NULL DEFAULT '', sent_at TEXT
    );

-- Source: 0001_legacy_baseline
CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL,
      target_id TEXT NOT NULL, created TEXT NOT NULL
    );

-- Source: 0001_legacy_baseline
ALTER TABLE users ADD COLUMN IF NOT EXISTS created TEXT NOT NULL DEFAULT '';

-- Source: 0001_legacy_baseline
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TEXT;

-- Source: 0001_legacy_baseline
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subscription_owner TEXT REFERENCES users(id);

-- Source: 0001_legacy_baseline
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS package_id TEXT;

-- Source: 0001_legacy_baseline
CREATE UNIQUE INDEX IF NOT EXISTS one_open_subscription_invoice ON invoices(subscription_owner) WHERE status != 'paid' AND subscription_owner IS NOT NULL;

-- Source: 0001_legacy_baseline
ALTER TABLE villas ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';

-- Source: 0001_legacy_baseline
ALTER TABLE villas ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT '';

-- Source: 0001_legacy_baseline
ALTER TABLE villas ADD COLUMN IF NOT EXISTS account_name TEXT NOT NULL DEFAULT '';

-- Source: 0001_legacy_baseline
ALTER TABLE villas ADD COLUMN IF NOT EXISTS account_number TEXT NOT NULL DEFAULT '';

-- Source: 0001_legacy_baseline
CREATE TABLE IF NOT EXISTS oauth_identities (
  provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY(provider, subject), UNIQUE(provider, user_id)
);

-- Source: 0001_legacy_baseline
CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY, provider TEXT NOT NULL, verifier TEXT NOT NULL,
  return_to TEXT NOT NULL, expires BIGINT NOT NULL
);

-- Source: 0001_legacy_baseline
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL
);

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('merchant','admin','user'))
    );

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS subscriptions (
      owner_id TEXT PRIMARY KEY REFERENCES users(id), package_id TEXT NOT NULL,
      expires TEXT, payments INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL
    );

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      csrf TEXT NOT NULL, expires BIGINT NOT NULL
    );

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL, mime TEXT NOT NULL, bytes BYTEA NOT NULL
    );

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS villas (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
      province TEXT NOT NULL, merchant TEXT NOT NULL, email TEXT NOT NULL, package_id TEXT NOT NULL,
      document_id TEXT NOT NULL REFERENCES documents(id),
      status TEXT NOT NULL CHECK(status IN ('pending','approved','changes','rejected')) DEFAULT 'pending',
      reason TEXT NOT NULL DEFAULT '', qr TEXT UNIQUE, expires TEXT, payments INTEGER NOT NULL DEFAULT 0,
      created TEXT NOT NULL
    );

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY, villa_id TEXT NOT NULL REFERENCES villas(id), amount INTEGER NOT NULL,
      months INTEGER NOT NULL CHECK(months IN (1,3)),
      status TEXT NOT NULL CHECK(status IN ('pending','submitted','paid')) DEFAULT 'pending',
      proof_id TEXT REFERENCES documents(id), reference TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '',
      created TEXT NOT NULL, paid_at TEXT, confirmed_by TEXT REFERENCES users(id)
    );

-- Source: 0002_business_requirements
CREATE UNIQUE INDEX IF NOT EXISTS one_open_invoice ON invoices(villa_id) WHERE status != 'paid';

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS mails (
      id TEXT PRIMARY KEY, villa_id TEXT NOT NULL REFERENCES villas(id), invoice_id TEXT NOT NULL UNIQUE REFERENCES invoices(id),
      recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt BIGINT NOT NULL DEFAULT 0, last_error TEXT NOT NULL DEFAULT '', sent_at TEXT
    );

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL,
      target_id TEXT NOT NULL, created TEXT NOT NULL
    );

-- Source: 0002_business_requirements
ALTER TABLE users ADD COLUMN IF NOT EXISTS created TEXT NOT NULL DEFAULT '';

-- Source: 0002_business_requirements
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TEXT;

-- Source: 0002_business_requirements
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subscription_owner TEXT REFERENCES users(id);

-- Source: 0002_business_requirements
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS package_id TEXT;

-- Source: 0002_business_requirements
CREATE UNIQUE INDEX IF NOT EXISTS one_open_subscription_invoice ON invoices(subscription_owner) WHERE status != 'paid' AND subscription_owner IS NOT NULL;

-- Source: 0002_business_requirements
ALTER TABLE villas ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';

-- Source: 0002_business_requirements
ALTER TABLE villas ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT '';

-- Source: 0002_business_requirements
ALTER TABLE villas ADD COLUMN IF NOT EXISTS account_name TEXT NOT NULL DEFAULT '';

-- Source: 0002_business_requirements
ALTER TABLE villas ADD COLUMN IF NOT EXISTS account_number TEXT NOT NULL DEFAULT '';

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS oauth_identities (
  provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY(provider, subject), UNIQUE(provider, user_id)
);

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY, provider TEXT NOT NULL, verifier TEXT NOT NULL,
  return_to TEXT NOT NULL, expires BIGINT NOT NULL
);

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL
);

-- Source: 0002_business_requirements
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'WAITING_FOR_SLIP';

-- Source: 0002_business_requirements
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS verification_mode TEXT NOT NULL DEFAULT 'MANUAL';

-- Source: 0002_business_requirements
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'THB';

-- Source: 0002_business_requirements
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS external_transaction_id TEXT;

-- Source: 0002_business_requirements
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS external_provider TEXT;

-- Source: 0002_business_requirements
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TEXT;

-- Source: 0002_business_requirements
CREATE UNIQUE INDEX IF NOT EXISTS unique_payment_transaction ON invoices(external_transaction_id) WHERE external_transaction_id IS NOT NULL;

-- Source: 0002_business_requirements
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'PENDING_RENEWAL';

-- Source: 0002_business_requirements
ALTER TABLE villas ADD COLUMN IF NOT EXISTS verification_level TEXT NOT NULL DEFAULT 'VERIFIED';

-- Source: 0002_business_requirements
ALTER TABLE villas ADD COLUMN IF NOT EXISTS reviewed_at TEXT;

-- Source: 0002_business_requirements
ALTER TABLE villas ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

-- Source: 0002_business_requirements
ALTER TABLE villas ADD COLUMN IF NOT EXISTS photo_url TEXT NOT NULL DEFAULT '';

-- Source: 0002_business_requirements
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name TEXT NOT NULL DEFAULT '';

-- Source: 0002_business_requirements
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';

-- Source: 0002_business_requirements
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS package_catalog (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount>=0), currency TEXT NOT NULL DEFAULT 'THB', billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
 trial_months INTEGER NOT NULL DEFAULT 0 CHECK(trial_months>=0), capacity INTEGER NOT NULL CHECK(capacity>=1),
 features TEXT NOT NULL DEFAULT '[]', max_level TEXT NOT NULL DEFAULT 'VERIFIED', banner INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL, updated TEXT NOT NULL
);

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS leads (
 id TEXT PRIMARY KEY,user_id TEXT UNIQUE REFERENCES users(id),type TEXT NOT NULL CHECK(type IN ('USER','MERCHANT')),
 name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',source TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'NEW',
 notes TEXT NOT NULL DEFAULT '',created TEXT NOT NULL,updated TEXT NOT NULL
);

-- Source: 0002_business_requirements
CREATE TABLE IF NOT EXISTS payment_qrs (
 id TEXT PRIMARY KEY,payment_id TEXT NOT NULL REFERENCES invoices(id),payload TEXT NOT NULL,
 generated_at TEXT NOT NULL,expires_at TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('ACTIVE','PAID','EXPIRED','CANCELLED')),
 created TEXT NOT NULL,updated TEXT NOT NULL
);

-- Source: 0002_business_requirements
CREATE UNIQUE INDEX IF NOT EXISTS one_active_payment_qr ON payment_qrs(payment_id) WHERE status='ACTIVE';

-- Source: 0003_operational_records
CREATE TABLE IF NOT EXISTS support_reports (
 id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, user_id TEXT REFERENCES users(id), villa_id TEXT REFERENCES villas(id),
 villa_name TEXT NOT NULL, type TEXT NOT NULL, detail TEXT NOT NULL, reporter TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','UNDER_REVIEW','RESOLVED','REJECTED')),
 admin_note TEXT NOT NULL DEFAULT '', public_note TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, updated TEXT NOT NULL
);

-- Source: 0003_operational_records
CREATE INDEX IF NOT EXISTS reports_user_created ON support_reports(user_id,created);

-- Source: 0003_operational_records
CREATE INDEX IF NOT EXISTS reports_villa_created ON support_reports(villa_id,created);

-- Source: 0003_operational_records
CREATE TABLE IF NOT EXISTS user_checks (
 id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id), villa_id TEXT REFERENCES villas(id),
 villa_name TEXT NOT NULL, qr TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, result TEXT NOT NULL,
 submitted_account TEXT NOT NULL DEFAULT '', submitted_contact TEXT NOT NULL DEFAULT '', request_key TEXT NOT NULL,
 created TEXT NOT NULL, UNIQUE(user_id,request_key)
);

-- Source: 0003_operational_records
CREATE INDEX IF NOT EXISTS checks_user_created ON user_checks(user_id,created);

-- Source: 0003_operational_records
CREATE TABLE IF NOT EXISTS villa_events (
 id TEXT PRIMARY KEY, villa_id TEXT NOT NULL REFERENCES villas(id), kind TEXT NOT NULL CHECK(kind IN ('PROFILE_VIEW','QR_SCAN','CONTACT_VIEW')),
 created TEXT NOT NULL
);

-- Source: 0003_operational_records
CREATE INDEX IF NOT EXISTS events_villa_created ON villa_events(villa_id,created);

-- Source: 0004_login_otp
CREATE TABLE IF NOT EXISTS login_otps (
 id TEXT PRIMARY KEY,
 channel TEXT NOT NULL CHECK(channel IN ('email','sms')),
 destination TEXT NOT NULL,
 code_hash TEXT NOT NULL,
 expires BIGINT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 consumed INTEGER NOT NULL DEFAULT 0,
 created BIGINT NOT NULL
);

-- Source: 0004_login_otp
CREATE INDEX IF NOT EXISTS login_otps_destination_created ON login_otps(destination,created);

-- Source: 0005_villa_guest_capacity
ALTER TABLE villas ADD COLUMN IF NOT EXISTS guest_capacity INTEGER CHECK (guest_capacity BETWEEN 1 AND 1000);

-- Source: 0006_invoice_validity
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_months_check;

-- Source: 0006_invoice_validity
ALTER TABLE invoices ADD CONSTRAINT invoices_months_check CHECK (months BETWEEN 1 AND 36);

-- Source: 0007_mail_payment_snapshot
ALTER TABLE mails ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

-- Source: 0008_merchant_auth
ALTER TABLE login_otps ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'user' CHECK (account_type IN ('user','merchant'));

-- Source: 0008_merchant_auth
ALTER TABLE login_otps ADD COLUMN IF NOT EXISTS binding_user_id TEXT REFERENCES users(id);

-- Source: 0008_merchant_auth
ALTER TABLE login_otps ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'login' CHECK(purpose IN ('login','register','link_identity'));

-- Source: 0009_bilingual_media
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name_en TEXT NOT NULL DEFAULT '';

-- Source: 0009_bilingual_media
ALTER TABLE villas ADD COLUMN IF NOT EXISTS name_en TEXT NOT NULL DEFAULT '';

-- Source: 0009_bilingual_media
ALTER TABLE villas ADD COLUMN IF NOT EXISTS photo_uploaded_at TEXT;

-- Source: 0009_bilingual_media
ALTER TABLE villas ADD COLUMN IF NOT EXISTS photo_taken_at TEXT;

-- Source: 0009_bilingual_media
ALTER TABLE villas ADD COLUMN IF NOT EXISTS photo_reviewed_at TEXT;

-- Source: 0011_read_performance
CREATE INDEX IF NOT EXISTS villas_owner_created ON villas(owner_id,created);

-- Source: 0011_read_performance
CREATE INDEX IF NOT EXISTS villas_status_created ON villas(status,created);

-- Source: 0011_read_performance
CREATE INDEX IF NOT EXISTS invoices_villa_created ON invoices(villa_id,created);

-- Source: 0011_read_performance
CREATE INDEX IF NOT EXISTS mails_villa_created ON mails(villa_id,created);

-- Source: 0011_read_performance
CREATE INDEX IF NOT EXISTS payment_qrs_payment_status_created ON payment_qrs(payment_id,status,created);

-- Source: 0012_oauth_state_binding
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS binding_user_id TEXT;
