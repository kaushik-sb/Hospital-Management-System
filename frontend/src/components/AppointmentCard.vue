// AppointmentCard component
// Usage: included and registered in main.js
// This file documents the component structure for reference
// The actual component is defined inline in main.js for CDN compatibility

/*
AppointmentCard Props:
  - appointment: Object  {id, patient_name, doctor_name, date, time, status, treatment}

Events:
  - complete(id)
  - cancel(id)
  - reschedule(appointment)

Template:
  <div class="appt-full-card">
    <div class="afc-left">
      <div class="afc-date">{{ appointment.date }}</div>
      <div class="afc-time">{{ appointment.time }}</div>
    </div>
    <div class="afc-mid">
      <div class="fw-600">Dr. {{ appointment.doctor_name }}</div>
      ...
    </div>
    <div class="afc-right">
      <span :class="'badge ' + statusColor(appointment.status)">{{ appointment.status }}</span>
    </div>
  </div>
*/
