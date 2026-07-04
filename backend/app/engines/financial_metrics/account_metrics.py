from typing import Dict, Any, List
from datetime import datetime, timedelta
from app.engines.financial_metrics.base_metric import BaseMetric
import app.engines.financial_metrics.config as config
from app.engines.financial_metrics.transaction_metrics import get_external_transactions

# Helper to extract counterparties
def get_counterparty(tx: Dict[str, Any]) -> str:
    desc = tx.get("description", "").upper()
    is_debit = tx.get("is_debit", True)
    counterparty = "external" if is_debit else "primary"
    
    # Simple extraction
    for word in desc.split():
        if "@" in word:
            return word.lower()
    if "NEFT-" in desc:
        parts = desc.split("-")
        if len(parts) > 2:
            return parts[2].strip()
    if "IMPS/" in desc:
        parts = desc.split("/")
        if len(parts) > 3:
            return parts[3].strip()
            
    return desc[:15].strip()

class UniqueBeneficiariesMetric(BaseMetric):
    name = "Unique Beneficiaries"
    category = "Account Metrics"
    description = "Counts the number of unique external accounts receiving funds."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        debits = [tx for tx in txs if tx["is_debit"]]
        beneficiaries = {get_counterparty(tx) for tx in debits}
        count = len(beneficiaries)
        severity = "High" if count > 15 else ("Medium" if count > 8 else "Low")
        
        return {
            "name": self.name,
            "category": self.category,
            "value": count,
            "severity": severity,
            "description": f"Funds were transferred to {count} unique beneficiaries.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {"beneficiaries": list(beneficiaries)}
        }

class UniqueSendersMetric(BaseMetric):
    name = "Unique Senders"
    category = "Account Metrics"
    description = "Counts the number of unique external accounts sending funds."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        credits = [tx for tx in txs if not tx["is_debit"]]
        senders = {get_counterparty(tx) for tx in credits}
        count = len(senders)
        severity = "Medium" if count > 10 else "Low"

        return {
            "name": self.name,
            "category": self.category,
            "value": count,
            "severity": severity,
            "description": f"Funds were received from {count} unique senders.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {"senders": list(senders)}
        }

class CreditCountMetric(BaseMetric):
    name = "Credit Count"
    category = "Account Metrics"
    description = "Total number of incoming transfers."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        count = sum(1 for tx in txs if not tx["is_debit"])
        return {
            "name": self.name,
            "category": self.category,
            "value": count,
            "severity": "Low",
            "description": f"Total of {count} credit transactions analyzed.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class DebitCountMetric(BaseMetric):
    name = "Debit Count"
    category = "Account Metrics"
    description = "Total number of outgoing transfers."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        count = sum(1 for tx in txs if tx["is_debit"])
        return {
            "name": self.name,
            "category": self.category,
            "value": count,
            "severity": "Low",
            "description": f"Total of {count} debit transactions analyzed.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class CreditVolumeMetric(BaseMetric):
    name = "Credit Volume"
    category = "Account Metrics"
    description = "Total amount of incoming funds."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        volume = sum(tx["amount"] for tx in txs if not tx["is_debit"])
        return {
            "name": self.name,
            "category": self.category,
            "value": round(volume, 2),
            "severity": "Low",
            "description": f"Total credit volume processed: ₹{volume:,.2f}.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class DebitVolumeMetric(BaseMetric):
    name = "Debit Volume"
    category = "Account Metrics"
    description = "Total amount of outgoing funds."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        volume = sum(tx["amount"] for tx in txs if tx["is_debit"])
        return {
            "name": self.name,
            "category": self.category,
            "value": round(volume, 2),
            "severity": "Low",
            "description": f"Total debit volume processed: ₹{volume:,.2f}.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class NetFlowMetric(BaseMetric):
    name = "Net Flow"
    category = "Account Metrics"
    description = "Net difference between credit volume and debit volume."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        credits = sum(tx["amount"] for tx in txs if not tx["is_debit"])
        debits = sum(tx["amount"] for tx in txs if tx["is_debit"])
        net = credits - debits
        return {
            "name": self.name,
            "category": self.category,
            "value": round(net, 2),
            "severity": "Low",
            "description": f"Net account flow: ₹{net:,.2f}.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {"credits": credits, "debits": debits}
        }

class AverageCreditMetric(BaseMetric):
    name = "Average Credit"
    category = "Account Metrics"
    description = "Average amount of incoming transactions."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        credits = [tx["amount"] for tx in txs if not tx["is_debit"]]
        avg = sum(credits) / len(credits) if credits else 0.0
        return {
            "name": self.name,
            "category": self.category,
            "value": round(avg, 2),
            "severity": "Low",
            "description": f"Average incoming transfer: ₹{avg:,.2f}.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class AverageDebitMetric(BaseMetric):
    name = "Average Debit"
    category = "Account Metrics"
    description = "Average amount of outgoing transactions."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        debits = [tx["amount"] for tx in txs if tx["is_debit"]]
        avg = sum(debits) / len(debits) if debits else 0.0
        return {
            "name": self.name,
            "category": self.category,
            "value": round(avg, 2),
            "severity": "Low",
            "description": f"Average outgoing transfer: ₹{avg:,.2f}.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class MaximumCreditMetric(BaseMetric):
    name = "Maximum Credit"
    category = "Account Metrics"
    description = "Largest incoming transaction amount."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        credits = [tx["amount"] for tx in txs if not tx["is_debit"]]
        maximum = max(credits) if credits else 0.0
        return {
            "name": self.name,
            "category": self.category,
            "value": round(maximum, 2),
            "severity": "Low",
            "description": f"Largest incoming transfer: ₹{maximum:,.2f}.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class MaximumDebitMetric(BaseMetric):
    name = "Maximum Debit"
    category = "Account Metrics"
    description = "Largest outgoing transaction amount."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        debits = [tx["amount"] for tx in txs if tx["is_debit"]]
        maximum = max(debits) if debits else 0.0
        return {
            "name": self.name,
            "category": self.category,
            "value": round(maximum, 2),
            "severity": "Low",
            "description": f"Largest outgoing transfer: ₹{maximum:,.2f}.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class AverageHoldingTimeMetric(BaseMetric):
    name = "Average Holding Time"
    category = "Account Metrics"
    description = "Calculates the average duration funds remain in the account (FIFO simulation)."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        txs = sorted(txs, key=lambda x: x["date"])
        
        credits = [tx for tx in txs if not tx["is_debit"]]
        debits = [tx for tx in txs if tx["is_debit"]]

        if not credits or not debits:
            return {
                "name": self.name,
                "category": self.category,
                "value": "N/A",
                "severity": "Low",
                "description": "Insufficient credit/debit activity to compute holding time.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {"holding_time_seconds": 0.0}
            }

        # FIFO simulation
        credit_queue = [[c["date"], c["amount"]] for c in credits]
        delays = []
        weights = []

        for d in debits:
            d_amt = d["amount"]
            d_time = d["date"]
            
            for c in credit_queue:
                if c[1] <= 0:
                    continue
                if c[0] > d_time:
                    # Debit occurred before this credit (possible due to initial balance, skip)
                    continue
                    
                consumed = min(c[1], d_amt)
                c[1] -= consumed
                d_amt -= consumed
                
                delay_sec = (d_time - c[0]).total_seconds()
                delays.append(delay_sec)
                weights.append(consumed)
                
                if d_amt <= 0:
                    break

        total_weight = sum(weights)
        if total_weight == 0:
            return {
                "name": self.name,
                "category": self.category,
                "value": "0 seconds",
                "severity": "Low",
                "description": "Funds are immediately withdrawn.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {"holding_time_seconds": 0.0}
            }

        avg_delay_sec = sum(d * w for d, w in zip(delays, weights)) / total_weight
        
        # Format human readable
        if avg_delay_sec < 60:
            val_str = f"{int(avg_delay_sec)} seconds"
        elif avg_delay_sec < 3600:
            val_str = f"{int(avg_delay_sec / 60)} minutes"
        elif avg_delay_sec < 86400:
            val_str = f"{avg_delay_sec / 3600:.1f} hours"
        else:
            val_str = f"{avg_delay_sec / 86400:.1f} days"

        severity = "High" if avg_delay_sec < 3600 else ("Medium" if avg_delay_sec < 86400 else "Low")
        desc = f"Average holding time of funds is {val_str} before withdrawal/transfer."

        return {
            "name": self.name,
            "category": self.category,
            "value": val_str,
            "severity": severity,
            "description": desc,
            "confidence": 0.9,
            "related_transactions": [],
            "metadata": {
                "holding_time_seconds": avg_delay_sec,
                "holding_time_hours": avg_delay_sec / 3600.0
            }
        }

class BalanceRetentionPercentMetric(BaseMetric):
    name = "Balance Retention %"
    category = "Account Metrics"
    description = "Percentage of total incoming volume retained in the account."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        credits = sum(tx["amount"] for tx in txs if not tx["is_debit"])
        debits = sum(tx["amount"] for tx in txs if tx["is_debit"])

        if credits == 0:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0.0,
                "severity": "Low",
                "description": "No credits recorded.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        retained = max(0.0, credits - debits)
        pct = (retained / credits) * 100
        
        severity = "High" if pct < 10.0 else ("Medium" if pct < 30.0 else "Low")
        desc = f"Account retains only {pct:.1f}% of incoming funds, indicating high pass-through behavior."

        return {
            "name": self.name,
            "category": self.category,
            "value": round(pct, 2),
            "severity": severity,
            "description": desc,
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {
                "inflow": credits,
                "outflow": debits,
                "retained_balance": retained
            }
        }

class BeneficiaryConcentrationIndexMetric(BaseMetric):
    name = "Beneficiary Concentration Index"
    category = "Account Metrics"
    description = "Herfindahl-Hirschman Index (HHI) representing the concentration of outflows across beneficiaries."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        debits = [tx for tx in txs if tx["is_debit"]]
        
        if not debits:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0.0,
                "severity": "Low",
                "description": "No outgoing transactions.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        total_debit_volume = sum(d["amount"] for d in debits)
        if total_debit_volume == 0.0:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0.0,
                "severity": "Low",
                "description": "Outgoing volume is zero.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        beneficiary_shares = {}
        
        for d in debits:
            bp = get_counterparty(d)
            beneficiary_shares[bp] = beneficiary_shares.get(bp, 0.0) + d["amount"]

        hhi = 0.0
        for bp, amt in beneficiary_shares.items():
            share = amt / total_debit_volume
            hhi += share ** 2

        # Convert to 0-100 scale (HHI standard normally is 0-10000, we map 0.0-1.0 to 0-100)
        hhi_pct = hhi * 100.0

        severity = "High" if hhi_pct >= 60.0 else ("Medium" if hhi_pct >= 30.0 else "Low")
        desc = f"Beneficiary concentration index is {hhi_pct:.1f}/100. Outflows are highly concentrated to few beneficiaries." if hhi_pct >= 50.0 else f"Outflows are diversified across beneficiaries (Index: {hhi_pct:.1f}/100)."

        return {
            "name": self.name,
            "category": self.category,
            "value": round(hhi_pct, 2),
            "severity": severity,
            "description": desc,
            "confidence": 0.95,
            "related_transactions": [],
            "metadata": {
                "beneficiary_shares": beneficiary_shares,
                "unique_beneficiaries_count": len(beneficiary_shares)
            }
        }
