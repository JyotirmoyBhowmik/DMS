# Free-Tier Production Deployment Guide — DMS & SFA Platform

> **Complete step-by-step guide.  No shortcuts.  Every command, every click, every screenshot-worthy moment documented.**

This document covers deploying the entire DMS monorepo — PostgreSQL database, Node.js backend microservices, React web admin dashboard, and Flutter Android SFA mobile app — using **100% free-tier services** and your existing Gmail account with Google Play Console access.

---

## Table of Contents

1. [Prerequisites & Accounts](#1-prerequisites--accounts)
2. [Prepare the Codebase for Production](#2-prepare-the-codebase-for-production)
3. [Database — Neon.tech Free PostgreSQL](#3-database--neontech-free-postgresql)
4. [Backend — Render.com Free Web Services](#4-backend--rendercom-free-web-services)
5. [Web Admin — Vercel Free Static Hosting](#5-web-admin--vercel-free-static-hosting)
6. [Flutter Android — Build Release APK & AAB](#6-flutter-android--build-release-apk--aab)
7. [Publish to Google Play Store](#7-publish-to-google-play-store)
8. [Free APK Distribution via GitHub Releases](#8-free-apk-distribution-via-github-releases)
9. [Git Push, Sync & Merge](#9-git-push-sync--merge)
10. [Post-Deployment Verification](#10-post-deployment-verification)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites & Accounts

Before starting, ensure you have the following installed and accounts created.

### 1.1 Local Machine Requirements

| Tool | Required Version | Check Command | Install Guide |
|---|---|---|---|
| **Node.js** | ≥ 18.0.0 | `node --version` | https://nodejs.org |
| **pnpm** | 8.15.4 | `pnpm --version` | `npm install -g pnpm@8.15.4` |
| **Git** | Any recent | `git --version` | https://git-scm.com |
| **Flutter SDK** | ≥ 3.0.0 | `flutter --version` | https://docs.flutter.dev/get-started/install |
| **Android SDK** | API 33+ | `flutter doctor` | Bundled with Android Studio |
| **Java JDK** | 17+ | `java --version` | https://adoptium.net |
| **Turbo** | ≥ 1.12.4 | `npx turbo --version` | Installed via `devDependencies` |

### 1.2 Free Accounts to Create

Open each of these in your browser and sign up (all are free):

| # | Service | URL | What For | Cost |
|---|---|---|---|---|
| 1 | **GitHub** | https://github.com | Source code hosting & CI/CD | Free |
| 2 | **Neon.tech** | https://neon.tech | Managed PostgreSQL database | Free tier (0.5 GiB) |
| 3 | **Render.com** | https://render.com | Backend API hosting | Free tier (750 hrs/mo) |
| 4 | **Vercel** | https://vercel.com | Web admin static hosting | Free tier (unlimited bandwidth) |
| 5 | **Google Play Console** | https://play.google.com/console | Android app publishing | You already have access |

> [!IMPORTANT]
> Sign up for **Neon.tech**, **Render.com**, and **Vercel** using your **GitHub account** (click "Continue with GitHub"). This connects your repositories automatically and avoids extra authentication steps.

---

## 2. Prepare the Codebase for Production

### 2.1 Verify the Build Passes Locally

Open PowerShell in your DMS project root:

```powershell
cd C:\Users\TEST\DMS
```

Install all dependencies:

```powershell
pnpm install
```

Run the full monorepo build:

```powershell
pnpm build
```

**Expected output** (last lines):

```
 Tasks:    34 successful, 34 total
Cached:    34 cached, 34 total
  Time:    ...
```

> [!CAUTION]
> Do **NOT** proceed if the build has any errors. Fix all TypeScript compilation errors first.

### 2.2 Run All Tests

```powershell
pnpm test
```

Confirm all test suites pass with 0 failures.

### 2.3 Create the Production Environment File

Copy the example environment file:

```powershell
Copy-Item .env.example .env.production
```

Open `.env.production` in your editor. You will fill in the real values in the following steps. For now, update these immediately:

```env
# Change these now:
NODE_ENV=production
LOG_LEVEL=INFO
SEED_MOCK_DATA=false

# You will fill these in after creating the database (Step 3):
DB_HOST=<will-be-filled-in-step-3>
DB_PORT=5432
DB_USER=<will-be-filled-in-step-3>
DB_PASSWORD=<will-be-filled-in-step-3>
DB_NAME=neondb
DB_SSL=true
DB_TIMEOUT=30000
```

---

## 3. Database — Neon.tech Free PostgreSQL

### 3.1 Create a Neon Account

1. Open your browser and go to **https://neon.tech**
2. Click **"Sign Up"** in the top right corner
3. Click **"Continue with GitHub"**
4. Authorize Neon to access your GitHub account
5. You will land on the Neon Dashboard

### 3.2 Create a New Project

1. On the Neon Dashboard, click **"New Project"** (green button, top right)
2. Fill in the form:
   - **Project name**: `dms-production`
   - **Postgres version**: `15` (matches your docker-compose.yml)
   - **Region**: Choose the region closest to your users (e.g., `Asia Pacific (Mumbai)` for India, or `US East (Ohio)` for US)
3. Click **"Create Project"**

### 3.3 Copy Your Connection Details

After creation, Neon shows your connection details. **Copy and save every field — you will need them all:**

| Field | Example Value | Your Value |
|---|---|---|
| **Host** | `ep-cool-darkness-123456.ap-south-1.aws.neon.tech` | _____________ |
| **Database** | `neondb` | _____________ |
| **User** | `neondb_owner` | _____________ |
| **Password** | `abc123xyz789` | _____________ |
| **Connection String** | `postgres://neondb_owner:abc123xyz789@ep-cool-darkness-123456.ap-south-1.aws.neon.tech/neondb?sslmode=require` | _____________ |

### 3.4 Update Your Environment File

Open `.env.production` and fill in the database values you just copied:

```env
DB_HOST=ep-cool-darkness-123456.ap-south-1.aws.neon.tech
DB_PORT=5432
DB_USER=neondb_owner
DB_PASSWORD=abc123xyz789
DB_NAME=neondb
DB_SSL=true
```

### 3.5 Run Database Migrations

Now apply all 46 Flyway migration scripts to your production database. Open PowerShell:

**Option A — Using psql (recommended if installed):**

```powershell
# Set your connection string as a variable
$CONNECTION = "postgres://neondb_owner:abc123xyz789@ep-cool-darkness-123456.ap-south-1.aws.neon.tech/neondb?sslmode=require"

# Run each migration file in order
Get-ChildItem "db/migrations/dms/V*.sql" | Sort-Object Name | ForEach-Object {
    Write-Host "Applying migration: $($_.Name)" -ForegroundColor Green
    psql $CONNECTION -f $_.FullName
}
```

**Option B — Using Neon SQL Editor (no install needed):**

1. Go to **Neon Dashboard** → your project → click **"SQL Editor"** in the left sidebar
2. Open each migration file in your code editor (start with `V001__create_dms_tables.sql`)
3. Copy the entire SQL content
4. Paste it into the Neon SQL Editor
5. Click **"Run"**
6. Repeat for every migration file from `V001` through `V046`, **in order**

> [!IMPORTANT]
> You MUST run the migrations in numerical order (V001, V002, V003, ..., V046). Each migration depends on tables created by previous ones.

**Complete migration file list (46 files):**

```
V001__create_dms_tables.sql
V002__dms_outbox_and_deduplication.sql
V003__create_distributor_hierarchy.sql
V004__create_kyc_documents.sql
V005__create_credit_limits.sql
V006__create_stock_ledger.sql
V007__create_stock_transfers.sql
V008__create_product_categories.sql
V009__create_batches.sql
V010__create_invoices.sql
V011__create_price_lists.sql
V012__distributor_lifecycle_rls_and_workflows.sql
V013__inventory_rls_and_concurrency.sql
V014__add_distributor_constraints.sql
V015__add_kyc_document_constraints.sql
V016__add_credit_limit_constraints.sql
V017__add_outlet_constraints.sql
V018__add_product_constraints.sql
V019__add_product_category_constraints.sql
V020__add_sku_constraints.sql
V021__add_inventory_constraints.sql
V022__add_stock_ledger_constraints.sql
V023__add_stock_transfer_constraints.sql
V024__add_goods_receipt_constraints.sql
V025__add_purchase_order_constraints.sql
V026__add_return_constraints.sql
V027__add_replacement_constraints.sql
V028__add_primary_sale_constraints.sql
V029__add_secondary_sale_constraints.sql
V030__add_tertiary_sale_constraints.sql
V031__add_price_list_constraints.sql
V032__add_price_slab_constraints.sql
V033__add_geo_price_rule_constraints.sql
V034__add_channel_price_rule_constraints.sql
V035__add_discount_constraints.sql
V036__add_tax_rule_constraints.sql
V037__add_scheme_constraints.sql
V038__add_scheme_promotion_constraints.sql
V039__add_eligibility_rule_constraints.sql
V040__add_scheme_budget_constraints.sql
V041__add_slab_reward_constraints.sql
V042__add_scheme_payout_constraints.sql
V043__add_claim_constraints.sql
V044__add_scheme_claim_constraints.sql
V045__add_claim_reconciliation_constraints.sql
V046__add_settlement_constraints.sql
```

### 3.6 Verify Database Schema

In the Neon SQL Editor, run:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see 30+ tables including `distributors`, `retail_outlets`, `products_skus`, `inventory_records`, `stock_ledger`, `invoices`, `orders`, etc.

---

## 4. Backend — Render.com Free Web Services

### 4.1 Push Your Code to GitHub First

Before deploying, ensure your latest code is on GitHub:

```powershell
cd C:\Users\TEST\DMS

git add -A
git commit -m "chore: production ready release v1.0.0"
git push origin main
```

### 4.2 Create a Render Account

1. Open **https://render.com**
2. Click **"Get Started for Free"**
3. Click **"GitHub"** to sign up with your GitHub account
4. Authorize Render to access your repositories
5. You will land on the Render Dashboard

### 4.3 Deploy the API Gateway Service

The API Gateway is the single entry point for all mobile and web traffic. Deploy it first.

1. On the Render Dashboard, click **"New +"** → **"Web Service"**
2. Click **"Connect a repository"** and select **`JyotirmoyBhowmik/DMS`**
3. Fill in the configuration:

| Setting | Value |
|---|---|
| **Name** | `dms-api-gateway` |
| **Region** | Singapore (or closest to your users) |
| **Branch** | `main` |
| **Root Directory** | *(leave blank — root of repo)* |
| **Runtime** | `Node` |
| **Build Command** | `npm install -g pnpm@8.15.4 && pnpm install && pnpm build` |
| **Start Command** | `node services/api-gateway/dist/index.js` |
| **Instance Type** | **Free** |

4. Click **"Advanced"** to expand environment variable settings
5. Add these environment variables one by one (click **"Add Environment Variable"** for each):

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DB_HOST` | `ep-cool-darkness-123456.ap-south-1.aws.neon.tech` *(your Neon host)* |
| `DB_PORT` | `5432` |
| `DB_USER` | `neondb_owner` *(your Neon user)* |
| `DB_PASSWORD` | `abc123xyz789` *(your Neon password)* |
| `DB_NAME` | `neondb` |
| `DB_SSL` | `true` |
| `DB_TIMEOUT` | `30000` |
| `JWT_ISSUER` | `dms-identity-service` |
| `JWT_AUDIENCE` | `dms-enterprise` |
| `LOCKOUT_THRESHOLD` | `5` |
| `LOCKOUT_DURATION_MINUTES` | `15` |
| `RATE_LIMIT_MAX_REQUESTS` | `100` |
| `LOG_LEVEL` | `INFO` |
| `SEED_MOCK_DATA` | `false` |
| `CORS_ORIGIN` | `*` |

6. Click **"Create Web Service"**

### 4.4 Wait for Deployment

Render will now:
1. Clone your GitHub repository
2. Run the build command (installs pnpm, dependencies, and compiles TypeScript)
3. Start the API Gateway

**This takes 3-8 minutes on first deploy.** Watch the build logs in the Render dashboard.

### 4.5 Note Your API URL

Once deployment succeeds (green "Live" badge), your API is available at:

```
https://dms-api-gateway.onrender.com
```

*(Render auto-generates this URL from your service name.)*

> [!NOTE]
> **Free tier cold starts**: Render free services spin down after 15 minutes of inactivity. The first request after idle takes ~30 seconds to wake up. This is normal for free tier.

### 4.6 Test the API

Open your browser or PowerShell:

```powershell
Invoke-RestMethod -Uri "https://dms-api-gateway.onrender.com/health" -Method GET
```

Expected response:
```json
{ "status": "ok" }
```

---

## 5. Web Admin — Vercel Free Static Hosting

### 5.1 Create a Vercel Account

1. Open **https://vercel.com**
2. Click **"Sign Up"**
3. Click **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub repositories

### 5.2 Import Your Project

1. On the Vercel Dashboard, click **"Add New..."** → **"Project"**
2. In the **"Import Git Repository"** section, find **`JyotirmoyBhowmik/DMS`** and click **"Import"**
3. Configure the project:

| Setting | Value |
|---|---|
| **Project Name** | `dms-web-admin` |
| **Framework Preset** | `Vite` |
| **Root Directory** | Click **"Edit"** → type `apps/web-admin` → click **"Continue"** |
| **Build Command** | `cd ../.. && npm install -g pnpm@8.15.4 && pnpm install && pnpm --filter @dms/web-admin run build` |
| **Output Directory** | `dist` |
| **Install Command** | *(leave blank — handled in build command)* |

4. Click **"Environment Variables"** and add:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://dms-api-gateway.onrender.com` |

5. Click **"Deploy"**

### 5.3 Wait for Deployment

Vercel will build your React + Vite web admin dashboard. This takes 2-5 minutes.

### 5.4 Note Your Web Admin URL

Once deployed (green checkmark), your web admin dashboard is live at:

```
https://dms-web-admin.vercel.app
```

### 5.5 Test the Web Admin

1. Open `https://dms-web-admin.vercel.app` in your browser
2. You should see the DMS Web Admin Dashboard loading
3. Verify the page renders without console errors (press F12 → Console tab)

### 5.6 Set Up Automatic Deployments

Vercel automatically redeploys whenever you push to `main` on GitHub. No extra configuration needed.

---

## 6. Flutter Android — Build Release APK & AAB

### 6.1 Create the Android Platform Directory

The Flutter project needs the Android platform files generated. Open PowerShell:

```powershell
cd C:\Users\TEST\DMS\apps\mobile-flutter
```

Create the Android project scaffolding:

```powershell
flutter create --platforms=android .
```

This generates the `android/` directory with `build.gradle`, `AndroidManifest.xml`, etc.

### 6.2 Update Android App Configuration

Open `android/app/build.gradle` in your editor and update:

```groovy
android {
    namespace "com.dms.sfa"
    compileSdkVersion 34

    defaultConfig {
        applicationId "com.dms.sfa"
        minSdkVersion 21
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
}
```

### 6.3 Update the API Base URL for Production

Open `lib/main.dart` and ensure your API URL points to the Render backend:

```dart
const String apiBaseUrl = 'https://dms-api-gateway.onrender.com';
```

### 6.4 Create a Signing Key for Google Play

Google Play requires all apps to be digitally signed. Create your upload keystore:

```powershell
keytool -genkey -v -keystore C:\Users\TEST\DMS\apps\mobile-flutter\android\app\upload-keystore.jks -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

You will be prompted for:

| Prompt | What to Enter |
|---|---|
| **Enter keystore password** | Choose a strong password (e.g., `MyStr0ngP@ss2024!`) and **write it down** |
| **Re-enter new password** | Same password |
| **What is your first and last name?** | Your full name |
| **What is the name of your organizational unit?** | `Engineering` |
| **What is the name of your organization?** | Your company name |
| **What is the name of your City or Locality?** | Your city |
| **What is the name of your State or Province?** | Your state |
| **What is the two-letter country code?** | `IN` (for India) or your country code |
| **Is CN=... correct? [no]** | Type `yes` |

> [!CAUTION]
> **NEVER lose this keystore file or password.** You need it for every future app update. Back it up to a secure location immediately. If you lose it, you cannot update your app on Google Play.

### 6.5 Configure Signing in Gradle

Create the file `android/key.properties`:

```properties
storePassword=MyStr0ngP@ss2024!
keyPassword=MyStr0ngP@ss2024!
keyAlias=upload
storeFile=app/upload-keystore.jks
```

Now edit `android/app/build.gradle` to use this keystore. Add these lines ABOVE the `android {` block:

```groovy
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Then INSIDE the `android {` block, add the signing config:

```groovy
android {
    // ... existing config ...

    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 6.6 Add keystore to .gitignore

**Never commit your keystore or key.properties to Git:**

```powershell
Add-Content -Path "C:\Users\TEST\DMS\apps\mobile-flutter\.gitignore" -Value "`nandroid/key.properties`nandroid/app/upload-keystore.jks"
```

### 6.7 Build the Release APK (for direct distribution)

```powershell
cd C:\Users\TEST\DMS\apps\mobile-flutter
flutter build apk --release
```

**Output file location:**
```
build\app\outputs\flutter-apk\app-release.apk
```

This is the file you can share directly with field reps for sideloading.

### 6.8 Build the Release App Bundle (for Google Play Store)

```powershell
flutter build appbundle --release
```

**Output file location:**
```
build\app\outputs\bundle\release\app-release.aab
```

This is the file you upload to Google Play Console.

### 6.9 Verify the Build

```powershell
# Check the APK exists and note its size
Get-Item "build\app\outputs\flutter-apk\app-release.apk" | Select-Object Name, Length

# Check the AAB exists and note its size
Get-Item "build\app\outputs\bundle\release\app-release.aab" | Select-Object Name, Length
```

---

## 7. Publish to Google Play Store

### 7.1 Open Google Play Console

1. Open **https://play.google.com/console** in your browser
2. Sign in with your Gmail account that has Android publish access

### 7.2 Create a New Application

1. Click **"Create app"** button (blue, top right)
2. Fill in the form:

| Field | Value |
|---|---|
| **App name** | `DMS SFA - Field Sales` |
| **Default language** | English (United States) — or your preferred language |
| **App or game** | Select **App** |
| **Free or paid** | Select **Free** |
| **Declarations** | Check both checkboxes (Developer Program Policies, US export laws) |

3. Click **"Create app"**

### 7.3 Complete the Dashboard Setup Tasks

Google Play Console shows a **Dashboard** with required setup steps. Complete each one:

#### 7.3.1 Privacy Policy

1. Go to **App content** → **Privacy policy**
2. Enter your privacy policy URL: `https://dms-web-admin.vercel.app/privacy`
   - If you don't have a privacy policy page yet, you can use a free generator like https://www.freeprivacypolicy.com
   - Or simply create a page on your Vercel deployment
3. Click **Save**

#### 7.3.2 App Access

1. Go to **App content** → **App access**
2. Select **"All functionality is available without special access"**
   - OR if login is required: select **"All or some functionality is restricted"** → click **"Add new instructions"** → provide test login credentials
3. Click **Save**

#### 7.3.3 Ads

1. Go to **App content** → **Ads**
2. Select **"No, my app does not contain ads"**
3. Click **Save**

#### 7.3.4 Content Rating

1. Go to **App content** → **Content rating**
2. Click **"Start questionnaire"**
3. Enter your email address
4. Select category: **"Utility, Productivity, Communication, or other"**
5. Answer all questions with **"No"** (unless your app has specific content)
6. Click **"Save"** → **"Calculate rating"** → **"Apply"**

#### 7.3.5 Target Audience

1. Go to **App content** → **Target audience and content**
2. Select target age group: **"18 and over"**
3. Click **"Next"** → **"Save"**

#### 7.3.6 News App

1. Go to **App content** → **News app**
2. Select **"No, my app is not a news app"**
3. Click **Save**

#### 7.3.7 Data Safety

1. Go to **App content** → **Data safety**
2. Click **"Start"**
3. Answer the questions honestly based on what your app collects:
   - Does your app collect or share user data? **Yes**
   - Is all user data encrypted in transit? **Yes** (your app uses HTTPS + AES-GCM)
   - Types of data collected: Select **"Location"** (GPS check-ins), **"Personal info"** (name, email for login), **"App activity"** (order history)
   - For each data type: Mark as **"Collected"**, purpose: **"App functionality"**
4. Click **"Save"** → **"Submit"**

### 7.4 Set Up the Store Listing

1. Go to **Grow** → **Store presence** → **Main store listing**
2. Fill in:

| Field | Value |
|---|---|
| **App name** | `DMS SFA - Field Sales` |
| **Short description** | `Sales force automation for field representatives. Manage orders, outlets, and GPS check-ins.` |
| **Full description** | Write a detailed description (at least 80 characters, up to 4000). Describe key features: order management, outlet visits, GPS tracking, offline capability, inventory sync. |

3. **Screenshots** (required):
   - You need at least 2 screenshots for phone
   - Take screenshots of your app running: `flutter run` → use Android's screenshot button
   - Or use the Android Emulator: `flutter run` → press the camera icon in the emulator toolbar
   - Upload at minimum: 2 phone screenshots (minimum 320px, maximum 3840px on each side)

4. **App icon** (required):
   - Upload a 512×512 PNG high-resolution icon
   - You can use your company logo or create one at https://www.canva.com

5. Click **"Save"**

### 7.5 Create a Production Release

1. Go to **Release** → **Production** in the left sidebar
2. Click **"Create new release"**
3. **App signing**: 
   - Google Play will ask if you want to use Google Play App Signing
   - Click **"Continue"** (recommended — Google manages your signing key)
4. **Upload your App Bundle**:
   - Click **"Upload"**
   - Navigate to: `C:\Users\TEST\DMS\apps\mobile-flutter\build\app\outputs\bundle\release\app-release.aab`
   - Select the file and wait for upload to complete
5. **Release details**:
   - **Release name**: `1.0.0` (auto-filled from your versionName)
   - **Release notes**: 
     ```
     Initial release of DMS SFA Mobile App.
     
     Features:
     - Order management and placement
     - Outlet visit tracking with GPS check-in
     - Competitor capture and photo documentation
     - Sales target and KPI tracking
     - Offline-first with automatic sync
     - End-to-end AES-256-GCM encryption
     ```
6. Click **"Save"**
7. Click **"Review release"**
8. Review the summary — fix any warnings or errors
9. Click **"Start rollout to Production"**
10. Confirm by clicking **"Rollout"**

> [!NOTE]
> Google Play reviews new apps before publishing. This typically takes **1-3 business days** for the first submission. You will receive an email at your Gmail when the review is complete.

---

## 8. Free APK Distribution via GitHub Releases

For **immediate distribution** while waiting for Google Play approval, publish the APK on GitHub.

### 8.1 Create a GitHub Release

1. Open your browser and go to: **https://github.com/JyotirmoyBhowmik/DMS/releases**
2. Click **"Draft a new release"**
3. Fill in:

| Field | Value |
|---|---|
| **Choose a tag** | Type `v1.0.0` → click **"Create new tag: v1.0.0 on publish"** |
| **Release title** | `DMS SFA Mobile v1.0.0` |
| **Description** | Paste the same release notes from the Play Store submission |

4. **Attach the APK file**:
   - In the "Attach binaries" section, click **"choose your files"**
   - Navigate to: `C:\Users\TEST\DMS\apps\mobile-flutter\build\app\outputs\flutter-apk\app-release.apk`
   - Wait for upload to complete
5. Click **"Publish release"**

### 8.2 Share the Download Link

The APK download link will be:

```
https://github.com/JyotirmoyBhowmik/DMS/releases/download/v1.0.0/app-release.apk
```

Share this URL with your field representatives. They can:
1. Open the link on their Android phone
2. Download the APK
3. Tap to install (they may need to enable "Install from unknown sources" in Settings)

---

## 9. Git Push, Sync & Merge

### 9.1 Stage All Changes

```powershell
cd C:\Users\TEST\DMS
git add -A
```

### 9.2 Review What Will Be Committed

```powershell
git status
```

You should see:
- Modified repository files (all the production-ready code changes)
- New `docs/DEPLOYMENT_GUIDE.md` file (this guide)
- Deleted legacy stub files (already staged)

### 9.3 Commit

```powershell
git commit -m "docs: add comprehensive free-tier deployment guide

- Complete step-by-step deployment guide for Neon.tech PostgreSQL,
  Render.com backend, Vercel web admin, and Google Play Store
- Covers database migration, environment configuration, Android
  signing, Play Store submission, and GitHub Releases APK hosting
- All services use 100% free tier with zero recurring cost"
```

### 9.4 Pull Latest Changes from Remote (Sync)

Before pushing, sync with any changes that might have been pushed by others:

```powershell
git pull origin main --rebase
```

If there are merge conflicts:
1. Open the conflicting files in your editor
2. Resolve conflicts (keep your changes where appropriate)
3. Stage resolved files: `git add <filename>`
4. Continue rebase: `git rebase --continue`

### 9.5 Push to GitHub

```powershell
git push origin main
```

### 9.6 Verify on GitHub

1. Open **https://github.com/JyotirmoyBhowmik/DMS** in your browser
2. Confirm your latest commit appears at the top
3. Navigate to `docs/DEPLOYMENT_GUIDE.md` and confirm it renders correctly
4. Check that Vercel auto-deploys (if already connected)

### 9.7 If Working on a Feature Branch (Merge)

If you prefer to use a feature branch instead of pushing directly to `main`:

```powershell
# Create and switch to a feature branch
git checkout -b release/v1.0.0-production

# Commit and push the feature branch
git add -A
git commit -m "docs: add comprehensive free-tier deployment guide"
git push origin release/v1.0.0-production
```

Then create a Pull Request on GitHub:
1. Go to **https://github.com/JyotirmoyBhowmik/DMS**
2. Click the **"Compare & pull request"** banner (appears after pushing a new branch)
3. Title: `Release v1.0.0 — Production Deployment with Free-Tier Guide`
4. Description: Summarize the changes
5. Click **"Create pull request"**
6. Review the diff
7. Click **"Merge pull request"** → **"Confirm merge"**
8. (Optional) Delete the feature branch after merge

---

## 10. Post-Deployment Verification

After everything is deployed, verify each component works end-to-end:

### 10.1 Database Verification

In the Neon SQL Editor, run:
```sql
-- Verify tables exist
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';

-- Verify RLS policies exist
SELECT schemaname, tablename, policyname FROM pg_policies ORDER BY tablename;
```

### 10.2 Backend API Verification

```powershell
# Health check
Invoke-RestMethod -Uri "https://dms-api-gateway.onrender.com/health"

# Test a GET endpoint (adjust path based on your routes)
Invoke-RestMethod -Uri "https://dms-api-gateway.onrender.com/api/v1/distributors" -Headers @{ "Content-Type" = "application/json" }
```

### 10.3 Web Admin Verification

1. Open `https://dms-web-admin.vercel.app` in your browser
2. Open Developer Tools (F12) → Network tab
3. Verify API calls go to your Render backend URL
4. Verify no CORS errors in the Console tab

### 10.4 Mobile App Verification

1. Install the APK on an Android device or emulator
2. Open the app
3. Verify it connects to the backend API
4. Test a basic flow (e.g., login, view dashboard, create an order)

---

## 11. Troubleshooting

### Problem: Render build fails with "pnpm not found"
**Fix**: Ensure the build command starts with `npm install -g pnpm@8.15.4 && ...`

### Problem: Vercel build fails with "workspace dependency not found"
**Fix**: The build command must install from the monorepo root. Use:
```
cd ../.. && npm install -g pnpm@8.15.4 && pnpm install && pnpm --filter @dms/web-admin run build
```

### Problem: CORS errors when web admin calls API
**Fix**: Ensure `CORS_ORIGIN=*` is set in Render environment variables. For production, restrict to your Vercel domain: `CORS_ORIGIN=https://dms-web-admin.vercel.app`

### Problem: Neon database connection timeout
**Fix**: Ensure `DB_SSL=true` is set. Neon requires SSL connections. Also verify the connection string includes `?sslmode=require`.

### Problem: Render free service is slow on first request
**Explanation**: Free tier services spin down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. This is a limitation of the free tier and does not affect paid plans.

### Problem: Flutter build fails with "Android SDK not found"
**Fix**: Run `flutter doctor` and follow the instructions to install the Android SDK. Ensure `ANDROID_HOME` environment variable is set.

### Problem: Google Play rejects the AAB file
**Fix**: Ensure you ran `flutter build appbundle --release` (not `--debug`). Verify the app is signed with your upload keystore.

---

## Architecture Summary

```mermaid
flowchart LR
    subgraph "Field Reps (Android)"
        APK["DMS SFA Mobile App<br/>(Flutter APK / Play Store)"]
    end

    subgraph "Admin Users (Browser)"
        WEB["DMS Web Admin<br/>(Vercel - vercel.app)"]
    end

    subgraph "Render.com (Free Tier)"
        GW["API Gateway<br/>(Node.js)"]
    end

    subgraph "Neon.tech (Free Tier)"
        DB[("PostgreSQL 15<br/>(0.5 GiB Free)")]
    end

    APK -->|"HTTPS REST API"| GW
    WEB -->|"HTTPS REST API"| GW
    GW -->|"SSL + RLS"| DB
```

| Service | URL | Auto-Deploys |
|---|---|---|
| **Web Admin** | `https://dms-web-admin.vercel.app` | ✅ On every `git push` to `main` |
| **API Gateway** | `https://dms-api-gateway.onrender.com` | ✅ On every `git push` to `main` |
| **Database** | Neon Dashboard | N/A (persistent) |
| **Android App** | Google Play Store | Manual upload per release |
| **APK Download** | GitHub Releases | Manual per release |
