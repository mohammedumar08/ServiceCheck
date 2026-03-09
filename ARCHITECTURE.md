# Car Service Tracker - Application Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   USERS                                          │
│                        (Browser / Mobile Device)                                 │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                            │
│                         React 19 + Tailwind CSS                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Landing    │  │    Auth     │  │  Dashboard  │  │  Vehicles   │             │
│  │    Page     │  │   Pages     │  │    Page     │  │    Page     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Services   │  │  Reminders  │  │   Export    │  │   Shadcn    │             │
│  │    Page     │  │    Page     │  │    Page     │  │ Components  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                                  │
│  Libraries: React Router, Axios, Framer Motion, Lucide Icons, date-fns          │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │ HTTPS (Port 3000)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           KUBERNETES INGRESS                                     │
│                    (Routes /api/* to Backend, else to Frontend)                  │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                             │
│                      FastAPI (Python 3.11+)                                      │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                           API ROUTES (/api)                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐          │   │
│  │  │   Auth     │  │  Vehicles  │  │  Service   │  │  Reminders │          │   │
│  │  │ /auth/*    │  │ /vehicles  │  │  Records   │  │ /reminders │          │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                          │   │
│  │  │    OCR     │  │   Export   │  │   Stats    │                          │   │
│  │  │ /ocr/*     │  │ /export/*  │  │ /stats/*   │                          │   │
│  │  └────────────┘  └────────────┘  └────────────┘                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Libraries: Motor (async MongoDB), PyJWT, bcrypt, httpx, reportlab              │
└───────────┬─────────────────────────────────┬───────────────────────────────────┘
            │                                 │
            ▼                                 ▼
┌───────────────────────┐         ┌───────────────────────────────────────────────┐
│       MongoDB         │         │              EXTERNAL SERVICES                 │
│    (Port 27017)       │         │                                               │
│                       │         │  ┌─────────────────┐  ┌─────────────────────┐ │
│  Collections:         │         │  │  Emergent Auth  │  │   OpenAI GPT-5.2    │ │
│  ├── users            │         │  │  (Google OAuth) │  │   (OCR Service)     │ │
│  ├── vehicles         │         │  │                 │  │                     │ │
│  ├── service_records  │         │  │ auth.emergent   │  │ emergentintegrations│ │
│  ├── reminders        │         │  │   agent.com     │  │     library         │ │
│  └── user_sessions    │         │  └─────────────────┘  └─────────────────────┘ │
│                       │         │                                               │
└───────────────────────┘         └───────────────────────────────────────────────┘
```

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION OPTIONS                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

OPTION 1: Email/Password (JWT)
══════════════════════════════

┌────────┐      POST /api/auth/login       ┌─────────┐      Query      ┌─────────┐
│ Client │ ──────────────────────────────► │ Backend │ ───────────────►│ MongoDB │
│        │   {email, password}             │         │                 │  users  │
└────────┘                                 └─────────┘                 └─────────┘
    ▲                                           │
    │         {access_token, user}              │ Verify password
    └───────────────────────────────────────────┘ Generate JWT


OPTION 2: Google OAuth (Emergent Auth)
══════════════════════════════════════

┌────────┐                              ┌──────────────┐
│ Client │ ────────────────────────────►│ Emergent Auth│
│        │  Redirect to auth.emergent   │   (Google)   │
└────────┘        agent.com             └──────────────┘
    ▲                                          │
    │  Redirect to /dashboard#session_id=xxx   │
    └──────────────────────────────────────────┘
                      │
                      ▼
┌────────┐   POST /api/auth/google/session   ┌─────────┐    GET session-data   ┌──────────────┐
│ Client │ ─────────────────────────────────►│ Backend │ ─────────────────────►│ Emergent Auth│
│        │      {session_id}                 │         │                       │    Server    │
└────────┘                                   └─────────┘                       └──────────────┘
    ▲                                             │
    │  {access_token, user} + Set Cookie          │ Create/Update user
    └─────────────────────────────────────────────┘ Store session
```

---

## Data Flow - Service Record with OCR

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    OCR EXTRACTION FLOW (Upload Receipt Photo)                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌────────┐                    ┌─────────┐                    ┌─────────────────┐
│ Client │   Upload Image     │ Backend │   Send Base64      │  OpenAI GPT-5.2 │
│        │ ──────────────────►│  /api/  │ ──────────────────►│  (via Emergent  │
│        │   (multipart)      │  ocr/   │   Image + Prompt   │  Integrations)  │
│        │                    │ extract │                    │                 │
└────────┘                    └─────────┘                    └─────────────────┘
    ▲                              ▲                               │
    │                              │ Parse JSON Response           │
    │  {service_type, date,        └───────────────────────────────┘
    │   price, location,              Extracted: service_type,
    │   odometer, provider}           date, price, location,
    └─────────────────────────────    odometer, provider
           Return to form
           for confirmation
```

---

## Database Schema

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MONGODB COLLECTIONS                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│       USERS         │     │    USER_SESSIONS    │     │      VEHICLES       │
├─────────────────────┤     ├─────────────────────┤     ├─────────────────────┤
│ id: string (UUID)   │◄────│ user_id: string     │     │ id: string (UUID)   │
│ email: string       │     │ session_token: str  │     │ user_id: string ────┼──┐
│ name: string        │     │ expires_at: datetime│     │ make: string        │  │
│ password: string?   │     │ created_at: datetime│     │ model: string       │  │
│ picture: string?    │     └─────────────────────┘     │ year: integer       │  │
│ created_at: datetime│                                 │ license_plate: str? │  │
└─────────────────────┘                                 │ vin: string?        │  │
         ▲                                              │ color: string?      │  │
         │                                              │ current_odometer:int│  │
         │                                              │ created_at: datetime│  │
         │                                              └─────────────────────┘  │
         │                                                        ▲              │
         │                                                        │              │
         │    ┌─────────────────────┐     ┌─────────────────────┐ │              │
         │    │   SERVICE_RECORDS   │     │      REMINDERS      │ │              │
         │    ├─────────────────────┤     ├─────────────────────┤ │              │
         └────┤ user_id: string     │     │ user_id: string ────┼─┘              │
              │ vehicle_id: string ─┼─────│ vehicle_id: string ─┼────────────────┘
              │ id: string (UUID)   │     │ id: string (UUID)   │
              │ service_type: string│     │ service_type: string│
              │ date: string        │     │ due_date: string    │
              │ price: float        │     │ due_odometer: int?  │
              │ location: string?   │     │ notes: string?      │
              │ odometer: integer   │     │ completed: boolean  │
              │ notes: string?      │     │ created_at: datetime│
              │ provider: string?   │     └─────────────────────┘
              │ created_at: datetime│
              └─────────────────────┘
```

---

## API Endpoints Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              REST API ENDPOINTS                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

Authentication
──────────────
POST   /api/auth/register        → Create account (email/password)
POST   /api/auth/login           → Login (email/password) → JWT token
POST   /api/auth/google/session  → Exchange Google OAuth session
POST   /api/auth/logout          → Clear session
GET    /api/auth/me              → Get current user

Vehicles
────────
GET    /api/vehicles             → List user's vehicles
POST   /api/vehicles             → Add new vehicle
GET    /api/vehicles/{id}        → Get vehicle details
PUT    /api/vehicles/{id}        → Update vehicle
DELETE /api/vehicles/{id}        → Delete vehicle + related records

Service Records
───────────────
GET    /api/service-records      → List records (optional: ?vehicle_id=)
POST   /api/service-records      → Add service record
GET    /api/service-records/{id} → Get record details
PUT    /api/service-records/{id} → Update record
DELETE /api/service-records/{id} → Delete record

OCR
───
POST   /api/ocr/extract          → Upload image → Extract service data

Reminders
─────────
GET    /api/reminders            → List reminders (?completed=true/false)
POST   /api/reminders            → Create reminder
PUT    /api/reminders/{id}       → Update/complete reminder
DELETE /api/reminders/{id}       → Delete reminder

Export
──────
GET    /api/export/csv           → Download CSV (?vehicle_id=)
GET    /api/export/pdf           → Download PDF (?vehicle_id=)

Dashboard
─────────
GET    /api/stats/dashboard      → Get aggregated statistics
```

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TECHNOLOGY STACK                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

FRONTEND                          BACKEND                         DATABASE
────────                          ───────                         ────────
• React 19                        • FastAPI                       • MongoDB
• Tailwind CSS                    • Python 3.11+                  • Motor (async)
• Shadcn/UI                       • Pydantic                      
• Framer Motion                   • PyJWT                         EXTERNAL
• React Router v6                 • bcrypt                        ────────
• Axios                           • httpx                         • Emergent Auth
• Lucide Icons                    • reportlab (PDF)               • OpenAI GPT-5.2
• date-fns                        • emergentintegrations          

INFRASTRUCTURE
──────────────
• Kubernetes (container orchestration)
• Nginx (ingress proxy)
• Supervisor (process management)
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DEPLOYMENT OPTIONS                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

OPTION 1: Emergent Platform (Recommended)
─────────────────────────────────────────
┌─────────────────────────────────────────────┐
│            Emergent Cloud                    │
│  ┌─────────────────────────────────────┐    │
│  │     Your App (auto-managed)         │    │
│  │  ┌──────────┐  ┌──────────┐        │    │
│  │  │ Frontend │  │ Backend  │        │    │  ←── One-click deploy
│  │  │ (React)  │  │ (FastAPI)│        │    │       50 credits/month
│  │  └──────────┘  └──────────┘        │    │       Custom domain support
│  │        └──────────┼─────────────────┼────┼───► MongoDB included
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘


OPTION 2: Self-Hosted (Docker)
──────────────────────────────
┌─────────────────────────────────────────────┐
│           Your Server (VPS/Cloud)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Frontend │ │ Backend  │ │ MongoDB  │    │
│  │ Container│ │ Container│ │ Container│    │
│  │  :3000   │ │  :8001   │ │  :27017  │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘    │
│       └────────────┴────────────┘          │
│              docker-compose                 │
└─────────────────────────────────────────────┘


OPTION 3: Split Deployment (Vercel + Railway)
─────────────────────────────────────────────
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Vercel     │    │   Railway    │    │ MongoDB Atlas│
│  (Frontend)  │───►│  (Backend)   │───►│  (Database)  │
│    Free      │    │   ~$5/mo     │    │    Free      │
└──────────────┘    └──────────────┘    └──────────────┘
```
