# Configuration thresholds for Financial Metrics Framework

# Time window in hours to detect rapid money movement (incoming -> outgoing)
RAPID_TRANSFER_WINDOW = 24.0

# Value list for round amount check
ROUND_VALUES = [1000.0, 5000.0, 10000.0, 50000.0, 100000.0]

# Limit above which transactions are considered "large" or subject to structuring/reporting thresholds
STRUCTURING_LIMIT = 50000.0

# Time window in hours for FIFO/LIFO matching logic
FIFO_WINDOW = 24.0

# Number of days of inactivity to classify as dormancy
DORMANCY_DAYS = 30

# Maximum number of transactions per day before flagging as high velocity
HIGH_VELOCITY_LIMIT = 10

# Limit above which transfers are flagged as large
LARGE_TRANSFER_LIMIT = 200000.0
