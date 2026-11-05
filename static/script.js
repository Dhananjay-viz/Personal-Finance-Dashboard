
let pieChart = null;
let barChart = null;
let allTransactions = [];
let editingId = null;

function formatMoney(amount) {
    return "₹" + Number(amount).toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

// Load dashboard summary
async function loadDashboard() {
    try {
        const response = await fetch("/api/dashboard");
        const data = await response.json();

        document.getElementById("income").textContent =
            formatMoney(data.income);

        document.getElementById("expenses").textContent =
            formatMoney(data.expenses);

        document.getElementById("savings").textContent =
            formatMoney(data.savings);

    } catch (error) {
        console.error("Dashboard error:", error);
    }
}

// Load transactions
async function loadTransactions() {
    try {
        const response = await fetch("/api/transactions");
        allTransactions = await response.json();
        populateMonthFilter();
        populateCategoryFilter();
        displayTransactions();
        
        createCharts();

    } catch (error) {
        console.error("Transaction error:", error);
    }
}


// Display transaction table
function displayTransactions() {
    const search = document.getElementById("search")
        .value.toLowerCase();

    const tbody = document.getElementById("transactionList");
    tbody.innerHTML = "";

    
const selectedMonth = document.getElementById("monthFilter").value;

const selectedCategory = document.getElementById("categoryFilter").value;

const filtered = allTransactions.filter(t => {
    const matchesSearch =
        String(t.description).toLowerCase().includes(search) ||
        String(t.category).toLowerCase().includes(search) ||
        String(t.type).toLowerCase().includes(search);

    const transactionMonth = t.date.substring(0, 7);

    const matchesMonth =
        selectedMonth === "" || transactionMonth === selectedMonth;

    const matchesCategory =
    selectedCategory === "" || t.category === selectedCategory;

return matchesSearch && matchesMonth && matchesCategory;
});


    filtered.forEach(t => {
        const row = document.createElement("tr");

        const values = [
            t.date,
            t.description,
            t.category,
            t.type,
            formatMoney(t.amount)
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");

        // Edit Button
        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.className = "edit-btn";
        editButton.onclick = () => editTransaction(t.id);

        // Delete Button
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-btn";
        deleteButton.onclick = () => deleteTransaction(t.id);

        actionCell.appendChild(editButton);
        actionCell.appendChild(deleteButton);

        row.appendChild(actionCell);
        tbody.appendChild(row);
    });
}


// Create charts
function createCharts() {
    const expenses = allTransactions.filter(
        t => t.type === "Expense"
    );

    const income = allTransactions
        .filter(t => t.type === "Income")
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = expenses.reduce(
        (sum, t) => sum + Number(t.amount), 0
    );

    const categories = {};

    expenses.forEach(t => {
        categories[t.category] =
            (categories[t.category] || 0) + Number(t.amount);
    });

    if (pieChart) pieChart.destroy();

    pieChart = new Chart(
        document.getElementById("pieChart"),
        {
            type: "pie",
            data: {
                labels: Object.keys(categories),
                datasets: [{
                    data: Object.values(categories)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true
            }
        }
    );

    if (barChart) barChart.destroy();

    barChart = new Chart(
        document.getElementById("barChart"),
        {
            type: "bar",
            data: {
                labels: ["Income", "Expenses"],
                datasets: [{
                    label: "Amount (₹)",
                    data: [income, totalExpenses]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        }
    );
}

// Open transaction form
function openForm() {
    document.getElementById("transactionModal")
        .style.display = "flex";

    document.getElementById("date").value =
        new Date().toISOString().split("T")[0];
}

// Close transaction form
function closeForm() {
    document.getElementById("transactionModal")
        .style.display = "none";
}


// Add or Update transaction
document.getElementById("transactionForm")
    .addEventListener("submit", async function(event) {

        event.preventDefault();

        const transaction = {
            date: document.getElementById("date").value,
            description: document.getElementById("description").value,
            category: document.getElementById("category").value,
            type: document.getElementById("type").value,
            amount: document.getElementById("amount").value,
            payment_method: document.getElementById("payment_method").value
        };

        try {
            const isEditing = editingId !== null;

            const url = isEditing
                ? `/api/transactions/${editingId}`
                : "/api/transactions";

            const response = await fetch(url, {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(transaction)
            });

            const result = await response.json();

            if (!response.ok) {
                alert(result.error || "Unable to save transaction");
                return;
            }

            alert(isEditing
                ? "Transaction updated successfully!"
                : "Transaction added successfully!");

            editingId = null;

            document.getElementById("transactionForm").reset();

            document.querySelector("#transactionForm button[type='submit']")
                .textContent = "Add Transaction";

            closeForm();

            await refreshDashboard();

        } catch (error) {
            alert("Server connection failed");
            console.error(error);
        }
});


// Delete transaction
async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) {
        return;
    }

    try {
        const response = await fetch(`/api/transactions/${id}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || "Unable to delete transaction");
            return;
        }

        alert("Transaction deleted successfully!");

        await refreshDashboard();

    } catch (error) {
        alert("Server connection failed");
    }
}

// Refresh dashboard data
async function refreshDashboard() {
    await loadDashboard();
    await loadTransactions();
}

// Start dashboard
document.addEventListener("DOMContentLoaded", refreshDashboard);

// Edit transaction
function editTransaction(id) {
    const transaction = allTransactions.find(t => t.id === id);

    if (!transaction) return;

    document.getElementById("date").value = transaction.date;
    document.getElementById("description").value = transaction.description;
    document.getElementById("category").value = transaction.category;
    document.getElementById("type").value = transaction.type;
    document.getElementById("amount").value = transaction.amount;
    document.getElementById("payment_method").value = transaction.payment_method;

    editingId = id;

    document.querySelector("#transactionForm button[type='submit']").textContent =
        "Update Transaction";

    openForm();
}

// Populate month dropdown
function populateMonthFilter() {
    const monthFilter = document.getElementById("monthFilter");

    const selectedMonth = monthFilter.value;

    const months = [...new Set(
        allTransactions.map(t => t.date.substring(0, 7))
    )].sort().reverse();

    monthFilter.innerHTML = '<option value="">All Months</option>';

    months.forEach(month => {
        const [year, monthNumber] = month.split("-");

        const date = new Date(year, monthNumber - 1);

        const option = document.createElement("option");

        option.value = month;
        option.textContent = date.toLocaleString("en-IN", {
            month: "long",
            year: "numeric"
        });

        monthFilter.appendChild(option);
    });

    monthFilter.value = selectedMonth;
}

// Populate category dropdown
function populateCategoryFilter() {
    const categoryFilter = document.getElementById("categoryFilter");

    const selectedCategory = categoryFilter.value;

    const categories = [...new Set(
        allTransactions.map(t => t.category)
    )].sort();

    categoryFilter.innerHTML =
        '<option value="">All Categories</option>';

    categories.forEach(category => {
        const option = document.createElement("option");

        option.value = category;
        option.textContent = category;

        categoryFilter.appendChild(option);
    });

    categoryFilter.value = selectedCategory;
}

// Export transactions to CSV
function exportTransactions() {
    if (allTransactions.length === 0) {
        alert("No transactions available to export!");
        return;
    }

    const headers = [
        "Date",
        "Description",
        "Category",
        "Type",
        "Amount",
        "Payment Method"
    ];

    const rows = allTransactions.map(t => [
        t.date,
        t.description,
        t.category,
        t.type,
        t.amount,
        t.payment_method
    ]);

    const csvContent = [
        headers,
        ...rows
    ].map(row =>
        row.map(value =>
            `"${String(value ?? "").replace(/"/g, '""')}"`
        ).join(",")
    ).join("\n");

    const blob = new Blob(
        ["\uFEFF" + csvContent],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "finance_transactions.csv";

    link.click();

    URL.revokeObjectURL(url);

    alert("CSV file downloaded successfully!");
}
