# Car Service Tracker - Product Requirements Document

## Original Problem Statement
Build a web-based app for tracking car service records with AI-powered OCR for receipt scanning. Extended with a "Repair Estimate Checker" that extracts, normalizes, and classifies mechanic quote line items. Now includes **region-aware maintenance schedule system** with US support and **simplified UX** that hides technical complexity from users.

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, Framer Motion, Recharts
- Backend: FastAPI, Motor (MongoDB async), Pydantic
- Auth: JWT + Emergent-managed Google OAuth
- AI/OCR: emergentintegrations (OpenAI GPT-5.2 vision)

## What's Been Implemented

### Core Features
- JWT + Google OAuth authentication
- Multi-vehicle management (cascading Make/Model/Year)
- Service record CRUD with categorized types + bundle pricing
- AI OCR for receipt scanning (images, PDFs, camera)
- Dashboard with Recharts, CSV/PDF export, reminders
- PWA Support: manifest.json, service-worker.js, Apple meta tags

### Repair Estimate Checker
- OCR extraction, deep normalization, 3-tier matching, classification
- Classification Rules Schema (33 rules)
- 36 automated pytest tests — all passing
- Match Debug Page (`/match-debug`)
- Debug API with full rule trace and inferred logic

### Region-Aware System (March 2026)
- **Region Profiles**: CA (Canada, km, CAD) and US (United States, mi, USD)
- **Verdict Engine**: Computes due_status from stored rules
- **US Mazda CX-5 2022 Rules**: 15 rules (Schedule 1 normal + Schedule 2 severe)
- **9 severe driving conditions** stored in US profile
- **US service aliases** added to synonym database

### UX Simplification (April 2026)
- **Removed schedule selectors** from upload dialog — inferred internally as SCHEDULE_1
- **Clean upload flow**: Region → Vehicle → Mileage → File → Analyze
- **Region-first with persistence**: Auto-detected from browser locale, persisted in localStorage
- **Dynamic labels**: "Current Mileage" (US) / "Current Odometer" (CA), region-appropriate placeholders/helper text
- **Post-analysis driving conditions toggle**: "Normal driving" / "Short trips / extreme conditions" on results page (US only)
- **Reanalyze endpoint**: `POST /api/estimates/{id}/reanalyze` re-runs analysis with different schedule
- **Auto-detect region from OCR**: Checks for USD/CAD, ZIP/postal codes, state abbreviations in scanned text
- **Detected region banner**: Shows suggestion if OCR-detected region differs from selected region
- **Debug mode**: Shows inferred_logic with default_schedule_applied and region_based logic

### Public/Guest Estimate Access (Feb 2026)
- **Public estimate checker page**: `/estimate-checker` accessible without login
- **Public API endpoints**: All under `/api/estimates/public/*` — no auth required
  - `POST /api/estimates/public/analyze` — Upload & analyze as guest (returns `guest_token`)
  - `GET /api/estimates/public/results/{id}?guest_token=xxx` — View guest results
  - `POST /api/estimates/public/results/{id}/reanalyze?guest_token=xxx` — Re-analyze with different driving conditions
  - `POST /api/estimates/public/claim/{id}` — Auth-required, links guest estimate to user
  - `GET /api/estimates/public/region-profiles` — Region profiles without auth
  - `GET /api/estimates/public/supported-vehicles` — Supported vehicles without auth
- **Guest-to-user flow**: Guest creates estimate → views results → clicks "Save to Garage" → redirected to login with `returnTo` param → after login, estimate auto-claimed and user redirected to authenticated detail page
- **Login/Register returnTo**: Both pages handle `returnTo` query parameter for post-auth redirect
- **Landing page CTA**: "Check an Estimate" and "Get Started Free" buttons now navigate to `/estimate-checker` (always, regardless of login state)

## Key API Endpoints
- `GET /api/estimates/region-profiles` — Returns CA/US profiles
- `GET /api/estimates/supported-vehicles` — Returns vehicles with available regions
- `POST /api/estimates` — Upload + analyze (accepts region_code, current_mileage; schedule defaults to SCHEDULE_1)
- `POST /api/estimates/{id}/reanalyze` — Re-run analysis with different driving conditions
- `POST /api/estimates/debug/match` — Enhanced debug with verdict, rule trace, inferred logic
- `POST /api/estimates/public/analyze` — Public guest analyze (no auth, returns guest_token)
- `GET /api/estimates/public/results/{id}` — Public guest results (requires guest_token query param)
- `POST /api/estimates/public/claim/{id}` — Claim guest estimate (requires auth)
- CRUD: vehicles, service-records, reminders, estimates

## Test Files
- `/app/backend/tests/test_estimate_matching.py` — 36 pytest cases (all passing)
- `/app/backend/tests/test_ux_simplification.py` — UX simplification tests
- `/app/backend/tests/test_public_estimate_flow.py` — Public/guest flow tests
- `/app/test_reports/iteration_6.json` — Latest: 100% pass rate (backend 23/23, all frontend flows)

## Backlog
- P1: "Operating Conditions" checklist UI on results page (check specific severe conditions)
- P1: Add more US makes/models (Toyota, Honda, etc.)
- P2: Modularize `server.py` — move auth & service-record routes into `/routers`
- P2: Remove unused `file-saver` dependency
- P3: Capacitor native apps for iOS/Android
