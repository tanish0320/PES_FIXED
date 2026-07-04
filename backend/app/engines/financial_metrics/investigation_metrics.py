from typing import Dict, Any, List
from datetime import datetime
from collections import defaultdict
from app.engines.financial_metrics.base_metric import BaseMetric
from app.engines.financial_metrics.transaction_metrics import get_external_transactions

class PatternCountMetric(BaseMetric):
    name = "Pattern Count"
    category = "Investigation Metrics"
    description = "Counts the total number of suspicious behavioral patterns detected."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        patterns = entities.get("patterns", []) or []
        count = len(patterns)
        severity = "High" if count >= 4 else ("Medium" if count >= 2 else "Low")
        
        return {
            "name": self.name,
            "category": self.category,
            "value": count,
            "severity": severity,
            "description": f"Detected {count} suspicious pattern signatures.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class PatternDiversityMetric(BaseMetric):
    name = "Pattern Diversity"
    category = "Investigation Metrics"
    description = "Counts the number of unique types of suspicious behaviors identified."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        patterns = entities.get("patterns", []) or []
        unique_patterns = {p.get("name") for p in patterns if p.get("name")}
        count = len(unique_patterns)
        severity = "High" if count >= 3 else ("Medium" if count >= 2 else "Low")

        return {
            "name": self.name,
            "category": self.category,
            "value": count,
            "severity": severity,
            "description": f"Identified {count} distinct types of suspicious behaviors.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {"unique_pattern_types": list(unique_patterns)}
        }

class PatternDensityMetric(BaseMetric):
    name = "Pattern Density"
    category = "Investigation Metrics"
    description = "Percentage of transactions that trigger behavioral pattern flags."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        patterns = entities.get("patterns", []) or []
        
        flagged_tx_ids = set()
        for p in patterns:
            for tx_id in p.get("related_transactions", []):
                flagged_tx_ids.add(tx_id)
                
        total_tx = len(txs)
        flagged_count = len(flagged_tx_ids)
        density = (flagged_count / total_tx) * 100 if total_tx > 0 else 0.0
        severity = "High" if density >= 30.0 else ("Medium" if density >= 10.0 else "Low")

        return {
            "name": self.name,
            "category": self.category,
            "value": round(density, 2),
            "severity": severity,
            "description": f"Pattern density is {density:.1f}% of all transactions.",
            "confidence": 1.0,
            "related_transactions": list(flagged_tx_ids),
            "metadata": {}
        }

class PatternsPer100TransactionsMetric(BaseMetric):
    name = "Patterns per 100 Transactions"
    category = "Investigation Metrics"
    description = "Normalizes pattern count per 100 transactions analyzed."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        patterns = entities.get("patterns", []) or []
        total_tx = len(txs)
        ratio = (len(patterns) / total_tx) * 100 if total_tx > 0 else 0.0
        severity = "High" if ratio >= 5.0 else ("Medium" if ratio >= 2.0 else "Low")

        return {
            "name": self.name,
            "category": self.category,
            "value": round(ratio, 2),
            "severity": severity,
            "description": f"An average of {ratio:.2f} patterns detected per 100 transactions.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class EntityCountMetric(BaseMetric):
    name = "Entity Count"
    category = "Investigation Metrics"
    description = "Total number of entities extracted from the transactions (names, UPIs, merchants, IFSCs)."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        names_count = len(entities.get("names", []))
        upi_count = len(entities.get("upi_ids", []))
        merchants_count = len(entities.get("merchants", []))
        ifsc_count = len(entities.get("ifsc_codes", []))
        
        total = names_count + upi_count + merchants_count + ifsc_count
        return {
            "name": self.name,
            "category": self.category,
            "value": total,
            "severity": "Low",
            "description": f"Extracted {total} total entities (names, UPIs, merchants, IFSCs).",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {
                "names_count": names_count,
                "upi_count": upi_count,
                "merchants_count": merchants_count,
                "ifsc_count": ifsc_count
            }
        }

class AccountCountMetric(BaseMetric):
    name = "Account Count"
    category = "Investigation Metrics"
    description = "Total count of distinct accounts involved in the graph."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        nodes = graph.get("nodes", [])
        accounts = [n for n in nodes if n.get("node_type") == "account"]
        count = len(accounts)
        return {
            "name": self.name,
            "category": self.category,
            "value": count,
            "severity": "Low",
            "description": f"Graph contains {count} distinct accounts.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class MerchantCountMetric(BaseMetric):
    name = "Merchant Count"
    category = "Investigation Metrics"
    description = "Total count of unique merchants detected."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        count = len(entities.get("merchants", []))
        return {
            "name": self.name,
            "category": self.category,
            "value": count,
            "severity": "Low",
            "description": f"Detected {count} unique merchants.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class UPICountMetric(BaseMetric):
    name = "UPI Count"
    category = "Investigation Metrics"
    description = "Total count of unique UPI IDs detected."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        count = len(entities.get("upi_ids", []))
        return {
            "name": self.name,
            "category": self.category,
            "value": count,
            "severity": "Low",
            "description": f"Detected {count} unique UPI identifiers.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class BankCountMetric(BaseMetric):
    name = "Bank Count"
    category = "Investigation Metrics"
    description = "Total count of unique banks (IFSC codes) detected."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        count = len(entities.get("ifsc_codes", []))
        return {
            "name": self.name,
            "category": self.category,
            "value": count,
            "severity": "Low",
            "description": f"Detected {count} unique banks/IFSC codes.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class InvestigationConfidenceMetric(BaseMetric):
    name = "Investigation Confidence"
    category = "Investigation Metrics"
    description = "Calculates the overall confidence score of the investigation based on parser statistics."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        # Extract confidence from entities or metadata, default to 100.0
        # If transactions are present, we can look at parser stats
        # (usually passed in metadata of transaction/entities, or we assume a high base)
        # Let's inspect if entities contains parser stats
        parser_stats = entities.get("parser_statistics", {}) or {}
        confidence = float(parser_stats.get("confidence", 100.0))
        
        # Deduct for warnings
        warnings = parser_stats.get("warnings", []) or []
        confidence = max(0.0, confidence - len(warnings) * 5.0)

        severity = "Low" if confidence >= 80.0 else ("Medium" if confidence >= 50.0 else "High")
        desc = f"Investigation confidence is {confidence:.1f}% based on input statement quality."

        return {
            "name": self.name,
            "category": self.category,
            "value": round(confidence, 2),
            "severity": severity,
            "description": desc,
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {"warnings": warnings}
        }

class EvidenceCountMetric(BaseMetric):
    name = "Evidence Count"
    category = "Investigation Metrics"
    description = "Total number of transactions flagged as evidence in any pattern."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        patterns = entities.get("patterns", []) or []
        evidence_ids = set()
        for p in patterns:
            for tx_id in p.get("related_transactions", []):
                evidence_ids.add(tx_id)

        count = len(evidence_ids)
        severity = "High" if count >= 10 else ("Medium" if count >= 4 else "Low")
        
        return {
            "name": self.name,
            "category": self.category,
            "value": count,
            "severity": severity,
            "description": f"Identified {count} transactions as critical investigation evidence.",
            "confidence": 1.0,
            "related_transactions": list(evidence_ids),
            "metadata": {}
        }

class SuspiciousTransactionPercentMetric(BaseMetric):
    name = "Suspicious Transaction %"
    category = "Investigation Metrics"
    description = "Percentage of transactions flagged as suspicious or related to risk patterns."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        patterns = entities.get("patterns", []) or []
        evidence_ids = set()
        for p in patterns:
            for tx_id in p.get("related_transactions", []):
                evidence_ids.add(tx_id)

        total_tx = len(txs)
        pct = (len(evidence_ids) / total_tx) * 100 if total_tx > 0 else 0.0
        severity = "High" if pct >= 30.0 else ("Medium" if pct >= 10.0 else "Low")

        return {
            "name": self.name,
            "category": self.category,
            "value": round(pct, 2),
            "severity": severity,
            "description": f"{pct:.1f}% of transactions are flagged in suspicious behavioral patterns.",
            "confidence": 1.0,
            "related_transactions": list(evidence_ids),
            "metadata": {}
        }

class AverageDailyVolumeMetric(BaseMetric):
    name = "Average Daily Volume"
    category = "Investigation Metrics"
    description = "Calculates the average transaction volume processed per day."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0.0,
                "severity": "Low",
                "description": "No transactions.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        sorted_txs = sorted(txs, key=lambda x: x["date"])
        start_date = sorted_txs[0]["date"]
        end_date = sorted_txs[-1]["date"]
        days = (end_date - start_date).days
        days = max(1, days) # At least 1 day

        total_vol = sum(t["amount"] for t in txs)
        avg_vol = total_vol / days
        severity = "Medium" if avg_vol >= 100000.0 else "Low"

        return {
            "name": self.name,
            "category": self.category,
            "value": round(avg_vol, 2),
            "severity": severity,
            "description": f"Average daily transactional volume: ₹{avg_vol:,.2f}.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {"total_volume": total_vol, "days": days}
        }

class HighestRiskEntityMetric(BaseMetric):
    name = "Highest Risk Entity"
    category = "Investigation Metrics"
    description = "Identifies the counterparty node in the network with the highest risk rating."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        nodes = graph.get("nodes", [])
        if not nodes:
            return {
                "name": self.name,
                "category": self.category,
                "value": None,
                "severity": "Low",
                "description": "Empty graph.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        # Filter out the primary owner node (normally containing "(Owner)")
        counterparties = [n for n in nodes if "owner" not in n.get("label", "").lower()]
        if not counterparties:
            return {
                "name": self.name,
                "category": self.category,
                "value": None,
                "severity": "Low",
                "description": "No counterparties present.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        highest_risk_node = max(counterparties, key=lambda x: x.get("risk", 0.0))
        risk_val = highest_risk_node.get("risk", 0.0)
        entity_name = highest_risk_node.get("account_id")

        severity = "High" if risk_val >= 70.0 else ("Medium" if risk_val >= 50.0 else "Low")
        desc = f"Highest risk counterparty is '{entity_name}' with a risk rating of {risk_val}%."

        return {
            "name": self.name,
            "category": self.category,
            "value": entity_name,
            "severity": severity,
            "description": desc,
            "confidence": 0.9,
            "related_transactions": [],
            "metadata": {"risk": risk_val}
        }

class HighestRiskDayMetric(BaseMetric):
    name = "Highest Risk Day"
    category = "Investigation Metrics"
    description = "Identifies the calendar day with the highest concentration of suspicious volume."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs:
            return {
                "name": self.name,
                "category": self.category,
                "value": None,
                "severity": "Low",
                "description": "No transactions.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        daily_volume = defaultdict(float)
        for tx in txs:
            date_str = tx["date"].strftime("%Y-%m-%d")
            daily_volume[date_str] += tx["amount"]

        highest_day = max(daily_volume, key=daily_volume.get)
        max_vol = daily_volume[highest_day]
        severity = "High" if max_vol >= 500000.0 else ("Medium" if max_vol >= 100000.0 else "Low")

        return {
            "name": self.name,
            "category": self.category,
            "value": highest_day,
            "severity": severity,
            "description": f"Highest volume activity day: {highest_day} with ₹{max_vol:,.2f} processed.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {"daily_volumes": dict(daily_volume)}
        }

class HighestRiskTransactionMetric(BaseMetric):
    name = "Highest Risk Transaction"
    category = "Investigation Metrics"
    description = "Identifies the transaction with the highest calculated risk score or largest volume among evidence."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs:
            return {
                "name": self.name,
                "category": self.category,
                "value": None,
                "severity": "Low",
                "description": "No transactions.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        # Look for tx with highest risk score, or largest among patterns
        patterns = entities.get("patterns", []) or []
        evidence_ids = set()
        for p in patterns:
            for tx_id in p.get("related_transactions", []):
                evidence_ids.add(tx_id)

        evidence_txs = [t for t in txs if t["tx_id"] in evidence_ids]
        if not evidence_txs:
            # Fallback to largest overall transaction
            target_tx = max(txs, key=lambda x: x["amount"])
            desc = f"Largest transaction processed: ₹{target_tx['amount']:,.2f} (ID: {target_tx['tx_id']})."
        else:
            target_tx = max(evidence_txs, key=lambda x: x["amount"])
            desc = f"Highest risk transaction among evidence: ₹{target_tx['amount']:,.2f} (ID: {target_tx['tx_id']})."

        return {
            "name": self.name,
            "category": self.category,
            "value": target_tx["tx_id"],
            "severity": "High" if target_tx["amount"] >= 100000.0 else "Medium",
            "description": desc,
            "confidence": 0.95,
            "related_transactions": [target_tx["tx_id"]],
            "metadata": {"amount": target_tx["amount"], "description": target_tx.get("description")}
        }

class FailedTransactionMetricsMetric(BaseMetric):
    name = "Failed Transactions"
    category = "Failed Transactions"
    description = "Analyzes transaction failure rates, streaks, and retry behaviors."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # Filter external transactions
            txs = get_external_transactions(transactions)
            txs = sorted(txs, key=lambda x: x["date"])
            
            # Check if any transaction is failed
            # We look for tx with tx.get("status") == "FAILED" or description indicating failure/decline
            failed_txs = []
            for tx in txs:
                status = str(tx.get("status", "")).upper()
                desc = str(tx.get("description", "")).upper()
                is_failed = status == "FAILED" or "FAILED" in desc or "DECLINED" in desc or "BOUNCED" in desc
                if is_failed:
                    failed_txs.append(tx)

            if not failed_txs:
                # No failed transaction information or all succeeded
                return {
                    "name": self.name,
                    "status": "Not Available"
                }

            failed_count = len(failed_txs)
            failure_pct = (failed_count / len(txs)) * 100 if txs else 0.0

            # Retries and fails before success
            # Group by amount and approximate time (within 10 mins)
            retries = 0
            failed_before_success = 0
            longest_streak = 0
            current_streak = 0

            # Longest failure streak chronologically
            for tx in txs:
                status = str(tx.get("status", "")).upper()
                desc = str(tx.get("description", "")).upper()
                is_failed = status == "FAILED" or "FAILED" in desc or "DECLINED" in desc or "BOUNCED" in desc
                
                if is_failed:
                    current_streak += 1
                    longest_streak = max(longest_streak, current_streak)
                else:
                    current_streak = 0

            # Simple retry grouping (same sender, same receiver/merchant, same amount, within 10 mins)
            # Find a failure followed by a success or retry
            for i, f_tx in enumerate(failed_txs):
                f_time = f_tx["date"]
                f_amt = f_tx["amount"]
                
                # Look for subsequent txs within 10 mins
                for j in range(len(txs)):
                    other = txs[j]
                    if other["date"] <= f_time:
                        continue
                    if (other["date"] - f_time).total_seconds() > 600:
                        break
                    
                    if abs(other["amount"] - f_amt) < 0.01:
                        # Same amount retry!
                        retries += 1
                        other_status = str(other.get("status", "")).upper()
                        other_desc = str(other.get("description", "")).upper()
                        other_failed = other_status == "FAILED" or "FAILED" in other_desc or "DECLINED" in other_desc or "BOUNCED" in other_desc
                        if not other_failed:
                            failed_before_success += 1
                        break

            severity = "High" if failed_count >= 5 else ("Medium" if failed_count >= 2 else "Low")
            desc = f"Detected {failed_count} failed transactions ({failure_pct:.1f}% failure rate) with {longest_streak} consecutive failures."

            return {
                "name": self.name,
                "category": self.category,
                "value": {
                    "failed_count": failed_count,
                    "failed_before_success": failed_before_success,
                    "failure_pct": round(failure_pct, 2),
                    "retry_count": retries,
                    "longest_failure_streak": longest_streak
                },
                "severity": severity,
                "description": desc,
                "confidence": 1.0,
                "related_transactions": [t["tx_id"] for t in failed_txs],
                "metadata": {}
            }
        except Exception:
            # Never throw exceptions
            return {
                "name": self.name,
                "status": "Not Available"
            }
