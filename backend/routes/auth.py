from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models.models import db, User, Doctor, Patient

auth_bp = Blueprint('auth', __name__)

def make_token(user):
    return create_access_token(identity=f"{user.id}:{user.role}")

def parse_identity(identity_str):
    parts = identity_str.split(':', 1)
    return {'id': int(parts[0]), 'role': parts[1]}

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    required = ['username', 'email', 'password', 'name']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400
    user = User(username=data['username'], email=data['email'], role='patient')
    user.set_password(data['password'])
    db.session.add(user)
    db.session.flush()
    patient = Patient(
        user_id=user.id, name=data['name'],
        phone=data.get('phone', ''), gender=data.get('gender', ''),
        blood_group=data.get('blood_group', '')
    )
    db.session.add(patient)
    db.session.commit()
    token = make_token(user)
    return jsonify({'token': token, 'user': user.to_dict(), 'patient': patient.to_dict()}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if not user or not user.check_password(data.get('password', '')):
        return jsonify({'error': 'Invalid credentials'}), 401
    if user.is_blacklisted:
        return jsonify({'error': 'Your account has been blacklisted. Reason: ' + (user.blacklist_reason or 'Contact admin')}), 403
    if not user.is_active:
        return jsonify({'error': 'Account is deactivated'}), 403
    token = make_token(user)
    profile = None
    if user.role == 'doctor' and user.doctor_profile:
        profile = user.doctor_profile.to_dict()
    elif user.role == 'patient' and user.patient_profile:
        profile = user.patient_profile.to_dict()
    return jsonify({'token': token, 'user': user.to_dict(), 'profile': profile}), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    identity = parse_identity(get_jwt_identity())
    user = User.query.get(identity['id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    profile = None
    if user.role == 'doctor' and user.doctor_profile:
        profile = user.doctor_profile.to_dict()
    elif user.role == 'patient' and user.patient_profile:
        profile = user.patient_profile.to_dict()
    return jsonify({'user': user.to_dict(), 'profile': profile}), 200
