const STORAGE_KEYS = {
  TRANSACTIONS: "ebv_transactions",
  CATEGORIES: "ebv_categories",
  THEME: "ebv_theme",
  CURRENCY: "ebv_currency"
};

const CURRENCIES = {
  USD: { symbol: "$", locale: "en-US", decimals: 2, placeholder: "0.00" },
  IDR: { symbol: "Rp", locale: "id-ID", decimals: 0, placeholder: "15000" },
  EUR: { symbol: "€", locale: "de-DE", decimals: 2, placeholder: "0.00" },
  JPY: { symbol: "¥", locale: "ja-JP", decimals: 0, placeholder: "1000" },
  GBP: { symbol: "£", locale: "en-GB", decimals: 2, placeholder: "0.00" },
  SGD: { symbol: "S$", locale: "en-SG", decimals: 2, placeholder: "0.00" },
  AUD: { symbol: "A$", locale: "en-AU", decimals: 2, placeholder: "0.00" },
  KRW: { symbol: "₩", locale: "ko-KR", decimals: 0, placeholder: "10000" },
  MYR: { symbol: "RM", locale: "ms-MY", decimals: 2, placeholder: "0.00" }
};

const DEFAULT_CATEGORIES = ["Food", "Transport", "Fun"];
const CATEGORY_COLORS = {
  Food: "#28c76f",
  Transport: "#2b8be6",
  Fun: "#e67e22"
};
const EXTRA_PALETTE = [
  "#9b59b6", "#e84393", "#00cec9", "#fdcb6e", "#6c5ce7", "#d63031", "#00b894"
];

let transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) || [];
let categories = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES)) || [...DEFAULT_CATEGORIES];
let currentCurrency = localStorage.getItem(STORAGE_KEYS.CURRENCY) || "USD";
if (!CURRENCIES[currentCurrency]) {
  currentCurrency = "USD";
}
let expenseChart = null;

const form = document.getElementById("transaction-form");
const itemNameInput = document.getElementById("item-name");
const itemAmountInput = document.getElementById("item-amount");
const currencySelect = document.getElementById("currency-select");
const amountLabel = document.getElementById("amount-label");
const amountPreview = document.getElementById("amount-preview");
const itemCategorySelect = document.getElementById("item-category");
const newCategoryInput = document.getElementById("new-category-input");
const addCategoryBtn = document.getElementById("add-category-btn");
const formError = document.getElementById("form-error");
const totalBalanceEl = document.getElementById("total-balance");
const transactionListEl = document.getElementById("transaction-list");
const sortSelect = document.getElementById("sort-transactions");
const themeToggleBtn = document.getElementById("theme-toggle");
const emptyChartMsg = document.getElementById("empty-chart-msg");
const chartCanvas = document.getElementById("expense-chart");

function init() {
  applySavedTheme();
  applySavedCurrency();
  renderCategories();
  renderUI();
}

function getCurrencyConfig(code = currentCurrency) {
  return CURRENCIES[code] || CURRENCIES.USD;
}

function formatMoney(amount, code = currentCurrency) {
  const cfg = getCurrencyConfig(code);
  const formattedNumber = Number(amount).toLocaleString(cfg.locale, {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals
  });
  return `${cfg.symbol}${formattedNumber}`;
}

function applySavedCurrency() {
  currencySelect.value = currentCurrency;
  updateAmountHelper();
}

function updateAmountHelper() {
  const cfg = getCurrencyConfig(currentCurrency);
  amountLabel.textContent = `Amount (${cfg.symbol})`;
  itemAmountInput.placeholder = cfg.placeholder;
  itemAmountInput.step = cfg.decimals === 0 ? "1" : "0.01";
  itemAmountInput.min = cfg.decimals === 0 ? "1" : "0.01";

  if (cfg.decimals === 0 && itemAmountInput.value) {
    itemAmountInput.value = String(Math.round(parseFloat(itemAmountInput.value) || 0));
  }
  updateAmountPreview();
}

function updateAmountPreview() {
  const rawVal = parseFloat(itemAmountInput.value);
  if (isNaN(rawVal) || rawVal <= 0) {
    amountPreview.textContent = `Formatted as: ${formatMoney(0, currentCurrency)}`;
    return;
  }
  const normalized = getCurrencyConfig(currentCurrency).decimals === 0 ? Math.round(rawVal) : rawVal;
  amountPreview.textContent = `Formatted as: ${formatMoney(normalized, currentCurrency)}`;
}

currencySelect.addEventListener("change", () => {
  currentCurrency = currencySelect.value;
  localStorage.setItem(STORAGE_KEYS.CURRENCY, currentCurrency);
  updateAmountHelper();
  renderUI();
});

itemAmountInput.addEventListener("input", updateAmountPreview);

function applySavedTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    themeToggleBtn.textContent = "☀️ Light Mode";
  }
}

themeToggleBtn.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem(STORAGE_KEYS.THEME, isDark ? "dark" : "light");
  themeToggleBtn.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
  updateChart();
});

function renderCategories() {
  itemCategorySelect.innerHTML = "";
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    itemCategorySelect.appendChild(option);
  });
}

addCategoryBtn.addEventListener("click", () => {
  const rawName = newCategoryInput.value.trim();
  if (!rawName) {
    formError.textContent = "Please enter a category name first.";
    return;
  }

  const formatted = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const exists = categories.some((c) => c.toLowerCase() === formatted.toLowerCase());

  if (exists) {
    formError.textContent = `Category "${formatted}" already exists.`;
    return;
  }

  categories.push(formatted);
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  renderCategories();
  itemCategorySelect.value = formatted;
  newCategoryInput.value = "";
  formError.textContent = "";
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  formError.textContent = "";

  const cfg = getCurrencyConfig(currentCurrency);
  const name = itemNameInput.value.trim();
  const rawAmount = parseFloat(itemAmountInput.value);
  const category = itemCategorySelect.value;

  if (!name || isNaN(rawAmount) || rawAmount <= 0 || !category) {
    formError.textContent = "Please fill out all fields with a valid positive amount.";
    return;
  }

  const amount = cfg.decimals === 0 ? Math.round(rawAmount) : Number(rawAmount.toFixed(2));

  const newTransaction = {
    id: Date.now(),
    name,
    amount,
    category,
    currency: currentCurrency
  };

  transactions.push(newTransaction);
  saveTransactions();
  renderUI();

  itemNameInput.value = "";
  itemAmountInput.value = "";
  updateAmountPreview();
});

function deleteTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions();
  renderUI();
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

sortSelect.addEventListener("change", renderTransactionList);

function getSortedTransactions() {
  const sortBy = sortSelect.value;
  const copy = [...transactions];

  if (sortBy === "amount-desc") {
    return copy.sort((a, b) => b.amount - a.amount);
  }
  if (sortBy === "amount-asc") {
    return copy.sort((a, b) => a.amount - b.amount);
  }
  if (sortBy === "category") {
    return copy.sort((a, b) => a.category.localeCompare(b.category));
  }
  return copy.sort((a, b) => b.id - a.id);
}

function renderUI() {
  updateTotalBalance();
  renderTransactionList();
  updateChart();
}

function updateTotalBalance() {
  const total = transactions.reduce((sum, item) => sum + item.amount, 0);
  totalBalanceEl.textContent = formatMoney(total, currentCurrency);
}

function renderTransactionList() {
  const sorted = getSortedTransactions();
  transactionListEl.innerHTML = "";

  if (sorted.length === 0) {
    transactionListEl.innerHTML = `<p class="empty-state">No transactions yet. Add one above!</p>`;
    return;
  }

  sorted.forEach((item) => {
    const itemCurrency = item.currency || currentCurrency;
    const row = document.createElement("div");
    row.className = "transaction-item";
    row.innerHTML = `
      <div class="transaction-info">
        <span class="transaction-name">${escapeHTML(item.name)}</span>
        <span class="transaction-amount">${formatMoney(item.amount, itemCurrency)}</span>
        <span class="transaction-category">${escapeHTML(item.category)}</span>
      </div>
      <button type="button" class="btn-delete" data-id="${item.id}">Delete</button>
    `;

    row.querySelector(".btn-delete").addEventListener("click", () => {
      deleteTransaction(item.id);
    });

    transactionListEl.appendChild(row);
  });
}

function getCategoryColor(category, index) {
  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }
  return EXTRA_PALETTE[index % EXTRA_PALETTE.length];
}

function updateChart() {
  if (transactions.length === 0) {
    chartCanvas.style.display = "none";
    emptyChartMsg.style.display = "block";
    if (expenseChart) {
      expenseChart.destroy();
      expenseChart = null;
    }
    return;
  }

  chartCanvas.style.display = "block";
  emptyChartMsg.style.display = "none";

  const totalsByCategory = {};
  categories.forEach((cat) => {
    totalsByCategory[cat] = 0;
  });

  transactions.forEach((t) => {
    totalsByCategory[t.category] = (totalsByCategory[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(totalsByCategory);
  const dataValues = labels.map((label) => totalsByCategory[label]);
  const bgColors = labels.map((label, idx) => getCategoryColor(label, idx));
  const isDark = document.body.classList.contains("dark-mode");

  if (expenseChart) {
    expenseChart.destroy();
  }

  expenseChart = new Chart(chartCanvas, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: dataValues,
          backgroundColor: bgColors,
          borderColor: isDark ? "#1c2026" : "#ffffff",
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: isDark ? "#f1f3f5" : "#495057",
            boxWidth: 16,
            padding: 14,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed || 0;
              return ` ${context.label}: ${formatMoney(value, currentCurrency)}`;
            }
          }
        }
      }
    }
  });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

init();