# Explanations and metadata for all forensic financial metrics
from typing import Dict, Any, List

METRIC_METADATA = {
    "rapid_money_movement": {
        "weight": 20,
        "why_it_matters": "This behaviour is commonly associated with mule accounts and layering activities.",
        "how_calculated": "Tracks credits exceeding threshold and finds subsequent debits within the specified hour window that consume at least 80% of the credit."
    },
    "transaction_velocity": {
        "weight": 10,
        "why_it_matters": "High velocity patterns indicate automated scripts, high-frequency laundering, or rapid funds routing.",
        "how_calculated": "Computes the average frequency of transactions per hour, day, and week, flagging peak activity periods."
    },
    "burst_activity": {
        "weight": 10,
        "why_it_matters": "Bursts of transaction volume denote automated laundering attempts or rapid fund sweeps.",
        "how_calculated": "Uses a rolling 24-hour window to find the peak count of transactions occurring in succession."
    },
    "dormant_activation": {
        "weight": 15,
        "why_it_matters": "Sudden high-volume activation of dormant accounts is a signature mule account pattern.",
        "how_calculated": "Identifies gaps of 30+ days between transactions followed by a sudden spike in volume or count within 7 days."
    },
    "immediate_balance_drain": {
        "weight": 15,
        "why_it_matters": "Mule accounts typically retain close to 0% of incoming funds, draining them immediately to exit nodes.",
        "how_calculated": "Measures the portion of all incoming funds that are transferred out within 24 hours of receipt."
    },
    "repeated_amount_detector": {
        "weight": 10,
        "why_it_matters": "Structured transfers often rely on identical repeat amounts to match downstream targets.",
        "how_calculated": "Identifies transactions with identical amounts occurring multiple times, counting the repetitions."
    },
    "round_amount_percent": {
        "weight": 5,
        "why_it_matters": "Illicit shell/mule transfers frequently use rounded figures (e.g., 50k, 1L) to simplify routing.",
        "how_calculated": "Calculates the percentage of transaction count and volume matching exact round-figure limits."
    },
    "first_transaction_equals_last_transaction": {
        "weight": 5,
        "why_it_matters": "Circular fund tests often return the identical initial test deposit back to its source.",
        "how_calculated": "Compares the amount of the first transaction in the statement with the last transaction."
    },
    "fifo_score": {
        "weight": 10,
        "why_it_matters": "High FIFO behaviour often indicates systematic pass-through transit routing where funds are cleared in chronological arrival order.",
        "how_calculated": "Simulates chronological matching of incoming credits to outgoing debits to determine the alignment percentage."
    },
    "lifo_score": {
        "weight": 5,
        "why_it_matters": "LIFO matching can indicate stack-based layering where the most recent inflows are cleared first.",
        "how_calculated": "Simulates reverse-chronological matching of incoming credits to outgoing debits to calculate the LIFO percentage."
    },
    "split_amount_ratio": {
        "weight": 15,
        "why_it_matters": "Split ratios highlight classic structuring and distribution schemes where one credit goes to many debits.",
        "how_calculated": "Compares the size of a single credit with the group of outgoing debits that immediately follow."
    },
    "merge_ratio": {
        "weight": 10,
        "why_it_matters": "Fund consolidation (many credits merging to one debit) is a typical precursor to bulk external transfer or cash withdrawal.",
        "how_calculated": "Compares the size of a single debit with the group of incoming credits that preceded it."
    },
    "large_to_small_compression": {
        "weight": 10,
        "why_it_matters": "High compression indexes signify structured layering to many low-tier beneficiaries.",
        "how_calculated": "Calculates the ratio of the average credit transaction amount to the average debit transaction amount."
    },
    "unique_beneficiaries": {
        "weight": 10,
        "why_it_matters": "High beneficiary counts point to fan-out layering where money is distributed to escape detection.",
        "how_calculated": "Counts the number of distinct counterparty accounts receiving funds from the primary account."
    },
    "unique_senders": {
        "weight": 10,
        "why_it_matters": "Many senders to one recipient indicate fan-in or consolidation networks.",
        "how_calculated": "Counts the number of distinct counterparty accounts sending funds to the primary account."
    },
    "credit_count": {
        "weight": 5,
        "why_it_matters": "Reflects incoming velocity and baseline account utilization.",
        "how_calculated": "Counts the total number of incoming transactions (credits) in the statement."
    },
    "debit_count": {
        "weight": 5,
        "why_it_matters": "Reflects outgoing velocity and baseline account utilization.",
        "how_calculated": "Counts the total number of outgoing transactions (debits) in the statement."
    },
    "credit_volume": {
        "weight": 10,
        "why_it_matters": "Establishes the absolute financial scale of incoming money laundering flows.",
        "how_calculated": "Sums all credit transaction amounts in the normalized statement."
    },
    "debit_volume": {
        "weight": 10,
        "why_it_matters": "Establishes the absolute financial scale of outgoing money laundering flows.",
        "how_calculated": "Sums all debit transaction amounts in the normalized statement."
    },
    "net_flow": {
        "weight": 5,
        "why_it_matters": "A net flow close to zero is standard for transit/mule accounts.",
        "how_calculated": "Subtracts total outgoing debit volume from total incoming credit volume."
    },
    "average_credit": {
        "weight": 5,
        "why_it_matters": "Determines normal credit baselines for structuring checks.",
        "how_calculated": "Divides total incoming credit volume by the total credit count."
    },
    "average_debit": {
        "weight": 5,
        "why_it_matters": "Establishes average outflow scale to detect abnormal transactions.",
        "how_calculated": "Divides total outgoing debit volume by the total debit count."
    },
    "maximum_credit": {
        "weight": 10,
        "why_it_matters": "Highlights peak inflows that trigger reporting thresholds.",
        "how_calculated": "Finds the maximum amount among all credit transactions."
    },
    "maximum_debit": {
        "weight": 10,
        "why_it_matters": "Identifies primary destination accounts receiving largest shares.",
        "how_calculated": "Finds the maximum amount among all debit transactions."
    },
    "average_holding_time": {
        "weight": 15,
        "why_it_matters": "Very short average holding times are typical of layering/mule accounts.",
        "how_calculated": "Performs a FIFO simulation of incoming deposits to outgoing withdrawals to compute average holding time."
    },
    "balance_retention_percent": {
        "weight": 15,
        "why_it_matters": "Low retention rates indicate pass-through transit behavior.",
        "how_calculated": "Calculates the final statement balance as a percentage of the total credit volume."
    },
    "beneficiary_concentration_index": {
        "weight": 10,
        "why_it_matters": "High concentration indexes indicate focused transfers to key destinations.",
        "how_calculated": "Computes the Herfindahl-Hirschman Index (HHI) of outflows across unique beneficiaries."
    },
    "maximum_layer_depth": {
        "weight": 15,
        "why_it_matters": "High depth values indicate advanced layering and complex transit routes.",
        "how_calculated": "Calculates the maximum path distance from the primary account node to any destination in the constructed graph."
    },
    "longest_money_path": {
        "weight": 15,
        "why_it_matters": "Long sequences denote structural layering of funds across intermediaries.",
        "how_calculated": "Finds the longest sequential chain of connected transactions in the money flow network."
    },
    "largest_transaction_path": {
        "weight": 10,
        "why_it_matters": "Highlights the main pipeline of money flow carrying the highest volume.",
        "how_calculated": "Computes path volumes using edge weights in the transaction network to find the highest-volume route."
    },
    "most_connected_account": {
        "weight": 10,
        "why_it_matters": "Denotes key central nodes (hubs) in layering networks.",
        "how_calculated": "Finds the account node in the graph with the highest degree centrality."
    },
    "highest_degree": {
        "weight": 10,
        "why_it_matters": "Points to high centrality hub nodes that route funds for multiple sources.",
        "how_calculated": "Finds the maximum number of incoming/outgoing transaction edges on any node in the graph."
    },
    "highest_betweenness": {
        "weight": 10,
        "why_it_matters": "Highlights critical bridge nodes that control transit paths between clusters.",
        "how_calculated": "Computes betweenness centrality for all nodes in the transaction graph."
    },
    "largest_cycle": {
        "weight": 15,
        "why_it_matters": "Circular flow cycles are definitive evidence of round-tripping and routing feedback loop layering.",
        "how_calculated": "Performs cycle detection on the graph to find the largest closed loop of transactions."
    },
    "graph_density": {
        "weight": 5,
        "why_it_matters": "Highly dense graphs denote close-knit transaction clusters (laundering syndicates).",
        "how_calculated": "Calculates the ratio of actual transaction edges to the total possible edges in the graph."
    },
    "average_degree": {
        "weight": 5,
        "why_it_matters": "Reflects overall network interconnectivity.",
        "how_calculated": "Divides the total number of edges by the total number of nodes in the graph."
    },
    "critical_bridge_node": {
        "weight": 10,
        "why_it_matters": "Highlights critical choke points in the flow of funds.",
        "how_calculated": "Performs node cut detection in the graph to find nodes whose removal disconnects the graph."
    },
    "money_concentration_percent": {
        "weight": 10,
        "why_it_matters": "Denotes focused routing to ultimate beneficiary exits.",
        "how_calculated": "Sums the outflow volume of the top 3 exit accounts as a percentage of total outflows."
    },
    "pattern_count": {
        "weight": 10,
        "why_it_matters": "More detected patterns indicate structured and systematic money laundering.",
        "how_calculated": "Counts the total number of suspicious behavioral patterns detected by the engine."
    },
    "pattern_diversity": {
        "weight": 10,
        "why_it_matters": "Higher diversity points to multi-layered evasion strategies.",
        "how_calculated": "Counts the unique pattern names triggered in the analysis."
    },
    "pattern_density": {
        "weight": 10,
        "why_it_matters": "High pattern density indicates systematically tainted transaction histories.",
        "how_calculated": "Calculates the percentage of transactions that are involved in any detected pattern."
    },
    "patterns_per_100_transactions": {
        "weight": 5,
        "why_it_matters": "Normalizes risk markers across statement lengths.",
        "how_calculated": "Normalizes pattern count per 100 transactions analyzed."
    },
    "entity_count": {
        "weight": 5,
        "why_it_matters": "Tracks counterparty diversity and forensic footprint.",
        "how_calculated": "Sums the number of unique names, UPI IDs, merchants, and banks extracted from statement narrations."
    },
    "account_count": {
        "weight": 5,
        "why_it_matters": "Reflects size of recipient network.",
        "how_calculated": "Counts distinct account nodes in the graph."
    },
    "merchant_count": {
        "weight": 5,
        "why_it_matters": "Indicates commercial layering and cash-out points.",
        "how_calculated": "Counts unique merchant nodes in the graph."
    },
    "upi_count": {
        "weight": 5,
        "why_it_matters": "Indicates digital transit endpoints.",
        "how_calculated": "Counts unique UPI IDs extracted from transaction descriptions."
    },
    "bank_count": {
        "weight": 5,
        "why_it_matters": "Reflects inter-bank routing breadth.",
        "how_calculated": "Counts unique bank and IFSC code entities extracted from transaction descriptions."
    },
    "investigation_confidence": {
        "weight": 10,
        "why_it_matters": "Provides quality SLA on the source statement ingestion.",
        "how_calculated": "Calculates the overall confidence score of the investigation based on parser statistics."
    },
    "evidence_count": {
        "weight": 5,
        "why_it_matters": "A higher volume of flagged evidence yields stronger prosecution cases.",
        "how_calculated": "Counts the total number of transactions flagged as evidence in any pattern."
    },
    "suspicious_transaction_percent": {
        "weight": 10,
        "why_it_matters": "Establishes degree of account taint.",
        "how_calculated": "Percentage of transactions flagged as highly suspicious."
    },
    "average_daily_volume": {
        "weight": 5,
        "why_it_matters": "Establishes base volume processed daily.",
        "how_calculated": "Mean transaction volume processed daily."
    },
    "highest_risk_entity": {
        "weight": 10,
        "why_it_matters": "Identifies top candidate for freezing action.",
        "how_calculated": "The entity node assigned the highest individual risk score."
    },
    "highest_risk_day": {
        "weight": 10,
        "why_it_matters": "Highlights peak campaign activity period.",
        "how_calculated": "The calendar date with the highest volume of suspicious transactions."
    },
    "highest_risk_transaction": {
        "weight": 10,
        "why_it_matters": "The core evidentiary transaction link.",
        "how_calculated": "The transaction with the highest computed risk score."
    },
    "failed_transaction_metrics": {
        "weight": 10,
        "why_it_matters": "Multiple consecutive failures indicate carding trial activity or blocked exit routes.",
        "how_calculated": "Examines transaction failures and retries, highlighting carding or structuring trial activity."
    },
    "suspicious_transaction_window": {
        "weight": 15,
        "why_it_matters": "Determines chronological duration of suspicious transfers to assess campaign lifecycles.",
        "how_calculated": "Computes time span between the first suspicious credit and the final suspicious debit."
    },
    "pass_through_ratio": {
        "weight": 15,
        "why_it_matters": "Mule transit indicator comparing absolute inflow to outflow volume.",
        "how_calculated": "Ratio of outgoing fund volume to incoming fund volume over the audit window."
    },
    "dormant_account_reactivation": {
        "weight": 15,
        "why_it_matters": "Sudden high-volume activation of dormant accounts is a standard shell/mule account indicator.",
        "how_calculated": "Identifies inactive periods of >= 30 days followed by large credit inputs and rapid outflows."
    },
    "rapid_success_after_failure": {
        "weight": 10,
        "why_it_matters": "Frequent declined requests followed by a successful transfer indicate automated sweep attempts.",
        "how_calculated": "Tracks failed transaction loops succeeded by a successful transfer within 15 minutes."
    },
    "same_amount_retry_score": {
        "weight": 10,
        "why_it_matters": "Syndicates frequently retry exact payment amounts to discover card limits or transaction boundaries.",
        "how_calculated": "Tracks consecutive failed transactions for the exact same amount followed by success."
    },
    "transaction_burst_score": {
        "weight": 10,
        "why_it_matters": "High-frequency transaction bursts indicate automated script execution.",
        "how_calculated": "Calculates peak transaction frequencies in rolling 5, 10, 30, and 60-minute blocks."
    },
    "night_activity_score": {
        "weight": 5,
        "why_it_matters": "Off-hours operations (8 PM to 6 AM) suggest script-driven movements or remote access routing.",
        "how_calculated": "Percentage of transactions executed during night hours."
    },
    "weekend_activity_score": {
        "weight": 5,
        "why_it_matters": "Weekend transactions differ from standard retail or commercial banking schedules.",
        "how_calculated": "Percentage of transactions occurring on Saturday and Sunday."
    },
    "incoming_source_diversity": {
        "weight": 8,
        "why_it_matters": "Consolidation (many-to-one) signature showing collection accounts.",
        "how_calculated": "Ratio of unique senders to unique outgoing destinations."
    },
    "destination_fan_out": {
        "weight": 10,
        "why_it_matters": "Dispersal (one-to-many) signature designed to layer money downstream.",
        "how_calculated": "Checks credits >= 50k split into >= 4 debits to separate destinations within 24h."
    },
    "account_reuse_score": {
        "weight": 15,
        "why_it_matters": "Shows a recurring mule node active across multiple investigations.",
        "how_calculated": "Compares node account IDs against other cases stored in the workstation memory."
    }
}
