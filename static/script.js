
// ==========================================
// FINANCEPRO - PERSONAL FINANCE DASHBOARD
// ==========================================

let pieChart = null;
let barChart = null;
let allTransactions = [];
let editingId = null;
let currentAnalytics = null;

// ------------------------------------------
// BASIC HELPERS
// ------------------------------------------

function formatMoney(amount) {
    return "₹" + Number(amount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function getCurrentMonth() {
    const now = new Date();
    return now.getFullYear() + "-" +
        String(now.getMonth() + 1).padStart(2, "0");
}

function getSelectedMonth() {
    return document.getElementById("dashboardMonth").value ||
        getCurrentMonth();
}

function getMonthLabel(month) {
    const parts = month.split("-");
    return new Date(
        Number(parts[0]),
        Number(parts[1]) - 1
    ).toLocaleString("en-IN", {
        month: "short",
        year: "numeric"
    });
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
    }

    return data;
}

// ------------------------------------------
// LOAD DASHBOARD ANALYTICS
// ------------------------------------------

async function loadAnalytics() {
    const month = getSelectedMonth();

    try {
        const data = await apiRequest(
            `/api/analytics?month=${encodeURIComponent(month)}`
        );

        currentAnalytics = data;

        // Summary cards
        document.getElementById("income").textContent =
            formatMoney(data.income);

        document.getElementById("expenses").textContent =
            formatMoney(data.expenses);

        document.getElementById("savings").textContent =
            formatMoney(data.savings);

        // Financial health
        const health = data.financial_health || {};

        document.getElementById("healthScore").textContent =
            Number(health.score || 0) + "%";

        document.getElementById("healthStatus").textContent =
            health.status || "No data";

        document.getElementById("healthProgress").style.width =
            Math.max(0, Math.min(100, Number(health.score || 0))) + "%";

        // Reports
        document.getElementById("reportIncome").textContent =
            formatMoney(data.income);

        document.getElementById("reportExpenses").textContent =
            formatMoney(data.expenses);

        document.getElementById("reportSavings").textContent =
            formatMoney(data.savings);

        const savingsRate = data.income > 0
            ? (data.savings / data.income) * 100
            : 0;

        document.getElementById("reportSavingsRate").textContent =
            savingsRate.toFixed(1) + "%";

        // Other sections
        createCharts(data);
        displayExpenseBreakdown(data.expense_breakdown || []);
        displayRecentTransactions(data.recent_transactions || []);
        displayBudgets(data.budgets || []);

    } catch (error) {
        console.error("Analytics error:", error);
        alert("Unable to load dashboard analytics: " + error.message);
    }
}

// ------------------------------------------
// LOAD ALL TRANSACTIONS
// ------------------------------------------

async function loadTransactions() {
    try {
        allTransactions = await apiRequest("/api/transactions");

        populateMonthFilter();
        populateCategoryFilter();
        displayTransactions();

    } catch (error) {
        console.error("Transaction error:", error);
    }
}

// ------------------------------------------
// DISPLAY TRANSACTIONS
// ------------------------------------------


function displayTransactions() {
    const search = document.getElementById("search")
        .value.toLowerCase().trim();

    const selectedMonth =
        document.getElementById("monthFilter").value;

    const selectedCategory =
        document.getElementById("categoryFilter").value;

    const tbody = document.getElementById("transactionList");
    tbody.innerHTML = "";

    const filtered = allTransactions.filter(t => {
        const matchesSearch =
            String(t.description).toLowerCase().includes(search) ||
            String(t.category).toLowerCase().includes(search) ||
            String(t.type).toLowerCase().includes(search);

        const transactionMonth = String(t.date).substring(0, 7);

        const matchesMonth =
            selectedMonth === "" ||
            transactionMonth === selectedMonth;

        const matchesCategory =
            selectedCategory === "" ||
            t.category === selectedCategory;

        return matchesSearch && matchesMonth && matchesCategory;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">No transactions found.</td>
            </tr>
        `;
        return;
    }

    // Show only latest 5 matching transactions
    filtered.forEach(t => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(t.date)}</td>
            <td>${escapeHTML(t.description)}</td>
            <td>${escapeHTML(t.category)}</td>
            <td>${escapeHTML(t.type)}</td>
            <td>${formatMoney(t.amount)}</td>
            <td>
                <button class="edit-btn"
                    onclick="editTransaction(${Number(t.id)})">
                    Edit
                </button>
                <button class="delete-btn"
                    onclick="deleteTransaction(${Number(t.id)})">
                    Delete
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}


// ------------------------------------------
// POPULATE MONTH FILTER
// ------------------------------------------

function populateMonthFilter() {
    const monthFilter = document.getElementById("monthFilter");
    const selectedMonth = monthFilter.value;

    const months = [...new Set(
        allTransactions.map(t => String(t.date).substring(0, 7))
    )].sort().reverse();

    monthFilter.innerHTML =
        '<option value="">All Months</option>';

    months.forEach(month => {
        const option = document.createElement("option");
        option.value = month;
        option.textContent = getMonthLabel(month);
        monthFilter.appendChild(option);
    });

    monthFilter.value = selectedMonth;
}

// ------------------------------------------
// POPULATE CATEGORY FILTER
// ------------------------------------------

function populateCategoryFilter() {
    const categoryFilter =
        document.getElementById("categoryFilter");

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

// ------------------------------------------
// CREATE CHARTS
// ------------------------------------------

function createCharts(data) {
    if (typeof Chart === "undefined") {
        console.error("Chart.js is not loaded.");
        return;
    }

    Chart.defaults.color = "#aab5d4";
    Chart.defaults.font.family = "Arial";

    // Expense Doughnut Chart
    const breakdown = data.expense_breakdown || [];

    if (pieChart) {
        pieChart.destroy();
    }

    pieChart = new Chart(
        document.getElementById("pieChart"),
        {
            type: "doughnut",

            data: {
                labels: breakdown.map(item => item.category),

                datasets: [{
                    data: breakdown.map(item => item.amount),

                    backgroundColor: [
                        "#9565ff",
                        "#45d7f5",
                        "#35d6a0",
                        "#ff718d",
                        "#f5c46b",
                        "#6487ff",
                        "#d77bff",
                        "#ff985c"
                    ],

                    borderColor: "#151c35",
                    borderWidth: 4,
                    hoverOffset: 10
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",

                plugins: {
                    legend: {
                        display: false
                    },

                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ": " +
                                    formatMoney(context.raw);
                            }
                        }
                    }
                }
            }
        }
    );

    // Monthly Overview Chart
    const overview = data.monthly_overview || [];
    const range = Number(
        document.getElementById("overviewRange").value || 6
    );

    const visibleOverview = overview.slice(-range);

    if (barChart) {
        barChart.destroy();
    }

    barChart = new Chart(
        document.getElementById("barChart"),
        {
            type: "bar",

            data: {
                labels: visibleOverview.map(
                    item => getMonthLabel(item.month)
                ),

                datasets: [
                    {
                        label: "Income",

                        data: visibleOverview.map(
                            item => item.income
                        ),

                        backgroundColor: "rgba(69, 215, 245, 0.8)",
                        borderColor: "#45d7f5",
                        borderWidth: 2,
                        borderRadius: 7
                    },

                    {
                        label: "Expenses",

                        data: visibleOverview.map(
                            item => item.expenses
                        ),

                        backgroundColor: "rgba(149, 101, 255, 0.8)",
                        borderColor: "#9565ff",
                        borderWidth: 2,
                        borderRadius: 7
                    }
                ]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        position: "bottom"
                    },

                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ": " +
                                    formatMoney(context.raw);
                            }
                        }
                    }
                },

                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },

                    y: {
                        beginAtZero: true,

                        grid: {
                            color: "rgba(150, 165, 210, 0.10)"
                        },

                        ticks: {
                            callback: function(value) {
                                return "₹" +
                                    Number(value).toLocaleString("en-IN");
                            }
                        }
                    }
                }
            }
        }
    );
}

// ------------------------------------------
// EXPENSE BREAKDOWN LIST
// ------------------------------------------

function displayExpenseBreakdown(items) {
    const container =
        document.getElementById("expenseBreakdownList");

    container.innerHTML = "";

    if (items.length === 0) {
        container.innerHTML =
            "<p>No expense data available for this month.</p>";
        return;
    }

    items.forEach(item => {
        const row = document.createElement("div");
        row.className = "breakdown-item";

        row.innerHTML = `
            <div>
                <strong>${escapeHTML(item.category)}</strong>
                <span>${Number(item.percentage).toFixed(1)}%</span>
            </div>

            <p>${formatMoney(item.amount)}</p>
        `;

        container.appendChild(row);
    });
}

// ------------------------------------------
// RECENT TRANSACTIONS
// ------------------------------------------

function displayRecentTransactions(items) {
    const tbody =
        document.getElementById("recentTransactionList");

    tbody.innerHTML = "";

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">No recent transactions found.</td>
            </tr>
        `;
        return;
    }

    items.forEach(t => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(t.date)}</td>
            <td>${escapeHTML(t.description)}</td>
            <td>${escapeHTML(t.category)}</td>
            <td>${escapeHTML(t.type)}</td>
            <td>${formatMoney(t.amount)}</td>
        `;

        tbody.appendChild(row);
    });
}

// ------------------------------------------
// BUDGET MANAGEMENT
// ------------------------------------------

async function loadBudgets() {
    const month = getSelectedMonth();

    try {
        const budgets = await apiRequest(
            `/api/budgets?month=${encodeURIComponent(month)}`
        );

        // Analytics API includes spending calculations.
        // Refresh analytics to display budget progress.
        await loadAnalytics();

    } catch (error) {
        console.error("Budget loading error:", error);
    }
}

function displayBudgets(budgets) {
    const container = document.getElementById("budgetList");
    container.innerHTML = "";

    if (budgets.length === 0) {
        container.innerHTML =
            "<p>No budgets added for this month. Add your first budget.</p>";
        return;
    }

    budgets.forEach(item => {
        const percentage = Math.max(
            0,
            Number(item.percentage || 0)
        );

        const progress = Math.min(100, percentage);

        const remaining = Number(item.remaining || 0);

        const budgetItem = document.createElement("div");
        budgetItem.className = "budget-item";

        budgetItem.innerHTML = `
            <div class="budget-top">
                <strong>${escapeHTML(item.category)}</strong>

                <button class="delete-btn"
                    onclick="deleteBudget(${Number(item.id)})">
                    Delete
                </button>
            </div>

            <div class="budget-amounts">
                <span>Budget: ${formatMoney(item.budget)}</span>
                <span>Spent: ${formatMoney(item.spent)}</span>
            </div>

            <div class="progress-track">
                <div class="progress-fill"
                     style="width:${progress}%"></div>
            </div>

            <div class="budget-bottom">
                <span>${percentage.toFixed(1)}% used</span>
                <span>
                    ${remaining >= 0 ? "Remaining: " : "Over budget: "}
                    ${formatMoney(Math.abs(remaining))}
                </span>
            </div>
        `;

        container.appendChild(budgetItem);
    });
}

// Open budget form
function openBudgetForm() {
    document.getElementById("budgetFormPanel").style.display = "block";

    document.getElementById("budgetMonth").value =
        getSelectedMonth();

    document.getElementById("budgetFormPanel")
        .scrollIntoView({ behavior: "smooth" });
}

// Close budget form
function closeBudgetForm() {
    document.getElementById("budgetFormPanel").style.display = "none";
    document.getElementById("budgetForm").reset();
}

// Save budget
document.getElementById("budgetForm")
    .addEventListener("submit", async function(event) {

        event.preventDefault();

        const budget = {
            month: document.getElementById("budgetMonth").value,
            category: document.getElementById("budgetCategory").value.trim(),
            amount: document.getElementById("budgetAmount").value
        };

        try {
            await apiRequest("/api/budgets", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(budget)
            });

            alert("Budget saved successfully!");

            closeBudgetForm();
            await loadAnalytics();

        } catch (error) {
            alert(error.message);
        }
    });

// Delete budget
async function deleteBudget(id) {
    if (!confirm("Are you sure you want to delete this budget?")) {
        return;
    }

    try {
        await apiRequest(`/api/budgets/${id}`, {
            method: "DELETE"
        });

        alert("Budget deleted successfully!");

        await loadAnalytics();

    } catch (error) {
        alert(error.message);
    }
}

// ------------------------------------------
// ADD TRANSACTION FORM
// ------------------------------------------

function openForm() {
    document.getElementById("transactionModal")
        .style.display = "flex";

    if (!editingId) {
        document.getElementById("transactionForm").reset();

        document.getElementById("date").value =
            getCurrentDate();
    }
}

function getCurrentDate() {
    const now = new Date();

    return now.getFullYear() + "-" +
        String(now.getMonth() + 1).padStart(2, "0") + "-" +
        String(now.getDate()).padStart(2, "0");
}

function closeForm() {
    document.getElementById("transactionModal")
        .style.display = "none";
}

// ------------------------------------------
// ADD OR UPDATE TRANSACTION
// ------------------------------------------

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

            await apiRequest(url, {
                method: isEditing ? "PUT" : "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(transaction)
            });

            alert(isEditing
                ? "Transaction updated successfully!"
                : "Transaction added successfully!"
            );

            editingId = null;

            document.getElementById("transactionForm").reset();

            document.querySelector(
                "#transactionForm button[type='submit']"
            ).textContent = "Save Transaction";

            closeForm();

            await refreshDashboard();

        } catch (error) {
            alert(error.message);
        }
    });

// ------------------------------------------
// EDIT TRANSACTION
// ------------------------------------------

function editTransaction(id) {
    const transaction = allTransactions.find(
        t => Number(t.id) === Number(id)
    );

    if (!transaction) return;

    document.getElementById("date").value = transaction.date;
    document.getElementById("description").value =
        transaction.description;

    document.getElementById("category").value =
        transaction.category;

    document.getElementById("type").value = transaction.type;
    document.getElementById("amount").value = transaction.amount;

    document.getElementById("payment_method").value =
        transaction.payment_method;

    editingId = id;

    document.querySelector(
        "#transactionForm button[type='submit']"
    ).textContent = "Update Transaction";

    openForm();
}

// ------------------------------------------
// DELETE TRANSACTION
// ------------------------------------------

async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) {
        return;
    }

    try {
        await apiRequest(`/api/transactions/${id}`, {
            method: "DELETE"
        });

        alert("Transaction deleted successfully!");

        await refreshDashboard();

    } catch (error) {
        alert(error.message);
    }
}

// ------------------------------------------
// EXPORT CSV
// ------------------------------------------

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

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

// ------------------------------------------
// REFRESH DASHBOARD
// ------------------------------------------

async function refreshDashboard() {
    await Promise.all([
        loadTransactions(),
        loadAnalytics()
    ]);
}

// ------------------------------------------
// START APPLICATION
// ------------------------------------------

document.addEventListener("DOMContentLoaded", async function() {

    document.getElementById("dashboardMonth").value =
        getCurrentMonth();

    document.getElementById("budgetMonth").value =
        getCurrentMonth();

    await refreshDashboard();

});

// ------------------------------------------
// UPLOAD AND ANALYZE FINANCE REPORT
// ------------------------------------------

async function uploadFinanceReport() {

    const fileInput = document.getElementById("financeFile");
    const status = document.getElementById("uploadStatus");
    const results = document.getElementById("uploadResults");

    if (!fileInput.files.length) {
        status.textContent = "Please select an Excel or CSV file.";
        return;
    }

    const file = fileInput.files[0];

    const formData = new FormData();
    formData.append("file", file);

    status.textContent = "Uploading and analyzing file...";
    
    try {

        const response = await fetch("/api/upload-report", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Upload failed");
        }

        document.getElementById("uploadedFileName").textContent =
            data.filename;

        document.getElementById("uploadedRows").textContent =
            data.rows;

        document.getElementById("uploadedColumns").textContent =
            data.columns.length;

        // Create preview table headings
        const head = document.getElementById("uploadPreviewHead");
        const body = document.getElementById("uploadPreviewBody");

        head.innerHTML = "";
        body.innerHTML = "";

        const headerRow = document.createElement("tr");

        data.columns.forEach(column => {
            const th = document.createElement("th");
            th.textContent = column;
            headerRow.appendChild(th);
        });

        head.appendChild(headerRow);

        // Display first 10 records
        data.preview.forEach(record => {

            const row = document.createElement("tr");

            data.columns.forEach(column => {

                const td = document.createElement("td");
                const value = record[column];

                td.textContent =
                    value === null || value === undefined
                    ? ""
                    : typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value);

                row.appendChild(td);
            });

            body.appendChild(row);
        });

        results.style.display = "block";
        status.textContent = "File uploaded and analyzed successfully!";

    } catch (error) {

        status.textContent = "Error: " + error.message;

        results.style.display = "none";
    }
}

