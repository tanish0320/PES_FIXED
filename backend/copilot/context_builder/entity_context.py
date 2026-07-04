from typing import Dict, Any

class EntityContext:
    """
    Builds context related to identified names, merchants, UPI handles, and counterparties.
    """

    @staticmethod
    def build(tool_results: Dict[str, Any]) -> str:
        entities = tool_results.get("entities") or []
        top_beneficiaries = tool_results.get("top_beneficiaries") or []

        context = []

        # 1. Extracted Entities
        if entities:
            context.append("### Identified Entities")
            if isinstance(entities, list):
                for ent in entities[:15]:
                    name = ent.get("value") or ent.get("name") or "Unknown"
                    etype = ent.get("type") or "Counterparty"
                    ctx = ent.get("context") or "Extracted from transactions"
                    context.append(f"- {name} ({etype}) - {ctx}")
            elif isinstance(entities, dict):
                for etype, items in entities.items():
                    context.append(f"- {etype.replace('_', ' ').title()}:")
                    for itm in items[:5]:
                        if isinstance(itm, dict):
                            context.append(f"  * {itm.get('value')} (Confidence: {itm.get('confidence', '100')})")
                        else:
                            context.append(f"  * {itm}")
            context.append("")

        # 2. Top Beneficiaries
        if top_beneficiaries:
            context.append("### Primary Flow Beneficiaries")
            for ben in top_beneficiaries[:5]:
                context.append(f"- {ben.get('account_id')}: Inflow volume ₹{ben.get('total_inflow', 0):,}, {ben.get('tx_count', 0)} transactions")
            context.append("")

        return "\n".join(context)
