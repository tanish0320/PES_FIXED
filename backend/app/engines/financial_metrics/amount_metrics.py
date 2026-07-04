from typing import Dict, Any, List
from datetime import datetime, timedelta
from collections import Counter
from app.engines.financial_metrics.base_metric import BaseMetric
import app.engines.financial_metrics.config as config
from app.engines.financial_metrics.transaction_metrics import get_external_transactions

class RepeatedAmountDetectorMetric(BaseMetric):
    name = "Repeated Amount Detector"
    category = "Amount Metrics"
    description = "Identifies transactions with identical amounts, highlighting potential automated transfers or structured pattern flows."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs:
            return {
                "name": self.name,
                "category": self.category,
                "value": {
                    "count": 0,
                    "top_repeated": [],
                    "most_frequent_amount": 0.0,
                    "repeated_amounts": {}
                },
                "severity": "Low",
                "description": "No external transactions found.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {
                    "most_frequent_amount": 0.0,
                    "frequency": 0,
                    "repeated_amount_percentage": 0.0,
                    "top_10_repeated_values": [],
                    "transaction_ids": [],
                    "explanation": "No external transactions found.",
                    "percentage_repeated": 0.0,
                    "total_repeated_count": 0
                }
            }

        amounts = [tx["amount"] for tx in txs]
        counter = Counter(amounts)
        
        # Get amounts repeated more than once
        repeated = {amt: count for amt, count in counter.items() if count > 1}
        top_10 = sorted(repeated.items(), key=lambda x: x[1], reverse=True)[:10]
        
        total_repeated_txs = sum(count for amt, count in counter.items() if count > 1)
        pct_repeated = (total_repeated_txs / len(txs)) * 100 if txs else 0.0

        most_frequent_amount = top_10[0][0] if top_10 else 0.0
        frequency = top_10[0][1] if top_10 else 0

        severity = "High" if pct_repeated >= 40.0 else ("Medium" if pct_repeated >= 20.0 else "Low")
        desc = (f"{pct_repeated:.1f}% of transactions have repeated amounts. Most frequent: "
                f"₹{most_frequent_amount:,.2f} repeated {frequency} times."
                if top_10 else "No repeated transaction amounts found.")

        # Find related transactions
        related_ids = [tx["tx_id"] for tx in txs if tx["amount"] in repeated]

        return {
            "name": self.name,
            "category": self.category,
            "value": {
                "count": total_repeated_txs,
                "top_repeated": [float(item[0]) for item in top_10],
                "most_frequent_amount": float(most_frequent_amount),
                "repeated_amounts": {float(k): v for k, v in repeated.items()}
            },
            "severity": severity,
            "description": desc,
            "confidence": 0.95,
            "related_transactions": related_ids,
            "metadata": {
                "most_frequent_amount": float(most_frequent_amount),
                "frequency": frequency,
                "repeated_amount_percentage": pct_repeated,
                "top_10_repeated_values": [{"amount": float(k), "count": v} for k, v in top_10],
                "transaction_ids": related_ids,
                "explanation": desc,
                "percentage_repeated": pct_repeated,
                "total_repeated_count": total_repeated_txs
            }
        }

class RoundAmountMetric(BaseMetric):
    name = "Round Amount %"
    category = "Amount Metrics"
    description = "Calculates the percentage of transactions that are exact round values (e.g. 1000, 5000, 10000, 25000, 50000, 100000, 1000000)."
    severity = "Low"

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
                "metadata": {
                    "percentage": 0.0,
                    "histogram": {},
                    "top_round_values": [],
                    "average_round_amount": 0.0,
                    "suspicion_level": "Low",
                    "overall_round_percentage": 0.0
                }
            }

        total_count = len(txs)
        round_targets = [1000.0, 5000.0, 10000.0, 25000.0, 50000.0, 100000.0, 1000000.0]
        exact_matches = [tx for tx in txs if float(tx["amount"]) in round_targets]
        percentage = (len(exact_matches) / total_count) * 100

        histogram = {}
        related_ids = []
        for val in round_targets:
            matches = [tx for tx in txs if float(tx["amount"]) == val]
            histogram[str(int(val))] = len(matches)
            if len(matches) > 0:
                related_ids.extend([tx["tx_id"] for tx in matches])

        top_round = sorted(histogram.items(), key=lambda x: x[1], reverse=True)
        top_round_list = [{"value": float(k), "count": v} for k, v in top_round if v > 0]
        
        average_round_amount = sum(tx["amount"] for tx in exact_matches) / len(exact_matches) if exact_matches else 0.0
        suspicion_level = "High" if percentage >= 30.0 else ("Medium" if percentage >= 15.0 else "Low")
        
        overall_pct = percentage
        desc = f"{percentage:.1f}% of transaction amounts are exact round figures."
        if top_round_list:
            top_desc = ", ".join([f"₹{item['value']:,.0f} ({item['count']} times)" for item in top_round_list[:3]])
            desc += f" Top round values: {top_desc}."

        return {
            "name": self.name,
            "category": self.category,
            "value": round(percentage, 2),
            "severity": suspicion_level,
            "description": desc,
            "confidence": 1.0,
            "related_transactions": list(set(related_ids)),
            "metadata": {
                "percentage": percentage,
                "histogram": histogram,
                "top_round_values": top_round_list,
                "average_round_amount": average_round_amount,
                "suspicion_level": suspicion_level,
                "overall_round_percentage": overall_pct,
                "round_amount_count": len(exact_matches)
            }
        }

class FirstTransactionEqualsLastTransactionMetric(BaseMetric):
    name = "First Transaction Equals Last Transaction"
    category = "Amount Metrics"
    description = "Compares the amount of the first transaction in the statement with the last transaction."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        if not txs or len(txs) < 2:
            return {
                "name": self.name,
                "category": self.category,
                "value": {"difference": 0.0, "percentage_deviation": 0.0, "match_confidence": 0.0},
                "severity": "Low",
                "description": "Insufficient transactions.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        txs_sorted = sorted(txs, key=lambda x: x["date"])
        first_tx = txs_sorted[0]
        last_tx = txs_sorted[-1]

        first_amt = first_tx["amount"]
        last_amt = last_tx["amount"]

        diff = abs(first_amt - last_amt)
        deviation = (diff / first_amt) * 100 if first_amt > 0 else 0.0
        
        match_confidence = 1.0 if diff == 0 else max(0.0, 1.0 - (diff / max(first_amt, last_amt)))

        severity = "Medium" if diff == 0 and len(txs) > 10 else "Low"
        desc = (f"First transaction amount (₹{first_amt:,.2f}) and last transaction amount (₹{last_amt:,.2f}) "
                f"match exactly." if diff == 0 else f"First and last transaction amounts deviate by {deviation:.1f}%.")

        return {
            "name": self.name,
            "category": self.category,
            "value": {
                "difference": diff,
                "percentage_deviation": round(deviation, 2),
                "match_confidence": round(match_confidence, 2)
            },
            "severity": severity,
            "description": desc,
            "confidence": 1.0,
            "related_transactions": [first_tx["tx_id"], last_tx["tx_id"]],
            "metadata": {
                "first_amount": first_amt,
                "last_amount": last_amt,
                "matched": diff == 0
            }
        }

class FIFOScoreMetric(BaseMetric):
    name = "FIFO Score"
    category = "Amount Metrics"
    description = "Measures how closely the outgoing funds match the First In, First Out order of incoming funds (0 to 100)."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        txs = sorted(txs, key=lambda x: x["date"])
        
        credits_queue = []
        matched_sequences = []
        delays = []
        total_debit_volume = 0.0
        
        for tx in txs:
            if not tx["is_debit"]:
                credits_queue.append({
                    "tx_id": tx["tx_id"],
                    "amount": tx["amount"],
                    "date": tx["date"],
                    "remaining": tx["amount"]
                })
            else:
                d_amt = tx["amount"]
                d_date = tx["date"]
                total_debit_volume += d_amt
                
                for c in credits_queue:
                    if c["remaining"] <= 0:
                        continue
                    if c["date"] > d_date:
                        continue
                    
                    matched = min(c["remaining"], d_amt)
                    c["remaining"] -= matched
                    d_amt -= matched
                    
                    delay = (d_date - c["date"]).total_seconds()
                    delays.append((delay, matched))
                    matched_sequences.append({
                        "credit_id": c["tx_id"],
                        "debit_id": tx["tx_id"],
                        "amount": matched,
                        "holding_time": delay
                    })
                    
                    if d_amt <= 0:
                        break
                        
        total_matched_volume = sum(w for _, w in delays)
        volume_matched_within_24h = sum(matched for delay, matched in delays if delay <= 86400)
        fifo_score = (volume_matched_within_24h / total_debit_volume) * 100 if total_debit_volume > 0 else 0.0
        
        unmatched_credits = [c for c in credits_queue if c["remaining"] > 0]
        queue_depth = len(unmatched_credits)
        oldest_remaining_funds = unmatched_credits[0]["date"].isoformat() + "Z" if unmatched_credits else "None"
        
        average_delay = sum(d * w for d, w in delays) / total_matched_volume if total_matched_volume > 0 else 0.0
        
        severity = "High" if fifo_score >= 70.0 and total_debit_volume >= 50000 else ("Medium" if fifo_score >= 40.0 else "Low")
        desc = f"FIFO score of {fifo_score:.1f}/100 indicates {'strong' if fifo_score >= 70 else 'moderate' if fifo_score >= 40 else 'weak'} adherence to chronological outflow."

        return {
            "name": self.name,
            "category": self.category,
            "value": round(fifo_score, 2),
            "severity": severity,
            "description": desc,
            "confidence": 0.9,
            "related_transactions": [seq["debit_id"] for seq in matched_sequences if seq["holding_time"] <= 86400],
            "metadata": {
                "matched_sequences": matched_sequences,
                "average_holding_time": average_delay,
                "queue_depth": queue_depth,
                "oldest_remaining_funds": oldest_remaining_funds,
                "average_delay": average_delay,
                "risk_severity": severity,
                "explanation": desc,
                "matched_chains_count": len(matched_sequences)
            }
        }

class LIFOScoreMetric(BaseMetric):
    name = "LIFO Score"
    category = "Amount Metrics"
    description = "Measures how closely the outgoing funds match the Last In, First Out order of incoming funds (0 to 100)."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        txs = get_external_transactions(transactions)
        txs = sorted(txs, key=lambda x: x["date"])
        
        credits_list = []
        matched_transactions = []
        delays = []
        total_debit_volume = 0.0
        
        for tx in txs:
            if not tx["is_debit"]:
                credits_list.append({
                    "tx_id": tx["tx_id"],
                    "amount": tx["amount"],
                    "date": tx["date"],
                    "remaining": tx["amount"]
                })
            else:
                d_amt = tx["amount"]
                d_date = tx["date"]
                total_debit_volume += d_amt
                
                for c in reversed(credits_list):
                    if c["remaining"] <= 0:
                        continue
                    if c["date"] > d_date:
                        continue
                    
                    matched = min(c["remaining"], d_amt)
                    c["remaining"] -= matched
                    d_amt -= matched
                    
                    delay = (d_date - c["date"]).total_seconds()
                    delays.append((delay, matched))
                    matched_transactions.append({
                        "credit_id": c["tx_id"],
                        "debit_id": tx["tx_id"],
                        "amount": matched,
                        "holding_time": delay
                    })
                    
                    if d_amt <= 0:
                        break
                        
        volume_matched_within_24h = sum(matched for delay, matched in delays if delay <= 86400)
        lifo_score = (volume_matched_within_24h / total_debit_volume) * 100 if total_debit_volume > 0 else 0.0
        
        severity = "High" if lifo_score >= 70.0 and total_debit_volume >= 50000 else ("Medium" if lifo_score >= 40.0 else "Low")
        desc = f"LIFO score of {lifo_score:.1f}/100 indicates {'strong' if lifo_score >= 70 else 'moderate' if lifo_score >= 40 else 'weak'} adherence to reverse-chronological outflow."

        return {
            "name": self.name,
            "category": self.category,
            "value": round(lifo_score, 2),
            "severity": severity,
            "description": desc,
            "confidence": 0.9,
            "related_transactions": [seq["debit_id"] for seq in matched_transactions if seq["holding_time"] <= 86400],
            "metadata": {
                "matched_transactions": matched_transactions,
                "confidence": 90.0,
                "explanation": desc
            }
        }

class SplitAmountRatioMetric(BaseMetric):
    name = "Split Amount Ratio"
    category = "Amount Metrics"
    description = "Detects single incoming credits split into multiple outgoing debits within a short time window."
    severity = "Medium"

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
                "metadata": {
                    "split_count": 0,
                    "largest_split": 0.0,
                    "average_split": 0.0,
                    "split_ratio": 0.0,
                    "total_distributed": 0.0,
                    "remaining_balance": 0.0,
                    "explanation": "No external transactions found."
                }
            }

        txs = sorted(txs, key=lambda x: x["date"])
        splits = []
        related_ids = set()

        for i, credit in enumerate(txs):
            if credit["is_debit"]:
                continue
            
            c_amt = credit["amount"]
            c_time = credit["date"]
            limit_time = c_time + timedelta(hours=24)
            
            debits = []
            total_debits = 0.0
            
            for j in range(i + 1, len(txs)):
                other = txs[j]
                if other["date"] > limit_time:
                    break
                if not other["is_debit"]:
                    continue
                
                debits.append(other)
                total_debits += other["amount"]
                if total_debits >= 1.1 * c_amt:
                    break
            
            if len(debits) >= 3 and 0.9 * c_amt <= total_debits <= 1.1 * c_amt:
                split_amts = [d["amount"] for d in debits]
                splits.append({
                    "credit_id": credit["tx_id"],
                    "credit_amount": c_amt,
                    "split_count": len(debits),
                    "average_split": sum(split_amts) / len(debits),
                    "largest_split": max(split_amts),
                    "split_ratio": total_debits / c_amt,
                    "total_distributed": total_debits,
                    "remaining_balance": max(0.0, c_amt - total_debits),
                    "debit_ids": [d["tx_id"] for d in debits]
                })
                related_ids.add(credit["tx_id"])
                related_ids.update([d["tx_id"] for d in debits])

        if not splits:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0.0,
                "severity": "Low",
                "description": "No credit splits detected.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {
                    "split_count": 0,
                    "largest_split": 0.0,
                    "average_split": 0.0,
                    "split_ratio": 0.0,
                    "total_distributed": 0.0,
                    "remaining_balance": 0.0,
                    "explanation": "No credit splits detected."
                }
            }

        largest_split_instance = max(splits, key=lambda x: x["credit_amount"])
        
        split_count = largest_split_instance["split_count"]
        largest_split = largest_split_instance["largest_split"]
        average_split = largest_split_instance["average_split"]
        split_ratio = largest_split_instance["split_ratio"]
        total_distributed = largest_split_instance["total_distributed"]
        remaining_balance = largest_split_instance["remaining_balance"]
        
        severity = "High" if len(splits) >= 3 else "Medium"
        desc = f"Detected {len(splits)} instances of credit split behavior. Largest credit ₹{largest_split_instance['credit_amount']:,.2f} split into {split_count} debits."

        return {
            "name": self.name,
            "category": self.category,
            "value": round(split_ratio, 2),
            "severity": severity,
            "description": desc,
            "confidence": 0.95,
            "related_transactions": list(related_ids),
            "metadata": {
                "split_count": split_count,
                "largest_split": largest_split,
                "average_split": average_split,
                "split_ratio": split_ratio,
                "total_distributed": total_distributed,
                "remaining_balance": remaining_balance,
                "explanation": desc,
                "detected_splits": splits
            }
        }

class MergeRatioMetric(BaseMetric):
    name = "Merge Ratio"
    category = "Amount Metrics"
    description = "Detects multiple incoming credits merged into a single outgoing debit within a short time window."
    severity = "Medium"

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
                "metadata": {
                    "merge_count": 0,
                    "largest_merge": 0.0,
                    "average_merge": 0.0,
                    "merge_ratio": 0.0,
                    "explanation": "No external transactions found."
                }
            }

        txs = sorted(txs, key=lambda x: x["date"])
        merges = []
        related_ids = set()

        for i, debit in enumerate(txs):
            if not debit["is_debit"]:
                continue
            
            d_amt = debit["amount"]
            d_time = debit["date"]
            start_time = d_time - timedelta(hours=24)
            
            credits = []
            total_credits = 0.0
            
            for j in range(i - 1, -1, -1):
                other = txs[j]
                if other["date"] < start_time:
                    break
                if other["is_debit"]:
                    continue
                
                credits.append(other)
                total_credits += other["amount"]
                if total_credits >= 1.1 * d_amt:
                    break

            if len(credits) >= 3 and 0.9 * d_amt <= total_credits <= 1.1 * d_amt:
                credit_amts = [c["amount"] for c in credits]
                merges.append({
                    "debit_id": debit["tx_id"],
                    "debit_amount": d_amt,
                    "merge_count": len(credits),
                    "average_merge": sum(credit_amts) / len(credits),
                    "largest_merge": max(credit_amts),
                    "merge_ratio": total_credits / d_amt,
                    "credit_ids": [c["tx_id"] for c in credits]
                })
                related_ids.add(debit["tx_id"])
                related_ids.update([c["tx_id"] for c in credits])

        if not merges:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0.0,
                "severity": "Low",
                "description": "No debit merges detected.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {
                    "merge_count": 0,
                    "largest_merge": 0.0,
                    "average_merge": 0.0,
                    "merge_ratio": 0.0,
                    "explanation": "No debit merges detected."
                }
            }

        largest_merge_instance = max(merges, key=lambda x: x["debit_amount"])
        
        merge_count = largest_merge_instance["merge_count"]
        largest_merge = largest_merge_instance["largest_merge"]
        average_merge = largest_merge_instance["average_merge"]
        merge_ratio = largest_merge_instance["merge_ratio"]
        
        severity = "High" if len(merges) >= 3 else "Medium"
        desc = f"Detected {len(merges)} instances of funds consolidation. Largest debit ₹{largest_merge_instance['debit_amount']:,.2f} merged from {merge_count} credits."

        return {
            "name": self.name,
            "category": self.category,
            "value": round(merge_ratio, 2),
            "severity": severity,
            "description": desc,
            "confidence": 0.95,
            "related_transactions": list(related_ids),
            "metadata": {
                "merge_count": merge_count,
                "largest_merge": largest_merge,
                "average_merge": average_merge,
                "merge_ratio": merge_ratio,
                "explanation": desc,
                "detected_merges": merges
            }
        }

class LargeToSmallCompressionMetric(BaseMetric):
    name = "Large-to-Small Compression"
    category = "Amount Metrics"
    description = "Measures the portion of large credits structured or compressed into small debits (below KYC/reporting limit)."
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
                "metadata": {
                    "compression_ratio": 0.0,
                    "average_compression": 0.0,
                    "largest_compression": 0.0,
                    "examples": [],
                    "explanation": "No external transactions found."
                }
            }

        txs = sorted(txs, key=lambda x: x["date"])
        compressions = []
        related_ids = set()

        for i, credit in enumerate(txs):
            if credit["is_debit"] or credit["amount"] < 100000.0:
                continue
            
            c_amt = credit["amount"]
            c_time = credit["date"]
            limit_time = c_time + timedelta(hours=48)
            
            small_debits = []
            total_small_debits = 0.0
            
            for j in range(i + 1, len(txs)):
                other = txs[j]
                if other["date"] > limit_time:
                    break
                if not other["is_debit"] or other["amount"] > 50000.0:
                    continue
                
                small_debits.append(other)
                total_small_debits += other["amount"]
                if total_small_debits >= 1.1 * c_amt:
                    break
            
            if len(small_debits) >= 3 and total_small_debits >= 0.7 * c_amt:
                ratio = (total_small_debits / c_amt) * 100
                compressions.append({
                    "credit_id": credit["tx_id"],
                    "credit_amount": c_amt,
                    "debit_count": len(small_debits),
                    "total_small_debits": total_small_debits,
                    "ratio": ratio,
                    "debit_ids": [d["tx_id"] for d in small_debits]
                })
                related_ids.add(credit["tx_id"])
                related_ids.update([d["tx_id"] for d in small_debits])

        if not compressions:
            large_credits = [t for t in txs if not t["is_debit"] and t["amount"] >= 100000.0]
            small_debits_all = [t for t in txs if t["is_debit"] and t["amount"] <= 50000.0]
            total_large = sum(c["amount"] for c in large_credits)
            total_small = sum(d["amount"] for d in small_debits_all)
            ratio = (total_small / total_large) * 100 if total_large > 0 else 0.0
            ratio = min(100.0, ratio)
            
            return {
                "name": self.name,
                "category": self.category,
                "value": round(ratio, 2),
                "severity": "Low",
                "description": f"Large-to-small compression is {ratio:.1f}%.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {
                    "compression_ratio": ratio,
                    "average_compression": ratio,
                    "largest_compression": ratio,
                    "examples": [],
                    "explanation": "No sequential compression patterns detected."
                }
            }

        avg_ratio = sum(c["ratio"] for c in compressions) / len(compressions)
        max_ratio = max(c["ratio"] for c in compressions)
        
        examples = []
        for c in sorted(compressions, key=lambda x: x["credit_amount"], reverse=True)[:3]:
            examples.append(f"₹{c['credit_amount']:,.2f} credit split into {c['debit_count']} small debits")

        severity = "High" if avg_ratio >= 60.0 and len(compressions) >= 2 else "Medium"
        desc = f"Large-to-small compression ratio is {avg_ratio:.1f}%. Inflows are structured into multiple small debits."

        return {
            "name": self.name,
            "category": self.category,
            "value": round(avg_ratio, 2),
            "severity": severity,
            "description": desc,
            "confidence": 0.95,
            "related_transactions": list(related_ids),
            "metadata": {
                "compression_ratio": avg_ratio,
                "average_compression": avg_ratio,
                "largest_compression": max_ratio,
                "examples": examples,
                "explanation": desc
            }
        }
