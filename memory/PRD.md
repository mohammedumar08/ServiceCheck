# Car Service Tracker - Product Requirements Document

## Original Problem Statement
Build a web-based app for tracking car service records. Users should be able to upload a photo of a receipt or manually enter service details. The service records should store the type of service, date, price, location, and odometer reading in km/miles.

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

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, Framer Motion
- Backend: FastAPI (Python), Pydantic
- Database: MongoDB (motor async driver)
- Auth: JWT + Emergent-managed Google OAuth
- AI/OCR: emergentintegrations (OpenAI GPT-5.2)
- PDF: reportlab (generation), PyMuPDF (PDF-to-image for OCR)

## What's Been Implemented (Complete)
- Full-stack Car Service Tracker app
- JWT email/password authentication
- Emergent-managed Google OAuth
- AI-powered OCR with multi-line item extraction
- PDF and image upload support + camera capture
- CSV and PDF export
- Multi-vehicle management with CRUD
- Service record CRUD
- Service reminders
- Dashboard with stats
- Responsive dark automotive theme UI
- ARCHITECTURE.md and README.md

## Bug Fixes
- [Feb 2026] Fixed manual login redirect on custom domain: Removed `withCredentials: true` from `/auth/me` call (CORS rejection), replaced `window.location.href` with `navigate()`.
- [Feb 2026] Fixed file upload closing Add Service dialog: Dialog now stays open during OCR processing and only closes when extracted services dialog opens.

## Known Issues
- Google OAuth on custom domain: Requires Emergent Support to whitelist `getservicecheck.com` in OAuth redirect URIs. NOT a code issue.
- File downloads blocked in preview iframe: Workaround with `window.open()` accepted.

## Backlog
- P1: PWA support (Add to Home Screen)
- P2: Capacitor native app wrapping (iOS/Android)
- P2: Remove unused `file-saver` dependency
