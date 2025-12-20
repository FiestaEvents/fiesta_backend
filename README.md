    
# ⚙️ Fiesta - API Server

The robust Node.js/Express backend powering the Fiesta Platform. It handles secure authentication, complex permission logic, scheduling, and database management.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)

## ⚡ Key Features

*   **🔐 Secure Authentication:** JWT via **HttpOnly Cookies** (XSS protection) + CSRF protection settings.
*   **🛡️ Granular RBAC:** Middleware-based permission checking (`checkPermission("invoices.update.all")`).
*   **📅 Job Scheduling:** Uses **Agenda** for reliable background jobs (Reminders, Emails).
*   **📧 Email Service:** Integration with Nodemailer for Invitations and Reset links.
*   **📄 PDF Generation:** Dynamic PDF generation for Invoices and Contracts.
*   **👥 Team Management:** Secure Invitation flows with token hashing and expiry logic.

## 🛠️ Tech Stack

*   **Framework:** Express.js
*   **Database:** MongoDB (Mongoose ODM)
*   **Auth:** JSON Web Tokens (JWT), Cookie-Parser, Bcrypt.js
*   **Validation:** Express-validator
*   **Scheduler:** Agenda
*   **File Uploads:** Multer

## 🚀 Getting Started

### 1. Prerequisites
*   Node.js (v18+)
*   MongoDB Instance (Local or Atlas)

### 2. Installation
```bash
cd fiesta_backend
npm install

  

3. Environment Setup

Create a .env file in the fiesta_backend root:
code Env

    
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/fiesta_db

# Security
JWT_SECRET=your_super_secret_random_string
JWT_EXPIRES_IN=7d

# Client URL (For CORS & Links)
CLIENT_URL=http://localhost:3000

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Invitation Settings
INVITATION_EXPIRY_HOURS=48

  

4. Database Seeding

To populate the database with default Permissions, Roles, and a Demo User:
code Bash

    
npm run seed

  

This will create an Owner: owner@demo.com / password123
5. Run Server
code Bash

    
# Development (with Nodemon)
npm run dev

# Production
npm start

  

🔒 Security & Architecture
Permission System

Permissions are flattened into strings (e.g., events.create, finance.read.all) and stored in the user session.

    Middleware: authenticate -> Deep populates user permissions.

    Middleware: checkPermission(perm) -> Checks the array instantly.

Cookies

We use cookie-parser to read the JWT.

    Production: secure: true, sameSite: 'strict'

    Development: Relaxed settings for localhost.

📂 Project Structure
code Code

    
src/
├── config/          # DB, Env, Roles/Permissions Config
├── controllers/     # Business logic (Auth, Events, Teams...)
├── middleware/      # Auth, Error Handling, Validators
├── models/          # Mongoose Schemas
├── routes/          # API Route Definitions
├── services/        # Email, Scheduler (Agenda), Socket logic
├── utils/           # PDF generation logic, Token helpers , Data base seeder
├── validators/      # Express-validator arrays
├── app.js           # Express App Setup
└── server.js        # Entry Point

  