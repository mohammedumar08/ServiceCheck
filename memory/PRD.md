# Car Service Tracker - Product Requirements Document

## Original Problem Statement
Build a web-based app for tracking car service records. Users should be able to upload a photo of a receipt or manually enter service details. The service records should store the type of service, date, price, location, and odometer reading in km/miles.

**Extended Requirement**: Add a "Repair Estimate Checker" feature. Users upload an estimate image/PDF, and the system extracts line items, normalizes them via synonym matching, and classifies them (required/conditional/optional) based on predefined vehicle maintenance rules.

## Core Requirements
- User Authentication: JWT-based (email/password) and Google Social Login
- AI-powered OCR: Extract service details from uploaded receipts using OpenAI GPT-5.2
- Multi-vehicle management
- Manual add/edit service records
- Upload receipts via file picker (Image/PDF) or camera
- Review and confirm OCR-extracted data before saving
- Service reminders
- Export to CSV and PDF
- Odometer unit: Kilometers (km) default
- **Repair Estimate Checker**: Upload mechanic quotes, AI-extract line items, classify as required/conditional/optional, show maintenance schedules, convert approved items to service records

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, Framer Motion, Recharts
- Backend: FastAPI (Python), Pydantic
- Database: MongoDB (motor async driver)
- Auth: JWT + Emergent-managed Google OAuth
- AI/OCR: emergentintegrations (OpenAI GPT-5.2 vision)
- PDF: reportlab (generation), PyMuPDF (PDF-to-image for OCR)

## What's Been Implemented
- Full-stack Car Service Tracker app
- JWT email/password authentication
- Emergent-managed Google OAuth
- AI-powered OCR with multi-line item extraction
- PDF and image upload support + camera capture
- CSV and PDF export
- Multi-vehicle management with CRUD
- Service record CRUD with categorized service types
- Bundle pricing (single vs split entries) for OCR
- Service reminders
- Dashboard with Recharts (monthly/yearly expenses, category breakdown)
- Cascading Make -> Model -> Year vehicle dropdowns
- Responsive dark automotive theme UI
- Delete account capability + global 401 interceptor
- **[Mar 2026] Repair Estimate Checker** - Complete feature:
  - Backend: OCR extraction via GPT-5.2 vision, synonym matching, classification rules, maintenance schedule lookup
  - Frontend: Estimates list page, upload dialog, detail page with classification badges
  - Convert estimate items to service records
  - DB seed data: 33 classification rules, 88 synonyms, 65 maintenance schedules

## Bug Fixes
- [Feb 2026] Fixed manual login redirect on custom domain
- [Feb 2026] Fixed file upload closing Add Service dialog
- [Mar 2026] Fixed odometer=None crash when converting estimate items to service records

## Known Issues
- Google OAuth on custom domain: Requires Emergent Support to whitelist domain
- File downloads blocked in preview iframe: Workaround with window.open() accepted

## Code Architecture
```
/app/
├── backend/
│   ├── server.py          # Main FastAPI app with auth, vehicles, services, OCR, export, stats
│   ├── routers/
│   │   └── estimates.py   # Estimate CRUD, OCR extraction, convert-to-service
│   ├── services/
│   │   └── estimate_analyzer.py  # Synonym matching, classification, maintenance lookup
│   ├── seed_loader.py     # DB seed initialization
│   └── seed/              # JSON seed data files
├── frontend/
│   └── src/
│       ├── App.js
│       ├── components/DashboardLayout.js
│       ├── context/AuthContext.js
│       └── pages/
│           ├── EstimatesPage.js      # NEW
│           ├── EstimateDetailPage.js  # NEW
│           ├── DashboardPage.js
│           ├── ServiceRecordsPage.js
│           └── ...
```

## Backlog
- P2: PWA support (Add to Home Screen)
- P2: Multi-image upload for multi-page receipts
- P3: Capacitor native app wrapping (iOS/Android)
- P3: Remove unused file-saver dependency
- P3: Modularize server.py routes into routers/ folder
