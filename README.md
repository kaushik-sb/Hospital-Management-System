<<<<<<< HEAD
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
hospital_management_2XfXXXXXX/         ← root folder
├── backend/
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py          ← SQLAlchemy models
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py            ← Login/Register endpoints
│   │   ├── admin.py           ← Admin-only endpoints
│   │   ├── doctor.py          ← Doctor endpoints
│   │   └── patient.py         ← Patient endpoints
│   ├── app.py                 ← Flask app entry point
│   ├── celery_tasks.py        ← Celery background tasks
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html             ← Entry point (Jinja2-compatible)
│   └── src/
│       └── main.js            ← Vue 3 app (single file, CDN-based)
├── run_backend.sh
├── run_frontend.sh
├── run_celery.sh
├── run_celery_beat.sh
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
./run_backend.sh
# OR: cd backend && python app.py
# Runs on http://localhost:5000
```

### 5. Start Frontend
```bash
./run_frontend.sh
# OR: cd frontend && python3 -m http.server 8080
# Open http://localhost:8080
```

### 6. (Optional) Start Celery for Background Jobs
```bash
# Terminal 3: Celery worker
./run_celery.sh

# Terminal 4: Celery beat (scheduled jobs)
./run_celery_beat.sh
```

---

## Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `Admin@123` |
| Doctor | (create via admin panel) | - |
| Patient | (register via app) | - |

---

## Features

### Admin
- Dashboard with stats (doctors, patients, appointments) + Chart.js doughnut
- Full CRUD for Doctors (add/edit/deactivate/reactivate)
- Full CRUD for Departments
- View & filter all Appointments (by status)
- View & manage all Patients (search, deactivate/activate)

### Doctor
- Dashboard with today's and upcoming appointments (7 days)
- Mark appointments as Completed or Cancelled
- Add/edit treatment records (diagnosis, prescription, notes, next visit)
- View full patient history
- Set availability for next 7 days

### Patient
- Register, login, update profile
- Browse departments and search doctors by specialization/name
- View doctor availability (7 days) and book appointments
- Reschedule or cancel booked appointments
- View appointment history with treatment details
- Trigger CSV export (emailed via Celery async job)

### Background Jobs (Celery)
1. **Daily Reminders** (8:00 AM daily): Emails patients with appointments that day
2. **Monthly Activity Report** (1st of each month): HTML email report to each doctor
3. **CSV Export** (user-triggered): Async job that emails treatment history CSV to patient

### Caching
- Flask-Caching with Redis (300s default TTL)
- Falls back to SimpleCache if Redis unavailable

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/register | Patient registration |
| GET | /api/auth/me | Get current user |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/dashboard | Stats |
| GET/POST | /api/admin/doctors | List/Add doctors |
| PUT/DELETE | /api/admin/doctors/:id | Edit/Deactivate doctor |
| GET/POST | /api/admin/departments | List/Add departments |
| GET | /api/admin/appointments | All appointments |
| GET | /api/admin/patients | All patients |

### Doctor
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/doctor/dashboard | Dashboard data |
| GET | /api/doctor/appointments | My appointments |
| PUT | /api/doctor/appointments/:id/complete | Mark complete |
| POST | /api/doctor/appointments/:id/treatment | Add treatment |
| GET/POST | /api/doctor/availability | Manage availability |

### Patient
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/patient/dashboard | Dashboard data |
| PUT | /api/patient/profile | Update profile |
| GET | /api/patient/doctors | Search doctors |
| POST | /api/patient/appointments | Book appointment |
| PUT | /api/patient/appointments/:id/cancel | Cancel |
| PUT | /api/patient/appointments/:id/reschedule | Reschedule |
| GET | /api/patient/export-csv | Trigger CSV export |

---

## Notes
- Database is created programmatically via SQLAlchemy models
- Admin user is seeded automatically on first run
- No manual DB creation (no DB Browser for SQLite)
- All business logic is in Flask (Python)
- Frontend uses Vue 3 CDN + Bootstrap 5 CDN only
- Single `.js` file approach for CDN-based Vue (no CLI required)
=======
# hospital-management-system-app
An application to systematically manage patient flow and other logistics of hospital management
>>>>>>> 5901013dc1ae154fd766731c7fa285dd41c01788
