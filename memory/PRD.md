# Car Service Tracker - Product Requirements Document

## Original Problem Statement
Build a web-based app for tracking car service records. Users can upload receipts or manually enter service details. Extended with a "Repair Estimate Checker" that extracts, normalizes, and classifies mechanic quote line items.

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, Framer Motion, Recharts
- Backend: FastAPI (Python), Pydantic, Motor (MongoDB async)
- Auth: JWT + Emergent-managed Google OAuth
- AI/OCR: emergentintegrations (OpenAI GPT-5.2 vision)
- PDF: reportlab (generation), PyMuPDF (PDF-to-image for OCR)

## What's Been Implemented
- Full JWT + Google OAuth authentication
- Multi-vehicle management with cascading Make/Model/Year dropdowns
- Service record CRUD with categorized service types and bundle pricing
- AI-powered OCR for receipt scanning (images + PDFs + camera)
- Dashboard with Recharts (monthly/yearly expenses)
- CSV and PDF export
- Service reminders
- Delete account + global 401 interceptor
- **Repair Estimate Checker**:
  - OCR extraction via GPT-5.2 vision
  - Deep normalization pipeline (strips dealer codes, noise, normalizes plurals/verbs)
  - 3-tier matching: exact -> contains -> token-overlap fuzzy
  - Convert estimate items to service records
- **Classification Rules Schema** (updated Mar 2026):
  - Fields: service_key, display_name, category, severity, default_recommendation_code, recommendation_text, user_explanation, description, region_scope, is_active
  - 33 seeded rules covering required/conditional/not_required/informational categories
  - recommendation_text and user_explanation rendered directly from API (no frontend hardcoding)

## DB Schema: service_classification_rules
```json
{
  "service_key": "fuel_injector_cleaning",
  "display_name": "Fuel Injector Cleaning",
  "category": "not_required",
  "severity": "medium",
  "default_recommendation_code": "likely_optional",
  "recommendation_text": "Usually not part of standard maintenance.",
  "user_explanation": "Consider this only if there are drivability symptoms...",
  "description": "Typically not part of standard manufacturer maintenance...",
  "region_scope": "global",
  "is_active": true
}
```

## Recommendation Codes
- `recommended_now` - Standard maintenance, recommended
- `maybe_needed` - Conditional, depends on symptoms/wear
- `likely_optional` - Usually optional / upsell
- `cannot_determine` - Informational or unmatched

## Category Values
- `required` - Manufacturer scheduled maintenance
- `conditional` - Depends on wear/symptoms/conditions
- `not_required` - Usually optional / upsell
- `informational` - Info-only items (inspections, checks)
- `unknown` - Unmatched service

## Code Architecture
```
/app/backend/
  server.py, routers/estimates.py, services/estimate_analyzer.py
  seed_loader.py, seed/*.json, tests/test_estimate_matching.py
/app/frontend/src/
  pages/EstimatesPage.js, EstimateDetailPage.js, DashboardPage.js, ...
  components/DashboardLayout.js, context/AuthContext.js
```

## Backlog
- P1: Test with real dealer estimates end-to-end
- P2: PWA support
- P3: Capacitor native apps
- P3: Modularize server.py routes
