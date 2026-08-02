CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,
  plan VARCHAR(32) NOT NULL DEFAULT 'free',
  subscription_status VARCHAR(32) NOT NULL DEFAULT 'inactive',
  subscription_id VARCHAR(128),
  subscription_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS login_codes (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  code VARCHAR(12) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_login_codes_user_code (user_id, code),
  CONSTRAINT fk_login_codes_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  original_name VARCHAR(512) NOT NULL,
  stored_name VARCHAR(512) NOT NULL,
  mime_type VARCHAR(255),
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  content LONGBLOB,
  kind VARCHAR(32) NOT NULL,
  tool_source VARCHAR(64),
  created_at DATETIME NOT NULL,
  INDEX idx_documents_user_created (user_id, created_at),
  CONSTRAINT fk_documents_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS operations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tool VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  input_document_ids JSON NOT NULL,
  output_document_id VARCHAR(36),
  options JSON,
  error TEXT,
  created_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  INDEX idx_operations_user_created (user_id, created_at),
  CONSTRAINT fk_operations_user FOREIGN KEY (user_id) REFERENCES users(id)
);
