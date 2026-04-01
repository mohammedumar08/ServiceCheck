# Car Service Tracker - Product Requirements Document

## Original Problem Statement
Build a web-based app for tracking car service records with AI-powered OCR for receipt scanning. Extended with a "Repair Estimate Checker" that extracts, normalizes, and classifies mechanic quote line items. Now includes **region-aware maintenance schedule system** with US support.

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

### Repair Estimate Checker
- OCR extraction, deep normalization, 3-tier matching, classification
- Classification Rules Schema (33 rules)
- 36 automated pytest tests — all passing
- Match Debug Page (`/match-debug`)
- Debug API (`POST /api/estimates/debug/match`)
- Vehicle dropdown filter: Convert dialog only shows garage vehicles matching estimate's Make & Model
- PWA Support: manifest.json, service-worker.js, Apple meta tags, offline caching

### Region-Aware System (NEW - March 2026)
- **Region Profiles**: CA (Canada, km, CAD) and US (United States, mi, USD) with schedule selection logic
- **Verdict Engine** (`verdict_engine.py`): Computes due_status from stored rules — `due_now`, `due_soon`, `not_due`, `condition_based`, `schedule_known`, `completed`, `inspection`, `unknown`
- **US Mazda CX-5 2022 Maintenance Rules**: 15 rules seeded from owner's manual
  - Schedule 1 (Normal): Oil flex, tire rotation 7500mi, spark plugs (2.5T: 40k, non-turbo: 75k), coolant first/recurring, air filters milestone
  - Schedule 2 (Severe): Oil flex+fixed (5000mi), tire rotation 5000mi, same spark/coolant, cabin air filter recurring
- **9 severe driving conditions** stored in US profile
- **US service aliases** added to synonym database
- **Frontend region selector**: Canada / United States in upload dialog and debug page
- **US-specific inputs**: Current mileage, Schedule 1/2 selector
- **Region-aware display**: Due status badges, miles/km units, schedule badges, rule trace
- **Enhanced debug mode**: Full rule trace with rule_selected, rules_found, schedule_code, engine_filter

## DB Schema

### region_profiles
`{region_code, country_name, distance_unit, currency_code, currency_symbol, location_levels, default_language, default_schedule_selection_logic, severe_driving_conditions, is_active}`

### maintenance_schedule_rules
`{rule_id (unique), make, model, year, engine, trim, region, service_key, schedule_code, interval_type, trigger_type, maintenance_mode, interval_km, interval_miles, interval_months, interval_years, max_miles, max_months, first_interval_km/miles, first_interval_years, repeat_interval_km/miles, repeat_interval_years, replace_miles, severe_only, explanation_template, rule_type, notes, source_name, source_reference, is_active}`

### service_classification_rules
`{service_key, display_name, category, severity, default_recommendation_code, recommendation_text, user_explanation, description, region_scope, is_active}`

### repair_estimates
`{id, user_id, make, model, year, provider, estimate_date, total_quoted, region_code, schedule_code, current_mileage, distance_unit, currency_code, status}`

## Key API Endpoints
- `GET /api/estimates/region-profiles` — Returns CA/US profiles
- `GET /api/estimates/supported-vehicles` — Returns vehicles with available regions
- `POST /api/estimates/debug/match` — Enhanced with region_code, schedule_code, current_mileage, returns verdict + rule_trace
- `POST /api/estimates` — Accepts region_code, schedule_code, current_mileage
- CRUD: vehicles, service-records, reminders, estimates

## Test Files
- `/app/backend/tests/test_estimate_matching.py` — 36 pytest cases (all passing)
- `/app/backend/tests/test_region_feature.py` — Region feature tests
- `/app/test_reports/iteration_4.json` — Latest: 100% pass rate

## Backlog
- P1: Add more US makes/models (Toyota, Honda, etc.)
- P2: Modularize `server.py` — move auth & service-record routes into `/routers`
- P2: Remove unused `file-saver` dependency
- P3: Capacitor native apps for iOS/Android
