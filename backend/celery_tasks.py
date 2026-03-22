from celery import Celery
from celery.schedules import crontab
import csv
import io
from datetime import date, datetime, timedelta

def make_celery(app):
    celery = Celery(
        app.import_name,
        backend=app.config['result_backend'],
        broker=app.config['broker_url']
    )
    celery.conf.update({'result_backend': app.config['result_backend'], 'broker_url': app.config['broker_url'], 'broker_connection_retry_on_startup': True})

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask

    # Beat schedule
    celery.conf.beat_schedule = {
        'daily-reminders': {
            'task': 'celery_tasks.send_daily_reminders',
            'schedule': crontab(hour=8, minute=0),
        },
        'monthly-report': {
            'task': 'celery_tasks.send_monthly_reports',
            'schedule': crontab(day_of_month=1, hour=7, minute=0),
        },
    }

    return celery


# These will be set in app.py
celery_app = None

def set_celery(c):
    global celery_app
    celery_app = c


# --- Tasks ---
def send_daily_reminders():
    """Send reminders to patients with appointments today."""
    from models.models import Appointment, Patient, User
    from flask_mail import Message
    from app import mail

    today = date.today()
    appointments = Appointment.query.filter_by(date=today, status='Booked').all()

    for apt in appointments:
        try:
            patient = apt.patient
            if patient and patient.user and patient.user.email:
                msg = Message(
                    subject='Appointment Reminder - Hospital Management System',
                    recipients=[patient.user.email],
                    body=f"""
Dear {patient.name},

This is a reminder that you have an appointment scheduled today.

Doctor: Dr. {apt.doctor.name}
Date: {apt.date}
Time: {apt.time}
Specialization: {apt.doctor.specialization}

Please arrive 10 minutes early.

Best regards,
Hospital Management System
                    """
                )
                mail.send(msg)
        except Exception as e:
            print(f"Failed to send reminder for appointment {apt.id}: {e}")


def send_monthly_reports():
    """Send monthly activity report to all doctors."""
    from models.models import Doctor, Appointment, Treatment, User
    from flask_mail import Message
    from app import mail

    today = date.today()
    first_day = today.replace(day=1)
    last_month_end = first_day - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)

    doctors = Doctor.query.join(User).filter(User.is_active == True).all()

    for doctor in doctors:
        try:
            appointments = Appointment.query.filter_by(
                doctor_id=doctor.id
            ).filter(
                Appointment.date.between(last_month_start, last_month_end)
            ).all()

            completed = [a for a in appointments if a.status == 'Completed']
            cancelled = [a for a in appointments if a.status == 'Cancelled']

            rows = ""
            for apt in completed:
                t = apt.treatment
                rows += f"""
<tr>
  <td>{apt.date}</td>
  <td>{apt.time}</td>
  <td>{apt.patient.name if apt.patient else 'N/A'}</td>
  <td>{t.diagnosis if t else 'N/A'}</td>
  <td>{t.prescription if t else 'N/A'}</td>
</tr>"""

            html = f"""
<!DOCTYPE html>
<html>
<head><style>
  body {{ font-family: Arial, sans-serif; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
  th {{ background-color: #2196F3; color: white; }}
  .summary {{ margin-bottom: 20px; }}
</style></head>
<body>
  <h2>Monthly Activity Report - {last_month_start.strftime('%B %Y')}</h2>
  <p>Dear Dr. {doctor.name},</p>
  <div class="summary">
    <p><strong>Total Appointments:</strong> {len(appointments)}</p>
    <p><strong>Completed:</strong> {len(completed)}</p>
    <p><strong>Cancelled:</strong> {len(cancelled)}</p>
  </div>
  <h3>Completed Appointments</h3>
  <table>
    <thead>
      <tr><th>Date</th><th>Time</th><th>Patient</th><th>Diagnosis</th><th>Prescription</th></tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
</body>
</html>"""

            if doctor.user and doctor.user.email:
                msg = Message(
                    subject=f'Monthly Activity Report - {last_month_start.strftime("%B %Y")}',
                    recipients=[doctor.user.email],
                    html=html
                )
                mail.send(msg)
        except Exception as e:
            print(f"Failed to send report for doctor {doctor.id}: {e}")


def export_patient_csv(patient_id, email):
    """Export patient treatment history as CSV and email it."""
    from models.models import Patient, Appointment
    from flask_mail import Message
    from app import mail

    patient = Patient.query.get(patient_id)
    if not patient:
        return

    appointments = Appointment.query.filter_by(patient_id=patient_id).order_by(
        Appointment.date.desc()
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Appointment ID', 'Patient Name', 'Consulting Doctor',
        'Appointment Date', 'Appointment Time', 'Status',
        'Diagnosis', 'Prescription', 'Notes', 'Next Visit'
    ])

    for apt in appointments:
        t = apt.treatment
        writer.writerow([
            apt.id,
            patient.name,
            apt.doctor.name if apt.doctor else '',
            apt.date,
            apt.time,
            apt.status,
            t.diagnosis if t else '',
            t.prescription if t else '',
            t.notes if t else '',
            t.next_visit if t else ''
        ])

    csv_content = output.getvalue()

    try:
        msg = Message(
            subject='Your Treatment History Export',
            recipients=[email],
            body=f"Dear {patient.name},\n\nPlease find your treatment history CSV attached.\n\nBest regards,\nHospital Management System"
        )
        msg.attach(
            'treatment_history.csv',
            'text/csv',
            csv_content
        )
        mail.send(msg)
    except Exception as e:
        print(f"Failed to send CSV export: {e}")
