 
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
 
function getCurrencyCode() {
    const saved = localStorage.getItem("financeCurrency");
    return ["INR", "USD", "EUR", "GBP"].includes(saved) ? saved : "INR";
}
 
function formatMoney(amount) {
    const currency = getCurrencyCode();
    const locale = currency === "INR" ? "en-IN" : "en-US";
 
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(Number(amount || 0));
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
    const monthInput =
        document.getElementById("dashboardMonth");
 
    return (monthInput && monthInput.value) ||
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
const summaryElements = [
    ["income", data.income],
    ["expenses", data.expenses],
    ["savings", data.savings],
    ["reportIncome", data.income],
    ["reportExpenses", data.expenses],
    ["reportSavings", data.savings]
];
 
summaryElements.forEach(([id, value]) => {
    const element = document.getElementById(id);
 
    if (element) {
        element.textContent = formatMoney(value);
    }
});
 
// Financial health
const health = data.financial_health || {};
 
const healthScore = document.getElementById("healthScore");
const healthStatus = document.getElementById("healthStatus");
const healthProgress = document.getElementById("healthProgress");
 
if (healthScore) {
    healthScore.textContent =
        Number(health.score || 0) + "%";
}
 
if (healthStatus) {
    healthStatus.textContent =
        health.status || "No data";
}
 
if (healthProgress) {
    healthProgress.style.width =
        Math.max(0, Math.min(100, Number(health.score || 0))) + "%";
}
 
// Savings rate
const savingsRate = data.income > 0
    ? (data.savings / data.income) * 100
    : 0;
 
const reportSavingsRate =
    document.getElementById("reportSavingsRate");
 
if (reportSavingsRate) {
    reportSavingsRate.textContent =
        savingsRate.toFixed(1) + "%";
}
 
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
    const tbody = document.getElementById("transactionList");
 
    if (!tbody) return;
 
    const searchInput = document.getElementById("search");
    const monthInput = document.getElementById("monthFilter");
    const categoryInput = document.getElementById("categoryFilter");
 
    const search = searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";
 
    const selectedMonth = monthInput ? monthInput.value : "";
    const selectedCategory = categoryInput ? categoryInput.value : "";
 
    tbody.innerHTML = "";
    updateTransactionSummary();
 
    const filtered = allTransactions.filter(t => {
        const matchesSearch =
            String(t.description).toLowerCase().includes(search) ||
            String(t.category).toLowerCase().includes(search) ||
            String(t.type).toLowerCase().includes(search);
 
        const transactionMonth = String(t.date).substring(0, 7);
 
        const matchesMonth =
            !selectedMonth || transactionMonth === selectedMonth;
 
        const matchesCategory =
            !selectedCategory || t.category === selectedCategory;
 
        return matchesSearch && matchesMonth && matchesCategory;
    });
 
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">No transactions found.</td>
            </tr>
        `;
        return;
    }
 
    filtered.forEach(t => {
        const row = document.createElement("tr");
 
        row.innerHTML = `
            <td>${escapeHTML(t.date)}</td>
            <td>${escapeHTML(t.description)}</td>
            <td>${escapeHTML(t.category)}</td>
            <td>${escapeHTML(t.type)}</td>
            <td>${formatMoney(t.amount)}</td>
            <td>${escapeHTML(t.payment_method || "-")}</td>
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
 
    if (!monthFilter) return;
 
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
 
    if (!categoryFilter) return;
 
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
    const pieCanvas = document.getElementById("pieChart");
    const barCanvas = document.getElementById("barChart");
 
    if (!pieCanvas && !barCanvas) return;
 
    if (typeof Chart === "undefined") {
        console.error("Chart.js is not loaded.");
        return;
    }
 
    Chart.defaults.color = "#aab5d4";
    Chart.defaults.font.family = "Arial";
 
    // EXPENSE DOUGHNUT CHART
    const breakdown = data.expense_breakdown || [];
 
    if (pieCanvas) {
        if (pieChart) {
            pieChart.destroy();
        }
 
        pieChart = new Chart(pieCanvas, {
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
        });
    }
 
    // MONTHLY OVERVIEW CHART
    if (barCanvas) {
        const overview = data.monthly_overview || [];
 
        const rangeInput =
            document.getElementById("overviewRange");
 
        const range = Number(
            (rangeInput && rangeInput.value) || 6
        );
 
        const visibleOverview = overview.slice(-range);
 
        if (barChart) {
            barChart.destroy();
        }
 
        barChart = new Chart(barCanvas, {
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
                                return formatMoney(value);
                            }
                        }
                    }
                }
            }
        });
    }
}
 
// ------------------------------------------
// RECENT TRANSACTIONS
// ------------------------------------------
 
function displayRecentTransactions(items) {
    const tbody =
        document.getElementById("recentTransactionList");
 
    if (!tbody) return;
 
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
 
if (!container) return;
 
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
    const panel = document.getElementById("budgetFormPanel");
    const monthInput = document.getElementById("budgetMonth");
 
    if (!panel) return;
    panel.style.display = "block";
 
    if (monthInput) monthInput.value = getSelectedMonth();
    panel.scrollIntoView({ behavior: "smooth" });
}
 
// Close budget form
function closeBudgetForm() {
    const panel = document.getElementById("budgetFormPanel");
    const form = document.getElementById("budgetForm");
 
    if (panel) panel.style.display = "none";
    if (form) form.reset();
}
 
// Save budget
const budgetForm = document.getElementById("budgetForm");
 
if (budgetForm) {
    budgetForm.addEventListener("submit", async function(event) {
 
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
}
 
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
    const modal = document.getElementById("transactionModal");
    const form = document.getElementById("transactionForm");
    const dateInput = document.getElementById("date");
 
    if (!modal) return;
    modal.style.display = "flex";
 
    if (!editingId && form) {
        form.reset();
        if (dateInput) dateInput.value = getCurrentDate();
    }
}
 
function getCurrentDate() {
    const now = new Date();
 
    return now.getFullYear() + "-" +
        String(now.getMonth() + 1).padStart(2, "0") + "-" +
        String(now.getDate()).padStart(2, "0");
}
 
function closeForm() {
    const modal = document.getElementById("transactionModal");
    if (modal) modal.style.display = "none";
}
 
// ------------------------------------------
// ADD OR UPDATE TRANSACTION
// ------------------------------------------
 
// ADD OR UPDATE TRANSACTION
const transactionForm =
    document.getElementById("transactionForm");
 
if (transactionForm) {
    transactionForm.addEventListener("submit", async function(event) {
 
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
 
            const submitButton = document.querySelector(
                "#transactionForm button[type='submit']"
            );
            if (submitButton) submitButton.textContent = "Save Transaction";
 
            closeForm();
 
            await refreshDashboard();
 
        } catch (error) {
            alert(error.message);
        }
    });
}
 
// ------------------------------------------
// EDIT TRANSACTION
// ------------------------------------------
 
function editTransaction(id) {
    const transaction = allTransactions.find(
        t => Number(t.id) === Number(id)
    );
 
    if (!transaction) return;
 
    const fields = {
        date: transaction.date,
        description: transaction.description,
        category: transaction.category,
        type: transaction.type,
        amount: transaction.amount,
        payment_method: transaction.payment_method
    };
 
    Object.entries(fields).forEach(([fieldId, value]) => {
        const input = document.getElementById(fieldId);
        if (input) input.value = value ?? "";
    });
 
    editingId = id;
 
    const submitButton = document.querySelector(
        "#transactionForm button[type='submit']"
    );
    if (submitButton) submitButton.textContent = "Update Transaction";
 
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
 
// START APPLICATION
 
document.addEventListener("DOMContentLoaded", async function() {
 
    const dashboardMonth =
        document.getElementById("dashboardMonth");
 
    const budgetMonth =
        document.getElementById("budgetMonth");
 
    if (dashboardMonth) {
        dashboardMonth.value = getCurrentMonth();
    }
 
    if (budgetMonth) {
        budgetMonth.value = getCurrentMonth();
    }
 
    const currencySetting = document.getElementById("currencySetting");
    if (currencySetting) {
        currencySetting.value = getCurrencyCode();
        currencySetting.addEventListener("change", saveSettings);
    }
 
    const searchInput = document.getElementById("search");
    const monthFilter = document.getElementById("monthFilter");
    const categoryFilter = document.getElementById("categoryFilter");
 
    if (searchInput) searchInput.addEventListener("input", displayTransactions);
    if (monthFilter) monthFilter.addEventListener("change", () => {
        displayTransactions();
        updateTransactionSummary();
    });
    if (categoryFilter) categoryFilter.addEventListener("change", displayTransactions);
 
    if (dashboardMonth) {
        dashboardMonth.addEventListener("change", loadAnalytics);
    }
 
    const overviewRange = document.getElementById("overviewRange");
    if (overviewRange) {
        overviewRange.addEventListener("change", () => {
            if (currentAnalytics) createCharts(currentAnalytics);
        });
    }
 
    if (budgetMonth) {
        budgetMonth.addEventListener("change", loadAnalytics);
    }
 
    await refreshDashboard();
 
});
 
// ------------------------------------------
// UPLOAD AND ANALYZE FINANCE REPORT
// ------------------------------------------
 

async function uploadFinanceReport() {

    const fileInput = document.getElementById("financeFile");
    const status = document.getElementById("uploadStatus");
    const results = document.getElementById("uploadResults");

    if (!fileInput || !status || !results) return;

    if (!fileInput.files || !fileInput.files.length) {
        status.textContent = "Please select a CSV or Excel file.";
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("file", file);

    status.textContent = "Uploading, saving and analyzing transactions...";

    try {

        const response = await fetch("/api/upload-report", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Upload failed");
        }

        const fileNameEl = document.getElementById("uploadedFileName");
        const rowsEl = document.getElementById("uploadedRows");
        const columnsEl = document.getElementById("uploadedColumns");

        if (fileNameEl) fileNameEl.textContent = data.filename ?? file.name;
        if (rowsEl) rowsEl.textContent = data.rows ?? 0;
        if (columnsEl) columnsEl.textContent = (data.columns || []).length;

        // Show import summary
        let summary = document.getElementById("importSummary");

        if (!summary) {
            summary = document.createElement("div");
            summary.id = "importSummary";
            summary.className = "cards";
            results.prepend(summary);
        }

        summary.innerHTML = `
            <div class="card">
                <h3>Imported</h3>
                <p>${Number(data.imported || 0)}</p>
            </div>
            <div class="card">
                <h3>Duplicates Skipped</h3>
                <p>${Number(data.duplicates || 0)}</p>
            </div>
            <div class="card">
                <h3>Invalid Records</h3>
                <p>${Number(data.rejected || 0)}</p>
            </div>
        `;

        // Create preview table headings
        const head = document.getElementById("uploadPreviewHead");
        const body = document.getElementById("uploadPreviewBody");

        if (!head || !body) {
            throw new Error("Upload preview elements are missing.");
        }

        head.innerHTML = "";
        body.innerHTML = "";

        const headerRow = document.createElement("tr");

        (data.columns || []).forEach(column => {
            const th = document.createElement("th");
            th.textContent = column;
            headerRow.appendChild(th);
        });

        head.appendChild(headerRow);

        // Display first 10 records
        (data.preview || []).forEach(record => {

            const row = document.createElement("tr");

            (data.columns || []).forEach(column => {
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

        status.textContent =
            `Import completed! ${data.imported || 0} imported, ` +
            `${data.duplicates || 0} duplicates skipped, ` +
            `${data.rejected || 0} rejected.`;

        // Refresh dashboard data
        if (typeof refreshDashboard === "function") {
            await refreshDashboard();
        }

        if (typeof loadTransactions === "function") {
            await loadTransactions();
        }

        if (typeof loadAnalytics === "function") {
            await loadAnalytics();
        }

    } catch (error) {

        status.textContent = "Error: " + error.message;
        results.style.display = "none";
    }
}

// EXPENSE BREAKDOWN LIST
// ------------------------------------------
 
function displayExpenseBreakdown(items) {
    const container = document.getElementById("expenseBreakdownList");
    if (!container) return;
 
    container.innerHTML = "";
 
    if (!items || items.length === 0) {
        container.innerHTML = "<p>No expense data available for this month.</p>";
        return;
    }
 
    const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
 
    items.forEach(item => {
        const amount = Number(item.amount || 0);
        const percentage = total > 0 ? (amount / total) * 100 : 0;
        const row = document.createElement("div");
        row.className = "expense-breakdown-item";
        row.innerHTML = `
            <div class="expense-breakdown-top">
                <span>${escapeHTML(item.category || "Other")}</span>
                <strong>${formatMoney(amount)}</strong>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width:${Math.min(100, percentage)}%"></div>
            </div>
            <small>${percentage.toFixed(1)}%</small>
        `;
        container.appendChild(row);
    });
}
 
function updateTransactionSummary() {
    const incomeEl = document.getElementById("transactionIncome");
    const expensesEl = document.getElementById("transactionExpenses");
    const balanceEl = document.getElementById("transactionBalance");
 
    if (!incomeEl && !expensesEl && !balanceEl) return;
 
    const monthFilter = document.getElementById("monthFilter");
    const selectedMonth = monthFilter ? monthFilter.value : "";
 
    const selected = allTransactions.filter(t =>
        !selectedMonth || String(t.date || "").substring(0, 7) === selectedMonth
    );
 
    const income = selected
        .filter(t => String(t.type).toLowerCase() === "income")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
 
    const expenses = selected
        .filter(t => String(t.type).toLowerCase() === "expense")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
 
    if (incomeEl) incomeEl.textContent = formatMoney(income);
    if (expensesEl) expensesEl.textContent = formatMoney(expenses);
    if (balanceEl) balanceEl.textContent = formatMoney(income - expenses);
}
 
function saveSettings() {
    const currencyInput = document.getElementById("currencySetting");
    const status = document.getElementById("settingsStatus");
 
    if (!currencyInput) return;
 
    const currency = currencyInput.value;
    if (!["INR", "USD", "EUR", "GBP"].includes(currency)) {
        if (status) status.textContent = "Please select a valid currency.";
        return;
    }
 
    localStorage.setItem("financeCurrency", currency);
    if (status) status.textContent = "Settings saved successfully.";
 
    // Refresh visible amounts using the selected currency.
    if (currentAnalytics) {
        loadAnalytics();
    }
    if (allTransactions.length) {
        displayTransactions();
        displayRecentTransactions(
            currentAnalytics ? currentAnalytics.recent_transactions || [] : []
        );
    }
}
 
 
