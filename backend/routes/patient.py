from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, Patient, Doctor, Appointment, DoctorAvailability, Department
from datetime import date, timedelta
from functools import wraps

def parse_identity(s):
    parts = s.split(':', 1)
    return {'id': int(parts[0]), 'role': parts[1]}


patient_bp = Blueprint('patient', __name__)

def patient_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        identity = parse_identity(get_jwt_identity())
        if identity['role'] != 'patient':
            return jsonify({'error': 'Patient access required'}), 403
        return f(*args, **kwargs)
    return decorated

def get_current_patient():
    identity = parse_identity(get_jwt_identity())
    return Patient.query.filter_by(user_id=identity['id']).first()


@patient_bp.route('/dashboard', methods=['GET'])
@patient_required
def dashboard():
    patient = get_current_patient()
    if not patient:
        return jsonify({'error': 'Patient profile not found'}), 404

    today = date.today()
    upcoming = Appointment.query.filter_by(
        patient_id=patient.id, status='Booked'
    ).filter(Appointment.date >= today).order_by(Appointment.date, Appointment.time).all()

    past = Appointment.query.filter_by(
        patient_id=patient.id, status='Completed'
    ).order_by(Appointment.date.desc()).limit(5).all()

    departments = Department.query.all()

    return jsonify({
        'patient': patient.to_dict(),
        'upcoming_appointments': [a.to_dict() for a in upcoming],
        'recent_history': [a.to_dict() for a in past],
        'departments': [d.to_dict() for d in departments]
    }), 200


@patient_bp.route('/profile', methods=['PUT'])
@patient_required
def update_profile():
    patient = get_current_patient()
    data = request.get_json()
    for field in ['name', 'phone', 'gender', 'address', 'blood_group']:
        if field in data:
            setattr(patient, field, data[field])
    if data.get('dob'):
        from datetime import datetime
        patient.dob = datetime.strptime(data['dob'], '%Y-%m-%d').date()
    db.session.commit()
    return jsonify(patient.to_dict()), 200


@patient_bp.route('/doctors', methods=['GET'])
@patient_required
def search_doctors():
    department = request.args.get('department', '')
    search = request.args.get('search', '')

    query = Doctor.query.join(Doctor.user).filter_by(is_active=True)

    if department:
        dept = Department.query.filter(Department.name.ilike(f'%{department}%')).first()
        if dept:
            query = query.filter(Doctor.department_id == dept.id)
        else:
            return jsonify([]), 200

    if search:
        query = query.filter(Doctor.name.ilike(f'%{search}%'))

    doctors = query.all()

    result = []
    today = date.today()
    week_end = today + timedelta(days=7)

    for doctor in doctors:
        doc_dict = doctor.to_dict()
        avail = DoctorAvailability.query.filter_by(doctor_id=doctor.id).filter(
            DoctorAvailability.date.between(today, week_end)
        ).all()
        doc_dict['availability'] = [a.to_dict() for a in avail]
        result.append(doc_dict)

    return jsonify(result), 200


@patient_bp.route('/departments', methods=['GET'])
@patient_required
def get_departments():
    depts = Department.query.all()
    return jsonify([d.to_dict() for d in depts]), 200


@patient_bp.route('/appointments', methods=['GET'])
@patient_required
def get_appointments():
    patient = get_current_patient()
    status = request.args.get('status')
    query = Appointment.query.filter_by(patient_id=patient.id)
    if status:
        query = query.filter_by(status=status)
    appointments = query.order_by(Appointment.date.desc(), Appointment.time.desc()).all()
    return jsonify([a.to_dict() for a in appointments]), 200


@patient_bp.route('/appointments', methods=['POST'])
@patient_required
def book_appointment():
    patient = get_current_patient()
    data = request.get_json()

    required = ['doctor_id', 'date', 'time']
    for f in required:
        if not data.get(f):
            return jsonify({'error': f'{f} is required'}), 400

    from datetime import datetime
    apt_date = datetime.strptime(data['date'], '%Y-%m-%d').date()

    # Validate time is within doctor's availability window
    avail = DoctorAvailability.query.filter_by(
        doctor_id=data['doctor_id'], date=apt_date
    ).first()
    if avail:
        if data['time'] < avail.start_time or data['time'] > avail.end_time:
            return jsonify({'error': f"Time must be within doctor availability: {avail.start_time} - {avail.end_time}"}), 400
    else:
        return jsonify({'error': 'Doctor has no availability set for this date'}), 400

    # Prevent duplicate appointment
    conflict = Appointment.query.filter_by(
        doctor_id=data['doctor_id'],
        date=apt_date,
        time=data['time']
    ).filter(Appointment.status != 'Cancelled').first()

    if conflict:
        return jsonify({'error': 'This time slot is already booked'}), 409

    apt = Appointment(
        patient_id=patient.id,
        doctor_id=data['doctor_id'],
        date=apt_date,
        time=data['time'],
        status='Booked',
        reason=data.get('reason', '')
    )
    db.session.add(apt)
    db.session.commit()
    return jsonify(apt.to_dict()), 201


@patient_bp.route('/appointments/<int:apt_id>/cancel', methods=['PUT'])
@patient_required
def cancel_appointment(apt_id):
    patient = get_current_patient()
    apt = Appointment.query.filter_by(id=apt_id, patient_id=patient.id).first_or_404()
    if apt.status == 'Completed':
        return jsonify({'error': 'Cannot cancel completed appointment'}), 400
    apt.status = 'Cancelled'
    db.session.commit()
    return jsonify(apt.to_dict()), 200


@patient_bp.route('/appointments/<int:apt_id>/reschedule', methods=['PUT'])
@patient_required
def reschedule_appointment(apt_id):
    patient = get_current_patient()
    apt = Appointment.query.filter_by(id=apt_id, patient_id=patient.id).first_or_404()
    if apt.status != 'Booked':
        return jsonify({'error': 'Only booked appointments can be rescheduled'}), 400

    data = request.get_json()
    from datetime import datetime
    new_date = datetime.strptime(data['date'], '%Y-%m-%d').date()

    conflict = Appointment.query.filter_by(
        doctor_id=apt.doctor_id,
        date=new_date,
        time=data['time']
    ).filter(Appointment.status != 'Cancelled', Appointment.id != apt.id).first()

    if conflict:
        return jsonify({'error': 'This time slot is already booked'}), 409

    apt.date = new_date
    apt.time = data['time']
    db.session.commit()
    return jsonify(apt.to_dict()), 200


@patient_bp.route('/export-csv', methods=['GET', 'POST'])
@patient_required
def export_csv():
    patient = get_current_patient()
    from celery_tasks import export_patient_csv
    export_patient_csv.delay(patient.id, patient.user.email)
    return jsonify({'message': 'Export started. You will receive an email when ready.'}), 200

