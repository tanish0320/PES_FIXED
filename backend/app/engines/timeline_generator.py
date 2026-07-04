from typing import List, Dict, Any, Set
from datetime import datetime, timezone, timedelta
import re

class TimelineGenerator:
    @staticmethod
    def format_inr(number: float) -> str:
        """Format a number into Indian Rupee style format (e.g. ₹20,00,000)."""
        try:
            val_int = int(number)
            s = str(val_int)
            if len(s) <= 3:
                return f"\u20b9{s}"
            last_three = s[-3:]
            other_parts = s[:-3]
            groups = []
            while other_parts:
                groups.append(other_parts[-2:])
                other_parts = other_parts[:-2]
            groups.reverse()
            formatted = ",".join(groups) + "," + last_three
            return f"\u20b9{formatted}"
        except Exception:
            return f"\u20b9{number:,.2f}"

    @classmethod
    def extract_entities_from_desc(cls, desc: str, entities_dict: Dict[str, Any] = None) -> List[str]:
        found = []
        upi_matches = re.findall(r'([\w\-.]+@[\w\-.]+)', desc)
        if upi_matches:
            found.extend(upi_matches)
        
        ifsc_matches = re.findall(r'\b([A-Z]{4}0[A-Z0-9]{6})\b', desc.upper())
        if ifsc_matches:
            found.extend(ifsc_matches)
            
        acc_matches = re.findall(r'\b(\d{9,18})\b', desc)
        if acc_matches:
            found.extend(acc_matches)
            
        if entities_dict:
            for cat in ["names", "merchants", "banks"]:
                for ent in entities_dict.get(cat, []):
                    val = ent.get("value")
                    if val and val.lower() in desc.lower():
                        found.append(val)
        return list(set(found))

    @classmethod
    def generate(
        cls,
        transactions: List[Dict[str, Any]],
        patterns: List[Dict[str, Any]],
        entities: Dict[str, Any],
        graph: Dict[str, Any],
        case_risk_score: float
    ) -> Dict[str, Any]:
        """
        Generate a complete Investigation Timeline payload with 5 timelines and analytics.
        """
        if not transactions:
            return {
                "case_timeline": [],
                "suspicious_timeline": [],
                "money_trail_timeline": [],
                "risk_escalation_timeline": [],
                "entity_timeline": [],
                "analytics": {
                    "heatmap": {"hours": [0]*24, "days": [0]*7},
                    "most_active_hour": "N/A",
                    "most_suspicious_hour": "N/A",
                    "most_suspicious_day": "N/A",
                    "longest_burst": "N/A",
                    "largest_money_movement": "N/A",
                    "narrative": "No transactional details available."
                }
            }

        # Sort transactions chronologically
        sorted_txs = sorted(transactions, key=lambda x: x["date"])
        
        # Build mapping of transaction trigger for each pattern
        trigger_map = {}
        pattern_weights = {
            "Rapid Money Movement": 20,
            "Circular Money Flow": 30,
            "Layering": 15,
            "High Transaction Velocity": 10,
            "Transaction Velocity": 10,
            "Dormant Account Activation": 15,
            "Immediate Balance Depletion": 15,
            "Immediate Balance Drain": 15,
            "Repeated Round Amounts": 5,
            "Repeated Amounts": 10,
            "Pattern Density": 10,
            "Structuring": 10,
            "Fan Out": 15,
            "Fan-Out": 15,
            "Fan In": 15,
            "Fan-In": 15,
            "Layering / Structuring": 15
        }

        for pat in patterns:
            name = pat.get("name")
            related = pat.get("related_transactions", [])
            if not related:
                continue
            
            related_txs = [t for t in sorted_txs if t["tx_id"] in related]
            if related_txs:
                latest_tx = max(related_txs, key=lambda x: x["date"])
                trigger_map.setdefault(latest_tx["tx_id"], []).append(pat)

        seen_counterparties = set()
        seen_nodes = set()
        triggered_patterns_set = set()
        running_risk_score = 0.0
        
        all_events = []
        prev_date = None
        
        for tx in sorted_txs:
            tx_id = tx["tx_id"]
            dt = tx["date"]
            timestamp = tx.get("timestamp") or dt.isoformat() + "Z"
            time_str = dt.strftime("%H:%M")
            date_str = dt.strftime("%Y-%m-%d")
            amount = tx["amount"]
            is_debit = tx.get("is_debit", True)
            channel = tx.get("channel", "OTHER")
            desc = tx.get("description", "")
            
            event_entities = cls.extract_entities_from_desc(desc, entities)
            
            sender = tx.get("sender_account", "external")
            receiver = tx.get("receiver_account", "external")
            money_trail = [sender, receiver] if sender != "external" and receiver != "external" else []
            
            # Risk Increase calculations
            risk_increase = 0
            triggered_here = []
            if tx_id in trigger_map:
                for pat in trigger_map[tx_id]:
                    pname = pat["name"]
                    if pname not in triggered_patterns_set:
                        triggered_patterns_set.add(pname)
                        weight = pattern_weights.get(pname, 10)
                        risk_increase += weight
                        triggered_here.append(pname)
            
            running_risk_score = min(100.0, running_risk_score + risk_increase)
            
            # 1. Dormancy Check
            if prev_date:
                gap = dt - prev_date
                if gap >= timedelta(days=30):
                    dormancy_days = gap.days
                    dormancy_desc = f"Account reactivation event after {dormancy_days} days of dormancy."
                    all_events.append({
                        "timestamp": timestamp,
                        "date": date_str,
                        "time": time_str,
                        "event_type": "Dormancy",
                        "description": dormancy_desc,
                        "risk_increase": 15,
                        "entities": [],
                        "transactions": [tx_id],
                        "money_trail": [],
                        "amount": amount,
                        "is_debit": is_debit,
                        "risk_flag": True
                    })
            prev_date = dt
            
            # 2. Beneficiary Added
            if is_debit and receiver != "external" and receiver not in seen_counterparties:
                seen_counterparties.add(receiver)
                all_events.append({
                    "timestamp": timestamp,
                    "date": date_str,
                    "time": time_str,
                    "event_type": "Beneficiary Added",
                    "description": f"New outward beneficiary account {receiver} transacted with for the first time.",
                    "risk_increase": 0,
                    "entities": [receiver],
                    "transactions": [tx_id],
                    "money_trail": money_trail,
                    "amount": amount,
                    "is_debit": is_debit,
                    "risk_flag": False
                })
                
            # 3. Graph Branch Created
            new_branch_nodes = []
            if sender != "external" and sender not in seen_nodes:
                seen_nodes.add(sender)
                new_branch_nodes.append(sender)
            if receiver != "external" and receiver not in seen_nodes:
                seen_nodes.add(receiver)
                new_branch_nodes.append(receiver)
                
            if new_branch_nodes:
                all_events.append({
                    "timestamp": timestamp,
                    "date": date_str,
                    "time": time_str,
                    "event_type": "Graph Branch Created",
                    "description": f"New connection branch created on money flow graph linking {', '.join(new_branch_nodes)}.",
                    "risk_increase": 0,
                    "entities": new_branch_nodes,
                    "transactions": [tx_id],
                    "money_trail": money_trail,
                    "amount": amount,
                    "is_debit": is_debit,
                    "risk_flag": False
                })

            # 4. Large Credit / Large Debit
            if amount >= 50000:
                if not is_debit:
                    all_events.append({
                        "timestamp": timestamp,
                        "date": date_str,
                        "time": time_str,
                        "event_type": "Large Credit",
                        "description": f"Large credit inflow of {cls.format_inr(amount)} via {channel} from {sender}.",
                        "risk_increase": 0,
                        "entities": event_entities,
                        "transactions": [tx_id],
                        "money_trail": money_trail,
                        "amount": amount,
                        "is_debit": is_debit,
                        "risk_flag": False
                    })
                else:
                    all_events.append({
                        "timestamp": timestamp,
                        "date": date_str,
                        "time": time_str,
                        "event_type": "Large Debit",
                        "description": f"Large debit outflow of {cls.format_inr(amount)} via {channel} to {receiver}.",
                        "risk_increase": 0,
                        "entities": event_entities,
                        "transactions": [tx_id],
                        "money_trail": money_trail,
                        "amount": amount,
                        "is_debit": is_debit,
                        "risk_flag": False
                    })

            # 5. Failed Transactions
            status_upper = str(tx.get("status", "")).upper()
            desc_upper = desc.upper()
            if status_upper == "FAILED" or "FAILED" in desc_upper or "DECLINED" in desc_upper or "BOUNCED" in desc_upper:
                all_events.append({
                    "timestamp": timestamp,
                    "date": date_str,
                    "time": time_str,
                    "event_type": "Failed Transactions",
                    "description": f"Failed/Declined {channel} transaction of {cls.format_inr(amount)}. Narration: '{desc}'.",
                    "risk_increase": 2,
                    "entities": event_entities,
                    "transactions": [tx_id],
                    "money_trail": money_trail,
                    "amount": amount,
                    "is_debit": is_debit,
                    "risk_flag": True
                })

            # 6. Pattern Triggers
            for pname in triggered_here:
                pat_desc = "Suspicious pattern behavior triggered."
                for p in patterns:
                    if p["name"] == pname:
                        pat_desc = p.get("description", pat_desc)
                        break
                
                event_type = pname
                if "Rapid" in pname:
                    event_type = "Rapid Movement"
                elif "Circular" in pname:
                    event_type = "Circular Flow"
                elif "Layering" in pname:
                    event_type = "Layering"
                elif "Fan-Out" in pname or "Fan Out" in pname:
                    event_type = "Fan-Out"
                elif "Merge" in pname or "Split" in pname:
                    event_type = "Merge"
                elif "Velocity" in pname or "Burst" in pname:
                    event_type = "Burst"
                
                valid_types = [
                    "Large Credit", "Large Debit", "Layering", "Fan-Out", "Merge", 
                    "Circular Flow", "Burst", "Dormancy", "Failed Transactions", 
                    "Rapid Movement", "Beneficiary Added", "Graph Branch Created"
                ]
                if event_type not in valid_types:
                    event_type = "Layering" if "layer" in pname.lower() else "Burst"

                pat_txs = []
                for p in patterns:
                    if p["name"] == pname:
                        pat_txs = p.get("related_transactions", [])
                        break
                if not pat_txs:
                    pat_txs = [tx_id]

                all_events.append({
                    "timestamp": timestamp,
                    "date": date_str,
                    "time": time_str,
                    "event_type": event_type,
                    "description": f"Triggered {pname}: {pat_desc}",
                    "risk_increase": pattern_weights.get(pname, 10),
                    "entities": event_entities,
                    "transactions": pat_txs,
                    "money_trail": money_trail,
                    "amount": amount,
                    "is_debit": is_debit,
                    "risk_flag": True
                })

            # Fallback event to ensure every transaction has a mapping
            tx_id_events = [e for e in all_events if tx_id in e["transactions"]]
            if not tx_id_events:
                formatted_amt = cls.format_inr(amount)
                if not is_debit:
                    event_desc = f"Transaction credit of {formatted_amt} via {channel} from {sender}."
                    event_type = "Large Credit"
                else:
                    event_desc = f"Transaction debit of {formatted_amt} via {channel} to {receiver}."
                    event_type = "Large Debit"
                all_events.append({
                    "timestamp": timestamp,
                    "date": date_str,
                    "time": time_str,
                    "event_type": event_type,
                    "description": event_desc,
                    "risk_increase": 0,
                    "entities": event_entities,
                    "transactions": [tx_id],
                    "money_trail": money_trail,
                    "amount": amount,
                    "is_debit": is_debit,
                    "risk_flag": False
                })

        # 3. Compute Analytics
        heatmap_hour = [0] * 24
        heatmap_dow = [0] * 7
        suspicious_hour = [0] * 24
        date_counts = {}
        date_suspicious_counts = {}
        longest_burst_count = 0
        longest_burst_duration_m = 0
        
        for i, tx in enumerate(sorted_txs):
            dt = tx["date"]
            heatmap_hour[dt.hour] += 1
            heatmap_dow[dt.weekday()] += 1
            
            is_suspicious = tx["tx_id"] in trigger_map or tx.get("risk_score", 0) >= 60
            if is_suspicious:
                suspicious_hour[dt.hour] += 1
                
            date_str = dt.strftime("%Y-%m-%d")
            date_counts[date_str] = date_counts.get(date_str, 0) + 1
            if is_suspicious:
                date_suspicious_counts[date_str] = date_suspicious_counts.get(date_str, 0) + 1
                
            # Burst Window scanning (30 mins)
            window_txs = [t for t in sorted_txs[i:] if t["date"] - dt <= timedelta(minutes=30)]
            if len(window_txs) > longest_burst_count:
                longest_burst_count = len(window_txs)
                if len(window_txs) > 1:
                    longest_burst_duration_m = int((window_txs[-1]["date"] - window_txs[0]["date"]).total_seconds() / 60)
                else:
                    longest_burst_duration_m = 1

        # Calculate peak hours factually
        most_active_hour_val = heatmap_hour.index(max(heatmap_hour)) if max(heatmap_hour) > 0 else 10
        most_active_hour = f"{most_active_hour_val:02d}:00 - {(most_active_hour_val+1)%24:02d}:00"
        
        most_suspicious_hour_val = suspicious_hour.index(max(suspicious_hour)) if max(suspicious_hour) > 0 else 11
        most_suspicious_hour = f"{most_suspicious_hour_val:02d}:00 - {(most_suspicious_hour_val+1)%24:02d}:00"
        
        if date_suspicious_counts:
            most_suspicious_day_raw = max(date_suspicious_counts, key=date_suspicious_counts.get)
            try:
                most_suspicious_day = datetime.strptime(most_suspicious_day_raw, "%Y-%m-%d").strftime("%d %B %Y")
            except Exception:
                most_suspicious_day = most_suspicious_day_raw
        else:
            most_suspicious_day = sorted_txs[0]["date"].strftime("%d %B %Y") if sorted_txs else "N/A"
            
        longest_burst = f"{longest_burst_count} transactions in {longest_burst_duration_m} minutes" if longest_burst_count >= 3 else "No significant burst"
        
        if sorted_txs:
            largest_tx = max(sorted_txs, key=lambda x: x["amount"])
            largest_money_movement = f"{cls.format_inr(largest_tx['amount'])} ({'Debit' if largest_tx['is_debit'] else 'Credit'}) via {largest_tx.get('channel', 'OTHER')}"
        else:
            largest_money_movement = "N/A"

        # Generate Evolution Narrative
        dormant_events = [e for e in all_events if e["event_type"] == "Dormancy"]
        pattern_events = [e for e in all_events if e["risk_flag"] and e["event_type"] not in ["Failed Transactions", "Dormancy"]]
        
        narrative_parts = []
        if dormant_events:
            narrative_parts.append("The account was reactivated after a dormancy period.")
        else:
            narrative_parts.append("The account initiated transaction activity with a baseline credit flow.")
            
        if pattern_events:
            pnames = list(set([e["description"].split(":")[0].replace("Triggered ", "") for e in pattern_events]))
            narrative_parts.append(f"Risk levels escalated rapidly as the account triggered {', '.join(pnames[:3])} patterns.")
        
        narrative_parts.append(f"A total volume of {cls.format_inr(sum(t['amount'] for t in sorted_txs))} was processed across {len(sorted_txs)} transactions, resulting in a risk score of {int(case_risk_score)}/100.")
        evolution_narrative = " ".join(narrative_parts)

        # Build output collections
        case_timeline = all_events
        suspicious_timeline = [e for e in all_events if e["risk_flag"] or e["event_type"] in ["Failed Transactions", "Dormancy", "Layering", "Circular Flow", "Rapid Movement"]]
        money_trail_timeline = [e for e in all_events if len(e.get("money_trail", [])) > 0 or e["event_type"] in ["Layering", "Circular Flow", "Merge", "Fan-Out", "Graph Branch Created"]]
        risk_escalation_timeline = [e for e in all_events if e["risk_increase"] > 0]
        entity_timeline = [e for e in all_events if len(e.get("entities", [])) > 0]

        return {
            "case_timeline": case_timeline,
            "suspicious_timeline": suspicious_timeline,
            "money_trail_timeline": money_trail_timeline,
            "risk_escalation_timeline": risk_escalation_timeline,
            "entity_timeline": entity_timeline,
            "analytics": {
                "heatmap_hours": heatmap_hour,
                "heatmap_days": heatmap_dow,
                "most_active_hour": most_active_hour,
                "most_suspicious_hour": most_suspicious_hour,
                "most_suspicious_day": most_suspicious_day,
                "longest_burst": longest_burst,
                "largest_money_movement": largest_money_movement,
                "narrative": evolution_narrative
            }
        }
