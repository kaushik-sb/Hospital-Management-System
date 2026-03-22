"""
Seed script - creates demo doctors and patients for testing.
Run AFTER starting the Flask app at least once (to create the DB).

Usage:
    cd backend
    python seed_demo.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import app
from models.models import db, User, Doctor, Patient, Department, DoctorAvailability
from datetime import date, timedelta

with app.app_context():
    # ── Demo Doctors ───────────────────────────────────────────────────────────
    demo_doctors = [
        {
            'username': 'doctor1',
            'email': 'doctor1@hospital.com',
            'password': 'Doctor@123',
            'name': 'Arjun Sharma',
            'specialization': 'Cardiology',
            'phone': '9876543210',
            'qualification': 'MBBS, MD (Cardiology)',
            'experience_years': 12,
            'dept_name': 'Cardiology'
        },
        {
            'username': 'doctor2',
            'email': 'doctor2@hospital.com',
            'password': 'Doctor@123',
            'name': 'Priya Nair',
            'specialization': 'Neurology',
            'phone': '9876543211',
            'qualification': 'MBBS, DM (Neurology)',
            'experience_years': 8,
            'dept_name': 'Neurology'
        },
        {
            'username': 'doctor3',
            'email': 'doctor3@hospital.com',
            'password': 'Doctor@123',
            'name': 'Rahul Mehta',
            'specialization': 'Orthopedics',
            'phone': '9876543212',
            'qualification': 'MBBS, MS (Ortho)',
            'experience_years': 15,
            'dept_name': 'Orthopedics'
        },
        {
            'username': 'doctor4',
            'email': 'doctor4@hospital.com',
            'password': 'Doctor@123',
            'name': 'Sunita Rao',
            'specialization': 'Pediatrics',
            'phone': '9876543213',
            'qualification': 'MBBS, MD (Pediatrics)',
            'experience_years': 10,
            'dept_name': 'Pediatrics'
        },
    ]

    created_doctors = []
    for d in demo_doctors:
        if User.query.filter_by(username=d['username']).first():
            print(f"Doctor {d['username']} already exists, skipping.")
            doc = Doctor.query.filter_by(name=d['name']).first()
            if doc:
                created_doctors.append(doc)
            continue

        dept = Department.query.filter_by(name=d['dept_name']).first()
        user = User(username=d['username'], email=d['email'], role='doctor')
        user.set_password(d['password'])
        db.session.add(user)
        db.session.flush()

        doctor = Doctor(
            user_id=user.id,
            name=d['name'],
            specialization=d['specialization'],
            phone=d['phone'],
            qualification=d['qualification'],
            experience_years=d['experience_years'],
            department_id=dept.id if dept else None
        )
        db.session.add(doctor)
        db.session.flush()
        created_doctors.append(doctor)
        print(f"Created doctor: {d['name']} (login: {d['username']} / {d['password']})")

    # ── Availability for next 7 days ───────────────────────────────────────────
    today = date.today()
    for doctor in created_doctors:
        for i in range(1, 8):
            d = today + timedelta(days=i)
            if not DoctorAvailability.query.filter_by(doctor_id=doctor.id, date=d).first():
                avail = DoctorAvailability(
                    doctor_id=doctor.id,
                    date=d,
                    start_time='09:00',
                    end_time='17:00',
                    max_appointments=10
                )
                db.session.add(avail)

    # ── Demo Patients ──────────────────────────────────────────────────────────
    demo_patients = [
        {
            'username': 'patient1',
            'email': 'patient1@example.com',
            'password': 'Patient@123',
            'name': 'Amit Kumar',
            'phone': '9123456789',
            'gender': 'Male',
            'blood_group': 'O+'
        },
        {
            'username': 'patient2',
            'email': 'patient2@example.com',
            'password': 'Patient@123',
            'name': 'Sneha Patel',
            'phone': '9123456790',
            'gender': 'Female',
            'blood_group': 'B+'
        },
    ]

    for p in demo_patients:
        if User.query.filter_by(username=p['username']).first():
            print(f"Patient {p['username']} already exists, skipping.")
            continue

        user = User(username=p['username'], email=p['email'], role='patient')
        user.set_password(p['password'])
        db.session.add(user)
        db.session.flush()

        patient = Patient(
            user_id=user.id,
            name=p['name'],
            phone=p['phone'],
            gender=p['gender'],
            blood_group=p['blood_group']
        )
        db.session.add(patient)
        print(f"Created patient: {p['name']} (login: {p['username']} / {p['password']})")

    db.session.commit()
    print("\n✅ Demo data seeded successfully!")
    print("\n--- Demo Login Credentials ---")
    print("Admin    : admin / Admin@123")
    print("Doctor 1 : doctor1 / Doctor@123  (Cardiology)")
    print("Doctor 2 : doctor2 / Doctor@123  (Neurology)")
    print("Doctor 3 : doctor3 / Doctor@123  (Orthopedics)")
    print("Doctor 4 : doctor4 / Doctor@123  (Pediatrics)")
    print("Patient 1: patient1 / Patient@123")
    print("Patient 2: patient2 / Patient@123")
