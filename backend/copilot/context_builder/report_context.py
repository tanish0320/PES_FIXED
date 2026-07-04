from typing import Dict, Any

class ReportContext:
    """
    Builds context related to the investigation report, timeline milestones,
    and detected behavioral patterns.
    """

    @staticmethod
    def build(tool_results: Dict[str, Any]) -> str:
        report_summary = tool_results.get("report_summary") or ""
        patterns = tool_results.get("patterns") or []
        timeline = tool_results.get("timeline") or []

        context = []

        # Executive Summary
        if report_summary:
            context.append("### Executive Investigation Summary")
            context.append(report_summary.strip())
            context.append("")

        # Suspicious Patterns (Max 5)
        if patterns:
            context.append("### Detected Suspicious Patterns")
            for p in patterns[:5]:
                context.append(f"- Pattern: {p.get('name', 'N/A')} (Severity: {p.get('severity', 'MEDIUM')})")
                context.append(f"  Description: {p.get('description', '')}")
                if p.get('risk_contribution'):
                    context.append(f"  Risk Contribution: {p.get('risk_contribution')}")
            if len(patterns) > 5:
                context.append(f"- ... [and {len(patterns) - 5} other patterns]")
            context.append("")

        # Timeline (Max 10)
        if timeline:
            context.append("### Chronological Milestones")
            sorted_timeline = sorted(timeline, key=lambda x: (x.get("date", ""), x.get("time", "")))
            for evt in sorted_timeline[:10]:
                flag = " [FLAGGED]" if evt.get("risk_flag") else ""
                context.append(f"- {evt.get('date')} {evt.get('time', '')} | {evt.get('event')}: {evt.get('description')}{flag}")
            if len(sorted_timeline) > 10:
                context.append(f"- ... [and {len(sorted_timeline) - 10} other timeline milestones]")
            context.append("")

        return "\n".join(context)
