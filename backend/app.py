from flask import Flask
from flask_jwt_extended import JWTManager
from flask_caching import Cache
from flask_mail import Mail
from flask_cors import CORS
from models.models import db, User, Doctor, Patient, Department
from routes.auth import auth_bp
from routes.admin import admin_bp
from routes.doctor import doctor_bp
from routes.patient import patient_bp
import os
from datetime import timedelta

app = Flask(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'hms-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hospital.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=12)

# Redis / Celery
app.config['broker_url'] = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
app.config['result_backend'] = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

# Caching
app.config['CACHE_TYPE'] = 'RedisCache'
app.config['CACHE_REDIS_URL'] = os.environ.get('REDIS_URL', 'redis://localhost:6379/1')
app.config['CACHE_DEFAULT_TIMEOUT'] = 300

# Mail
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@hospital.com')

# ── Extensions ─────────────────────────────────────────────────────────────────
db.init_app(app)
jwt = JWTManager(app)
CORS(app, resources={r"/api/*": {"origins": "*"}})
mail = Mail(app)

# Cache with fallback to SimpleCache if Redis is unavailable
try:
    cache = Cache(app)
    cache.get('test')  # Test connection
except Exception:
    app.config['CACHE_TYPE'] = 'SimpleCache'
    cache = Cache(app)

# ── Celery ─────────────────────────────────────────────────────────────────────
try:
    from celery_tasks import make_celery, set_celery, send_daily_reminders, send_monthly_reports, export_patient_csv
    celery = make_celery(app)
    set_celery(celery)

    # Register tasks with celery
    celery.task(name='celery_tasks.send_daily_reminders')(send_daily_reminders)
    celery.task(name='celery_tasks.send_monthly_reports')(send_monthly_reports)
    celery.task(name='celery_tasks.export_patient_csv')(export_patient_csv)
except Exception as e:
    print(f"Celery setup warning: {e}")
    celery = None

# ── Blueprints ──────────────────────────────────────────────────────────────────
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(doctor_bp, url_prefix='/api/doctor')
app.register_blueprint(patient_bp, url_prefix='/api/patient')

# ── Database Initialization ────────────────────────────────────────────────────
def create_tables_and_seed():
    db.create_all()

    # Seed admin if not present
    if not User.query.filter_by(role='admin').first():
        admin = User(username='admin', email='admin@hospital.com', role='admin')
        admin.set_password('Admin@123')
        db.session.add(admin)

    # Seed departments
    departments = [
        ('Cardiology', 'Heart and cardiovascular system'),
        ('Neurology', 'Brain, spine, and nervous system'),
        ('Orthopedics', 'Bones, joints, and musculoskeletal system'),
        ('Pediatrics', 'Medical care for infants, children, and adolescents'),
        ('Dermatology', 'Skin, hair, and nails'),
        ('Ophthalmology', 'Eyes and vision'),
        ('Gynecology', 'Female reproductive health'),
        ('General Medicine', 'General health and common illnesses'),
    ]
    for name, desc in departments:
        if not Department.query.filter_by(name=name).first():
            db.session.add(Department(name=name, description=desc))

    db.session.commit()
    print("Database initialized with admin and departments.")

with app.app_context():
    create_tables_and_seed()

# ── Run ────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True, port=5000)
