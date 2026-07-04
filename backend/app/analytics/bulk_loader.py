import os
import sys
import uuid
import json
import io
from pathlib import Path
from datetime import datetime
from typing import Tuple

# Fix Unicode on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app.engines.statement_parser import StatementParser
from app.engines.normalization_engine import NormalizationEngine
from app.engines.entity_extractor import EntityExtractor
# ponytail: lazy import sqlite_store only when ingest_file() is called

SUPPORTED_EXTS = {".pdf", ".csv", ".xlsx", ".xls", ".txt"}


def _resolve_side(side_value: str, counterparty: str | None, statement_id: str, tx_id: str) -> Tuple[str, int]:
    """Resolve a sender/receiver side, handling 'external' placeholders.

    Returns (resolved_account_id, is_inferred_flag).
    If side is known (not 'external'), return as-is.
    If 'external' with counterparty, use counterparty (inferred=1).
    If 'external' without counterparty, generate unique unknown placeholder (inferred=1).
    """
    if side_value != "external":
        return side_value, 0
    if counterparty:
        return counterparty, 1
    return f"UNKNOWN_EXTERNAL::{statement_id}::{tx_id}", 1


def ingest_file(file_path: str) -> dict:
    """Parse, normalize, extract, and ingest a single statement file into analytics.db.

    This is the canonical single ingestion path used by both bulk_loader and the upload hook.
    """
    from app.analytics import sqlite_store as store

    try:
        account_id, raw_txs, parser_stats = StatementParser().parse_statement(file_path)
        normalized = NormalizationEngine.normalize(raw_txs, account_id)
        entities = EntityExtractor.extract_all(normalized)

        statement_id = f"STMT-{uuid.uuid4().hex[:8].upper()}"
        filename = os.path.basename(file_path)
        bank = parser_stats.get("source_format", "Unknown")

        # Insert statement and account metadata
        store.insert_statement(statement_id, filename, account_holder=account_id, bank=bank)
        store.insert_account(account_id, account_number=account_id, holder_name=None, bank_name=bank)

        # Insert transactions, resolving "external" placeholders
        for tx in normalized:
            sender, sender_inferred = _resolve_side(
                tx["sender_account"], tx.get("counterparty_account"), statement_id, tx["tx_id"]
            )
            receiver, receiver_inferred = _resolve_side(
                tx["receiver_account"], tx.get("counterparty_account"), statement_id, tx["tx_id"]
            )

            tx_timestamp = tx["timestamp"]
            if hasattr(tx_timestamp, 'isoformat'):
                tx_timestamp_str = tx_timestamp.isoformat()
            else:
                tx_timestamp_str = str(tx_timestamp)

            store.insert_transaction(
                transaction_id=f"{statement_id}::{tx['tx_id']}",
                statement_id=statement_id,
                sender_account=sender,
                receiver_account=receiver,
                sender_is_inferred=sender_inferred,
                receiver_is_inferred=receiver_inferred,
                amount=float(tx["amount"]),
                timestamp=tx_timestamp_str,
                description=tx.get("description"),
                channel=tx.get("channel")
            )

        # Insert entities, extracting linked_accounts and source_tx_ids from the extraction result
        for etype, items in entities.items():
            for item in items:
                linked_accts = item.get("linked_accounts", [])
                source_ids = item.get("source_tx_ids", [])
                # Prefix tx_ids with statement_id to make them global
                global_source_ids = [f"{statement_id}::{tx_id}" for tx_id in source_ids]
                store.insert_entity(
                    value=item["value"],
                    type_=etype.rstrip('s') if etype.endswith('s') else etype,  # Singularize type
                    statement_id=statement_id,
                    linked_accounts=linked_accts,
                    source_tx_ids=global_source_ids
                )

        return {
            "statement_id": statement_id,
            "account_id": account_id,
            "filename": filename,
            "tx_count": len(normalized),
            "entity_count": sum(len(items) for items in entities.values()),
            "status": "success"
        }
    except Exception as e:
        return {
            "file": file_path,
            "status": "error",
            "error": str(e)
        }


def scan_and_ingest_directory(directory: str) -> dict:
    """Bulk import: scan a directory recursively and ingest all supported statement files.

    Skips unsupported file types (does not error the whole run).
    Returns summary of results per file with transaction counts.
    """
    results = []
    file_count = 0
    success_count = 0
    error_count = 0
    total_transactions = 0
    total_entities = 0
    batch_size = 10

    # Collect all files first to show progress
    files = sorted([p for p in Path(directory).rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS])
    total_files = len(files)

    print(f"\nFound {total_files} statement files to ingest...")
    print("=" * 80)

    for idx, path in enumerate(files, 1):
        file_count += 1
        result = ingest_file(str(path))
        results.append(result)

        if result.get("status") == "success":
            success_count += 1
            tx_count = result.get('tx_count', 0)
            entity_count = result.get('entity_count', 0)
            total_transactions += tx_count
            total_entities += entity_count
            stmt_id = result.get('statement_id', '?')
            account_id = result.get('account_id', '?')
            print(f"[{idx:3d}/{total_files}] {path.name:40s} | {tx_count:4d} txs | {entity_count:3d} entities | {stmt_id} ({account_id})")
        else:
            error_count += 1
            print(f"[{idx:3d}/{total_files}] {path.name:40s} | ERROR: {result.get('error', 'unknown')}")

        # Print progress summary every batch_size files
        if idx % batch_size == 0:
            print(f"        {'':40s}   [Progress: {success_count} OK, {error_count} failed | Total: {total_transactions} transactions]")

    print("=" * 80)
    print(f"\nFinal Summary:")
    print(f"  Files scanned:     {file_count}")
    print(f"  Files successful:  {success_count}")
    print(f"  Files failed:      {error_count}")
    print(f"  Total transactions: {total_transactions}")
    print(f"  Total entities:    {total_entities}")

    return {
        "files_scanned": file_count,
        "files_successful": success_count,
        "files_failed": error_count,
        "total_transactions": total_transactions,
        "total_entities": total_entities,
        "results": results
    }


if __name__ == "__main__":
    store.init_db()
    if len(sys.argv) < 2:
        print("Usage: python -m app.analytics.bulk_loader <directory_path>")
        print("Example: python -m app.analytics.bulk_loader Bank-statements-dataset/")
        sys.exit(1)

    directory = sys.argv[1]
    if not os.path.isdir(directory):
        print(f"Error: {directory} is not a valid directory")
        sys.exit(1)

    print(f"Scanning and ingesting files from: {directory}")
    summary = scan_and_ingest_directory(directory)
    print(f"\nSummary: {summary['files_successful']}/{summary['files_scanned']} files successfully ingested")
    if summary['files_failed'] > 0:
        print(f"         {summary['files_failed']} files failed")
    print(f"Database: {store.DB_PATH}")
