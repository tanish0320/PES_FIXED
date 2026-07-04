from typing import Dict, Any, List
from datetime import datetime, timedelta
from app.engines.financial_metrics.base_metric import BaseMetric
from app.engines.financial_metrics.transaction_metrics import get_external_transactions

class SuspiciousTransactionWindowMetric(BaseMetric):
    name = "Suspicious Transaction Window"
    category = "Chronological Analysis"
    description = "Calculates the time window between the first suspicious credit and the final suspicious debit."
    severity = "High"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs:
            return {
                "name": self.name, "category": self.category, "value": None,
                "severity": "Low", "description": "No transactions.", "confidence": 1.0,
                "related_transactions": [], "metadata": {}
            }
        
        # Chronological sort
        sorted_txs = sorted(txs, key=lambda x: x["date"])
        credits = [t for t in sorted_txs if not t.get("is_debit", True) and t.get("amount", 0) >= 10000]
        debits = [t for t in sorted_txs if t.get("is_debit", True)]

        if not credits or not debits:
            return {
                "name": self.name, "category": self.category, "value": None,
                "severity": "Low", "description": "Insufficient flow for window.", "confidence": 1.0,
                "related_transactions": [], "metadata": {}
            }

        first_credit = credits[0]
        last_debit = debits[-1]
        
        duration = last_debit["date"] - first_credit["date"]
        duration_hours = duration.total_seconds() / 3600.0

        total_credits_vol = sum(t["amount"] for t in credits)
        total_debits_vol = sum(t["amount"] for t in debits)
        
        remaining = max(0.0, total_credits_vol - total_debits_vol)
        pct_retained = (remaining / total_credits_vol) * 100 if total_credits_vol > 0 else 0.0
        pct_pass_through = min(100.0, (total_debits_vol / total_credits_vol) * 100) if total_credits_vol > 0 else 0.0

        return {
            "name": self.name,
            "category": self.category,
            "value": {
                "duration_hours": duration_hours,
                "money_retained": remaining,
                "money_distributed": total_debits_vol,
                "pass_through_percent": pct_pass_through
            },
            "severity": "High" if pct_pass_through >= 80 and duration_hours <= 48 else "Medium",
            "description": f"Suspicious transaction window spanning {duration_hours:.1f} hours with {pct_pass_through:.1f}% pass-through.",
            "confidence": 0.95,
            "related_transactions": [first_credit["tx_id"], last_debit["tx_id"]],
            "metadata": {
                "first_suspicious_credit": first_credit["tx_id"],
                "last_suspicious_debit": last_debit["tx_id"]
            }
        }


class PassThroughRatioMetric(BaseMetric):
    name = "Pass Through Ratio"
    category = "Transaction Behaviour"
    description = "Measures the ratio of incoming funds directly routed out of the account."
    severity = "High"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        credits = sum(t["amount"] for t in txs if not t.get("is_debit", True))
        debits = sum(t["amount"] for t in txs if t.get("is_debit", True))

        if credits == 0:
            return {
                "name": self.name, "category": self.category, "value": None,
                "severity": "Low", "description": "No credits.", "confidence": 1.0,
                "related_transactions": [], "metadata": {}
            }

        pass_through_pct = min(100.0, (debits / credits) * 100)
        retention_pct = max(0.0, 100.0 - pass_through_pct)

        # Average holding time calculation
        holding_times = []
        credits_txs = sorted([t for t in txs if not t.get("is_debit", True)], key=lambda x: x["date"])
        debits_txs = sorted([t for t in txs if t.get("is_debit", True)], key=lambda x: x["date"])
        
        for c in credits_txs[:10]: # check top 10 inflows
            for d in debits_txs:
                if d["date"] > c["date"]:
                    holding_times.append((d["date"] - c["date"]).total_seconds())
                    break
        
        avg_holding_time_str = "N/A"
        if holding_times:
            avg_sec = sum(holding_times) / len(holding_times)
            avg_holding_time_str = f"{avg_sec / 3600:.1f} hours"

        return {
            "name": self.name,
            "category": self.category,
            "value": {
                "pass_through_percent": pass_through_pct,
                "retention_percent": retention_pct,
                "average_holding_time": avg_holding_time_str
            },
            "severity": "High" if pass_through_pct >= 80 else "Medium",
            "description": f"Pass through ratio: {pass_through_pct:.1f}% with retention: {retention_pct:.1f}%.",
            "confidence": 0.96,
            "related_transactions": [],
            "metadata": {}
        }


class DormantAccountReactivationMetric(BaseMetric):
    name = "Dormant Account Reactivation"
    category = "Transaction Behaviour"
    description = "Measures sudden high-volume reactivation of previously inactive accounts."
    severity = "High"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = sorted(get_external_transactions(transactions), key=lambda x: x["date"])
        if len(txs) < 2:
            return {
                "name": self.name, "category": self.category, "value": None,
                "severity": "Low", "description": "Insufficient history.", "confidence": 1.0,
                "related_transactions": [], "metadata": {}
            }

        max_gap = timedelta(seconds=0)
        gap_index = -1
        
        for i in range(1, len(txs)):
            gap = txs[i]["date"] - txs[i-1]["date"]
            if gap > max_gap:
                max_gap = gap
                gap_index = i

        max_gap_days = max_gap.total_seconds() / 86400.0
        
        dormancy_score = 0.0
        related = []
        if gap_index != -1 and max_gap_days >= 30:
            reactivating_tx = txs[gap_index]
            if not reactivating_tx["is_debit"] and reactivating_tx["amount"] >= 50000:
                subsequent_debits = sum(t["amount"] for t in txs[gap_index+1:] if t["is_debit"] and (t["date"] - reactivating_tx["date"]) <= timedelta(days=1))
                if subsequent_debits >= 0.8 * reactivating_tx["amount"]:
                    dormancy_score = min(100.0, 50.0 + (max_gap_days * 0.5))
                    related = [txs[gap_index-1]["tx_id"], reactivating_tx["tx_id"]]
        
        return {
            "name": self.name,
            "category": self.category,
            "value": {
                "inactive_period_days": max_gap_days,
                "dormancy_score": dormancy_score
            },
            "severity": "High" if dormancy_score >= 70 else "Low",
            "description": f"Account was dormant for {max_gap_days:.1f} days before a large inflow reactivation.",
            "confidence": 0.94,
            "related_transactions": related,
            "metadata": {}
        }


class RapidSuccessAfterFailureMetric(BaseMetric):
    name = "Rapid Success After Failure"
    category = "Fraud Operational Indicators"
    description = "Detects multiple failed transaction attempts followed by a successful transfer within 15 minutes."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = sorted(get_external_transactions(transactions), key=lambda x: x["date"])
        
        retries = 0
        related = []
        avg_delay = 0.0
        
        for i in range(2, len(txs)):
            tx = txs[i]
            prev1 = txs[i-1]
            prev2 = txs[i-2]
            
            p1_desc = prev1.get("description", "").upper()
            p2_desc = prev2.get("description", "").upper()
            
            p1_failed = prev1.get("status") == "FAILED" or "FAILED" in p1_desc or "DECLINED" in p1_desc
            p2_failed = prev2.get("status") == "FAILED" or "FAILED" in p2_desc or "DECLINED" in p2_desc
            current_success = not (tx.get("status") == "FAILED" or "FAILED" in tx.get("description", "").upper())

            if p1_failed and p2_failed and current_success:
                time_diff = tx["date"] - prev2["date"]
                if time_diff <= timedelta(minutes=15):
                    retries += 1
                    related.extend([prev2["tx_id"], prev1["tx_id"], tx["tx_id"]])
                    avg_delay = time_diff.total_seconds() / 60.0

        return {
            "name": self.name,
            "category": self.category,
            "value": {
                "retries": retries,
                "delay_minutes": avg_delay
            },
            "severity": "High" if retries > 0 else "Low",
            "description": f"Detected {retries} retry attempts succeeding rapidly after multiple transaction failures.",
            "confidence": 0.90,
            "related_transactions": related,
            "metadata": {}
        }


class SameAmountRetryScoreMetric(BaseMetric):
    name = "Same Amount Retry Score"
    category = "Fraud Operational Indicators"
    description = "Detects consecutive failed transaction attempts for the exact same amount followed by a success."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = sorted(get_external_transactions(transactions), key=lambda x: x["date"])
        
        matches = 0
        related = []
        
        for i in range(2, len(txs)):
            tx = txs[i]
            prev1 = txs[i-1]
            prev2 = txs[i-2]
            
            p1_desc = prev1.get("description", "").upper()
            p2_desc = prev2.get("description", "").upper()
            
            p1_failed = prev1.get("status") == "FAILED" or "FAILED" in p1_desc or "DECLINED" in p1_desc
            p2_failed = prev2.get("status") == "FAILED" or "FAILED" in p2_desc or "DECLINED" in p2_desc
            current_success = not (tx.get("status") == "FAILED" or "FAILED" in tx.get("description", "").upper())

            if p1_failed and p2_failed and current_success:
                if prev2["amount"] == prev1["amount"] == tx["amount"]:
                    if (tx["date"] - prev2["date"]) <= timedelta(minutes=15):
                        matches += 1
                        related.extend([prev2["tx_id"], prev1["tx_id"], tx["tx_id"]])

        return {
            "name": self.name,
            "category": self.category,
            "value": matches,
            "severity": "High" if matches > 0 else "Low",
            "description": f"Same amount retry score: {matches} groups detected.",
            "confidence": 0.92,
            "related_transactions": related,
            "metadata": {}
        }


class TransactionBurstScoreMetric(BaseMetric):
    name = "Transaction Burst Score"
    category = "Transaction Behaviour"
    description = "Measures transaction frequency bursts within 5, 10, 30, and 60 minutes."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = sorted(get_external_transactions(transactions), key=lambda x: x["date"])
        
        burst_5 = 0
        burst_10 = 0
        burst_30 = 0
        burst_60 = 0
        
        for i, tx in enumerate(txs):
            t_time = tx["date"]
            c_5 = sum(1 for other in txs[i:] if other["date"] - t_time <= timedelta(minutes=5))
            c_10 = sum(1 for other in txs[i:] if other["date"] - t_time <= timedelta(minutes=10))
            c_30 = sum(1 for other in txs[i:] if other["date"] - t_time <= timedelta(minutes=30))
            c_60 = sum(1 for other in txs[i:] if other["date"] - t_time <= timedelta(minutes=60))
            
            burst_5 = max(burst_5, c_5)
            burst_10 = max(burst_10, c_10)
            burst_30 = max(burst_30, c_30)
            burst_60 = max(burst_60, c_60)

        return {
            "name": self.name,
            "category": self.category,
            "value": {
                "burst_5m": burst_5,
                "burst_10m": burst_10,
                "burst_30m": burst_30,
                "burst_60m": burst_60
            },
            "severity": "High" if burst_10 >= 8 else "Low",
            "description": f"Peak transaction burst count in 10 minutes: {burst_10} transactions.",
            "confidence": 0.95,
            "related_transactions": [],
            "metadata": {}
        }


class NightActivityScoreMetric(BaseMetric):
    name = "Night Activity Score"
    category = "Behavioral Frequency"
    description = "Calculates the percentage of transactions occurring during off-hours (8 PM to 6 AM)."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs:
            return {
                "name": self.name, "category": self.category, "value": 0.0,
                "severity": "Low", "description": "No transactions.", "confidence": 1.0,
                "related_transactions": [], "metadata": {}
            }
        
        night_txs = 0
        for tx in txs:
            hr = tx["date"].hour
            if hr >= 20 or hr < 6:
                night_txs += 1
                
        pct = (night_txs / len(txs)) * 100
        return {
            "name": self.name,
            "category": self.category,
            "value": pct,
            "severity": "Medium" if pct >= 40 else "Low",
            "description": f"{pct:.1f}% of transactions occurred during night hours (8 PM - 6 AM).",
            "confidence": 0.98,
            "related_transactions": [],
            "metadata": {}
        }


class WeekendActivityScoreMetric(BaseMetric):
    name = "Weekend Activity Score"
    category = "Behavioral Frequency"
    description = "Calculates the percentage of transactions occurring on weekends (Saturdays and Sundays)."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs:
            return {
                "name": self.name, "category": self.category, "value": 0.0,
                "severity": "Low", "description": "No transactions.", "confidence": 1.0,
                "related_transactions": [], "metadata": {}
            }
        
        weekend_txs = 0
        for tx in txs:
            wd = tx["date"].weekday()
            if wd >= 5:
                weekend_txs += 1
                
        pct = (weekend_txs / len(txs)) * 100
        return {
            "name": self.name,
            "category": self.category,
            "value": pct,
            "severity": "Medium" if pct >= 40 else "Low",
            "description": f"{pct:.1f}% of transactions occurred on weekends.",
            "confidence": 0.98,
            "related_transactions": [],
            "metadata": {}
        }


class IncomingSourceDiversityMetric(BaseMetric):
    name = "Incoming Source Diversity"
    category = "Account Metrics"
    description = "Measures the diversity ratio of inbound sources compared to destinations."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        credits = [t for t in txs if not t.get("is_debit", True)]
        debits = [t for t in txs if t.get("is_debit", True)]
        
        from app.engines.financial_metrics.account_metrics import get_counterparty
        senders = {get_counterparty(tx) for tx in credits}
        destinations = {get_counterparty(tx) for tx in debits}
        
        diversity = len(senders) / max(1, len(destinations))
        return {
            "name": self.name,
            "category": self.category,
            "value": diversity,
            "severity": "Medium" if diversity >= 3.0 else "Low",
            "description": f"Diversity ratio is {diversity:.2f} (Inbound unique senders: {len(senders)} / destinations: {len(destinations)}).",
            "confidence": 0.95,
            "related_transactions": [],
            "metadata": {}
        }


class DestinationFanOutMetric(BaseMetric):
    name = "Destination Fan-Out"
    category = "Layering & Structuring"
    description = "Measures dispersed credits to multiple outward destinations within 24 hours."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = sorted(get_external_transactions(transactions), key=lambda x: x["date"])
        
        from app.engines.financial_metrics.account_metrics import get_counterparty
        
        fan_outs = 0
        related = []
        
        for i, credit in enumerate(txs):
            if credit["is_debit"] or credit["amount"] < 50000:
                continue
                
            c_time = credit["date"]
            out_dests = set()
            out_txs = []
            
            for j in range(i + 1, len(txs)):
                other = txs[j]
                if other["date"] - c_time > timedelta(days=1):
                    break
                if other["is_debit"]:
                    dest = get_counterparty(other)
                    out_dests.add(dest)
                    out_txs.append(other)
            
            if len(out_dests) >= 4:
                fan_outs += 1
                related.append(credit["tx_id"])
                related.extend([t["tx_id"] for t in out_txs])

        return {
            "name": self.name,
            "category": self.category,
            "value": fan_outs,
            "severity": "High" if fan_outs > 0 else "Low",
            "description": f"Detected {fan_outs} destination fan-out structures.",
            "confidence": 0.95,
            "related_transactions": related,
            "metadata": {}
        }


class AccountReuseScoreMetric(BaseMetric):
    name = "Account Reuse Score"
    category = "Overall Risk Profiling"
    description = "Detects cross-investigation usage of nodes across other cases."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        from app.core.data_store import data_store as store
        
        all_cases = store.get("cases", {})
        nodes_seen = {}
        
        for c_id, c_data in all_cases.items():
            ent = c_data.get("entities", {})
            for acc in ent.get("accounts", []):
                val = acc.get("value")
                if val:
                    nodes_seen[val] = nodes_seen.get(val, 0) + 1
                    
        max_overlaps = 0
        primary_acc = entities.get("accounts", [{}])[0].get("value")
        if primary_acc:
            max_overlaps = max(0, nodes_seen.get(primary_acc, 1) - 1)

        return {
            "name": self.name,
            "category": self.category,
            "value": max_overlaps,
            "severity": "High" if max_overlaps > 0 else "Low",
            "description": f"Entity is flagged in {max_overlaps} other active investigations.",
            "confidence": 0.96,
            "related_transactions": [],
            "metadata": {}
        }
