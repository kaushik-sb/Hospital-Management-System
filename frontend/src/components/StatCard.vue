// StatCard component
// Usage: included and registered in main.js
// This file documents the component structure for reference
// The actual component is defined inline in main.js for CDN compatibility

/*
StatCard Props:
  - label: String  (e.g. "Total Doctors")
  - value: Number
  - icon: String   (Bootstrap icon class, e.g. "bi-person-badge-fill")
  - color: String  (CSS color)

Template:
  <div class="stat-card" :style="'--accent-color:' + color">
    <div class="stat-icon"><i :class="'bi ' + icon"></i></div>
    <div class="stat-info">
      <div class="stat-value">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
*/
