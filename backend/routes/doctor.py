from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, Doctor, Appointment, Treatment, DoctorAvailability, Patient
from datetime import date, timedelta
from functools import wraps

def parse_identity(s):
    parts = s.split(':', 1)
    return {'id': int(parts[0]), 'role': parts[1]}


doctor_bp = Blueprint('doctor', __name__)

def doctor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        identity = parse_identity(get_jwt_identity())
        if identity['role'] != 'doctor':
            return jsonify({'error': 'Doctor access required'}), 403
        return f(*args, **kwargs)
    return decorated

def get_current_doctor():
    identity = parse_identity(get_jwt_identity())
    return Doctor.query.filter_by(user_id=identity['id']).first()


@doctor_bp.route('/dashboard', methods=['GET'])
@doctor_required
def dashboard():
    doctor = get_current_doctor()
    if not doctor:
        return jsonify({'error': 'Doctor profile not found'}), 404

    today = date.today()
    week_end = today + timedelta(days=7)

    today_appointments = Appointment.query.filter_by(
        doctor_id=doctor.id, status='Booked'
    ).filter(Appointment.date == today).all()

    upcoming = Appointment.query.filter_by(
        doctor_id=doctor.id, status='Booked'
    ).filter(Appointment.date.between(today, week_end)).order_by(Appointment.date, Appointment.time).all()

    patients_set = {a.patient_id for a in Appointment.query.filter_by(doctor_id=doctor.id).all()}

    return jsonify({
        'doctor': doctor.to_dict(),
        'today_count': len(today_appointments),
        'upcoming_appointments': [a.to_dict() for a in upcoming],
        'patient_count': len(patients_set)
    }), 200


@doctor_bp.route('/appointments', methods=['GET'])
@doctor_required
def get_appointments():
    doctor = get_current_doctor()
    status = request.args.get('status')
    query = Appointment.query.filter_by(doctor_id=doctor.id)
    if status:
        query = query.filter_by(status=status)
    appointments = query.order_by(Appointment.date.desc(), Appointment.time.desc()).all()
    return jsonify([a.to_dict() for a in appointments]), 200


@doctor_bp.route('/appointments/<int:apt_id>/complete', methods=['PUT'])
@doctor_required
def complete_appointment(apt_id):
    from datetime import date
    doctor = get_current_doctor()
    apt = Appointment.query.filter_by(id=apt_id, doctor_id=doctor.id).first_or_404()
    if apt.date > date.today():
        return jsonify({'error': 'Cannot complete a future appointment'}), 400
    apt.status = 'Completed'
    db.session.commit()
    return jsonify(apt.to_dict()), 200


@doctor_bp.route('/appointments/<int:apt_id>/cancel', methods=['PUT'])
@doctor_required
def cancel_appointment(apt_id):
    doctor = get_current_doctor()
    apt = Appointment.query.filter_by(id=apt_id, doctor_id=doctor.id).first_or_404()
    apt.status = 'Cancelled'
    db.session.commit()
    return jsonify(apt.to_dict()), 200


@doctor_bp.route('/appointments/<int:apt_id>/treatment', methods=['POST', 'PUT'])
@doctor_required
def add_treatment(apt_id):
    from datetime import date
    doctor = get_current_doctor()
    apt = Appointment.query.filter_by(id=apt_id, doctor_id=doctor.id).first_or_404()
    if apt.date > date.today():
        return jsonify({'error': 'Cannot add treatment for a future appointment'}), 400
    data = request.get_json()

    if apt.treatment:
        t = apt.treatment
        for field in ['diagnosis', 'prescription', 'notes']:
            if field in data:
                setattr(t, field, data[field])
        if data.get('next_visit'):
            from datetime import datetime
            t.next_visit = datetime.strptime(data['next_visit'], '%Y-%m-%d').date()
    else:
        from datetime import datetime
        next_visit = None
        if data.get('next_visit'):
            next_visit = datetime.strptime(data['next_visit'], '%Y-%m-%d').date()
        t = Treatment(
            appointment_id=apt.id,
            diagnosis=data.get('diagnosis', ''),
            prescription=data.get('prescription', ''),
            notes=data.get('notes', ''),
            next_visit=next_visit
        )
        db.session.add(t)
        apt.status = 'Completed'

    db.session.commit()
    return jsonify(t.to_dict()), 200


@doctor_bp.route('/patients', methods=['GET'])
@doctor_required
def get_patients():
    doctor = get_current_doctor()
    patient_ids = db.session.query(Appointment.patient_id).filter_by(doctor_id=doctor.id).distinct()
    patients = Patient.query.filter(Patient.id.in_(patient_ids)).all()
    return jsonify([p.to_dict() for p in patients]), 200


@doctor_bp.route('/patients/<int:pat_id>/history', methods=['GET'])
@doctor_required
def patient_history(pat_id):
    doctor = get_current_doctor()
    appointments = Appointment.query.filter_by(
        doctor_id=doctor.id, patient_id=pat_id
    ).order_by(Appointment.date.desc()).all()
    return jsonify([a.to_dict() for a in appointments]), 200


@doctor_bp.route('/availability', methods=['GET'])
@doctor_required
def get_availability():
    doctor = get_current_doctor()
    today = date.today()
    week_end = today + timedelta(days=7)
    avail = DoctorAvailability.query.filter_by(doctor_id=doctor.id).filter(
        DoctorAvailability.date.between(today, week_end)
    ).all()
    return jsonify([a.to_dict() for a in avail]), 200


@doctor_bp.route('/availability', methods=['POST'])
@doctor_required
def set_availability():
    doctor = get_current_doctor()
    data = request.get_json()
    from datetime import datetime
    avail_date = datetime.strptime(data['date'], '%Y-%m-%d').date()

    existing = DoctorAvailability.query.filter_by(doctor_id=doctor.id, date=avail_date).first()
    if existing:
        existing.start_time = data['start_time']
        existing.end_time = data['end_time']
        existing.max_appointments = data.get('max_appointments', 10)
    else:
        avail = DoctorAvailability(
            doctor_id=doctor.id,
            date=avail_date,
            start_time=data['start_time'],
            end_time=data['end_time'],
            max_appointments=data.get('max_appointments', 10)
        )
        db.session.add(avail)
    db.session.commit()
    return jsonify({'message': 'Availability updated'}), 200


@doctor_bp.route('/availability/<int:avail_id>', methods=['DELETE'])
@doctor_required
def delete_availability(avail_id):
    doctor = get_current_doctor()
    avail = DoctorAvailability.query.filter_by(id=avail_id, doctor_id=doctor.id).first_or_404()
    db.session.delete(avail)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200
