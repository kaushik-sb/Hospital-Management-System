# Hospital Management System - V2
**MAD 2 Project | Jan 2026 Term**

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend API | Flask (Python) |
| Frontend UI | Vue.js 3 (CDN) |
| Database | SQLite via SQLAlchemy |
| Auth | JWT (Flask-JWT-Extended) |
| Caching | Redis (Flask-Caching) |
| Background Jobs | Celery + Redis |
| Email | Flask-Mail (SMTP) |
| Styling | Bootstrap 5 |
| Charts | Chart.js |

---

## Project Structure
```
hospital_management_23f3001827/         ← root folder
├── backend/
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py          ← SQLAlchemy models
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py            ← Login/Register endpoints
│   │   ├── admin.py           ← Admin-only endpoints
│   │   ├── doctor.py          ← Doctor endpoints
│   │   ├── patient.py         ← Patient endpoints
│   │   └── payment.py         ← Payment portal endpoints
│   ├── app.py                 ← Flask app entry point
│   ├── celery_tasks.py        ← Celery background tasks
│   ├── seed_demo.py           ← Demo data seeder
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html             ← Entry point with PWA manifest
│   ├── manifest.json          ← PWA manifest
│   ├── sw.js                  ← Service worker
│   └── src/
│       └── main.js            ← Vue 3 app (single file, CDN-based)
├── api.yaml                   ← OpenAPI 3.0 API definition
└── README.md
```

---

## Setup & Run

### Prerequisites
- Python 3.9+
- Redis server running on localhost:6379
- pip

### 1. Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your mail credentials and secret keys
```

### 3. Start Redis
```bash
redis-server
```

### 4. Start Flask Backend
```bash
cd backend
python app.py
# Runs on http://localhost:5000
```

### 5. Start Frontend
```bash
cd frontend
python -m http.server 8080
# Open http://localhost:8080
```

### 6. Seed Demo Data (run once)
```bash
cd backend
python seed_demo.py
```

### 7. Start Celery for Background Jobs
```bash
# Terminal 3: Celery worker
cd backend
python -m celery -A celery_tasks.celery_app worker --loglevel=info --pool=solo

# Terminal 4: Celery beat (scheduled jobs)
python -m celery -A celery_tasks.celery_app beat --loglevel=info
```

---

## Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `Admin@123` |
| Doctor 1 | `doctor1` | `Doctor@123` |
| Doctor 2 | `doctor2` | `Doctor@123` |
| Patient 1 | `patient1` | `Patient@123` |
| Patient 2 | `patient2` | `Patient@123` |

---

## Features

### Admin
- Dashboard with stats (doctors, patients, appointments) + Chart.js doughnut chart
- Full CRUD for Doctors (add/edit/deactivate/reactivate/blacklist)
- Full CRUD for Departments
- View and filter all Appointments by status
- View and manage all Patients (search by name/phone/email/ID, deactivate/blacklist)
- Revenue Analytics dashboard — total revenue, bar chart by doctor, doughnut chart by department, full breakdown table

### Doctor
- Dashboard with today's and upcoming appointments (7 days)
- Mark appointments as Completed or Cancelled (today and past only)
- Add/edit treatment records (diagnosis, prescription, notes, next visit)
- View full patient history for informed consultation
- Set availability for next 7 days with time window enforcement
- Set consultation fee (appointment booking fee)
- Revenue & Fees page — total earnings, payment history per patient

### Patient
- Register, login, update profile
- Browse departments and search doctors by name/department
- View doctor availability (7 days) and book appointments within availability window
- Reschedule or cancel booked appointments
- View appointment history with treatment details (diagnosis, prescriptions)
- Payment portal — pay consultation fee via Card, UPI, or Net Banking (dummy)
- Trigger CSV export of full treatment history (emailed via Celery async job)

### Payment Portal
- Patients pay consultation fee after appointment is booked or completed
- Supports Card (with live card preview), UPI, and Net Banking payment methods
- Dummy payment processing with transaction ID generation
- Payment status shown on appointment list (Pay Now / Paid ✓)
- Doctors can set their own consultation fee from the Revenue & Fees page
- Admin can view total revenue, revenue per doctor, and revenue per department with Chart.js visualizations

### Background Jobs (Celery + Redis)
1. **Daily Reminders** (8:00 AM daily) — emails patients with appointments scheduled that day
2. **Monthly Activity Report** (1st of each month) — sends HTML email report to each doctor with completed appointments, diagnoses and prescriptions
3. **CSV Export** (user-triggered) — async Celery job that emails treatment history CSV to patient

### Caching
- Flask-Caching with Redis (300s default TTL)
- Falls back to SimpleCache if Redis unavailable
---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Authenticate user and return JWT token |
| `/api/auth/register` | POST | Register new patient account |
| `/api/auth/me` | GET | Get current authenticated user profile |
| `/api/admin/dashboard` | GET | Get total doctors, patients and appointment stats |
| `/api/admin/doctors` | GET / POST | List all doctors / Add new doctor |
| `/api/admin/doctors/<id>` | PUT / DELETE | Update or deactivate a doctor |
| `/api/admin/patients` | GET | List all patients, search by name/phone/email/ID |
| `/api/admin/appointments` | GET | List all appointments with optional status filter |
| `/api/admin/departments` | GET / POST | List or add departments |
| `/api/doctor/dashboard` | GET | Get upcoming appointments and patient count |
| `/api/doctor/appointments/<id>/treatment` | POST | Add diagnosis, prescription and notes |
| `/api/doctor/patients/<id>/history` | GET | Full treatment history for a patient |
| `/api/doctor/availability` | GET / POST | View or set availability slots |
| `/api/patient/doctors` | GET | Search doctors by name and department |
| `/api/patient/appointments` | GET / POST | View or book appointments |
| `/api/patient/appointments/<id>/reschedule` | PUT | Reschedule a booked appointment |
| `/api/patient/appointments/<id>/cancel` | PUT | Cancel a booked appointment |
| `/api/patient/export-csv` | POST | Trigger async Celery job to email treatment history CSV |
| `/api/payment/pay` | POST | Process dummy payment for an appointment |
| `/api/payment/appointment/<id>` | GET | Get payment details for an appointment |
| `/api/payment/set-fee` | PUT | Doctor sets their consultation fee |
| `/api/payment/admin/revenue` | GET | Admin views revenue analytics by doctor and department |

See `api.yaml` for the full OpenAPI 3.0 specification.

---

## Notes
- Database is created programmatically via SQLAlchemy models — no manual DB creation
- Admin user and departments are seeded automatically on first run
- All business logic is in Flask (Python)
- Frontend uses Vue 3 CDN + Bootstrap 5 CDN — no CLI or build step required
- Single `.js` file approach for CDN-based Vue
- Payment portal is a dummy implementation for demonstration purposes