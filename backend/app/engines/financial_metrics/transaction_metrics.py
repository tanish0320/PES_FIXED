from typing import Dict, Any, List
from datetime import datetime, timedelta
from app.engines.financial_metrics.base_metric import BaseMetric
import app.engines.financial_metrics.config as config

def get_external_transactions(transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Helper to filter out bank-internal transactions (e.g., FD sweeps)."""
    return [tx for tx in transactions if not tx.get("is_internal_transfer", False)]

class RapidMoneyMovementMetric(BaseMetric):
    name = "Rapid Money Movement"
    category = "Transaction Behaviour"
    description = "Detects large incoming credits followed by corresponding outgoing debits within a short time window."
    severity = "High"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs:
            return {
                "name": self.name,
                "category": self.category,
                "value": {"count": 0, "largest_amount": 0.0, "average_transfer_delay": 0.0},
                "severity": "Low",
                "description": "No external transactions found.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        # Sort chronologically
        txs = sorted(txs, key=lambda x: x["date"])
        
        rapid_movements = []
        related_tx_ids = []
        delays = []
        largest_amount = 0.0

        # Look for credits >= STRUCTURING_LIMIT
        for i, credit in enumerate(txs):
            if credit["is_debit"]:
                continue
            
            credit_amount = credit["amount"]
            if credit_amount < config.STRUCTURING_LIMIT:
                continue
                
            credit_time = credit["date"]
            window_end = credit_time + timedelta(hours=config.RAPID_TRANSFER_WINDOW)
            
            # Find subsequent debits within window
            matching_debits = []
            total_debit_amt = 0.0
            
            for j in range(i + 1, len(txs)):
                other = txs[j]
                if other["date"] > window_end:
                    break
                if not other["is_debit"]:
                    continue
                
                matching_debits.append(other)
                total_debit_amt += other["amount"]
                
                # Stop if we've matched at least 80% of the credit amount
                if total_debit_amt >= 0.8 * credit_amount:
                    break
            
            if total_debit_amt >= 0.8 * credit_amount:
                # This is a rapid money movement!
                # Calculate average delay of the outflows
                out_delays = [(d["date"] - credit_time).total_seconds() for d in matching_debits]
                avg_delay = sum(out_delays) / len(out_delays) if out_delays else 0.0
                delays.append(avg_delay)
                
                amount_moved = min(credit_amount, total_debit_amt)
                largest_amount = max(largest_amount, amount_moved)
                
                rapid_movements.append({
                    "credit_id": credit["tx_id"],
                    "debit_ids": [d["tx_id"] for d in matching_debits],
                    "amount": amount_moved,
                    "delay": avg_delay
                })
                
                related_tx_ids.append(credit["tx_id"])
                related_tx_ids.extend([d["tx_id"] for d in matching_debits])

        count = len(rapid_movements)
        avg_delay = sum(delays) / count if count > 0 else 0.0
        
        severity = "High" if count >= 3 else ("Medium" if count > 0 else "Low")
        desc = (f"Detected {count} instances where incoming funds were transferred out within {config.RAPID_TRANSFER_WINDOW} hours."
                if count > 0 else "No rapid incoming-to-outgoing cycles detected.")

        return {
            "name": self.name,
            "category": self.category,
            "value": {
                "count": count,
                "largest_amount": largest_amount,
                "average_transfer_delay": avg_delay
            },
            "severity": severity,
            "description": desc,
            "confidence": 0.9 if count > 0 else 1.0,
            "related_transactions": list(set(related_tx_ids)),
            "metadata": {
                "rapid_movements": rapid_movements
            }
        }

class TransactionVelocityMetric(BaseMetric):
    name = "Transaction Velocity"
    category = "Transaction Behaviour"
    description = "Computes frequency of transactions per hour, day, and week, identifying peak activity times."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs:
            return {
                "name": self.name,
                "category": self.category,
                "value": {},
                "severity": "Low",
                "description": "No external transactions found.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        hour_counts = {}
        day_counts = {}
        week_counts = {}
        
        for tx in txs:
            dt = tx["date"]
            hour = dt.hour
            date_str = dt.strftime("%Y-%m-%d")
            # Get year and ISO week number
            year, week, _ = dt.isocalendar()
            week_str = f"{year}-W{week:02d}"

            hour_counts[hour] = hour_counts.get(hour, 0) + 1
            day_counts[date_str] = day_counts.get(date_str, 0) + 1
            week_counts[week_str] = week_counts.get(week_str, 0) + 1

        total_tx = len(txs)
        num_days = len(day_counts)
        num_weeks = len(week_counts)

        tx_per_hour = total_tx / (num_days * 24) if num_days > 0 else 0.0
        tx_per_day = total_tx / num_days if num_days > 0 else 0.0
        tx_per_week = total_tx / num_weeks if num_weeks > 0 else 0.0

        peak_hour = max(hour_counts, key=hour_counts.get) if hour_counts else None
        peak_day = max(day_counts, key=day_counts.get) if day_counts else None

        # Determine severity based on daily velocity limit
        max_daily_tx = max(day_counts.values()) if day_counts else 0
        severity = "High" if max_daily_tx > config.HIGH_VELOCITY_LIMIT * 2 else ("Medium" if max_daily_tx > config.HIGH_VELOCITY_LIMIT else "Low")
        
        desc = f"Average velocity is {tx_per_day:.1f} transactions/day. Peak daily volume reached {max_daily_tx} transactions on {peak_day}."

        return {
            "name": self.name,
            "category": self.category,
            "value": {
                "tx_per_hour": tx_per_hour,
                "tx_per_day": tx_per_day,
                "tx_per_week": tx_per_week,
                "peak_hour": peak_hour,
                "peak_day": peak_day
            },
            "severity": severity,
            "description": desc,
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {
                "hour_distribution": hour_counts,
                "daily_counts": day_counts
            }
        }

class BurstActivityMetric(BaseMetric):
    name = "Burst Activity"
    category = "Transaction Behaviour"
    description = "Identifies sudden transaction spikes within a rolling 24-hour window."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs:
            return {
                "name": self.name,
                "category": self.category,
                "value": {"largest_burst": 0, "burst_duration": 0.0, "burst_intensity": 0.0},
                "severity": "Low",
                "description": "No transactions analyzed.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        txs = sorted(txs, key=lambda x: x["date"])
        
        largest_burst_count = 0
        burst_tx_ids = []
        burst_start_time = None
        burst_end_time = None

        # Find the window containing the most transactions
        for i in range(len(txs)):
            start_time = txs[i]["date"]
            end_time = start_time + timedelta(hours=24)
            
            # Count transactions in this window
            current_txs = []
            for j in range(i, len(txs)):
                if txs[j]["date"] <= end_time:
                    current_txs.append(txs[j])
                else:
                    break
            
            if len(current_txs) > largest_burst_count:
                largest_burst_count = len(current_txs)
                burst_tx_ids = [tx["tx_id"] for tx in current_txs]
                burst_start_time = start_time
                # Real duration between first and last tx in the burst
                burst_end_time = current_txs[-1]["date"]

        burst_duration = 0.0
        burst_intensity = 0.0
        if largest_burst_count > 0 and burst_start_time and burst_end_time:
            dur_seconds = (burst_end_time - burst_start_time).total_seconds()
            burst_duration = max(0.5, dur_seconds / 3600.0) # at least 30 mins to avoid division by zero
            burst_intensity = largest_burst_count / burst_duration

        severity = "High" if largest_burst_count >= 15 else ("Medium" if largest_burst_count >= 8 else "Low")
        desc = (f"Largest transaction burst: {largest_burst_count} transactions within {burst_duration:.1f} hours "
                f"({burst_intensity:.2f} tx/hr)." if largest_burst_count > 3 else "No significant transaction bursts detected.")

        return {
            "name": self.name,
            "category": self.category,
            "value": {
                "largest_burst": largest_burst_count,
                "burst_duration": burst_duration,
                "burst_intensity": burst_intensity
            },
            "severity": severity,
            "description": desc,
            "confidence": 0.95,
            "related_transactions": burst_tx_ids if largest_burst_count > 3 else [],
            "metadata": {
                "burst_start": burst_start_time.isoformat() if burst_start_time else None,
                "burst_end": burst_end_time.isoformat() if burst_end_time else None
            }
        }

class DormantActivationMetric(BaseMetric):
    name = "Dormant Activation"
    category = "Transaction Behaviour"
    description = "Detects when an account is reactivated with high volume or frequency after being dormant for 30+ days."
    severity = "High"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs or len(txs) < 2:
            return {
                "name": self.name,
                "category": self.category,
                "value": {"dormancy_days": 0, "activation_date": None},
                "severity": "Low",
                "description": "Insufficient transaction history.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        txs = sorted(txs, key=lambda x: x["date"])
        max_gap = timedelta(0)
        gap_start_idx = -1

        for i in range(1, len(txs)):
            gap = txs[i]["date"] - txs[i-1]["date"]
            if gap > max_gap:
                max_gap = gap
                gap_start_idx = i - 1

        dormancy_days = max_gap.days
        activation_txs = []
        
        if dormancy_days >= config.DORMANCY_DAYS:
            # Check if there is an activity spike after activation
            activation_time = txs[gap_start_idx + 1]["date"]
            # Look at transactions within 7 days of activation
            window_end = activation_time + timedelta(days=7)
            for j in range(gap_start_idx + 1, len(txs)):
                if txs[j]["date"] <= window_end:
                    activation_txs.append(txs[j])
                else:
                    break

        spike_detected = len(activation_txs) >= 5 or sum(t["amount"] for t in activation_txs) >= 50000.0
        
        if dormancy_days >= config.DORMANCY_DAYS and spike_detected:
            severity = "High"
            desc = f"Account activated on {txs[gap_start_idx + 1]['date'].strftime('%Y-%m-%d')} with high activity after {dormancy_days} days of dormancy."
            related_ids = [t["tx_id"] for t in activation_txs]
            val = {
                "dormancy_days": dormancy_days,
                "activation_date": txs[gap_start_idx + 1]["date"].strftime("%Y-%m-%d")
            }
        else:
            severity = "Low"
            desc = "No dormant activation patterns detected."
            related_ids = []
            val = {
                "dormancy_days": dormancy_days,
                "activation_date": None
            }

        return {
            "name": self.name,
            "category": self.category,
            "value": val,
            "severity": severity,
            "description": desc,
            "confidence": 0.9 if severity == "High" else 1.0,
            "related_transactions": related_ids,
            "metadata": {
                "max_dormancy_period_days": dormancy_days,
                "activation_tx_count": len(activation_txs),
                "activation_tx_volume": sum(t["amount"] for t in activation_txs)
            }
        }

class ImmediateBalanceDrainMetric(BaseMetric):
    name = "Immediate Balance Drain"
    category = "Transaction Behaviour"
    description = "Calculates the percentage of incoming funds transferred out within 24 hours of receipt."
    severity = "High"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0.0,
                "severity": "Low",
                "description": "No external transactions found.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        txs = sorted(txs, key=lambda x: x["date"])
        credits = [t for t in txs if not t["is_debit"]]
        debits = [t for t in txs if t["is_debit"]]

        if not credits or not debits:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0.0,
                "severity": "Low",
                "description": "No credits or debits found to compute drain.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        total_credits_val = sum(c["amount"] for c in credits)
        drained_credits_val = 0.0
        related_ids = set()

        # For each credit, check subsequent debits within 24 hours that consume it (FIFO style)
        # To avoid side-effects on original objects, copy debits structure
        debits_remaining = [{"tx_id": d["tx_id"], "amount": d["amount"], "date": d["date"]} for d in debits]
        
        for c in credits:
            c_amt = c["amount"]
            c_time = c["date"]
            limit_time = c_time + timedelta(hours=24)
            
            drained_for_this_credit = 0.0
            
            for d in debits_remaining:
                if d["amount"] <= 0:
                    continue
                if d["date"] < c_time:
                    continue
                if d["date"] > limit_time:
                    break
                
                # Consume from this debit
                needed = c_amt - drained_for_this_credit
                if needed <= 0:
                    break
                    
                consumed = min(d["amount"], needed)
                d["amount"] -= consumed
                drained_for_this_credit += consumed
                
                related_ids.add(c["tx_id"])
                related_ids.add(d["tx_id"])
                
            drained_credits_val += drained_for_this_credit

        drain_pct = (drained_credits_val / total_credits_val) * 100 if total_credits_val > 0 else 0.0
        
        severity = "High" if drain_pct >= 80.0 else ("Medium" if drain_pct >= 50.0 else "Low")
        desc = f"{drain_pct:.1f}% of all incoming funds were drained/transferred out within 24 hours of receipt."

        return {
            "name": self.name,
            "category": self.category,
            "value": round(drain_pct, 2),
            "severity": severity,
            "description": desc,
            "confidence": 0.95,
            "related_transactions": list(related_ids),
            "metadata": {
                "total_inflow": total_credits_val,
                "drained_volume": drained_credits_val
            }
        }
