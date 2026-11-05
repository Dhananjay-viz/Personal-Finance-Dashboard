import matplotlib.pyplot as plt

def show_charts(df):

    expenses = df[df["Type"] == "Expense"]

    # Pie Chart
    category = expenses.groupby("Category")["Amount"].sum()

    plt.figure(figsize=(8, 6))
    plt.pie(
        category,
        labels=category.index,
        autopct="%1.1f%%"
    )

    plt.title("Category-wise Expenses")

    plt.savefig(
        "category_expenses.png",
        dpi=150,
        bbox_inches="tight"
    )

    plt.close()

    # Bar Chart
    income = df[df["Type"] == "Income"]["Amount"].sum()
    total_expenses = expenses["Amount"].sum()

    plt.figure(figsize=(7, 5))

    plt.bar(
        ["Income", "Expenses"],
        [income, total_expenses]
    )

    plt.title("Income vs Expenses")
    plt.ylabel("Amount (₹)")

    plt.savefig(
        "income_vs_expenses.png",
        dpi=150,
        bbox_inches="tight"
    )

    plt.close()

    print("\nGraphs saved successfully!")