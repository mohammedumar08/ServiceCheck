# Car Service Tracker - Product Requirements Document

## Original Problem Statement
Build a web based app for tracking the Car service records by user uploading the photo or manually entering the services with price. Service records should store type of service made, date, price, location, odometer in km/miles.

## User Choices
- AI-powered OCR using OpenAI GPT-5.2
- Kilometers (km) as default unit
- Multiple vehicle support
- Service reminders/notifications
- Export records (CSV/JSON)
- JWT-based authentication

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + Framer Motion
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Authentication**: JWT tokens with bcrypt password hashing
- **OCR Integration**: OpenAI GPT-5.2 via emergentintegrations library

## User Personas
1. **Primary**: Car owners wanting to track vehicle maintenance history
2. **Secondary**: Fleet managers tracking multiple vehicles

## Core Requirements (Static)
- User authentication (register/login)
- Multi-vehicle management (CRUD)
- Service record tracking (type, date, price, location, odometer)
- Photo upload with AI OCR extraction
- Service reminders with due dates
- Data export (CSV/JSON)

## What's Been Implemented (January 2026)
### Backend
- [x] JWT authentication (register, login, profile)
- [x] Vehicle CRUD endpoints
- [x] Service Record CRUD endpoints
- [x] Reminder CRUD endpoints
- [x] OCR extraction endpoint using GPT-5.2
- [x] Export endpoints (CSV, JSON)
- [x] Dashboard stats endpoint

### Frontend
- [x] Landing page with hero section and features
- [x] Auth pages (Login, Register)
- [x] Dashboard with stats cards and recent activity
- [x] Vehicles page (add, edit, delete)
- [x] Service Records page (manual entry + OCR upload)
- [x] Reminders page with status badges
- [x] Export page (CSV/JSON)
- [x] Dark/Light theme toggle
- [x] Responsive design

## Prioritized Backlog

### P0 (Critical) - Done
- ✅ Core CRUD operations
- ✅ Authentication
- ✅ AI OCR integration

### P1 (High Priority) - Future
- [ ] Push notifications for reminders
- [ ] PDF export with formatted report
- [ ] Service cost analytics charts

### P2 (Nice to Have)
- [ ] Multiple user roles (admin/viewer)
- [ ] Vehicle image gallery
- [ ] Service center directory
- [ ] Mobile app (React Native)

## Next Action Items
1. Add service cost analytics with charts (Recharts)
2. Implement PDF export with ReportLab
3. Add email notifications for due reminders
4. Add vehicle image upload support
