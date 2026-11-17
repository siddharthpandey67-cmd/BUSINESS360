# BUSINESS360

A website-first business management SaaS starter for Indian small businesses.

## What is included in this starter
- Public landing page
- Email/password signup and login
- Business workspace creation
- Owner-controlled organization model (no platform admin approval)
- Responsive dashboard
- Working product creation and product list
- PostgreSQL schema for organizations, memberships, products, customers, invoices, invoice items, expenses and audit logs
- Row Level Security (RLS) policies for tenant isolation

## Important
This is the first integrated foundation, **not yet a finished production accounting product**. Customer, invoicing, GST, payments, payroll, AI, staff permission screens, subscriptions, exports and advanced reporting still require implementation and testing before being advertised as working.

## Requirements
- Node.js 20.9 or newer
- A Supabase project
- GitHub account
- Vercel account

## Setup
1. Create a Supabase project.
2. Open Supabase Dashboard -> SQL Editor.
3. Run `supabase/migrations/001_business360.sql`.
4. Copy `.env.example` to `.env.local`.
5. Add your Supabase Project URL and publishable/anon key.
6. Install dependencies with `npm install`.
7. Run `npm run dev` only for development and testing.
8. Push this project to GitHub.
9. Import the repository into Vercel.
10. Add the same environment variables in Vercel Project Settings -> Environment Variables.
11. Deploy. Your public site will receive a `*.vercel.app` address.

## Signup confirmation
For the simplest initial test, configure Supabase Authentication email confirmation according to your email provider and test the full signup flow. If email confirmation is enabled, a user may need to confirm email before the business workspace is created; this starter currently handles the signed-in signup path and should be extended with a post-confirmation onboarding screen before production.

## Security
- Never put a Supabase `service_role` key in browser code or GitHub.
- The publishable/anon key is designed for browser use only when RLS is correctly enabled.
- Review and test every RLS policy before adding real customer data.
- Configure backups, monitoring, rate limits and privacy/legal documents before production use.
- The current initial product policies allow organization members to manage products; fine-grained role permissions are a later migration.

## Free launch expectations
Free tiers can be used for a small pilot, but have quotas, possible inactivity pauses, bandwidth/storage limits and provider policy changes. A free `vercel.app` subdomain is available; a custom domain normally costs money. No service can promise unlimited public hosting at zero cost.
