
from flask import Flask, request, jsonify, render_template
import sqlite3
import csv
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "finance.db")
CSV_PATH = os.path.join(BASE_DIR, "data.csv")


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
# Initialize database when application starts
initialize_database()

# Start application
if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )
