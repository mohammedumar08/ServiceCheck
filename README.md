# Car Service Tracker

A full-featured web application for tracking vehicle service records with AI-powered OCR extraction.

![Car Service Tracker](https://images.unsplash.com/photo-1758411897888-3ca658535fdf?w=800)

## Features

- **AI-Powered OCR**: Upload service receipts and automatically extract details using GPT-5.2
- **Multi-Vehicle Support**: Track service records for multiple vehicles
- **Service Records**: Log service type, date, price, location, and odometer (km)
- **Smart Reminders**: Set maintenance reminders with due dates
- **Export Data**: Download records as CSV or JSON
- **Dark/Light Theme**: Toggle between themes
- **JWT Authentication**: Secure user accounts

## Tech Stack

- **Frontend**: React 19, Tailwind CSS, Shadcn UI, Framer Motion
- **Backend**: FastAPI, Motor (async MongoDB driver)
- **Database**: MongoDB
- **AI**: OpenAI GPT-5.2 via emergentintegrations

---

## Self-Hosting Guide

### Prerequisites

- Node.js 18+ and Yarn
- Python 3.11+
- MongoDB (local or Atlas)
- OpenAI API key (for OCR feature)

### Option 1: Manual Setup

#### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/car-service-tracker.git
cd car-service-tracker
```

#### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your values:
# MONGO_URL=mongodb://localhost:27017
# DB_NAME=car_service_tracker
# JWT_SECRET_KEY=your-secret-key-here
# EMERGENT_LLM_KEY=your-openai-key  # For OCR feature

# Run the server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

#### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
yarn install

# Create .env file
cp .env.example .env
# Edit .env:
# REACT_APP_BACKEND_URL=http://localhost:8001

# Run the development server
yarn start
```

#### 4. Access the app
Open http://localhost:3000 in your browser.

---

### Option 2: Docker Deployment

#### docker-compose.yml
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: car-tracker-mongo
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

  backend:
    build: ./backend
    container_name: car-tracker-backend
    ports:
      - "8001:8001"
    environment:
      - MONGO_URL=mongodb://mongodb:27017
      - DB_NAME=car_service_tracker
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - EMERGENT_LLM_KEY=${EMERGENT_LLM_KEY}
      - CORS_ORIGINS=http://localhost:3000
    depends_on:
      - mongodb

  frontend:
    build: ./frontend
    container_name: car-tracker-frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_BACKEND_URL=http://localhost:8001
    depends_on:
      - backend

volumes:
  mongo_data:
```

#### backend/Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

#### frontend/Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["yarn", "start"]
```

#### Run with Docker
```bash
# Create .env file in root directory
echo "JWT_SECRET_KEY=your-secret-key" > .env
echo "EMERGENT_LLM_KEY=your-openai-key" >> .env

# Build and run
docker-compose up --build
```

---

### Option 3: Deploy to Cloud Platforms

#### Vercel (Frontend) + Railway (Backend)

**Frontend on Vercel:**
1. Push code to GitHub
2. Import project in Vercel
3. Set root directory to `frontend`
4. Add environment variable: `REACT_APP_BACKEND_URL=https://your-railway-url.up.railway.app`
5. Deploy

**Backend on Railway:**
1. Create new project in Railway
2. Connect GitHub repo
3. Set root directory to `backend`
4. Add environment variables:
   - `MONGO_URL` (use Railway's MongoDB or Atlas)
   - `DB_NAME=car_service_tracker`
   - `JWT_SECRET_KEY=your-secret`
   - `EMERGENT_LLM_KEY=your-key`
5. Deploy

#### Render (Full Stack)
1. Create Web Service for backend (Python)
2. Create Static Site for frontend (React)
3. Add MongoDB from Render or use Atlas
4. Configure environment variables
5. Deploy both services

---

## Environment Variables

### Backend (.env)
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=car_service_tracker
JWT_SECRET_KEY=your-super-secret-jwt-key
EMERGENT_LLM_KEY=sk-your-openai-api-key
CORS_ORIGINS=http://localhost:3000
```

### Frontend (.env)
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| GET/POST | `/api/vehicles` | List/Create vehicles |
| GET/PUT/DELETE | `/api/vehicles/{id}` | Vehicle CRUD |
| GET/POST | `/api/service-records` | List/Create records |
| GET/PUT/DELETE | `/api/service-records/{id}` | Record CRUD |
| POST | `/api/ocr/extract` | Extract data from image |
| GET/POST | `/api/reminders` | List/Create reminders |
| PUT/DELETE | `/api/reminders/{id}` | Reminder CRUD |
| GET | `/api/export/csv` | Export as CSV |
| GET | `/api/export/json` | Export as JSON |
| GET | `/api/stats/dashboard` | Dashboard statistics |

---

## License

MIT License - feel free to use and modify as needed.

---

## Support

Built with [Emergent](https://emergent.sh)
