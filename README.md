# 🗳️ Election Management System v3 — Setup & Deployment Guide

This is a modern, responsive, and robust **Election Management System** built with **HTML5, Vanilla CSS, JavaScript, and Node.js (Express)**.

It supports **Dual Database Modes**:
- 📂 **Zero-Dependency Local Mode** (default): Saves data to a file (`db.json`) on the server. Requires no database servers or configurations to be installed! Perfect for instant local running and Glitch/persistent hosting.
- 🗄️ **MySQL Mode**: Connects to a robust MySQL server (local or cloud). Perfect for production and standard database servers.

---

## ⚡ Quick Start (Run Locally in 1 Minute)

No database configuration or installation required! The system automatically uses the zero-dependency JSON database mode out-of-the-box.

### Step 1 — Install Node.js
If not already installed, download and install Node.js (LTS version) from [nodejs.org](https://nodejs.org).

### Step 2 — Run the App
Open your terminal inside this directory and run:
```bash
cd server
npm install
npm start
```

### Step 3 — Open in Browser
Visit **[http://localhost:3000](http://localhost:3000)**!
- **Admin Password**: `admin123` (change this under Settings)
- **Voter Portal**: Go to `/vote.html` or click **Cast Your Vote** on the home page.

---

## 🖥️ Local Setup with MySQL

If you want to use MySQL database locally:

1. Install MySQL Server from [dev.mysql.com](https://dev.mysql.com/downloads/).
2. Run the SQL schema file `server/schema.sql` in MySQL Workbench or Command Line to set up database:
   ```sql
   SOURCE server/schema.sql;
   ```
3. Edit your `.env` file (copied from `.env.example`) and uncomment the database credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=election_db
   ```
4. Restart your node server (`npm start`). It will automatically detect the credentials and connect to MySQL!

---

## 🚀 Deploy Online for FREE

### Option A — Deploy to Vercel (Fastest — 2 Minutes)
Vercel is 100% free and requires zero git knowledge.

1. Install Vercel CLI or run via `npx`:
   ```bash
   npx vercel --prod
   ```
2. Log in with your email or GitHub. Vercel will guide you through prompts (just press Enter to accept defaults).
3. Once completed, Vercel gives you a public live URL like `https://election-system.vercel.app`!
4. **Note**: Since Vercel is serverless, you must connect it to a free cloud database (like **Supabase** or **Neon**) by adding a `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` environment variable in the Vercel dashboard.

### Option B — Deploy to Render (Free Web Service)
1. Push this folder to your GitHub account (you can create a repository on GitHub and drag-and-drop the files).
2. Go to [Render.com](https://render.com) and sign in.
3. Create a **New Web Service** and select your GitHub repository.
4. Set the following details:
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `node server/index.js`
5. Connect an external database (or add a free Render PostgreSQL/MySQL database) and define your DB environment variables in Render Settings.
6. Click Deploy! Render will give you a public URL.

---

## 📊 Excel Import format

You can bulk-upload students from the Admin panel using an Excel `.xlsx` spreadsheet. Create the sheet with these exact headers:

| Name | Roll No | Gender | Class Name |
| :--- | :--- | :--- | :--- |
| Arjun Kumar | 22CS001 | Boy | CSE-A 1st Year |
| Priya Sharma | 22CS002 | Girl | CSE-A 1st Year |
| Mohammed Ali | 22EC001 | Boy | ECE-B 2nd Year |

**Rules:**
- **Name**: Required.
- **Roll No**: Optional. Skip for duplicate roll numbers.
- **Gender**: Must be `Boy` or `Girl` (also accepts Male/Female/M/F case-insensitive).
- **Class Name**: Must exactly match a Class Name created in the Admin Panel first.
- A pre-filled download template is available on the Admin Page!
