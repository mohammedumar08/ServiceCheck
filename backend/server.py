from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import base64
from io import BytesIO
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'fallback_secret_key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72

# Create the main app
app = FastAPI(title="Car Service Tracker API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# ==================== MODELS ====================

# Auth Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Vehicle Models
class VehicleCreate(BaseModel):
    make: str
    model: str
    year: int
    license_plate: Optional[str] = None
    vin: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None

class VehicleUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    license_plate: Optional[str] = None
    vin: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None

class VehicleResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    make: str
    model: str
    year: int
    license_plate: Optional[str] = None
    vin: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None
    current_odometer: int = 0
    created_at: str

# Service Record Models
class ServiceRecordCreate(BaseModel):
    vehicle_id: str
    service_type: str
    date: str
    price: float
    location: Optional[str] = None
    odometer: int
    notes: Optional[str] = None
    provider: Optional[str] = None

class ServiceRecordUpdate(BaseModel):
    service_type: Optional[str] = None
    date: Optional[str] = None
    price: Optional[float] = None
    location: Optional[str] = None
    odometer: Optional[int] = None
    notes: Optional[str] = None
    provider: Optional[str] = None

class ServiceRecordResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    vehicle_id: str
    service_type: str
    date: str
    price: float
    location: Optional[str] = None
    odometer: int
    notes: Optional[str] = None
    provider: Optional[str] = None
    image_base64: Optional[str] = None
    created_at: str

# Reminder Models
class ReminderCreate(BaseModel):
    vehicle_id: str
    service_type: str
    due_date: str
    due_odometer: Optional[int] = None
    notes: Optional[str] = None

class ReminderUpdate(BaseModel):
    service_type: Optional[str] = None
    due_date: Optional[str] = None
    due_odometer: Optional[int] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None

class ReminderResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    vehicle_id: str
    service_type: str
    due_date: str
    due_odometer: Optional[int] = None
    notes: Optional[str] = None
    completed: bool = False
    created_at: str

# OCR Response Model
class OCRExtractedData(BaseModel):
    service_type: Optional[str] = None
    date: Optional[str] = None
    price: Optional[float] = None
    location: Optional[str] = None
    odometer: Optional[int] = None
    provider: Optional[str] = None
    confidence: str = "low"
    raw_text: Optional[str] = None

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user_from_token(token: str):
    """Helper to get user from token string"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            return None
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        return user
    except:
        return None

async def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    """Get current user from session cookie or Authorization header"""
    # First try session cookie (Google OAuth)
    session_token = request.cookies.get("session_token")
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            # Check expiry
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0, "password": 0})
                if user:
                    return user
    
    # Fall back to JWT token (email/password auth)
    if credentials:
        try:
            token = credentials.credentials
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("user_id")
            if user_id:
                user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
                if user:
                    return user
        except:
            pass
    
    raise HTTPException(status_code=401, detail="Not authenticated")

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email)
    user_response = UserResponse(
        id=user_id,
        email=user_data.email,
        name=user_data.name,
        created_at=user_doc["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"])
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        created_at=user["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ==================== GOOGLE OAUTH ENDPOINTS ====================

class GoogleSessionRequest(BaseModel):
    session_id: str

@api_router.post("/auth/google/session")
async def google_session(request: GoogleSessionRequest, response: Response):
    """Exchange Google OAuth session_id for user session"""
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    try:
        # Call Emergent Auth to get session data
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            auth_data = auth_response.json()
        
        email = auth_data.get("email")
        name = auth_data.get("name")
        picture = auth_data.get("picture")
        session_token = auth_data.get("session_token")
        
        if not email or not session_token:
            raise HTTPException(status_code=401, detail="Invalid session data")
        
        # Check if user exists, create if not
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["id"]
            # Update user info if needed
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"name": name, "picture": picture}}
            )
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            user_doc = {
                "id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "password": None,  # No password for OAuth users
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user_doc)
        
        # Store session
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.delete_many({"user_id": user_id})  # Remove old sessions
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7*24*60*60  # 7 days
        )
        
        # Get user data
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        
        # Also return JWT token for API calls
        jwt_token = create_token(user_id, email)
        
        return {
            "access_token": jwt_token,
            "token_type": "bearer",
            "user": UserResponse(**user)
        }
        
    except httpx.RequestError as e:
        logging.error(f"Google auth error: {str(e)}")
        raise HTTPException(status_code=500, detail="Authentication service error")

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ==================== VEHICLE ENDPOINTS ====================

@api_router.post("/vehicles", response_model=VehicleResponse)
async def create_vehicle(vehicle_data: VehicleCreate, current_user: dict = Depends(get_current_user)):
    vehicle_id = str(uuid.uuid4())
    vehicle_doc = {
        "id": vehicle_id,
        "user_id": current_user["id"],
        **vehicle_data.model_dump(),
        "current_odometer": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.vehicles.insert_one(vehicle_doc)
    return VehicleResponse(**vehicle_doc)

@api_router.get("/vehicles", response_model=List[VehicleResponse])
async def get_vehicles(current_user: dict = Depends(get_current_user)):
    vehicles = await db.vehicles.find(
        {"user_id": current_user["id"]}, 
        {"_id": 0}
    ).to_list(100)
    return [VehicleResponse(**v) for v in vehicles]

@api_router.get("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(vehicle_id: str, current_user: dict = Depends(get_current_user)):
    vehicle = await db.vehicles.find_one(
        {"id": vehicle_id, "user_id": current_user["id"]}, 
        {"_id": 0}
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return VehicleResponse(**vehicle)

@api_router.put("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(vehicle_id: str, update_data: VehicleUpdate, current_user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.vehicles.update_one(
        {"id": vehicle_id, "user_id": current_user["id"]},
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    return VehicleResponse(**vehicle)

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.vehicles.delete_one({"id": vehicle_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Also delete related service records and reminders
    await db.service_records.delete_many({"vehicle_id": vehicle_id})
    await db.reminders.delete_many({"vehicle_id": vehicle_id})
    
    return {"message": "Vehicle deleted successfully"}

# ==================== SERVICE RECORD ENDPOINTS ====================

@api_router.post("/service-records", response_model=ServiceRecordResponse)
async def create_service_record(record_data: ServiceRecordCreate, current_user: dict = Depends(get_current_user)):
    # Verify vehicle belongs to user
    vehicle = await db.vehicles.find_one({"id": record_data.vehicle_id, "user_id": current_user["id"]})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    record_id = str(uuid.uuid4())
    record_doc = {
        "id": record_id,
        "user_id": current_user["id"],
        **record_data.model_dump(),
        "image_base64": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.service_records.insert_one(record_doc)
    
    # Update vehicle odometer if this is higher
    if record_data.odometer > vehicle.get("current_odometer", 0):
        await db.vehicles.update_one(
            {"id": record_data.vehicle_id},
            {"$set": {"current_odometer": record_data.odometer}}
        )
    
    return ServiceRecordResponse(**record_doc)

@api_router.get("/service-records", response_model=List[ServiceRecordResponse])
async def get_service_records(
    vehicle_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    
    records = await db.service_records.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    return [ServiceRecordResponse(**r) for r in records]

@api_router.get("/service-records/{record_id}", response_model=ServiceRecordResponse)
async def get_service_record(record_id: str, current_user: dict = Depends(get_current_user)):
    record = await db.service_records.find_one(
        {"id": record_id, "user_id": current_user["id"]}, 
        {"_id": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Service record not found")
    return ServiceRecordResponse(**record)

@api_router.put("/service-records/{record_id}", response_model=ServiceRecordResponse)
async def update_service_record(record_id: str, update_data: ServiceRecordUpdate, current_user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.service_records.update_one(
        {"id": record_id, "user_id": current_user["id"]},
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service record not found")
    
    record = await db.service_records.find_one({"id": record_id}, {"_id": 0})
    return ServiceRecordResponse(**record)

@api_router.delete("/service-records/{record_id}")
async def delete_service_record(record_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.service_records.delete_one({"id": record_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service record not found")
    return {"message": "Service record deleted successfully"}

# ==================== OCR ENDPOINT ====================

@api_router.post("/ocr/extract", response_model=OCRExtractedData)
async def extract_from_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        import re
        
        # Read file content
        content = await file.read()
        content_type = file.content_type or 'image/jpeg'
        
        # Handle PDF files - extract first page as image
        if content_type == 'application/pdf' or (file.filename and file.filename.lower().endswith('.pdf')):
            try:
                import fitz  # PyMuPDF
                
                # Open PDF from bytes
                pdf_document = fitz.open(stream=content, filetype="pdf")
                
                if len(pdf_document) == 0:
                    return OCRExtractedData(
                        confidence="low",
                        raw_text="PDF file is empty"
                    )
                
                # Get first page and render as image
                page = pdf_document[0]
                mat = fitz.Matrix(2, 2)
                pix = page.get_pixmap(matrix=mat)
                
                # Convert to PNG bytes
                image_bytes = pix.tobytes("png")
                image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                
                pdf_document.close()
                
            except ImportError:
                return OCRExtractedData(
                    confidence="low",
                    raw_text="PDF processing not available. Please upload an image instead."
                )
            except Exception as pdf_error:
                logging.error(f"PDF processing error: {str(pdf_error)}")
                return OCRExtractedData(
                    confidence="low",
                    raw_text=f"Error processing PDF: {str(pdf_error)}"
                )
        else:
            # Regular image file
            image_base64 = base64.b64encode(content).decode('utf-8')
        
        # Initialize LLM chat
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="OCR service not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"ocr-{uuid.uuid4()}",
            system_message="""You are an expert at extracting car service information from receipts and invoices.
Extract the following information if present:
- Service type (e.g., oil change, tire rotation, brake service, etc.)
- Date of service (format: YYYY-MM-DD)
- Price/cost (as a number, total amount paid)
- Location/address of service center
- Odometer reading (in km, look for mileage or odometer)
- Service provider/shop name

Return ONLY a JSON object with these exact fields:
{
  "service_type": "string or null",
  "date": "YYYY-MM-DD or null",
  "price": number or null,
  "location": "string or null",
  "odometer": number or null,
  "provider": "string or null",
  "confidence": "high/medium/low",
  "raw_text": "brief summary of what was found"
}"""
        ).with_model("openai", "gpt-5.2")
        
        # Create image content - ImageContent is a subclass of FileContent with content_type="image"
        image_content = ImageContent(image_base64=image_base64)
        
        user_message = UserMessage(
            text="Please extract car service information from this receipt/invoice. Return only the JSON object.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Try to extract JSON from response
        json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return OCRExtractedData(**data)
        else:
            return OCRExtractedData(
                confidence="low",
                raw_text=response[:500] if response else "Could not extract data"
            )
            
    except Exception as e:
        logging.error(f"OCR extraction error: {str(e)}")
        return OCRExtractedData(
            confidence="low",
            raw_text=f"Error processing file: {str(e)}"
        )

# ==================== REMINDER ENDPOINTS ====================

@api_router.post("/reminders", response_model=ReminderResponse)
async def create_reminder(reminder_data: ReminderCreate, current_user: dict = Depends(get_current_user)):
    # Verify vehicle belongs to user
    vehicle = await db.vehicles.find_one({"id": reminder_data.vehicle_id, "user_id": current_user["id"]})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    reminder_id = str(uuid.uuid4())
    reminder_doc = {
        "id": reminder_id,
        "user_id": current_user["id"],
        **reminder_data.model_dump(),
        "completed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.reminders.insert_one(reminder_doc)
    return ReminderResponse(**reminder_doc)

@api_router.get("/reminders", response_model=List[ReminderResponse])
async def get_reminders(
    vehicle_id: Optional[str] = None,
    completed: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    if completed is not None:
        query["completed"] = completed
    
    reminders = await db.reminders.find(query, {"_id": 0}).sort("due_date", 1).to_list(100)
    return [ReminderResponse(**r) for r in reminders]

@api_router.put("/reminders/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(reminder_id: str, update_data: ReminderUpdate, current_user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.reminders.update_one(
        {"id": reminder_id, "user_id": current_user["id"]},
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    reminder = await db.reminders.find_one({"id": reminder_id}, {"_id": 0})
    return ReminderResponse(**reminder)

@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.reminders.delete_one({"id": reminder_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"message": "Reminder deleted successfully"}

# ==================== EXPORT ENDPOINTS ====================

@api_router.get("/export/csv")
async def export_csv(
    vehicle_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    import csv
    from io import StringIO
    from fastapi.responses import Response
    
    query = {"user_id": current_user["id"]}
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    
    records = await db.service_records.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    vehicles = await db.vehicles.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    vehicle_map = {v["id"]: f"{v['year']} {v['make']} {v['model']}" for v in vehicles}
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Vehicle", "Service Type", "Date", "Price", "Odometer (km)", "Location", "Provider", "Notes"])
    
    for record in records:
        writer.writerow([
            vehicle_map.get(record["vehicle_id"], "Unknown"),
            record.get("service_type", ""),
            record.get("date", ""),
            record.get("price", 0),
            record.get("odometer", 0),
            record.get("location", ""),
            record.get("provider", ""),
            record.get("notes", "")
        ])
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=service_records.csv"}
    )

@api_router.get("/export/pdf")
async def export_pdf(
    vehicle_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    from io import BytesIO
    from fastapi.responses import Response
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    
    query = {"user_id": current_user["id"]}
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    
    records = await db.service_records.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    vehicles = await db.vehicles.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    vehicle_map = {v["id"]: f"{v['year']} {v['make']} {v['model']}" for v in vehicles}
    
    # Create PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        textColor=colors.HexColor('#1E293B')
    )
    elements.append(Paragraph("Service Records Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Summary
    total_spent = sum(r.get("price", 0) for r in records)
    elements.append(Paragraph(f"<b>Total Records:</b> {len(records)}", styles['Normal']))
    elements.append(Paragraph(f"<b>Total Spent:</b> ${total_spent:,.2f}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    if records:
        # Table data
        data = [["Vehicle", "Service", "Date", "Price", "Odometer"]]
        for record in records:
            data.append([
                vehicle_map.get(record["vehicle_id"], "Unknown")[:20],
                record.get("service_type", "")[:20],
                record.get("date", ""),
                f"${record.get('price', 0):,.2f}",
                f"{record.get('odometer', 0):,} km"
            ])
        
        # Create table
        table = Table(data, colWidths=[1.5*inch, 1.3*inch, 1*inch, 0.9*inch, 1*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8FAFC')),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1E293B')),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F1F5F9')]),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph("No service records found.", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=service_records.pdf"}
    )

# ==================== DASHBOARD STATS ====================

@api_router.get("/stats/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    vehicles = await db.vehicles.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    records = await db.service_records.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(500)
    reminders = await db.reminders.find(
        {"user_id": current_user["id"], "completed": False}, 
        {"_id": 0}
    ).to_list(100)
    
    # Calculate stats
    total_spent = sum(r.get("price", 0) for r in records)
    
    # Get upcoming reminders (next 30 days)
    today = datetime.now(timezone.utc).date()
    upcoming = [r for r in reminders if r.get("due_date")]
    
    # Recent services (last 5)
    recent_records = sorted(records, key=lambda x: x.get("date", ""), reverse=True)[:5]
    
    return {
        "total_vehicles": len(vehicles),
        "total_services": len(records),
        "total_spent": round(total_spent, 2),
        "upcoming_reminders": len(upcoming),
        "recent_services": recent_records,
        "vehicles": vehicles,
        "reminders": upcoming[:5]
    }

# ==================== ROOT ENDPOINT ====================

@api_router.get("/")
async def root():
    return {"message": "Car Service Tracker API", "status": "running"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
