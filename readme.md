# 📈 Financial Accounting & Reporting System

### Deployed for Hindsfeet Investments Liberia Limited

This enterprise financial platform was engineered to centralize, secure, and automate core accounting workflows, wealth management metrics, and investment portfolio tracking for **Hindsfeet Investments Liberia Limited**. 

The system transitions traditional financial operations into a high-efficiency digital hub, eliminating reporting delays and human calculation errors.

---

## 🚀 Key Features

* **Automated General Ledger & Ledger Logs:** Streamlines multi-entry bookkeeping with real-time balance sheet and income statement updates.
* **Investment Portfolio Tracking:** Real-time visibility into active asset allocations, mature yields, and investment liquidities.
* **Institutional Expense Management:** Secure workflow approvals for corporate spend, overhead costs, and transactional auditing.
* **Dynamic Financial Compliance Reporting:** One-click generation of audit-ready compliance sheets, tax summaries, and quarterly profit-and-loss statements.
* **Role-Based Access Controls (RBAC):** Safeguards sensitive corporate financial records by enforcing strict operational permissions for accountants, managers, and executives.

---

## 💻 Tech Stack & Architecture

Built with a secure, highly scalable split-architecture designed for transactional integrity and data consistency.

* **Backend Engine:** Python (Django / FastAPI)
* **Database Layer:** PostgreSQL *(Robust ACID compliance for financial logs)*
* **Frontend Panel:** React.js (optimized with Vite for rapid analytics rendering)
* **Authentication:** JWT Secure Session Tokens with encrypted database logging

---

## 🛠️ Installation & Local Setup

### Prerequisites
* Python 3.10+
* Node.js (v18+)
* PostgreSQL Database instance

### 1. Backend Configuration
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install secure financial dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Start the local engine
python manage.py runserver
```

### 2. Frontend Configuration
```bash
# Navigate to UI directory
cd ../frontend

# Install node modules
npm install

# Run the local dashboard environment
npm run dev
```

---

## 🔒 Security & Data Compliance
* **Data Encryption:** Encrypted storage of client bank identifiers and sensitive transaction tables.
* **Audit Trails:** Unalterable systemic logs capturing the exact time, user ID, and device metadata for every financial modification.

---
<sub>*Developed securely for Hindsfeet Investments Liberia Limited.*</sub>
