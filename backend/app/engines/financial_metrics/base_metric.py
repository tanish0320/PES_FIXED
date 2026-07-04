from typing import Dict, Any, List

class BaseMetric:
    name: str = ""
    category: str = ""
    description: str = ""
    severity: str = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute the metric. Must be overridden by subclasses.
        Returns:
            {
                "name": str,
                "category": str,
                "value": any,
                "severity": str,
                "description": str,
                "confidence": float,
                "related_transactions": List[str],
                "metadata": Dict[str, Any]
            }
        """
        raise NotImplementedError("Subclasses must implement compute")
