# LITTLE STAR

LITTLE STAR is the existing React + Vite children's clothing storefront. Its Supabase foundation and Stage 2 store operations add authentication, a PostgreSQL schema with row-level security, product and inventory management, COD order workflows, and customer management while keeping the existing storefront, product details, cart, wishlist, and size guide.

## Requirements

- Node.js compatible with the Vite version in `package.json`
- A Supabase project

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project URL and public anon/publishable key from **Supabase → Project Settings → API**. These are browser-safe project values. **Never put a service-role key in a `VITE_` variable or browser code.**

3. Apply `supabase/migrations/20261019000000_stage_one_foundation.sql` to the project. For example, open **Supabase → SQL Editor**, paste the migration contents, and run it. This creates the tables, indexes, timestamp triggers, RLS policies, and the `product-images` Storage bucket with admin-only write policies.

4. Apply `supabase/migrations/20261019000100_repair_missing_profiles.sql` after the foundation migration. It safely backfills Auth users who predate the profile trigger, without replacing existing profiles or roles, and makes subsequent trigger inserts idempotent.

5. Apply `supabase/migrations/20261020000000_stage_two_store_operations.sql` after the two foundation migrations. This additive migration adds sale pricing, transactional COD checkout and idempotency, inventory movements and adjustment functions, order event history and transitions, and the admin catalog/category workflow. It reuses the existing Stage 1 tables and `product-images` bucket; it does not create a second copy of the schema.

6. Apply `supabase/migrations/20261021000000_stage_three_business_analytics.sql` after Stage 2. This migration adds admin-only expenses and private receipt storage, suppliers, purchase orders, receiving and supplier payments, coupon code references, and product-cost snapshots. Purchase stock is added only by the authorized receiving function.

7. Apply `supabase/migrations/20261022000000_media_and_website_content.sql` after Stage 3. This adds the media registry, draft/published website content, admin audit records, product gallery metadata, and admin-only media/content RPCs. Existing homepage, sample catalog, journal, social-gallery, size-chart, and product images are registered by stable keys so replacement does not require editing React source. It reuses the public `product-images` bucket for storefront delivery; only authenticated admins can upload or remove objects. Product and content references are checked before deletion.

8. Apply `supabase/migrations/20261023000000_verified_checkout_and_order_management.sql` after the media migration. This makes verified email a database-enforced prerequisite for COD checkout, saves the delivery address and verified email snapshot, uses an explicit unpaid COD state, and enables customers to review and cancel unconfirmed orders. It preserves the existing atomic pricing, inventory, and idempotency behavior.

9. In **Supabase → Authentication → URL Configuration**, set the Site URL to your local app URL (usually `http://localhost:5173`) and add these Redirect URLs:

   - `http://localhost:5173/auth/callback*` (the email and OAuth callbacks may include a safe `next` query)
   - `http://localhost:5173/reset-password`
   - Your equivalent production URLs when deploying.

   Enable email signups and email confirmations in the Supabase Auth settings. Configure SMTP before production use so verification and reset emails are deliverable.

10. To enable Google sign-in, open **Supabase → Authentication → Providers → Google**, enable the provider, and enter the Google OAuth client ID and client secret from your Google Cloud OAuth client. In **Google Cloud Console → APIs & Services → Credentials**, add the exact Supabase callback URI shown in the Supabase Google provider settings as an authorized redirect URI. It normally has the form `https://<project-ref>.supabase.co/auth/v1/callback`. This is Google's callback to Supabase—not the app URL below.

   Add the app callback URL (`http://localhost:5173/auth/callback` and the corresponding production origin) to **Supabase → Authentication → URL Configuration → Redirect URLs**. This is the redirect Supabase sends back to your app. Keep the Google client secret only in the Supabase provider settings; it is not used by the browser app.

10. Start the app:

   ```sh
   npm run dev
   ```

Restart Vite after changing `.env.local`. Without Supabase environment values, the storefront remains browseable and the authentication pages show an explicit setup error rather than pretending to authenticate.
When deploying, configure the hosting provider to serve `index.html` for the app routes (`/login`, `/register`, `/account/*`, `/admin/*`, and the auth callback/reset routes) so direct visits and email links reach the React app.

## Authentication and roles

- Customers register with email and password, verify email, sign in, request password resets, and manage a persistent Supabase session.
- `/account` requires an authenticated customer. `/admin/*` requires the `admin` profile role; `/admin/login` is the separate admin sign-in entry.
- New Auth users receive a `customer` profile from a database trigger. Signup metadata cannot set the role, profile insert policies allow only `customer`, and a database trigger rejects role changes from browser-authenticated sessions.
- Each profile's primary key is its matching `auth.users.id`; missing profiles are reported as an explicit authorization/setup error, never silently treated as customers or admins.
- To grant the first admin, create and verify the account through the normal signup flow, then run this statement from the trusted Supabase SQL Editor after substituting the exact account email:

  ```sql
  update public.profiles
  set role = 'admin'
  where email = 'admin@example.com';
  ```

  Confirm that exactly one profile was updated. Admin role grants are deliberately not available in the client or public signup form. Never expose a service-role key to perform this operation from the browser.

If login reports that the authenticated account has no profile, first apply the repair migration above. To repair one account manually, replace the email below with the exact verified Auth email and run in the trusted Supabase SQL Editor. The statement only inserts a missing profile, assigns the safe `customer` role, and preserves any existing profile (including an admin role):

```sql
insert into public.profiles (id, email, full_name, phone, role)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data ->> 'full_name', ''),
  nullif(users.raw_user_meta_data ->> 'phone', ''),
  'customer'
from auth.users as users
where lower(users.email) = lower('customer@example.com')
on conflict (id) do nothing;
```

## Data and security

The foundation migration creates `profiles`, `categories`, `products`, `product_images`, `product_variants`, `addresses`, `carts`, `cart_items`, `orders`, and `order_items`. Public visitors can read active catalog records; customers can access only their own profile, addresses, carts, and order records. Stage 2 adds RLS-protected operational history and security-definer RPCs that verify admin role or authenticated customer identity before changing sensitive records.

The COD checkout RPC recalculates prices, stock, shipping, and totals inside a database transaction. Browser-submitted totals are never authoritative.

Product images belong in the `product-images` Storage bucket. Reads are public for storefront image delivery, while upload, update, and delete operations require an admin JWT.

## Stage 2 store operations

- Admin **Products** and **Categories** provide search, filters, sorting, pagination, publish/unpublish/archive, editable pricing, size/color variants, and multi-image upload using existing tables and storage.
- **Inventory** tracks variant stock, adjustments, damaged stock and returns in movement records. Database row locks and constraints prevent concurrent overselling and negative stock.
- **Orders** uses Cash on Delivery initially. Checkout requires a signed-in customer, a delivery address, a stable per-session idempotency key, and live product variant IDs. The database function recalculates price and shipping, locks and validates stock, snapshots order lines, reserves stock, records events, and empties the saved cart in one transaction. Admin transitions record history and restore stock on cancellation or return.
- **Customers** is restricted to admins and derives contact, order count and eligible spend from profiles and actual order rows. It does not read authentication credentials or tokens.
- Active database products appear in the existing storefront, product pages, collection routes, and cart. Existing sample products remain visible for compatibility, but cannot be checked out until managed as live products with inventory variants.
- Products, categories, inventory, orders, and customer management use the existing protected Stage 2 workflows.

## Stage 3 analytics and finance

- The admin overview and reports use actual orders, order items, profiles, products, inventory variants, expenses, and supplier records. Date boundaries use Pakistan Standard Time; filters support today, the last 7/30 days, this/last month, and custom ranges. Order and item metrics exclude cancelled, returned, and refunded records from recognized sales; gross sales, discounts, refunds, net sales, and collected payments are shown separately.
- Refund reporting assumes a refunded order represents a full merchandise refund (subtotal less order discount); the current order schema does not record partial refund amounts.
- Product cost is stored in admin-only cost tables and snapshotted for new order items after this migration; it is not added to publicly readable product variants or customer order rows. Historical order lines without a cost stay unknown and make estimated profit incomplete. Profit deducts recorded product cost and operational overhead; product purchasing and stitching/manufacturing expenses are excluded from overhead to avoid double-counting against product cost.
- **Expenses** stores PKR amount, category, date, recipient, notes, and optional private image/PDF receipt (up to 10 MB). **Suppliers** stores contact information. **Purchases** records ordered/received quantities, unit costs, purchase status, and supplier payment history. Creating a purchase does not change stock; each authorized receipt transaction updates inventory, weighted average unit cost when known, and inventory movement history.
- **Reports** includes sales by date, product/category performance, slow-moving products, inventory valuation, customer acquisition/repeat orders, coupon-code discounts, returns/refunds/cancellations, COD collection status, and expenses/estimated profit. CSV exports are provided for reports, orders, products, inventory, expenses, and purchases and are only available from protected admin workspaces.
- All finance, supplier, purchase, expense, and receipt reads are protected by admin-only RLS; mutations use security-definer RPCs that verify the admin role. The browser uses only the public Supabase key. The existing storefront, customer account, checkout, order, and catalog features are unchanged.

Apply the migrations in order using Supabase CLI or the SQL Editor. Use a real admin account to exercise management screens and a separate customer account to verify that administrative reads and writes are denied by RLS/RPC authorization.

## Media library and website content

- Admin sidebar routes **Media Library**, **Website Content**, **Homepage Manager**, **Product Image Manager**, and **Size Chart Manager** are protected by the existing admin route and the database `is_admin()` checks. The product image route includes the existing product editor, with gallery ordering/removal, alt text, featured status, and restricted per-variant purchase/manufacturing costs; stock adjustments remain in Inventory so each change continues to create an inventory movement.
- Uploads accept JPEG, PNG, WebP, GIF, and AVIF up to 10 MB. The central library offers multi-upload, metadata editing, search/filter/sort, full-size preview, copy URL, replacement, and unused-only deletion. Replacements upload a new immutable object first and atomically update database references before cleaning up the old object. Content- or product-referenced images cannot be deleted. Cropping is a centered crop with original, square, 4:5, and 16:9 proportions; still images are downscaled to a maximum 2400-pixel edge while preserving proportions. Animated GIFs are preserved as-is and cannot be cropped.
- Website edits are draft-only until **Save and publish** (or the separate publish action). A draft preview is available in the dashboard. The homepage hero, editorial banners, wide banner, occasion cards, featured/sale headings, journal and social gallery images, announcement bar, footer copy/social links, and product size chart read published database content. Other storefront components keep their original layout/default copy.
- The migration seeds registry records for source-code image URLs and the existing public size-chart file. Existing remote images remain at their original URL until replaced; upload a replacement through the media library to move that asset to Supabase Storage. Product images already in Supabase are backfilled automatically.
- The existing public `product-images` bucket serves storefront files. RLS blocks public metadata changes; Storage write access and all content mutations are admin-only. Product gallery image keys remain stable while editing a product, and detaching an image leaves it in the library for safe reuse or deletion. Audit rows record product creation/edits, media upload, replacement, metadata edit/deletion, draft save, publish/unpublish, administrator, and timestamp. Do not manually delete a referenced object from Supabase Storage; use the Media Library so the database safeguard and audit trail run.

## Customer checkout and order management

- Checkout requires a Supabase Auth session with a verified email. The `place_cod_order` database function independently checks `auth.users.email_confirmed_at` and the customer role; browser-provided email, prices, totals, stock, and payment state are not trusted.
- Checkout collects phone and a complete Pakistan delivery address, presents a final review, and submits product/variant/quantity plus address and an idempotency key. PostgreSQL recalculates current prices and shipping, rejects prices changed since the review, reserves stock, writes order items and audit events, and stores a verified-email/address snapshot in one transaction.
- Customers can review order history and order details, and cancel orders while they are still awaiting store confirmation. Admin order management continues to confirm, fulfill, cancel, restore inventory, record COD collection after delivery, and view status history.
- COD orders remain **unpaid** until an authorized admin records collection after delivery. The cart is preserved while a customer signs in or verifies their email. Supabase Auth verification and password-reset emails require email confirmation and SMTP to be configured in Supabase.
- Easypaisa is unavailable until Little Star provides the merchant's official integration contract, sandbox/live credentials, callback verification details, and endpoint allowlist. No payment API, redirect, or successful payment state is simulated. Do not add merchant secrets or a service-role key to `VITE_` variables.
- Order transaction emails are not sent by this frontend-only configuration. Configure a trusted transactional email service/server function before promising order-status notifications; checkout remains successful if a future notification delivery fails.

### If the admin panel does not open

1. Confirm `.env.local` contains the Supabase **project URL and anon/publishable key**, then restart Vite. Do not use a service-role key in frontend variables.
2. Apply all migrations in order through `20261022000000_media_and_website_content.sql`. The admin page displays a migration/setup error if the media tables are unavailable.
3. Sign in with an account whose `public.profiles.role` is `admin`. New signups are intentionally customers; grant the initial admin role only from Supabase SQL Editor using the trusted procedure above. A customer account is redirected away from `/admin`.
4. If sign-in reports a missing profile, apply the profile repair migration. If browser errors identify a missing table/function, apply the corresponding migration and reload.

## Validation

```sh
npm run test
npm run lint
npm run build
```
