# Car Service Tracker - Product Requirements Document

## Original Problem Statement
Build a web-based app for tracking car service records with AI-powered OCR for receipt scanning. Extended with a "Repair Estimate Checker" that extracts, normalizes, and classifies mechanic quote line items.

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, Framer Motion, Recharts
- Backend: FastAPI, Motor (MongoDB async), Pydantic
- Auth: JWT + Emergent-managed Google OAuth
- AI/OCR: emergentintegrations (OpenAI GPT-5.2 vision)

## What's Been Implemented
- JWT + Google OAuth authentication
- Multi-vehicle management (cascading Make/Model/Year)
- Service record CRUD with categorized types + bundle pricing
- AI OCR for receipt scanning (images, PDFs, camera)
- Dashboard with Recharts, CSV/PDF export, reminders
- **Repair Estimate Checker**: OCR extraction, deep normalization, 3-tier matching, classification
- **Classification Rules Schema** (33 rules): service_key, display_name, category, severity, default_recommendation_code, recommendation_text, user_explanation, description, region_scope, is_active
- **36 automated pytest tests** — all passing, covering every service type
- **Match Debug Page** (`/match-debug`) — paste any dealer line to see normalization + matching + classification pipeline output
- **Debug API** (`POST /api/estimates/debug/match`) — returns full pipeline breakdown as JSON

## DB Schema: service_classification_rules
Fields: service_key, display_name, category, severity, default_recommendation_code, recommendation_text, user_explanation, description, region_scope, is_active

## Recommendation Codes
- `recommended_now` — Standard maintenance
- `maybe_needed` — Conditional
- `likely_optional` — Usually optional/upsell
- `cannot_determine` — Informational or unmatched

## Categories
- `required`, `conditional`, `not_required`, `informational`, `unknown`

## Key API Endpoints
- `POST /api/estimates/debug/match` — Debug matcher with any line text
- `POST /api/estimates` — Upload + analyze estimate
- `GET /api/estimates`, `GET /api/estimates/{id}`, `DELETE /api/estimates/{id}`
- `POST /api/estimates/{id}/convert` — Convert items to service records

## Test Files
- `/app/backend/tests/test_estimate_matching.py` — 36 pytest cases + report generator
- `/app/test_reports/matching_pipeline_report.json` — Readable test report

## Backlog
- P1: Test with real dealer estimates end-to-end
- P2: PWA support
- P3: Capacitor native apps, server.py modularization
