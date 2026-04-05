from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
import random
import string
from datetime import datetime

payment_bp = Blueprint('payment', __name__)

def parse_identity(s):
    parts = s.split(':', 1)
    return {'id': int(parts[0]), 'role': parts[1]}

def patient_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        identity = parse_identity(get_jwt_identity())
        if identity['role'] != 'patient':
            return jsonify({'error': 'Patient access required'}), 403
        return f(*args, **kwargs)
    return decorated

def doctor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        identity = parse_identity(get_jwt_identity())
        if identity['role'] != 'doctor':
            return jsonify({'error': 'Doctor access required'}), 403
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        identity = parse_identity(get_jwt_identity())
        if identity['role'] != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated


# ── Patient: Get payment details for an appointment ───────────────────────────
@payment_bp.route('/appointment/<int:apt_id>', methods=['GET'])
@patient_required
def get_payment_details(apt_id):
    from models.models import Appointment, Payment, Doctor
    identity = parse_identity(get_jwt_identity())

    apt = Appointment.query.get_or_404(apt_id)
    doctor = Doctor.query.get(apt.doctor_id)
    existing_payment = Payment.query.filter_by(appointment_id=apt_id).first()

    return jsonify({
        'appointment': apt.to_dict(),
        'doctor_name': doctor.name if doctor else '',
        'consultation_fee': doctor.consultation_fee if doctor else 500.0,
        'payment': existing_payment.to_dict() if existing_payment else None
    }), 200


# ── Patient: Process dummy payment ───────────────────────────────────────────
@payment_bp.route('/pay', methods=['POST'])
@patient_required
def process_payment():
    from models.models import db, Appointment, Payment, Patient, Doctor
    identity = parse_identity(get_jwt_identity())

    data = request.get_json()
    required = ['appointment_id', 'payment_method']
    for f in required:
        if not data.get(f):
            return jsonify({'error': f'{f} is required'}), 400

    apt = Appointment.query.get_or_404(data['appointment_id'])
    patient = Patient.query.filter_by(user_id=identity['id']).first()

    if apt.patient_id != patient.id:
        return jsonify({'error': 'Unauthorized'}), 403

    # Check if already paid
    existing = Payment.query.filter_by(appointment_id=apt.id, status='Paid').first()
    if existing:
        return jsonify({'error': 'Payment already completed'}), 400

    doctor = Doctor.query.get(apt.doctor_id)
    amount = doctor.consultation_fee if doctor else 500.0

    # Validate card details for Card payment
    if data['payment_method'] == 'Card':
        if not data.get('card_number') or len(data['card_number'].replace(' ', '')) < 16:
            return jsonify({'error': 'Invalid card number'}), 400
        if not data.get('expiry') or not data.get('cvv'):
            return jsonify({'error': 'Card expiry and CVV are required'}), 400

    # Generate dummy transaction ID
    transaction_id = 'TXN' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))
    card_last4 = None
    if data['payment_method'] == 'Card' and data.get('card_number'):
        card_last4 = data['card_number'].replace(' ', '')[-4:]

    # Create or update payment record
    payment = Payment.query.filter_by(appointment_id=apt.id).first()
    if payment:
        payment.status = 'Paid'
        payment.payment_method = data['payment_method']
        payment.card_last4 = card_last4
        payment.transaction_id = transaction_id
        payment.paid_at = datetime.utcnow()
    else:
        payment = Payment(
            appointment_id=apt.id,
            patient_id=patient.id,
            doctor_id=apt.doctor_id,
            amount=amount,
            status='Paid',
            payment_method=data['payment_method'],
            card_last4=card_last4,
            transaction_id=transaction_id,
            paid_at=datetime.utcnow()
        )
        db.session.add(payment)

    db.session.commit()

    return jsonify({
        'message': 'Payment successful',
        'transaction_id': transaction_id,
        'amount': amount,
        'payment': payment.to_dict()
    }), 200


# ── Patient: Get all their payments ──────────────────────────────────────────
@payment_bp.route('/my-payments', methods=['GET'])
@patient_required
def my_payments():
    from models.models import Payment, Patient
    identity = parse_identity(get_jwt_identity())
    patient = Patient.query.filter_by(user_id=identity['id']).first()
    payments = Payment.query.filter_by(patient_id=patient.id).order_by(Payment.created_at.desc()).all()
    return jsonify([p.to_dict() for p in payments]), 200


# ── Doctor: Set consultation fee ──────────────────────────────────────────────
@payment_bp.route('/set-fee', methods=['PUT'])
@doctor_required
def set_fee():
    from models.models import db, Doctor
    identity = parse_identity(get_jwt_identity())
    doctor = Doctor.query.filter_by(user_id=identity['id']).first()
    if not doctor:
        return jsonify({'error': 'Doctor not found'}), 404

    data = request.get_json()
    fee = data.get('consultation_fee')
    if fee is None or float(fee) < 0:
        return jsonify({'error': 'Valid fee is required'}), 400

    doctor.consultation_fee = float(fee)
    from models.models import db
    db.session.commit()
    return jsonify({'message': 'Fee updated', 'consultation_fee': doctor.consultation_fee}), 200


# ── Doctor: View their revenue ────────────────────────────────────────────────
@payment_bp.route('/doctor-revenue', methods=['GET'])
@doctor_required
def doctor_revenue():
    from models.models import Payment, Doctor
    identity = parse_identity(get_jwt_identity())
    doctor = Doctor.query.filter_by(user_id=identity['id']).first()
    payments = Payment.query.filter_by(doctor_id=doctor.id, status='Paid').all()
    total = sum(p.amount for p in payments)
    return jsonify({
        'total_revenue': total,
        'total_payments': len(payments),
        'consultation_fee': doctor.consultation_fee,
        'payments': [p.to_dict() for p in payments]
    }), 200


# ── Admin: Revenue analytics ──────────────────────────────────────────────────
@payment_bp.route('/admin/revenue', methods=['GET'])
@admin_required
def admin_revenue():
    from models.models import Payment, Doctor, Department
    payments = Payment.query.filter_by(status='Paid').all()
    total_revenue = sum(p.amount for p in payments)

    # Revenue per doctor
    doctor_revenue = {}
    for p in payments:
            did = p.doctor_id
            if did not in doctor_revenue:
                doc = Doctor.query.get(did)
                doctor_revenue[did] = {
                    'doctor_id': did,
                    'doctor_name': doc.name if doc else 'Unknown',
                    'total': 0,
                    'count': 0,
                    'department': doc.department.name if doc and doc.department else 'N/A'
                }
            doctor_revenue[did]['total'] += p.amount
            doctor_revenue[did]['count'] += 1
    # Revenue per department
    dept_revenue = {}
    for d in doctor_revenue.values():
        dept = d['department']
        if dept not in dept_revenue:
            dept_revenue[dept] = {'department': dept, 'total': 0, 'count': 0}
        dept_revenue[dept]['total'] += d['total']
        dept_revenue[dept]['count'] += d['count']

    return jsonify({
        'total_revenue': total_revenue,
        'total_payments': len(payments),
        'by_doctor': sorted(doctor_revenue.values(), key=lambda x: x['total'], reverse=True),
        'by_department': sorted(dept_revenue.values(), key=lambda x: x['total'], reverse=True)
    }), 200
