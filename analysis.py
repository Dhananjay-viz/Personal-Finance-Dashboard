import pandas as pd
import numpy as np

def analyze_data(df):

    income = df[df["Type"] == "Income"]["Amount"].sum()

    expenses = df[df["Type"] == "Expense"]["Amount"].sum()

    savings = income - expenses

    print("\n===== FINANCIAL SUMMARY =====")

    print("Total Income: ₹", income)
    print("Total Expenses: ₹", expenses)
    print("Total Savings: ₹", savings)

    print("\n===== CATEGORY-WISE EXPENSES =====")

    category_expenses = df[df["Type"] == "Expense"].groupby("Category")["Amount"].sum()

    print(category_expenses)

    print("\n===== AVERAGE EXPENSE =====")

    average = np.mean(df[df["Type"] == "Expense"]["Amount"])

    print("Average Expense: ₹", round(average, 2))