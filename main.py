import pandas as pd

from analysis import analyze_data
from charts import show_charts

print("================================")
print("   PERSONAL FINANCE DASHBOARD")
print("================================")

# Load dataset
df = pd.read_csv("data.csv")

# Display first 5 records
print("\n===== TRANSACTION DATA =====")
print(df.head())

# Financial analysis
analyze_data(df)

# Display charts
show_charts(df)

print("\nProject Completed Successfully!")