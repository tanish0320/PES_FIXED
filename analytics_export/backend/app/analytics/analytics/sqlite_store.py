import sqlite3
import os
import json
from contextlib import contextmanager
from datetime import datetime
from typing import List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "analytics.db")
DB_PATH = os.path.abspath(DB_PATH)

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS statements (
    statement_id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    account_holder TEXT,
    bank TEXT,
    upload_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
    account_id TEXT PRIMARY KEY,
    account_number TEXT,
    holder_name TEXT,
    bank_name TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id TEXT PRIMARY KEY,
    statement_id TEXT NOT NULL REFERENCES statements(statement_id),
    sender_account TEXT NOT NULL,
    receiver_account TEXT NOT NULL,
    sender_is_inferred INTEGER NOT NULL DEFAULT 0,
    receiver_is_inferred INTEGER NOT NULL DEFAULT 0,
    amount REAL NOT NULL,
    timestamp TEXT NOT NULL,
    description TEXT,
    channel TEXT
);

CREATE INDEX IF NOT EXISTS idx_tx_sender ON transactions(sender_account);
CREATE INDEX IF NOT EXISTS idx_tx_receiver ON transactions(receiver_account);
CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transactions(timestamp);

CREATE TABLE IF NOT EXISTS entities (
    entity_id INTEGER PRIMARY KEY AUTOINCREMENT,
    value TEXT NOT NULL,
    type TEXT NOT NULL,
    statement_id TEXT REFERENCES statements(statement_id),
    linked_accounts TEXT,
    source_tx_ids TEXT
);

CREATE INDEX IF NOT EXISTS idx_entity_value ON entities(value);
CREATE INDEX IF NOT EXISTS idx_entity_type ON entities(type);

CREATE TABLE IF NOT EXISTS cycles (
    cycle_id TEXT PRIMARY KEY,
    accounts TEXT NOT NULL,
    transaction_ids TEXT NOT NULL,
    amount REAL NOT NULL,
    hop_count INTEGER NOT NULL,
    confidence REAL NOT NULL,
    detected_at TEXT NOT NULL
);
"""


def get_connection():
    """Get a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initialize the database with schema. Idempotent."""
    conn = get_connection()
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()


def insert_statement(statement_id: str, filename: str, account_holder: str = None,
                     bank: str = None, upload_time: str = None) -> None:
    """Insert or ignore a statement."""
    if upload_time is None:
        upload_time = datetime.utcnow().isoformat()
    conn = get_connection()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO statements (statement_id, filename, account_holder, bank, upload_time) VALUES (?, ?, ?, ?, ?)",
            (statement_id, filename, account_holder, bank, upload_time)
        )
        conn.commit()
    finally:
        conn.close()


def insert_account(account_id: str, account_number: str = None, holder_name: str = None,
                   bank_name: str = None) -> None:
    """Insert or ignore an account."""
    conn = get_connection()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO accounts (account_id, account_number, holder_name, bank_name) VALUES (?, ?, ?, ?)",
            (account_id, account_number, holder_name, bank_name)
        )
        conn.commit()
    finally:
        conn.close()


def insert_transaction(transaction_id: str, statement_id: str, sender_account: str,
                       receiver_account: str, sender_is_inferred: int, receiver_is_inferred: int,
                       amount: float, timestamp: str, description: str = None,
                       channel: str = None) -> None:
    """Insert or ignore a transaction."""
    conn = get_connection()
    try:
        conn.execute(
            """INSERT OR IGNORE INTO transactions
               (transaction_id, statement_id, sender_account, receiver_account,
                sender_is_inferred, receiver_is_inferred, amount, timestamp, description, channel)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (transaction_id, statement_id, sender_account, receiver_account,
             sender_is_inferred, receiver_is_inferred, amount, timestamp, description, channel)
        )
        conn.commit()
    finally:
        conn.close()


def insert_entity(value: str, type_: str, statement_id: str = None,
                  linked_accounts: List[str] = None, source_tx_ids: List[str] = None) -> None:
    """Insert an entity."""
    linked_accounts_json = json.dumps(linked_accounts or [])
    source_tx_ids_json = json.dumps(source_tx_ids or [])
    conn = get_connection()
    try:
        conn.execute(
            """INSERT INTO entities (value, type, statement_id, linked_accounts, source_tx_ids)
               VALUES (?, ?, ?, ?, ?)""",
            (value, type_, statement_id, linked_accounts_json, source_tx_ids_json)
        )
        conn.commit()
    finally:
        conn.close()


def upsert_cycle(cycle_id: str, accounts: List[str], transaction_ids: List[str],
                 amount: float, hop_count: int, confidence: float, detected_at: str = None) -> None:
    """Insert or replace a cycle."""
    if detected_at is None:
        detected_at = datetime.utcnow().isoformat()
    accounts_json = json.dumps(accounts)
    transaction_ids_json = json.dumps(transaction_ids)
    conn = get_connection()
    try:
        conn.execute(
            """INSERT OR REPLACE INTO cycles
               (cycle_id, accounts, transaction_ids, amount, hop_count, confidence, detected_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (cycle_id, accounts_json, transaction_ids_json, amount, hop_count, confidence, detected_at)
        )
        conn.commit()
    finally:
        conn.close()


def fetch_all_transactions() -> List[Dict[str, Any]]:
    """Fetch all transactions as a list of dicts."""
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM transactions")
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def fetch_transactions_for_account(account_id: str) -> List[Dict[str, Any]]:
    """Fetch all transactions where account is sender or receiver."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            """SELECT * FROM transactions
               WHERE sender_account = ? OR receiver_account = ?
               ORDER BY timestamp""",
            (account_id, account_id)
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def fetch_all_accounts() -> List[Dict[str, Any]]:
    """Fetch all accounts."""
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM accounts")
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def fetch_account_by_id(account_id: str) -> Dict[str, Any] | None:
    """Fetch a single account by ID."""
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM accounts WHERE account_id = ?", (account_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def fetch_entities_by_value(value: str) -> List[Dict[str, Any]]:
    """Fetch entities by value (LIKE match, case-insensitive)."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            "SELECT * FROM entities WHERE value LIKE ?",
            (f"%{value}%",)
        )
        rows = [dict(row) for row in cursor.fetchall()]
        for row in rows:
            if row.get("linked_accounts"):
                row["linked_accounts"] = json.loads(row["linked_accounts"])
            if row.get("source_tx_ids"):
                row["source_tx_ids"] = json.loads(row["source_tx_ids"])
        return rows
    finally:
        conn.close()


def fetch_all_cycles() -> List[Dict[str, Any]]:
    """Fetch all detected cycles."""
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM cycles")
        rows = [dict(row) for row in cursor.fetchall()]
        for row in rows:
            if row.get("accounts"):
                row["accounts"] = json.loads(row["accounts"])
            if row.get("transaction_ids"):
                row["transaction_ids"] = json.loads(row["transaction_ids"])
        return rows
    finally:
        conn.close()


def get_statement_count() -> int:
    """Get the total number of statements in the database."""
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT COUNT(*) FROM statements")
        return cursor.fetchone()[0]
    finally:
        conn.close()
