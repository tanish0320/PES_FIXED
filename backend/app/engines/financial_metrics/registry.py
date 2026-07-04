from app.engines.financial_metrics.transaction_metrics import (
    RapidMoneyMovementMetric,
    TransactionVelocityMetric,
    BurstActivityMetric,
    DormantActivationMetric,
    ImmediateBalanceDrainMetric
)
from app.engines.financial_metrics.investigation_centric_metrics import (
    SuspiciousTransactionWindowMetric,
    PassThroughRatioMetric,
    DormantAccountReactivationMetric,
    RapidSuccessAfterFailureMetric,
    SameAmountRetryScoreMetric,
    TransactionBurstScoreMetric,
    NightActivityScoreMetric,
    WeekendActivityScoreMetric,
    IncomingSourceDiversityMetric,
    DestinationFanOutMetric,
    AccountReuseScoreMetric
)
from app.engines.financial_metrics.amount_metrics import (
    RepeatedAmountDetectorMetric,
    RoundAmountMetric,
    FirstTransactionEqualsLastTransactionMetric,
    FIFOScoreMetric,
    LIFOScoreMetric,
    SplitAmountRatioMetric,
    MergeRatioMetric,
    LargeToSmallCompressionMetric
)
from app.engines.financial_metrics.account_metrics import (
    UniqueBeneficiariesMetric,
    UniqueSendersMetric,
    CreditCountMetric,
    DebitCountMetric,
    CreditVolumeMetric,
    DebitVolumeMetric,
    NetFlowMetric,
    AverageCreditMetric,
    AverageDebitMetric,
    MaximumCreditMetric,
    MaximumDebitMetric,
    AverageHoldingTimeMetric,
    BalanceRetentionPercentMetric,
    BeneficiaryConcentrationIndexMetric
)
from app.engines.financial_metrics.graph_metrics import (
    MaximumLayerDepthMetric,
    LongestMoneyPathMetric,
    LargestTransactionPathMetric,
    MostConnectedAccountMetric,
    HighestDegreeMetric,
    HighestBetweennessMetric,
    LargestCycleMetric,
    GraphDensityMetric,
    AverageDegreeMetric,
    CriticalBridgeNodeMetric,
    MoneyConcentrationPercentMetric
)
from app.engines.financial_metrics.investigation_metrics import (
    PatternCountMetric,
    PatternDiversityMetric,
    PatternDensityMetric,
    PatternsPer100TransactionsMetric,
    EntityCountMetric,
    AccountCountMetric,
    MerchantCountMetric,
    UPICountMetric,
    BankCountMetric,
    InvestigationConfidenceMetric,
    EvidenceCountMetric,
    SuspiciousTransactionPercentMetric,
    AverageDailyVolumeMetric,
    HighestRiskEntityMetric,
    HighestRiskDayMetric,
    HighestRiskTransactionMetric,
    FailedTransactionMetricsMetric
)

ALL_METRICS = [
    # Category 1: Transaction Behaviour
    RapidMoneyMovementMetric(),
    TransactionVelocityMetric(),
    BurstActivityMetric(),
    DormantActivationMetric(),
    ImmediateBalanceDrainMetric(),

    # Category 2: Amount Metrics
    RepeatedAmountDetectorMetric(),
    RoundAmountMetric(),
    FirstTransactionEqualsLastTransactionMetric(),
    FIFOScoreMetric(),
    LIFOScoreMetric(),
    SplitAmountRatioMetric(),
    MergeRatioMetric(),
    LargeToSmallCompressionMetric(),

    # Category 3: Account Metrics
    UniqueBeneficiariesMetric(),
    UniqueSendersMetric(),
    CreditCountMetric(),
    DebitCountMetric(),
    CreditVolumeMetric(),
    DebitVolumeMetric(),
    NetFlowMetric(),
    AverageCreditMetric(),
    AverageDebitMetric(),
    MaximumCreditMetric(),
    MaximumDebitMetric(),
    AverageHoldingTimeMetric(),
    BalanceRetentionPercentMetric(),
    BeneficiaryConcentrationIndexMetric(),

    # Category 4: Graph Metrics
    MaximumLayerDepthMetric(),
    LongestMoneyPathMetric(),
    LargestTransactionPathMetric(),
    MostConnectedAccountMetric(),
    HighestDegreeMetric(),
    HighestBetweennessMetric(),
    LargestCycleMetric(),
    GraphDensityMetric(),
    AverageDegreeMetric(),
    CriticalBridgeNodeMetric(),
    MoneyConcentrationPercentMetric(),

    # Category 5: Investigation Metrics
    PatternCountMetric(),
    PatternDiversityMetric(),
    PatternDensityMetric(),
    PatternsPer100TransactionsMetric(),
    EntityCountMetric(),
    AccountCountMetric(),
    MerchantCountMetric(),
    UPICountMetric(),
    BankCountMetric(),
    InvestigationConfidenceMetric(),
    EvidenceCountMetric(),
    SuspiciousTransactionPercentMetric(),
    AverageDailyVolumeMetric(),
    HighestRiskEntityMetric(),
    HighestRiskDayMetric(),
    HighestRiskTransactionMetric(),
    FailedTransactionMetricsMetric(),
    SuspiciousTransactionWindowMetric(),
    PassThroughRatioMetric(),
    DormantAccountReactivationMetric(),
    RapidSuccessAfterFailureMetric(),
    SameAmountRetryScoreMetric(),
    TransactionBurstScoreMetric(),
    NightActivityScoreMetric(),
    WeekendActivityScoreMetric(),
    IncomingSourceDiversityMetric(),
    DestinationFanOutMetric(),
    AccountReuseScoreMetric()
]
