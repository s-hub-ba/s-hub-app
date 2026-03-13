# Shift Me Up

A modern, full-stack marketplace connecting top-tier nannies with verified NYC agencies.

## 1. Project Folder Structure

```
├── server.ts                 # Express server entry point (Vite middleware + API)
├── server/
│   └── paypal.ts             # PayPal webhook and subscription API routes
├── supabase/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql # Database schema definitions
│   └── seed.sql              # Mock data for local development
├── src/
│   ├── components/           # Reusable UI components (ProtectedRoute, etc.)
│   ├── contexts/             # React Contexts (AuthContext)
│   ├── layouts/              # Dashboard and Public layouts
│   ├── lib/                  # Utilities and Supabase client
│   └── pages/                # Route components (Nanny, Agency, Admin, Public)
```

## 2. Setup Instructions

### Environment Variables
Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id
```

### Database Setup (Supabase)
1. Create a new Supabase project.
2. Run the SQL script located in `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL Editor to create the tables and RLS policies.
3. (Optional) Run `supabase/seed.sql` to populate mock data.

### Running the Application
Install dependencies and start the full-stack development server:

```bash
npm install
npm run dev
```

The server will start on `http://localhost:3000`, serving both the Vite React frontend and the Express API routes.

## 3. Architecture Overview

- **Frontend:** React 18, Vite, Tailwind CSS, React Router, Lucide Icons, Motion (Framer).
- **Backend:** Express.js running on Node.js. Serves API routes (`/api/*`) and falls back to Vite middleware for SPA routing.
- **Database & Auth:** Supabase (PostgreSQL + GoTrue Auth).
- **Payments:** PayPal REST API for agency subscriptions (Starter, Professional, Enterprise). Webhooks are handled at `/api/paypal/webhook`.
