from datetime import datetime
from typing import List, Dict, Any

class NormalizationEngine:
    @staticmethod
    def normalize(raw_txs: List[Dict[str, Any]], account_id: str) -> List[Dict[str, Any]]:
        """
        Normalize transactions from different sources into a uniform format.
        """
        normalized_txs = []
        for tx in raw_txs:
            desc = str(tx.get("description", "")).strip()
            raw_desc = str(tx.get("raw_description", desc))
            
            # Channel Detection from narration keywords
            desc_lower = desc.lower()
            channel = "OTHER"

            # Detect FD sweep / internal transfer transactions.
            # These are bank-internal movements (e.g. FD creation/maturity, sweep-in/sweep-out)
            # and must NOT be counted as external debits/credits.
            FD_SWEEP_KEYWORDS = [
                "transfer/debit for fd",
                "transfer/credit for fd",
                "fd a/c",
                "fd account",
                "fixed deposit",
                "sweep in",
                "sweep out",
                "sweep-in",
                "sweep-out",
                "auto sweep",
                "fd renewal",
                "fd maturity",
                "fd proceeds",
                "fd closure",
                "int.on fd",
                "interest on fd",
            ]
            is_internal_transfer = any(kw in desc_lower for kw in FD_SWEEP_KEYWORDS)

            if is_internal_transfer:
                channel = "INTERNAL"
            elif "upi" in desc_lower or "@" in desc_lower:
                channel = "UPI"
            elif "imps" in desc_lower or "mmt/imps" in desc_lower or desc_lower.startswith("mps/"):
                channel = "IMPS"
            elif "neft" in desc_lower:
                channel = "NEFT"
            elif "rtgs" in desc_lower:
                channel = "RTGS"
            elif any(k in desc_lower for k in ["atm", "cwdr", "wdr/atm", "atm wdr", "cash wdl"]):
                channel = "ATM"
            elif any(k in desc_lower for k in ["cash dep", "cash deposit", "by cash", "cam/"]):
                channel = "CASH"
            elif any(k in desc_lower for k in ["cheque", "chq", "clg/"]):
                channel = "CHEQUE"

            # Parse amounts and balances safely
            amount = float(tx.get("amount", 0.0))
            is_debit = bool(tx.get("is_debit", True))
            balance_after = tx.get("balance_after", None)
            if balance_after is not None:
                balance_after = float(balance_after)

            date_val = tx.get("date")
            if isinstance(date_val, str):
                try:
                    date_val = datetime.fromisoformat(date_val.replace("Z", ""))
                except ValueError:
                    date_val = datetime.now()
            elif not isinstance(date_val, datetime):
                date_val = datetime.now()

            normalized_tx = {
                "tx_id": str(tx.get("tx_id", f"{account_id}_{date_val.timestamp()}_{amount}")),
                "date": date_val,
                "timestamp": date_val.isoformat() + "Z",
                "description": desc,
                "raw_description": raw_desc,
                "amount": amount,
                "is_debit": is_debit,
                "is_internal_transfer": is_internal_transfer,
                "sender_account": account_id if is_debit else "external",
                "receiver_account": "external" if is_debit else account_id,
                "channel": channel,
                "balance_after": balance_after
            }
            normalized_txs.append(normalized_tx)

        # Sort chronologically
        normalized_txs.sort(key=lambda x: x["date"])
        return normalized_txs
