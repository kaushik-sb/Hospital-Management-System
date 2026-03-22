from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.models import db, User, Doctor, Patient, Department, Appointment, Treatment
from functools import wraps

admin_bp = Blueprint('admin', __name__)

def parse_identity(s):
    parts = s.split(':', 1)
    return {'id': int(parts[0]), 'role': parts[1]}

def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        identity = parse_identity(get_jwt_identity())
        if identity['role'] != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated

@admin_bp.route('/dashboard', methods=['GET'])
@admin_required
def dashboard():
    total_doctors = Doctor.query.join(User).filter(User.is_active == True).count()
    total_patients = Patient.query.join(User).filter(User.is_active == True).count()
    total_appointments = Appointment.query.count()
    booked = Appointment.query.filter_by(status='Booked').count()
    completed = Appointment.query.filter_by(status='Completed').count()
    cancelled = Appointment.query.filter_by(status='Cancelled').count()
    return jsonify({'total_doctors': total_doctors, 'total_patients': total_patients,
                    'total_appointments': total_appointments, 'booked': booked,
                    'completed': completed, 'cancelled': cancelled}), 200

@admin_bp.route('/departments', methods=['GET'])
@admin_required
def get_departments():
    return jsonify([d.to_dict() for d in Department.query.all()]), 200

@admin_bp.route('/departments', methods=['POST'])
@admin_required
def add_department():
    data = request.get_json()
    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    if Department.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Department already exists'}), 400
    dept = Department(name=data['name'], description=data.get('description', ''))
    db.session.add(dept); db.session.commit()
    return jsonify(dept.to_dict()), 201

@admin_bp.route('/departments/<int:dept_id>', methods=['PUT'])
@admin_required
def update_department(dept_id):
    dept = Department.query.get_or_404(dept_id)
    data = request.get_json()
    if data.get('name'): dept.name = data['name']
    if 'description' in data: dept.description = data['description']
    db.session.commit()
    return jsonify(dept.to_dict()), 200

@admin_bp.route('/departments/<int:dept_id>', methods=['DELETE'])
@admin_required
def delete_department(dept_id):
    dept = Department.query.get_or_404(dept_id)
    db.session.delete(dept); db.session.commit()
    return jsonify({'message': 'Deleted'}), 200

@admin_bp.route('/doctors', methods=['GET'])
@admin_required
def get_doctors():
    search = request.args.get('search', '')
    query = Doctor.query.join(User)
    if search:
        query = query.filter(
            (Doctor.name.ilike(f'%{search}%')) | (Doctor.specialization.ilike(f'%{search}%')))
    return jsonify([d.to_dict() for d in query.all()]), 200

@admin_bp.route('/doctors', methods=['POST'])
@admin_required
def add_doctor():
    data = request.get_json()
    for f in ['username', 'email', 'password', 'name']:
        if not data.get(f):
            return jsonify({'error': f'{f} is required'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400
    user = User(username=data['username'], email=data['email'], role='doctor')
    user.set_password(data['password'])
    db.session.add(user); db.session.flush()
    doctor = Doctor(user_id=user.id, name=data['name'],
                    specialization=data.get('specialization', ''),
                    phone=data.get('phone', ''), qualification=data.get('qualification', ''),
                    experience_years=data.get('experience_years', 0),
                    department_id=data.get('department_id'))
    db.session.add(doctor); db.session.commit()
    return jsonify(doctor.to_dict()), 201

@admin_bp.route('/doctors/<int:doc_id>', methods=['PUT'])
@admin_required
def update_doctor(doc_id):
    doctor = Doctor.query.get_or_404(doc_id)
    data = request.get_json()
    for field in ['name', 'specialization', 'phone', 'qualification', 'experience_years', 'department_id']:
        if field in data: setattr(doctor, field, data[field])
    if 'email' in data: doctor.user.email = data['email']
    db.session.commit()
    return jsonify(doctor.to_dict()), 200

@admin_bp.route('/doctors/<int:doc_id>', methods=['DELETE'])
@admin_required
def delete_doctor(doc_id):
    doctor = Doctor.query.get_or_404(doc_id)
    doctor.user.is_active = False; db.session.commit()
    return jsonify({'message': 'Doctor deactivated'}), 200

@admin_bp.route('/doctors/<int:doc_id>/activate', methods=['PUT'])
@admin_required
def activate_doctor(doc_id):
    doctor = Doctor.query.get_or_404(doc_id)
    doctor.user.is_active = True; db.session.commit()
    return jsonify({'message': 'Doctor activated'}), 200

@admin_bp.route('/patients', methods=['GET'])
@admin_required
def get_patients():
    search = request.args.get('search', '')
    query = Patient.query.join(User)
    if search:
        query = query.filter(
            (Patient.name.ilike(f'%{search}%')) | (Patient.phone.ilike(f'%{search}%')) |
            (User.email.ilike(f'%{search}%')))
    return jsonify([p.to_dict() for p in query.all()]), 200

@admin_bp.route('/patients/<int:pat_id>', methods=['PUT'])
@admin_required
def update_patient(pat_id):
    patient = Patient.query.get_or_404(pat_id)
    data = request.get_json()
    for field in ['name', 'phone', 'gender', 'address', 'blood_group']:
        if field in data: setattr(patient, field, data[field])
    db.session.commit()
    return jsonify(patient.to_dict()), 200

@admin_bp.route('/patients/<int:pat_id>/deactivate', methods=['PUT'])
@admin_required
def deactivate_patient(pat_id):
    patient = Patient.query.get_or_404(pat_id)
    patient.user.is_active = False; db.session.commit()
    return jsonify({'message': 'Patient deactivated'}), 200

@admin_bp.route('/patients/<int:pat_id>/activate', methods=['PUT'])
@admin_required
def activate_patient(pat_id):
    patient = Patient.query.get_or_404(pat_id)
    patient.user.is_active = True; db.session.commit()
    return jsonify({'message': 'Patient activated'}), 200

@admin_bp.route('/appointments', methods=['GET'])
@admin_required
def get_appointments():
    status = request.args.get('status')
    query = Appointment.query
    if status: query = query.filter_by(status=status)
    appointments = query.order_by(Appointment.date.desc(), Appointment.time.desc()).all()
    return jsonify([a.to_dict() for a in appointments]), 200

@admin_bp.route('/doctors/<int:doc_id>/blacklist', methods=['PUT'])
@admin_required
def blacklist_doctor(doc_id):
    doctor = Doctor.query.get_or_404(doc_id)
    data = request.get_json()
    doctor.user.is_active = False
    doctor.user.is_blacklisted = True
    doctor.user.blacklist_reason = data.get('reason', 'Blacklisted by admin')
    # Cancel all future appointments
    from datetime import date
    future_apts = Appointment.query.filter_by(
        doctor_id=doctor.id, status='Booked'
    ).filter(Appointment.date >= date.today()).all()
    for apt in future_apts:
        apt.status = 'Cancelled'
    db.session.commit()
    return jsonify({'message': 'Doctor blacklisted', 'doctor': doctor.to_dict()}), 200

@admin_bp.route('/doctors/<int:doc_id>/unblacklist', methods=['PUT'])
@admin_required
def unblacklist_doctor(doc_id):
    doctor = Doctor.query.get_or_404(doc_id)
    doctor.user.is_active = True
    doctor.user.is_blacklisted = False
    doctor.user.blacklist_reason = ''
    db.session.commit()
    return jsonify({'message': 'Doctor removed from blacklist', 'doctor': doctor.to_dict()}), 200

@admin_bp.route('/patients/<int:pat_id>/blacklist', methods=['PUT'])
@admin_required
def blacklist_patient(pat_id):
    patient = Patient.query.get_or_404(pat_id)
    data = request.get_json()
    patient.user.is_active = False
    patient.user.is_blacklisted = True
    patient.user.blacklist_reason = data.get('reason', 'Blacklisted by admin')
    from datetime import date
    future_apts = Appointment.query.filter_by(
        patient_id=patient.id, status='Booked'
    ).filter(Appointment.date >= date.today()).all()
    for apt in future_apts:
        apt.status = 'Cancelled'
    db.session.commit()
    return jsonify({'message': 'Patient blacklisted', 'patient': patient.to_dict()}), 200

@admin_bp.route('/patients/<int:pat_id>/unblacklist', methods=['PUT'])
@admin_required
def unblacklist_patient(pat_id):
    patient = Patient.query.get_or_404(pat_id)
    patient.user.is_active = True
    patient.user.is_blacklisted = False
    patient.user.blacklist_reason = ''
    db.session.commit()
    return jsonify({'message': 'Patient removed from blacklist', 'patient': patient.to_dict()}), 200
