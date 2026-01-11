# ⚙️ Fiesta - API Server

The robust Node.js/Express backend powering the Fiesta Platform. It handles secure authentication, multi-tenant business logic, dynamic RBAC, job scheduling, and database management.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)

## ⚡ Key Features

*   **🔐 Secure Authentication:** JWT via **HttpOnly Cookies** (XSS protection) + CSRF protection settings.
*   **🛡️ Granular RBAC:** Middleware-based permission checking (`checkPermission("invoices.update.all")`) stored in MongoDB.
*   **🏢 Multi-Vertical Architecture:** Polymorphic `Business` model supporting Venues, Service Providers, and Freelancers.
*   **👑 Super Admin Mode:** Dedicated administrative layer for managing subscriptions and global users.
*   **📅 Job Scheduling:** Uses **Agenda** for reliable background jobs (Reminders, Emails, Recurring Tasks).
*   **📧 Email Service:** Integration with Nodemailer for Invitations and Reset links.
*   **📄 PDF Generation:** Dynamic PDF generation for Invoices and Contracts.

## 🛠️ Tech Stack

*   **Framework:** Express.js
*   **Database:** MongoDB (Mongoose ODM)
*   **Auth:** JSON Web Tokens (JWT), Cookie-Parser, Bcrypt.js
*   **Validation:** Express-validator
*   **Scheduler:** Agenda
*   **File Uploads:** Multer + Cloudinary

## 🚀 Getting Started

### 1. Prerequisites
*   Node.js (v18+)
*   MongoDB Instance (Local or Atlas)
*   npm or yarn

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
MONGODB_URI=mongodb://localhost:27017/FiestaApp

# Security
JWT_SECRET=your_super_secret_random_string_change_this_in_production
JWT_EXPIRES_IN=7d

# Client URL (For CORS & Links)
CLIENT_URL=http://localhost:5173

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Invitation Settings
INVITATION_EXPIRY_HOURS=48

  

4. Database Seeding

This is critical for setting up the Permission Matrix and Demo Accounts.
code Bash

    
npm run seed

  

Created Accounts:
Account	Email	Password	Role
Super Admin	admin@fiesta.com	SuperAdmin123!	Global Admin
Venue	venue@demo.com	password123	Business Owner
Photographer	photo@demo.com	password123	Business Owner
Driver	driver@demo.com	password123	Business Owner
5. Run Server
code Bash

    
# Development (with Nodemon)
npm run dev

# Production
npm start

  

API available at http://localhost:5000/api/v1
🔒 Security & Architecture
Permission System

Permissions are flattened into strings (e.g., events.create, finance.read.all) and stored in the user session.

    Authentication Middleware: Verifies the cookie, decodes the JWT, and deeply populates the User's permissions.

    Check Middleware: checkPermission() compares the required permission string against the user's flattened list.

    Super Admin: Bypasses all permission checks via isSuperAdmin flag.

Authentication Strategy

We use HttpOnly Cookies to store the JWT. This makes the token inaccessible to JavaScript, preventing XSS attacks.

    Production: Cookies are Secure (HTTPS only) and SameSite: Strict.

    Development: Settings are relaxed to allow localhost testing.

API Error Handling

Consistent JSON error responses:

    401 Unauthorized: Invalid/missing cookie.

    403 Forbidden: Valid cookie, insufficient permissions.

    400 Bad Request: Validation failure.

    404 Not Found: Resource does not exist.

📂 Project Structure
code Text

    
src/
├── config/          # DB, Env, Cloudinary, Roles/Permissions
├── controllers/     # Business logic (Auth, Admin, Business...)
├── middleware/      # Auth, Error Handling, Validators
├── models/          # Mongoose Schemas (User, Business, Event...)
├── routes/          # API Route Definitions
├── services/        # Email, Scheduler, Socket logic
├── utils/           # PDF generation, Token helpers, Seeder
├── validators/      # Express-validator arrays
├── app.js           # Express App Setup
└── server.js        # Entry Point

  