
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import sqlite3
import csv
import os
import pandas as pd
import numpy as np
from datetime import date, datetime

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "finance.db")
CSV_PATH = os.path.join(BASE_DIR, "data.csv")


# Uploaded finance reports
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
ALLOWED_EXTENSIONS = {"csv", "xlsx"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
# Connect to database
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# Create database table
def initialize_database():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            description TEXT,
            category TEXT,
            type TEXT,
            amount REAL,
            payment_method TEXT
        )
    """)

    count = conn.execute(
        "SELECT COUNT(*) FROM transactions"
    ).fetchone()[0]

    # Import CSV records only when database is empty
    if count == 0 and os.path.exists(CSV_PATH):
        with open(CSV_PATH, "r", encoding="utf-8-sig") as file:
            reader = csv.DictReader(file)

            for row in reader:
                conn.execute("""
                    INSERT INTO transactions
                    (date, description, category, type,
                     amount, payment_method)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    row["Date"],
                    row["Description"],
                    row["Category"],
                    row["Type"],
                    float(row["Amount"]),
                    row["Payment_Method"]
                ))

    conn.commit()
    conn.close()


# Home page
@app.route("/")
def home():
    return render_template("index.html")


# Get dashboard summary
@app.route("/api/dashboard")
def dashboard():
    conn = get_db()

    income = conn.execute("""
        SELECT COALESCE(SUM(amount), 0)
        FROM transactions WHERE type = 'Income'
    """).fetchone()[0]

    expenses = conn.execute("""
        SELECT COALESCE(SUM(amount), 0)
        FROM transactions WHERE type = 'Expense'
    """).fetchone()[0]

    conn.close()

    return jsonify({
        "income": income,
        "expenses": expenses,
        "savings": income - expenses
    })


# Get all transactions
@app.route("/api/transactions")
def get_transactions():
    conn = get_db()

    rows = conn.execute("""
        SELECT * FROM transactions ORDER BY date DESC, id DESC
    """).fetchall()

    conn.close()

    return jsonify([dict(row) for row in rows])


# Add transaction
@app.route("/api/transactions", methods=["POST"])
def add_transaction():
    data = request.get_json(silent=True) or {}

    required = [
        "date", "description", "category",
        "type", "amount", "payment_method"
    ]

    if any(not data.get(key) for key in required):
        return jsonify({"error": "Please fill all fields"}), 400

    if data["type"] not in ["Income", "Expense"]:
        return jsonify({"error": "Invalid transaction type"}), 400

    try:
        amount = float(data["amount"])
        if amount <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Enter a valid positive amount"}), 400

    conn = get_db()

    conn.execute("""
        INSERT INTO transactions
        (date, description, category, type, amount, payment_method)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        data["date"],
        data["description"],
        data["category"],
        data["type"],
        amount,
        data["payment_method"]
    ))

    conn.commit()
    conn.close()

    return jsonify({"message": "Transaction added successfully!"}), 201


# Delete transaction
@app.route("/api/transactions/<int:transaction_id>",
           methods=["DELETE"])
def delete_transaction(transaction_id):
    conn = get_db()

    cursor = conn.execute(
        "DELETE FROM transactions WHERE id = ?",
        (transaction_id,)
    )

    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "Transaction not found"}), 404

    return jsonify({"message": "Transaction deleted successfully!"})

@app.route("/api/transactions/<int:id>", methods=["PUT"])
def update_transaction(id):
    data = request.get_json()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE transactions
        SET date=?, description=?, category=?,
            type=?, amount=?, payment_method=?
        WHERE id=?
    """, (
        data["date"],
        data["description"],
        data["category"],
        data["type"],
        data["amount"],
        data["payment_method"],
        id
    ))

    conn.commit()
    updated = cursor.rowcount
    conn.close()

    if updated:
        return jsonify({"message": "Transaction updated successfully"})

    return jsonify({"error": "Transaction not found"}), 404

# Create budget database table
def initialize_budget_table():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month TEXT NOT NULL,
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            UNIQUE(month, category)
        )
    """)

    conn.commit()
    conn.close()




# Get all budgets
@app.route("/api/budgets", methods=["GET"])
def get_budgets():
    month = request.args.get("month")

    conn = get_db()

    if month:
        rows = conn.execute(
            "SELECT * FROM budgets WHERE month=? ORDER BY category",
            (month,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM budgets ORDER BY month DESC, category"
        ).fetchall()

    conn.close()

    return jsonify([dict(row) for row in rows])


# Add or update a budget
@app.route("/api/budgets", methods=["POST"])
def save_budget():
    data = request.get_json(silent=True) or {}

    month = data.get("month", "")
    category = data.get("category", "").strip()

    try:
        amount = float(data.get("amount", 0))
        if amount <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Enter a valid positive budget"}), 400

    if not month or not category:
        return jsonify({"error": "Month and category are required"}), 400

    conn = get_db()

    conn.execute("""
        INSERT INTO budgets (month, category, amount)
        VALUES (?, ?, ?)
        ON CONFLICT(month, category)
        DO UPDATE SET amount=excluded.amount
    """, (month, category, amount))

    conn.commit()
    conn.close()

    return jsonify({"message": "Budget saved successfully"})


# Delete a budget
@app.route("/api/budgets/<int:budget_id>", methods=["DELETE"])
def delete_budget(budget_id):
    conn = get_db()

    cursor = conn.execute(
        "DELETE FROM budgets WHERE id=?",
        (budget_id,)
    )

    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "Budget not found"}), 404

    return jsonify({"message": "Budget deleted successfully"})


# ------------------------------------------
# FINANCE REPORT FILE UPLOAD AND ANALYSIS
# ------------------------------------------

def allowed_file(filename):
    return (
        "." in filename and
        filename.rsplit(".", 1)[1].lower()
        in ALLOWED_EXTENSIONS
    )


@app.route("/api/upload-report", methods=["POST"])
def upload_report():

    if "file" not in request.files:
        return jsonify({"error": "Please select a file"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({
            "error": "Only CSV and XLSX files are allowed"
        }), 400

    filename = secure_filename(file.filename)

    if not filename:
        return jsonify({"error": "Invalid filename"}), 400

    file_path = os.path.join(UPLOAD_FOLDER, filename)

    # Avoid overwriting an existing uploaded file
    if os.path.exists(file_path):
        name, extension = os.path.splitext(filename)
        filename = f"{name}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}{extension}"
        file_path = os.path.join(UPLOAD_FOLDER, filename)

    try:
        file.save(file_path)

        # Read uploaded report
        if filename.lower().endswith(".csv"):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path, engine="openpyxl")

        # Clean column names
        df.columns = [
            str(column).strip() for column in df.columns
        ]

        # Basic report information
        result = {
            "success": True,
            "filename": filename,
            "rows": int(len(df)),
            "columns": list(df.columns),
            "preview": df.head(10).replace(
                {np.nan: None}
            ).to_dict(orient="records")
        }

        return jsonify(result)

    except Exception as error:
        if os.path.exists(file_path):
            os.remove(file_path)

        return jsonify({
            "error": f"Unable to read report: {str(error)}"
        }), 400



# Complete dashboard analytics API
@app.route("/api/analytics")
def get_analytics():
    month = request.args.get("month", date.today().strftime("%Y-%m"))

    try:
        datetime.strptime(month, "%Y-%m")
    except ValueError:
        return jsonify({"error": "Invalid month format. Use YYYY-MM"}), 400

    conn = get_db()

    # Selected month income and expenses
    totals = conn.execute("""
        SELECT
            COALESCE(SUM(CASE WHEN type='Income' THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN type='Expense' THEN amount ELSE 0 END), 0)
        FROM transactions
        WHERE strftime('%Y-%m', date) = ?
    """, (month,)).fetchone()

    income = float(totals[0])
    expenses = float(totals[1])
    savings = income - expenses

    # Expense breakdown
    categories = conn.execute("""
        SELECT category, SUM(amount) AS total
        FROM transactions
        WHERE type='Expense'
        AND strftime('%Y-%m', date)=?
        GROUP BY category
        ORDER BY total DESC
    """, (month,)).fetchall()

    breakdown = [
        {
            "category": row["category"],
            "amount": float(row["total"]),
            "percentage": round(
                float(row["total"]) / expenses * 100, 2
            ) if expenses else 0
        }
        for row in categories
    ]

    # Last six months overview
    overview = conn.execute("""
        SELECT
            strftime('%Y-%m', date) AS month,
            SUM(CASE WHEN type='Income' THEN amount ELSE 0 END) AS income,
            SUM(CASE WHEN type='Expense' THEN amount ELSE 0 END) AS expenses
        FROM transactions
        WHERE date >= date('now', 'start of month', '-5 months')
        GROUP BY strftime('%Y-%m', date)
        ORDER BY month
    """).fetchall()

    monthly_data = {
        row["month"]: {
            "income": float(row["income"] or 0),
            "expenses": float(row["expenses"] or 0)
        }
        for row in overview
    }

    six_months = []
    today = date.today()

    for offset in range(5, -1, -1):
        year = today.year
        month_number = today.month - offset

        while month_number <= 0:
            month_number += 12
            year -= 1

        month_key = f"{year}-{month_number:02d}"
        values = monthly_data.get(
            month_key, {"income": 0, "expenses": 0}
        )

        six_months.append({
            "month": month_key,
            "income": values["income"],
            "expenses": values["expenses"]
        })

    # Latest five transactions
    recent = conn.execute("""
        SELECT * FROM transactions
        ORDER BY date DESC, id DESC
        LIMIT 5
    """).fetchall()

    # Monthly budget progress
    budgets = conn.execute("""
        SELECT
            b.id,
            b.category,
            b.amount AS budget,
            COALESCE(SUM(t.amount), 0) AS spent
        FROM budgets b
        LEFT JOIN transactions t
            ON t.category = b.category
            AND t.type = 'Expense'
            AND strftime('%Y-%m', t.date) = b.month
        WHERE b.month = ?
        GROUP BY b.id
        ORDER BY b.category
    """, (month,)).fetchall()

    budget_data = [
        {
            "id": row["id"],
            "category": row["category"],
            "budget": float(row["budget"]),
            "spent": float(row["spent"]),
            "remaining": float(row["budget"]) - float(row["spent"]),
            "percentage": round(
                float(row["spent"]) / float(row["budget"]) * 100, 2
            ) if row["budget"] else 0
        }
        for row in budgets
    ]

    conn.close()

    # Financial health score based on savings rate
    health_score = round(
        max(0, min(100, savings / income * 100)), 1
    ) if income > 0 else 0

    if income == 0:
        health_status = "No income data"
    elif health_score >= 30:
        health_status = "Excellent"
    elif health_score >= 20:
        health_status = "Good"
    elif health_score >= 10:
        health_status = "Fair"
    elif health_score > 0:
        health_status = "Needs Improvement"
    else:
        health_status = "Critical"

    return jsonify({
        "month": month,
        "income": income,
        "expenses": expenses,
        "savings": savings,
        "financial_health": {
            "score": health_score,
            "status": health_status
        },
        "monthly_overview": six_months,
        "expense_breakdown": breakdown,
        "recent_transactions": [dict(row) for row in recent],
        "budgets": budget_data
    })


# Initialize database when application starts
initialize_budget_table()
initialize_database()

# Start application
if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )
