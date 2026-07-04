"""
Money trail engine for FIFO allocation tracking.
Traces fund movements through accounts using FIFO methodology.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime


class MoneyTrailEngine:
    """Allocate money trails using FIFO methodology."""

    @staticmethod
    def allocate_trails(transactions: List[Dict[str, Any]], account_id: str) -> Dict[str, Any]:
        """
        Allocate money trails for an account using FIFO.

        Args:
            transactions: List of transaction dicts sorted by timestamp, with keys:
                - tx_id: transaction ID
                - amount: transaction amount
                - is_debit: True if money flowing out
                - timestamp: transaction datetime
                - description: transaction description
                - channel: transaction channel

            account_id: The account to compute trails for

        Returns:
            Dict with:
                - trails: List of money trail objects
                - total_inflow: Total money in
                - total_outflow: Total money out
                - balance_now: Current balance
        """
        if not transactions:
            return {
                "trails": [],
                "total_inflow": 0,
                "total_outflow": 0,
                "balance_now": 0
            }

        # FIFO queue: (source_tx_id, source_account, remaining_amount)
        fifo_queue = []
        total_inflow = 0
        total_outflow = 0
        trails = []

        for tx in transactions:
            amount = float(tx.get("amount", 0))
            is_debit = tx.get("is_debit", False)
            tx_id = tx.get("tx_id", "")
            timestamp = tx.get("timestamp")
            channel = tx.get("channel", "UNKNOWN")

            if is_debit:
                # Money flowing out: allocate from FIFO queue
                total_outflow += amount
                remaining = amount

                while remaining > 0 and fifo_queue:
                    source_tx, source_account, queued_amount = fifo_queue[0]

                    if queued_amount <= remaining:
                        # Use entire queued amount
                        allocated = queued_amount
                        remaining -= allocated
                        fifo_queue.pop(0)
                    else:
                        # Use part of queued amount
                        allocated = remaining
                        fifo_queue[0] = (source_tx, source_account, queued_amount - allocated)
                        remaining = 0

                    trails.append({
                        "source_tx": source_tx,
                        "source_account": source_account,
                        "current_tx": tx_id,
                        "current_account": account_id,
                        "allocated_amount": allocated,
                        "channel": channel,
                        "timestamp": timestamp.isoformat() if timestamp else None
                    })

            else:
                # Money flowing in: add to FIFO queue
                total_inflow += amount
                fifo_queue.append((tx_id, account_id, amount))

        balance_now = total_inflow - total_outflow

        return {
            "trails": trails,
            "total_inflow": total_inflow,
            "total_outflow": total_outflow,
            "balance_now": balance_now
        }
