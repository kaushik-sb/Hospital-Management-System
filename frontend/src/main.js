const { createApp, ref, reactive, computed, onMounted, watch } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

// ── API Helper ────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000/api';

async function api(method, endpoint, data = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (data) opts.body = JSON.stringify(data);
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

// ── Auth Store (global) ───────────────────────────────────────────────────────
const authStore = reactive({
  token: localStorage.getItem('hms_token') || null,
  user: JSON.parse(localStorage.getItem('hms_user') || 'null'),
  profile: JSON.parse(localStorage.getItem('hms_profile') || 'null'),
  get isLoggedIn() { return !!this.token; },
  get role() { return this.user?.role || null; },
  login(token, user, profile) {
    this.token = token;
    this.user = user;
    this.profile = profile;
    localStorage.setItem('hms_token', token);
    localStorage.setItem('hms_user', JSON.stringify(user));
    localStorage.setItem('hms_profile', JSON.stringify(profile));
  },
  logout() {
    this.token = null;
    this.user = null;
    this.profile = null;
    localStorage.removeItem('hms_token');
    localStorage.removeItem('hms_user');
    localStorage.removeItem('hms_profile');
  }
});

// ── Alert Component ───────────────────────────────────────────────────────────
const AlertComponent = {
  template: `
    <div v-if="msg" :class="['alert', 'alert-' + type, 'alert-dismissible', 'fade', 'show']" role="alert">
      <i :class="icon + ' me-2'"></i>{{ msg }}
      <button type="button" class="btn-close" @click="msg=''"></button>
    </div>
  `,
  props: { message: String, type: { default: 'danger' } },
  setup(props) {
    const msg = ref(props.message || '');
    const icon = computed(() => ({
      danger: 'bi bi-exclamation-circle',
      success: 'bi bi-check-circle',
      warning: 'bi bi-exclamation-triangle',
      info: 'bi bi-info-circle'
    }[props.type] || 'bi bi-info-circle'));
    watch(() => props.message, v => { msg.value = v; });
    return { msg, icon };
  }
};

// ── Sidebar Component ─────────────────────────────────────────────────────────
const SidebarComponent = {
  template: `
  <div class="sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <div class="brand">
        <div class="brand-icon"><i class="bi bi-heart-pulse-fill"></i></div>
        <span v-if="!collapsed" class="brand-name">MediCare</span>
      </div>
      <button class="btn btn-sm collapse-btn" @click="$emit('toggle')">
        <i :class="collapsed ? 'bi bi-chevron-right' : 'bi bi-chevron-left'"></i>
      </button>
    </div>

    <nav class="sidebar-nav">
      <router-link v-for="item in navItems" :key="item.path"
        :to="item.path" class="nav-item" active-class="active">
        <i :class="'bi ' + item.icon"></i>
        <span v-if="!collapsed">{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <div class="user-info" v-if="!collapsed">
        <div class="avatar">{{ initials }}</div>
        <div>
          <div class="fw-600">{{ authStore.user?.username }}</div>
          <div class="role-badge">{{ authStore.role }}</div>
        </div>
      </div>
      <button class="btn btn-logout" @click="logout">
        <i class="bi bi-box-arrow-right"></i>
        <span v-if="!collapsed">Logout</span>
      </button>
    </div>
  </div>
  `,
  props: { collapsed: Boolean },
  emits: ['toggle'],
  setup() {
    const router = VueRouter.useRouter();
    const navItems = computed(() => {
      const role = authStore.role;
      if (role === 'admin') return [
        { path: '/admin/dashboard', icon: 'bi-grid-1x2-fill', label: 'Dashboard' },
        { path: '/admin/doctors', icon: 'bi-person-badge-fill', label: 'Doctors' },
        { path: '/admin/patients', icon: 'bi-people-fill', label: 'Patients' },
        { path: '/admin/appointments', icon: 'bi-calendar2-check-fill', label: 'Appointments' },
        { path: '/admin/departments', icon: 'bi-building-fill-check', label: 'Departments' },
        { path: '/admin/revenue', icon: 'bi-graph-up-arrow', label: 'Revenue' },
      ];
      if (role === 'doctor') return [
        { path: '/doctor/dashboard', icon: 'bi-grid-1x2-fill', label: 'Dashboard' },
        { path: '/doctor/appointments', icon: 'bi-calendar2-check-fill', label: 'Appointments' },
        { path: '/doctor/patients', icon: 'bi-people-fill', label: 'My Patients' },
        { path: '/doctor/availability', icon: 'bi-clock-fill', label: 'Availability' },
        { path: '/doctor/revenue', icon: 'bi-currency-rupee', label: 'Revenue & Fees' },
      ];
      if (role === 'patient') return [
        { path: '/patient/dashboard', icon: 'bi-grid-1x2-fill', label: 'Dashboard' },
        { path: '/patient/doctors', icon: 'bi-person-badge-fill', label: 'Find Doctors' },
        { path: '/patient/appointments', icon: 'bi-calendar2-check-fill', label: 'My Appointments' },
        { path: '/patient/profile', icon: 'bi-person-circle', label: 'Profile' },
      ];
      return [];
    });
    const initials = computed(() => {
      const n = authStore.user?.username || '';
      return n.slice(0, 2).toUpperCase();
    });
    function logout() {
      authStore.logout();
      router.push('/login');
    }
    return { navItems, authStore, initials, logout };
  }
};

// ── Layout Component ──────────────────────────────────────────────────────────
const LayoutComponent = {
  components: { SidebarComponent },
  template: `
  <div class="layout">
    <SidebarComponent :collapsed="sidebarCollapsed" @toggle="sidebarCollapsed = !sidebarCollapsed" />
    <main class="main-content" :class="{ expanded: sidebarCollapsed }">
      <div class="topbar">
        <h5 class="page-title">{{ pageTitle }}</h5>
        <div class="topbar-right">
          <span class="badge bg-primary-soft text-primary">
            <i class="bi bi-person-circle me-1"></i>{{ authStore.user?.username }}
          </span>
        </div>
      </div>
      <div class="content-area">
        <router-view />
      </div>
    </main>
  </div>
  `,
  setup() {
    const route = VueRouter.useRoute();
    const sidebarCollapsed = ref(false);
    const pageTitle = computed(() => route.meta?.title || 'HMS');
    return { sidebarCollapsed, pageTitle, authStore };
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGES
// ══════════════════════════════════════════════════════════════════════════════

// ── Login Page ────────────────────────────────────────────────────────────────
const LoginPage = {
  components: { AlertComponent },
  template: `
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand">
        <div class="brand-icon-lg"><i class="bi bi-heart-pulse-fill"></i></div>
        <h2 class="auth-title">MediCare HMS</h2>
        <p class="auth-subtitle">Hospital Management System</p>
      </div>
      <AlertComponent :message="error" type="danger" />
      <form @submit.prevent="login">
        <div class="mb-3">
          <label class="form-label">Username</label>
          <div class="input-group">
            <span class="input-group-text"><i class="bi bi-person"></i></span>
            <input v-model="form.username" type="text" class="form-control" placeholder="Enter username" required />
          </div>
        </div>
        <div class="mb-4">
          <label class="form-label">Password</label>
          <div class="input-group">
            <span class="input-group-text"><i class="bi bi-lock"></i></span>
            <input v-model="form.password" :type="showPwd ? 'text' : 'password'" class="form-control" placeholder="Enter password" required />
            <button type="button" class="btn btn-outline-secondary" @click="showPwd=!showPwd">
              <i :class="showPwd ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
            </button>
          </div>
        </div>
        <button class="btn btn-primary w-100 btn-lg" :disabled="loading">
          <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
          Sign In
        </button>
      </form>
      <p class="text-center mt-3 text-muted">
        New patient? <router-link to="/register">Register here</router-link>
      </p>
      <div class="demo-creds mt-3">
        <small class="text-muted d-block mb-1">Demo credentials:</small>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-sm btn-outline-secondary" @click="fillDemo('admin','Admin@123')">Admin</button>
          <button class="btn btn-sm btn-outline-secondary" @click="fillDemo('doctor1','Doctor@123')">Doctor</button>
          <button class="btn btn-sm btn-outline-secondary" @click="fillDemo('patient1','Patient@123')">Patient</button>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const router = VueRouter.useRouter();
    const form = reactive({ username: '', password: '' });
    const error = ref('');
    const loading = ref(false);
    const showPwd = ref(false);

    function fillDemo(u, p) { form.username = u; form.password = p; }

    async function login() {
      error.value = '';
      loading.value = true;
      try {
        const res = await api('POST', '/auth/login', form);
        authStore.login(res.token, res.user, res.profile);
        const role = res.user.role;
        router.push(`/${role}/dashboard`);
      } catch (e) {
        error.value = e.message;
      } finally {
        loading.value = false;
      }
    }
    return { form, error, loading, showPwd, login, fillDemo };
  }
};

// ── Register Page ─────────────────────────────────────────────────────────────
const RegisterPage = {
  components: { AlertComponent },
  template: `
  <div class="auth-page">
    <div class="auth-card" style="max-width:480px">
      <div class="auth-brand">
        <div class="brand-icon-lg"><i class="bi bi-heart-pulse-fill"></i></div>
        <h2 class="auth-title">Create Account</h2>
        <p class="auth-subtitle">Register as a Patient</p>
      </div>
      <AlertComponent :message="error" type="danger" />
      <AlertComponent :message="success" type="success" />
      <form @submit.prevent="register">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Full Name *</label>
            <input v-model="form.name" class="form-control" placeholder="John Doe" required />
          </div>
          <div class="col-md-6">
            <label class="form-label">Username *</label>
            <input v-model="form.username" class="form-control" placeholder="johndoe" required />
          </div>
          <div class="col-12">
            <label class="form-label">Email *</label>
            <input v-model="form.email" type="email" class="form-control" placeholder="john@example.com" required />
          </div>
          <div class="col-md-6">
            <label class="form-label">Password *</label>
            <input v-model="form.password" type="password" class="form-control" placeholder="Min 6 chars" required />
          </div>
          <div class="col-md-6">
            <label class="form-label">Phone</label>
            <input v-model="form.phone" class="form-control" placeholder="+91 XXXXXXXXXX" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Gender</label>
            <select v-model="form.gender" class="form-select">
              <option value="">Select</option>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Blood Group</label>
            <select v-model="form.blood_group" class="form-select">
              <option value="">Select</option>
              <option v-for="bg in bloodGroups" :key="bg">{{ bg }}</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary w-100 btn-lg mt-4" :disabled="loading">
          <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
          Register
        </button>
      </form>
      <p class="text-center mt-3 text-muted">
        Already have an account? <router-link to="/login">Login</router-link>
      </p>
    </div>
  </div>
  `,
  setup() {
    const router = VueRouter.useRouter();
    const form = reactive({ name:'', username:'', email:'', password:'', phone:'', gender:'', blood_group:'' });
    const error = ref('');
    const success = ref('');
    const loading = ref(false);
    const bloodGroups = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

    async function register() {
      error.value = ''; success.value = ''; loading.value = true;
      try {
        const res = await api('POST', '/auth/register', form);
        authStore.login(res.token, res.user, res.patient);
        router.push('/patient/dashboard');
      } catch(e) {
        error.value = e.message;
      } finally {
        loading.value = false;
      }
    }
    return { form, error, success, loading, bloodGroups, register };
  }
};

// ── Admin Dashboard ───────────────────────────────────────────────────────────
const AdminDashboard = {
  template: `
  <div>
    <div class="row g-4 mb-4">
      <div class="col-sm-6 col-xl-3" v-for="stat in stats" :key="stat.label">
        <div class="stat-card" :style="'--accent-color:' + stat.color">
          <div class="stat-icon"><i :class="'bi ' + stat.icon"></i></div>
          <div class="stat-info">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="row g-4">
      <div class="col-lg-7">
        <div class="card-panel">
          <h6 class="panel-title">Appointment Overview</h6>
          <canvas ref="chartRef" height="200"></canvas>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="card-panel">
          <h6 class="panel-title">Quick Actions</h6>
          <div class="d-grid gap-2">
            <router-link to="/admin/doctors" class="btn btn-outline-primary">
              <i class="bi bi-person-plus me-2"></i>Add New Doctor
            </router-link>
            <router-link to="/admin/departments" class="btn btn-outline-info">
              <i class="bi bi-building-add me-2"></i>Manage Departments
            </router-link>
            <router-link to="/admin/appointments" class="btn btn-outline-success">
              <i class="bi bi-calendar2-check me-2"></i>View All Appointments
            </router-link>
            <router-link to="/admin/patients" class="btn btn-outline-warning">
              <i class="bi bi-people me-2"></i>View All Patients
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const chartRef = ref(null);
    const data = reactive({ total_doctors:0, total_patients:0, total_appointments:0, booked:0, completed:0, cancelled:0 });

    const stats = computed(() => [
      { label:'Total Doctors', value: data.total_doctors, icon:'bi-person-badge-fill', color:'#1a6fc4' },
      { label:'Total Patients', value: data.total_patients, icon:'bi-people-fill', color:'#00bcd4' },
      { label:'Total Appointments', value: data.total_appointments, icon:'bi-calendar2-check-fill', color:'#2e7d32' },
      { label:'Active Bookings', value: data.booked, icon:'bi-clock-fill', color:'#f9a825' },
    ]);

    onMounted(async () => {
      try {
        const res = await api('GET', '/admin/dashboard', null, authStore.token);
        Object.assign(data, res);
        if (chartRef.value) {
          new Chart(chartRef.value, {
            type: 'doughnut',
            data: {
              labels: ['Booked', 'Completed', 'Cancelled'],
              datasets: [{ data: [res.booked, res.completed, res.cancelled],
                backgroundColor: ['#1a6fc4','#2e7d32','#e53935'], borderWidth:0 }]
            },
            options: { responsive:true, plugins:{ legend:{ position:'bottom' } } }
          });
        }
      } catch(e) { console.error(e); }
    });

    return { stats, chartRef };
  }
};

// ── Admin Doctors ─────────────────────────────────────────────────────────────
const AdminDoctors = {
  components: { AlertComponent },
  template: `
  <div>
    <AlertComponent :message="msg.text" :type="msg.type" />
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div class="search-bar">
        <i class="bi bi-search"></i>
        <input v-model="search" @input="fetchDoctors" type="text" placeholder="Search by name or specialization..." />
      </div>
      <button class="btn btn-primary" @click="openModal()">
        <i class="bi bi-plus-lg me-2"></i>Add Doctor
      </button>
    </div>

    <div class="table-panel">
      <table class="table table-hover align-middle">
        <thead><tr>
          <th>Name</th><th>Specialization</th><th>Department</th>
          <th>Experience</th><th>Phone</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          <tr v-if="!doctors.length"><td colspan="7" class="text-center text-muted py-4">No doctors found</td></tr>
          <tr v-for="d in doctors" :key="d.id">
            <td><div class="fw-600">{{ d.name }}</div><small class="text-muted">{{ d.email }}</small></td>
            <td>{{ d.specialization }}</td>
            <td>{{ d.department?.name || '—' }}</td>
            <td>{{ d.experience_years }} yrs</td>
            <td>{{ d.phone || '—' }}</td>
            <td><span :class="'badge ' + (d.is_active ? 'bg-success' : 'bg-danger')">{{ d.is_active ? 'Active' : 'Inactive' }}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary me-1" @click="openModal(d)"><i class="bi bi-pencil"></i></button>
              <button v-if="d.is_active" class="btn btn-sm btn-outline-danger" @click="toggleStatus(d)"><i class="bi bi-slash-circle"></i></button>
              <button v-else class="btn btn-sm btn-outline-success" @click="toggleStatus(d)"><i class="bi bi-check-circle"></i></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div class="modal fade" id="doctorModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ editing ? 'Edit Doctor' : 'Add Doctor' }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-md-6" v-if="!editing">
                <label class="form-label">Username *</label>
                <input v-model="form.username" class="form-control" required />
              </div>
              <div class="col-md-6" v-if="!editing">
                <label class="form-label">Password *</label>
                <input v-model="form.password" type="password" class="form-control" required />
              </div>
              <div class="col-md-6">
                <label class="form-label">Full Name *</label>
                <input v-model="form.name" class="form-control" required />
              </div>
              <div class="col-md-6">
                <label class="form-label">Email *</label>
                <input v-model="form.email" type="email" class="form-control" required />
              </div>
              <div class="col-md-6">
                <label class="form-label">Department</label>
                <select v-model="form.department_id" @change="onDeptChange" class="form-select">
                  <option value="">Select Department</option>
                  <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Specialization <small class="text-muted">(auto-filled, editable)</small></label>
                <input v-model="form.specialization" class="form-control" placeholder="e.g. Interventional Cardiology" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Phone</label>
                <input v-model="form.phone" class="form-control" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Experience (years)</label>
                <input v-model="form.experience_years" type="number" class="form-control" />
              </div>
              <div class="col-12">
                <label class="form-label">Qualification</label>
                <input v-model="form.qualification" class="form-control" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button class="btn btn-primary" @click="saveDoctor" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const doctors = ref([]);
    const departments = ref([]);
    const search = ref('');
    const editing = ref(null);
    const saving = ref(false);
    const msg = reactive({ text: '', type: 'success' });
    const form = reactive({ username:'', password:'', name:'', email:'', specialization:'', department_id:'', phone:'', experience_years:0, qualification:'' });
    let modal;

    async function fetchDoctors() {
      const res = await api('GET', `/admin/doctors?search=${search.value}`, null, authStore.token);
      doctors.value = res;
    }
    async function fetchDepartments() {
      const res = await api('GET', '/admin/departments', null, authStore.token);
      departments.value = res;
    }

    function onDeptChange() {
      // Auto-fill specialization with department name if specialization is empty or was previously auto-filled
      const dept = departments.value.find(d => d.id == form.department_id);
      if (dept) form.specialization = dept.name;
    }

    function openModal(doc = null) {
      editing.value = doc;
      if (doc) {
        Object.assign(form, { name: doc.name, email: doc.email, specialization: doc.specialization, department_id: doc.department?.id || '', phone: doc.phone, experience_years: doc.experience_years, qualification: doc.qualification, username:'', password:'' });
      } else {
        Object.assign(form, { username:'', password:'', name:'', email:'', specialization:'', department_id:'', phone:'', experience_years:0, qualification:'' });
      }
      modal = new bootstrap.Modal(document.getElementById('doctorModal'));
      modal.show();
    }

    async function saveDoctor() {
      saving.value = true;
      try {
        if (editing.value) {
          await api('PUT', `/admin/doctors/${editing.value.id}`, form, authStore.token);
          msg.text = 'Doctor updated!'; msg.type = 'success';
        } else {
          await api('POST', '/admin/doctors', form, authStore.token);
          msg.text = 'Doctor added!'; msg.type = 'success';
        }
        modal.hide();
        fetchDoctors();
      } catch(e) {
        msg.text = e.message; msg.type = 'danger';
      } finally {
        saving.value = false;
      }
    }

    async function toggleStatus(doc) {
      const ep = doc.is_active ? `/admin/doctors/${doc.id}` : `/admin/doctors/${doc.id}/activate`;
      const method = doc.is_active ? 'DELETE' : 'PUT';
      await api(method, ep, null, authStore.token);
      fetchDoctors();
    }

    onMounted(() => { fetchDoctors(); fetchDepartments(); });
    return { doctors, departments, search, editing, saving, form, msg, openModal, saveDoctor, toggleStatus, fetchDoctors, onDeptChange };
  }
};

// ── Admin Patients ────────────────────────────────────────────────────────────
const AdminPatients = {
  components: { AlertComponent },
  template: `
  <div>
    <AlertComponent :message="msg.text" :type="msg.type" />
    <div class="search-bar mb-4">
      <i class="bi bi-search"></i>
      <input v-model="search" @input="fetchPatients" type="text" placeholder="Search by name, phone, or email..." />
    </div>
    <div class="table-panel">
      <table class="table table-hover align-middle">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Gender</th><th>Blood Group</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-if="!patients.length"><td colspan="7" class="text-center text-muted py-4">No patients found</td></tr>
          <tr v-for="p in patients" :key="p.id">
            <td class="fw-600">{{ p.name }}</td>
            <td>{{ p.email }}</td>
            <td>{{ p.phone || '—' }}</td>
            <td>{{ p.gender || '—' }}</td>
            <td>{{ p.blood_group || '—' }}</td>
            <td><span :class="'badge ' + (p.is_active ? 'bg-success' : 'bg-danger')">{{ p.is_active ? 'Active' : 'Inactive' }}</span></td>
            <td>
              <button v-if="p.is_active" class="btn btn-sm btn-outline-danger" @click="toggleStatus(p)">Deactivate</button>
              <button v-else class="btn btn-sm btn-outline-success" @click="toggleStatus(p)">Activate</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  `,
  setup() {
    const patients = ref([]);
    const search = ref('');
    const msg = reactive({ text: '', type: 'success' });

    async function fetchPatients() {
      const res = await api('GET', `/admin/patients?search=${search.value}`, null, authStore.token);
      patients.value = res;
    }
    async function toggleStatus(p) {
      const ep = p.is_active ? `/admin/patients/${p.id}/deactivate` : `/admin/patients/${p.id}/activate`;
      await api('PUT', ep, null, authStore.token);
      fetchPatients();
    }
    onMounted(fetchPatients);
    return { patients, search, msg, fetchPatients, toggleStatus };
  }
};

// ── Admin Appointments ────────────────────────────────────────────────────────
const AdminAppointments = {
  template: `
  <div>
    <div class="d-flex gap-2 mb-4">
      <button v-for="s in ['','Booked','Completed','Cancelled']" :key="s"
        :class="['btn btn-sm', statusFilter===s ? 'btn-primary' : 'btn-outline-secondary']"
        @click="statusFilter=s; fetchAppointments()">
        {{ s || 'All' }}
      </button>
    </div>
    <div class="table-panel">
      <table class="table table-hover align-middle">
        <thead><tr><th>#</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Reason</th></tr></thead>
        <tbody>
          <tr v-if="!appointments.length"><td colspan="7" class="text-center text-muted py-4">No appointments</td></tr>
          <tr v-for="a in appointments" :key="a.id">
            <td>{{ a.id }}</td>
            <td class="fw-600">{{ a.patient_name }}</td>
            <td>Dr. {{ a.doctor_name }}</td>
            <td>{{ a.date }}</td>
            <td>{{ a.time }}</td>
            <td><span :class="'badge ' + statusColor(a.status)">{{ a.status }}</span></td>
            <td>{{ a.reason || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  `,
  setup() {
    const appointments = ref([]);
    const statusFilter = ref('');
    function statusColor(s) { return { Booked:'bg-primary', Completed:'bg-success', Cancelled:'bg-danger' }[s] || 'bg-secondary'; }
    async function fetchAppointments() {
      const ep = statusFilter.value ? `/admin/appointments?status=${statusFilter.value}` : '/admin/appointments';
      const res = await api('GET', ep, null, authStore.token);
      appointments.value = res;
    }
    onMounted(fetchAppointments);
    return { appointments, statusFilter, statusColor, fetchAppointments };
  }
};

// ── Admin Departments ─────────────────────────────────────────────────────────
const AdminDepartments = {
  components: { AlertComponent },
  template: `
  <div>
    <AlertComponent :message="msg.text" :type="msg.type" />
    <div class="d-flex justify-content-end mb-4">
      <button class="btn btn-primary" @click="openModal()"><i class="bi bi-plus-lg me-2"></i>Add Department</button>
    </div>
    <div class="row g-3">
      <div class="col-md-4" v-for="d in departments" :key="d.id">
        <div class="dept-card">
          <div class="dept-icon"><i class="bi bi-building-fill-check"></i></div>
          <div class="dept-info">
            <h6>{{ d.name }}</h6>
            <p class="text-muted small">{{ d.description }}</p>
            <span class="badge bg-primary-soft text-primary">{{ d.doctor_count }} doctors</span>
          </div>
          <div class="dept-actions">
            <button class="btn btn-sm btn-outline-primary" @click="openModal(d)"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" @click="deleteDept(d.id)"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>
    </div>
    <!-- Modal -->
    <div class="modal fade" id="deptModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">{{ editing ? 'Edit' : 'Add' }} Department</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3"><label class="form-label">Name *</label>
              <input v-model="form.name" class="form-control" /></div>
            <div class="mb-3"><label class="form-label">Description</label>
              <textarea v-model="form.description" class="form-control" rows="3"></textarea></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button class="btn btn-primary" @click="saveDept">Save</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const departments = ref([]);
    const editing = ref(null);
    const form = reactive({ name:'', description:'' });
    const msg = reactive({ text:'', type:'success' });
    let modal;

    async function fetchDepts() {
      const res = await api('GET', '/admin/departments', null, authStore.token);
      departments.value = res;
    }
    function openModal(d = null) {
      editing.value = d;
      Object.assign(form, d ? { name: d.name, description: d.description } : { name:'', description:'' });
      modal = new bootstrap.Modal(document.getElementById('deptModal'));
      modal.show();
    }
    async function saveDept() {
      try {
        if (editing.value) await api('PUT', `/admin/departments/${editing.value.id}`, form, authStore.token);
        else await api('POST', '/admin/departments', form, authStore.token);
        msg.text = 'Saved!'; msg.type = 'success';
        modal.hide(); fetchDepts();
      } catch(e) { msg.text = e.message; msg.type = 'danger'; }
    }
    async function deleteDept(id) {
      if (!confirm('Delete this department?')) return;
      await api('DELETE', `/admin/departments/${id}`, null, authStore.token);
      fetchDepts();
    }
    onMounted(fetchDepts);
    return { departments, editing, form, msg, openModal, saveDept, deleteDept };
  }
};

// ── Doctor Dashboard ──────────────────────────────────────────────────────────
const DoctorDashboard = {
  template: `
  <div>
    <div class="row g-4 mb-4">
      <div class="col-sm-6 col-xl-3" v-for="stat in stats" :key="stat.label">
        <div class="stat-card" :style="'--accent-color:' + stat.color">
          <div class="stat-icon"><i :class="'bi ' + stat.icon"></i></div>
          <div class="stat-info">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="card-panel">
      <h6 class="panel-title">Upcoming Appointments (Next 7 Days)</h6>
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr><th>Patient</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="!upcoming.length"><td colspan="5" class="text-center text-muted py-4">No upcoming appointments</td></tr>
            <tr v-for="a in upcoming" :key="a.id">
              <td class="fw-600">{{ a.patient_name }}</td>
              <td>{{ a.date }}</td>
              <td>{{ a.time }}</td>
              <td><span class="badge bg-primary">{{ a.status }}</span></td>
              <td>
                <button class="btn btn-sm btn-success me-1" @click="complete(a.id)"
                  :disabled="a.date > today" :title="a.date > today ? 'Cannot complete a future appointment' : ''">Complete</button>
                <button class="btn btn-sm btn-danger" @click="cancel(a.id)">Cancel</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `,
  setup() {
    const data = reactive({ doctor:null, today_count:0, upcoming_appointments:[], patient_count:0 });
    const upcoming = computed(() => data.upcoming_appointments);
    const stats = computed(() => [
      { label:"Today's Appointments", value: data.today_count, icon:'bi-calendar-day-fill', color:'#1a6fc4' },
      { label:'My Patients', value: data.patient_count, icon:'bi-people-fill', color:'#00bcd4' },
    ]);

    const today = new Date().toISOString().split('T')[0];
    async function load() {
      const res = await api('GET', '/doctor/dashboard', null, authStore.token);
      Object.assign(data, res);
    }
    async function complete(id) {
      await api('PUT', `/doctor/appointments/${id}/complete`, null, authStore.token);
      load();
    }
    async function cancel(id) {
      await api('PUT', `/doctor/appointments/${id}/cancel`, null, authStore.token);
      load();
    }
    onMounted(load);
    return { upcoming, stats, complete, cancel, today };
  }
};

// ── Doctor Appointments ───────────────────────────────────────────────────────
const DoctorAppointments = {
  components: { AlertComponent },
  template: `
  <div>
    <AlertComponent :message="msg.text" :type="msg.type" />
    <div class="d-flex gap-2 mb-4">
      <button v-for="s in ['','Booked','Completed','Cancelled']" :key="s"
        :class="['btn btn-sm', filter===s ? 'btn-primary' : 'btn-outline-secondary']"
        @click="filter=s; load()">{{ s || 'All' }}</button>
    </div>
    <div class="table-panel">
      <table class="table table-hover align-middle">
        <thead><tr><th>Patient</th><th>Date</th><th>Time</th><th>Status</th><th>Reason</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-if="!appointments.length"><td colspan="6" class="text-center text-muted py-4">No appointments</td></tr>
          <tr v-for="a in appointments" :key="a.id">
            <td class="fw-600">{{ a.patient_name }}</td>
            <td>{{ a.date }}</td><td>{{ a.time }}</td>
            <td><span :class="'badge ' + statusColor(a.status)">{{ a.status }}</span></td>
            <td>{{ a.reason || '—' }}</td>
            <td>
              <button v-if="a.status==='Booked' && a.date <= todayStr" class="btn btn-sm btn-success me-1" @click="openTreatment(a)">
                <i class="bi bi-clipboard-plus"></i> Treat
              </button>
              <button v-if="a.status==='Booked'" class="btn btn-sm btn-danger" @click="cancel(a.id)">
                <i class="bi bi-x"></i>
              </button>
              <button v-if="a.treatment" class="btn btn-sm btn-outline-info" @click="openTreatment(a)">
                <i class="bi bi-eye"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Treatment Modal -->
    <div class="modal fade" id="treatModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Treatment for {{ selected?.patient_name }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body">
            <div class="mb-3"><label class="form-label">Diagnosis</label>
              <textarea v-model="tf.diagnosis" class="form-control" rows="2"></textarea></div>
            <div class="mb-3"><label class="form-label">Prescription</label>
              <textarea v-model="tf.prescription" class="form-control" rows="2"></textarea></div>
            <div class="mb-3"><label class="form-label">Notes</label>
              <textarea v-model="tf.notes" class="form-control" rows="2"></textarea></div>
            <div class="mb-3"><label class="form-label">Next Visit</label>
              <input v-model="tf.next_visit" type="date" class="form-control" /></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button class="btn btn-primary" @click="saveTreatment">Save & Complete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const appointments = ref([]);
    const filter = ref('');
    const todayStr = new Date().toISOString().split('T')[0];
    const selected = ref(null);
    const tf = reactive({ diagnosis:'', prescription:'', notes:'', next_visit:'' });
    const msg = reactive({ text:'', type:'success' });
    let modal;

    function statusColor(s) { return { Booked:'bg-primary', Completed:'bg-success', Cancelled:'bg-danger' }[s] || 'bg-secondary'; }

    async function load() {
      const ep = filter.value ? `/doctor/appointments?status=${filter.value}` : '/doctor/appointments';
      appointments.value = await api('GET', ep, null, authStore.token);
    }
    async function cancel(id) {
      await api('PUT', `/doctor/appointments/${id}/cancel`, null, authStore.token);
      load();
    }
    function openTreatment(apt) {
      selected.value = apt;
      const t = apt.treatment || {};
      Object.assign(tf, { diagnosis: t.diagnosis||'', prescription: t.prescription||'', notes: t.notes||'', next_visit: t.next_visit||'' });
      modal = new bootstrap.Modal(document.getElementById('treatModal'));
      modal.show();
    }
    async function saveTreatment() {
      try {
        await api('POST', `/doctor/appointments/${selected.value.id}/treatment`, tf, authStore.token);
        msg.text = 'Treatment saved!'; msg.type = 'success';
        modal.hide(); load();
      } catch(e) { msg.text = e.message; msg.type = 'danger'; }
    }
    onMounted(load);
    return { appointments, filter, selected, tf, msg, statusColor, load, cancel, openTreatment, saveTreatment, todayStr };
  }
};

// ── Doctor Patients ───────────────────────────────────────────────────────────
const DoctorPatients = {
  template: `
  <div>
    <div class="row g-3">
      <div class="col-md-4" v-for="p in patients" :key="p.id">
        <div class="patient-card" @click="selected=p">
          <div class="patient-avatar">{{ p.name[0] }}</div>
          <div>
            <div class="fw-600">{{ p.name }}</div>
            <small class="text-muted">{{ p.gender }} · {{ p.blood_group || 'N/A' }}</small>
          </div>
        </div>
      </div>
    </div>
    <div v-if="selected" class="card-panel mt-4">
      <h6 class="panel-title">History for {{ selected.name }}</h6>
      <div class="table-responsive">
        <table class="table align-middle">
          <thead><tr><th>Date</th><th>Status</th><th>Diagnosis</th><th>Prescription</th></tr></thead>
          <tbody>
            <tr v-for="a in history" :key="a.id">
              <td>{{ a.date }}</td>
              <td><span :class="'badge bg-'+statusColor(a.status)">{{ a.status }}</span></td>
              <td>{{ a.treatment?.diagnosis || '—' }}</td>
              <td>{{ a.treatment?.prescription || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `,
  setup() {
    const patients = ref([]);
    const selected = ref(null);
    const history = ref([]);
    function statusColor(s) { return { Booked:'primary', Completed:'success', Cancelled:'danger' }[s] || 'secondary'; }

    watch(selected, async (p) => {
      if (p) history.value = await api('GET', `/doctor/patients/${p.id}/history`, null, authStore.token);
    });
    onMounted(async () => {
      patients.value = await api('GET', '/doctor/patients', null, authStore.token);
    });
    return { patients, selected, history, statusColor };
  }
};

// ── Doctor Availability ───────────────────────────────────────────────────────
const DoctorAvailability = {
  components: { AlertComponent },
  template: `
  <div>
    <AlertComponent :message="msg.text" :type="msg.type" />
    <div class="card-panel mb-4">
      <h6 class="panel-title">Set Availability</h6>
      <div class="row g-3">
        <div class="col-md-3"><label class="form-label">Date *</label>
          <input v-model="form.date" type="date" class="form-control" :min="today" /></div>
        <div class="col-md-3"><label class="form-label">Start Time *</label>
          <input v-model="form.start_time" type="time" class="form-control" /></div>
        <div class="col-md-3"><label class="form-label">End Time *</label>
          <input v-model="form.end_time" type="time" class="form-control" /></div>
        <div class="col-md-2"><label class="form-label">Max Slots</label>
          <input v-model="form.max_appointments" type="number" class="form-control" min="1" max="50" /></div>
        <div class="col-md-1 d-flex align-items-end">
          <button class="btn btn-primary w-100" @click="save">Add</button>
        </div>
      </div>
    </div>
    <div class="card-panel">
      <h6 class="panel-title">Your Availability (Next 7 Days)</h6>
      <div class="table-responsive">
        <table class="table align-middle">
          <thead><tr><th>Date</th><th>Start</th><th>End</th><th>Max Slots</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="!availability.length"><td colspan="5" class="text-center text-muted py-4">No availability set</td></tr>
            <tr v-for="a in availability" :key="a.id">
              <td>{{ a.date }}</td><td>{{ a.start_time }}</td><td>{{ a.end_time }}</td><td>{{ a.max_appointments }}</td>
              <td><button class="btn btn-sm btn-outline-danger" @click="del(a.id)"><i class="bi bi-trash"></i></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `,
  setup() {
    const availability = ref([]);
    const form = reactive({ date:'', start_time:'09:00', end_time:'17:00', max_appointments:10 });
    const msg = reactive({ text:'', type:'success' });
    const today = new Date().toISOString().split('T')[0];

    async function load() { availability.value = await api('GET', '/doctor/availability', null, authStore.token); }
    async function save() {
      try {
        await api('POST', '/doctor/availability', form, authStore.token);
        msg.text = 'Availability saved!'; msg.type = 'success'; load();
      } catch(e) { msg.text = e.message; msg.type = 'danger'; }
    }
    async function del(id) {
      await api('DELETE', `/doctor/availability/${id}`, null, authStore.token); load();
    }
    onMounted(load);
    return { availability, form, msg, today, save, del };
  }
};

// ── Patient Dashboard ─────────────────────────────────────────────────────────
const PatientDashboard = {
  template: `
  <div>
    <div class="row g-4 mb-4">
      <div class="col-12">
        <div class="welcome-banner">
          <div>
            <h4>Welcome back, {{ authStore.profile?.name || authStore.user?.username }}!</h4>
            <p class="mb-0 opacity-75">Your health, our priority.</p>
          </div>
          <router-link to="/patient/doctors" class="btn btn-light">
            <i class="bi bi-calendar-plus me-2"></i>Book Appointment
          </router-link>
        </div>
      </div>
    </div>

    <div class="row g-4 mb-4">
      <div class="col-md-6">
        <div class="card-panel h-100">
          <h6 class="panel-title">Upcoming Appointments</h6>
          <div v-if="!upcoming.length" class="text-muted text-center py-3">No upcoming appointments</div>
          <div v-for="a in upcoming" :key="a.id" class="appt-item">
            <div class="appt-date">
              <div class="day">{{ new Date(a.date).getDate() }}</div>
              <div class="month">{{ new Date(a.date+'T00:00:00').toLocaleString('default',{month:'short'}) }}</div>
            </div>
            <div class="appt-info">
              <div class="fw-600">Dr. {{ a.doctor_name }}</div>
              <div class="text-muted small">{{ a.doctor_specialization }} · {{ a.time }}</div>
            </div>
            <span class="badge bg-primary">{{ a.status }}</span>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card-panel h-100">
          <h6 class="panel-title">Departments</h6>
          <div class="dept-grid">
            <div v-for="d in departments" :key="d.id" class="dept-chip"
              @click="$router.push('/patient/doctors?department=' + d.name)">
              <i class="bi bi-building-fill-check"></i>
              {{ d.name }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card-panel">
      <h6 class="panel-title">Recent History</h6>
      <div v-if="!history.length" class="text-muted text-center py-3">No past appointments</div>
      <div class="table-responsive">
        <table class="table align-middle" v-if="history.length">
          <thead><tr><th>Date</th><th>Doctor</th><th>Status</th><th>Diagnosis</th></tr></thead>
          <tbody>
            <tr v-for="a in history" :key="a.id">
              <td>{{ a.date }}</td>
              <td>Dr. {{ a.doctor_name }}</td>
              <td><span :class="'badge bg-' + statusColor(a.status)">{{ a.status }}</span></td>
              <td>{{ a.treatment?.diagnosis || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `,
  setup() {
    const upcoming = ref([]);
    const history = ref([]);
    const departments = ref([]);
    function statusColor(s) { return { Booked:'primary', Completed:'success', Cancelled:'danger' }[s] || 'secondary'; }
    onMounted(async () => {
      const res = await api('GET', '/patient/dashboard', null, authStore.token);
      upcoming.value = res.upcoming_appointments;
      history.value = res.recent_history;
      departments.value = res.departments;
    });
    return { upcoming, history, departments, statusColor, authStore };
  }
};

// ── Patient Find Doctors ──────────────────────────────────────────────────────
const PatientDoctors = {
  components: { AlertComponent },
  template: `
  <div>
    <AlertComponent :message="msg.text" :type="msg.type" />
    <div class="row g-3 mb-4">
      <div class="col-md-5">
        <div class="search-bar">
          <i class="bi bi-search"></i>
          <input v-model="search" @input="load" type="text" placeholder="Search by doctor name..." />
        </div>
      </div>
      <div class="col-md-4">
        <select v-model="deptFilter" @change="load" class="form-select">
          <option value="">All Departments</option>
          <option v-for="d in departments" :key="d.id" :value="d.name">{{ d.name }}</option>
        </select>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-md-4" v-for="doc in doctors" :key="doc.id">
        <div class="doctor-card">
          <div class="doc-avatar">{{ doc.name[0] }}</div>
          <div class="doc-info">
            <h6>Dr. {{ doc.name }}</h6>
            <p class="text-muted small mb-1">{{ doc.specialization }}</p>
            <p class="text-muted small mb-2">{{ doc.experience_years }} years exp.</p>
            <div class="avail-chips">
              <span v-for="a in doc.availability.slice(0,3)" :key="a.id" class="avail-chip">{{ a.date }}</span>
              <span v-if="!doc.availability.length" class="text-muted small">No availability set</span>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w-100 mt-2" @click="openBook(doc)" :disabled="!doc.availability.length">
            <i class="bi bi-calendar-plus me-1"></i>Book
          </button>
        </div>
      </div>
    </div>

    <!-- Booking Modal -->
    <div class="modal fade" id="bookModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Book Appointment with Dr. {{ bookDoc?.name }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Select Availability Slot *</label>
              <select v-model="bf.avail_id" @change="setSlot" class="form-select">
                <option value="">Choose date...</option>
                <option v-for="a in bookDoc?.availability" :key="a.id" :value="a.id">
                  {{ a.date }} ({{ a.start_time }} - {{ a.end_time }})
                </option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">Time *</label>
              <input v-model="bf.time" type="time" class="form-control"
                :min="bf.min_time" :max="bf.max_time" :disabled="!bf.avail_id" />
              <div class="form-text text-muted" v-if="bf.min_time">Available: {{ bf.min_time }} – {{ bf.max_time }}</div>
              <div class="form-text text-danger" v-if="bf.avail_id && bf.time && (bf.time < bf.min_time || bf.time > bf.max_time)">⚠ Time must be within the availability window</div>
            </div>
            <div class="mb-3">
              <label class="form-label">Reason for Visit</label>
              <textarea v-model="bf.reason" class="form-control" rows="2" placeholder="Describe your symptoms..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button class="btn btn-primary" @click="book" :disabled="booking">
              <span v-if="booking" class="spinner-border spinner-border-sm me-2"></span>
              Confirm Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const doctors = ref([]);
    const departments = ref([]);
    const search = ref('');
    const specFilter = ref('');
    const deptFilter = ref('');
    const bookDoc = ref(null);
    const bf = reactive({ avail_id:'', date:'', time:'', reason:'', min_time:'', max_time:'' });
    const msg = reactive({ text:'', type:'success' });
    const booking = ref(false);
    let modal;

    const route = VueRouter.useRoute();
    onMounted(async () => {
      const depts = await api('GET', '/patient/departments', null, authStore.token);
      departments.value = depts;
      if (route.query.spec) specFilter.value = route.query.spec;
      if (route.query.department) deptFilter.value = route.query.department;
      load();
    });

    async function load() {
      let ep = `/patient/doctors?search=${search.value}&department=${deptFilter.value}`;
      doctors.value = await api('GET', ep, null, authStore.token);
    }
    function openBook(doc) {
      bookDoc.value = doc;
      Object.assign(bf, { avail_id:'', date:'', time:'', reason:'' });
      modal = new bootstrap.Modal(document.getElementById('bookModal'));
      modal.show();
    }
    function setSlot() {
      const av = bookDoc.value?.availability.find(a => a.id == bf.avail_id);
      if (av) { bf.date = av.date; bf.time = av.start_time; bf.min_time = av.start_time; bf.max_time = av.end_time; }
    }
    async function book() {
      // Validate time is within availability window
      if (bf.time < bf.min_time || bf.time > bf.max_time) {
        msg.text = `Time must be between ${bf.min_time} and ${bf.max_time}`; msg.type = 'danger';
        return;
      }
      booking.value = true;
      try {
        await api('POST', '/patient/appointments', { doctor_id: bookDoc.value.id, date: bf.date, time: bf.time, reason: bf.reason }, authStore.token);
        msg.text = 'Appointment booked successfully!'; msg.type = 'success';
        modal.hide(); load();
      } catch(e) { msg.text = e.message; msg.type = 'danger'; }
      finally { booking.value = false; }
    }
    return { doctors, departments, search, deptFilter, bookDoc, bf, msg, booking, load, openBook, setSlot, book };
  }
};

// ── Patient Appointments ──────────────────────────────────────────────────────
const PatientAppointments = {
  components: { AlertComponent },
  template: `
  <div>
    <AlertComponent :message="msg.text" :type="msg.type" />
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div class="d-flex gap-2">
        <button v-for="s in ['','Booked','Completed','Cancelled']" :key="s"
          :class="['btn btn-sm', filter===s ? 'btn-primary' : 'btn-outline-secondary']"
          @click="filter=s; load()">{{ s || 'All' }}</button>
      </div>
      <button class="btn btn-outline-success btn-sm" @click="exportCsv">
        <i class="bi bi-download me-1"></i>Export CSV
      </button>
    </div>
    <div class="row g-3">
      <div class="col-12" v-for="a in appointments" :key="a.id">
        <div class="appt-full-card">
          <div class="afc-left">
            <div class="afc-date">{{ a.date }}</div>
            <div class="afc-time">{{ a.time }}</div>
          </div>
          <div class="afc-mid">
            <div class="fw-600">Dr. {{ a.doctor_name }}</div>
            <div class="text-muted small">{{ a.doctor_specialization }}</div>
            <div class="text-muted small mt-1" v-if="a.reason">{{ a.reason }}</div>
            <div v-if="a.treatment" class="mt-2">
              <span class="badge bg-info text-dark me-1">Dx: {{ a.treatment.diagnosis }}</span>
              <span class="badge bg-light text-dark">Rx: {{ a.treatment.prescription }}</span>
            </div>
          </div>
          <div class="afc-right">
            <span :class="'badge ' + statusColor(a.status) + ' mb-2 d-block'">{{ a.status }}</span>
            <router-link
              v-if="a.status==='Completed' || a.status==='Booked'"
              :to="'/patient/payment/' + a.id"
              :class="['btn btn-sm mb-1 d-block', a.payment?.status==='Paid' ? 'btn-success' : 'btn-warning fw-600']">
              <i class="bi bi-credit-card me-1"></i>{{ a.payment?.status==='Paid' ? '✓ Paid' : 'Pay Now' }}
            </router-link>
            <div v-if="a.status==='Booked'" class="d-flex gap-1 flex-column">
              <button class="btn btn-sm btn-outline-primary" @click="openReschedule(a)">Reschedule</button>
              <button class="btn btn-sm btn-outline-danger" @click="cancel(a.id)">Cancel</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!appointments.length" class="col-12 text-center text-muted py-4">No appointments found</div>
    </div>

    <!-- Reschedule Modal -->
    <div class="modal fade" id="reschedModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Reschedule Appointment</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body">
            <div class="mb-3"><label class="form-label">New Date *</label>
              <input v-model="rf.date" type="date" class="form-control" :min="today" /></div>
            <div class="mb-3"><label class="form-label">New Time *</label>
              <input v-model="rf.time" type="time" class="form-control" /></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button class="btn btn-primary" @click="reschedule">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const appointments = ref([]);
    const filter = ref('');
    const selected = ref(null);
    const rf = reactive({ date:'', time:'' });
    const msg = reactive({ text:'', type:'success' });
    const today = new Date().toISOString().split('T')[0];
    let modal;

    function statusColor(s) { return { Booked:'bg-primary', Completed:'bg-success', Cancelled:'bg-danger' }[s] || 'bg-secondary'; }
    async function load() {
      const ep = filter.value ? `/patient/appointments?status=${filter.value}` : '/patient/appointments';
      appointments.value = await api('GET', ep, null, authStore.token);
    }
    async function cancel(id) {
      try { await api('PUT', `/patient/appointments/${id}/cancel`, null, authStore.token); msg.text='Cancelled'; msg.type='success'; load(); }
      catch(e) { msg.text=e.message; msg.type='danger'; }
    }
    function openReschedule(a) {
      selected.value = a; rf.date = a.date; rf.time = a.time;
      modal = new bootstrap.Modal(document.getElementById('reschedModal')); modal.show();
    }
    async function reschedule() {
      try {
        await api('PUT', `/patient/appointments/${selected.value.id}/reschedule`, rf, authStore.token);
        msg.text='Rescheduled!'; msg.type='success'; modal.hide(); load();
      } catch(e) { msg.text=e.message; msg.type='danger'; }
    }
    async function exportCsv() {
      try { await api('GET', '/patient/export-csv', null, authStore.token); msg.text='Export started! Check your email.'; msg.type='success'; }
      catch(e) { msg.text=e.message; msg.type='danger'; }
    }
    onMounted(load);
    return { appointments, filter, rf, msg, today, statusColor, load, cancel, openReschedule, reschedule, exportCsv };
  }
};

// ── Patient Profile ───────────────────────────────────────────────────────────
const PatientProfile = {
  components: { AlertComponent },
  template: `
  <div class="row justify-content-center">
    <div class="col-md-7">
      <AlertComponent :message="msg.text" :type="msg.type" />
      <div class="card-panel">
        <div class="profile-header mb-4">
          <div class="profile-avatar">{{ (form.name||'P')[0] }}</div>
          <div>
            <h5>{{ form.name }}</h5>
            <p class="text-muted mb-0">{{ authStore.user?.email }}</p>
          </div>
        </div>
        <div class="row g-3">
          <div class="col-md-6"><label class="form-label">Full Name</label>
            <input v-model="form.name" class="form-control" /></div>
          <div class="col-md-6"><label class="form-label">Phone</label>
            <input v-model="form.phone" class="form-control" /></div>
          <div class="col-md-6"><label class="form-label">Date of Birth</label>
            <input v-model="form.dob" type="date" class="form-control" /></div>
          <div class="col-md-6"><label class="form-label">Gender</label>
            <select v-model="form.gender" class="form-select">
              <option>Male</option><option>Female</option><option>Other</option>
            </select></div>
          <div class="col-md-6"><label class="form-label">Blood Group</label>
            <select v-model="form.blood_group" class="form-select">
              <option v-for="bg in bgs" :key="bg">{{ bg }}</option>
            </select></div>
          <div class="col-12"><label class="form-label">Address</label>
            <textarea v-model="form.address" class="form-control" rows="2"></textarea></div>
        </div>
        <button class="btn btn-primary mt-4" @click="save" :disabled="saving">
          <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
          Update Profile
        </button>
      </div>
    </div>
  </div>
  `,
  setup() {
    const form = reactive({ name:'', phone:'', dob:'', gender:'', blood_group:'', address:'' });
    const msg = reactive({ text:'', type:'success' });
    const saving = ref(false);
    const bgs = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

    onMounted(async () => {
      const res = await api('GET', '/auth/me', null, authStore.token);
      if (res.profile) Object.assign(form, res.profile);
    });

    async function save() {
      saving.value = true;
      try {
        const res = await api('PUT', '/patient/profile', form, authStore.token);
        authStore.profile = res;
        localStorage.setItem('hms_profile', JSON.stringify(res));
        msg.text = 'Profile updated!'; msg.type = 'success';
      } catch(e) { msg.text = e.message; msg.type = 'danger'; }
      finally { saving.value = false; }
    }
    return { form, msg, saving, bgs, save, authStore };
  }
};


// ── Payment Portal ────────────────────────────────────────────────────────────
const PaymentPortal = {
  components: { AlertComponent },
  template: `
  <div class="row justify-content-center">
    <div class="col-md-6">
      <AlertComponent :message="msg.text" :type="msg.type" />

      <div v-if="success" class="payment-success">
        <div class="success-icon"><i class="bi bi-check-circle-fill"></i></div>
        <h4>Payment Successful!</h4>
        <p class="text-muted">Transaction ID: <strong>{{ txnId }}</strong></p>
        <p class="text-muted">Amount Paid: <strong>₹{{ amount }}</strong></p>
        <router-link to="/patient/appointments" class="btn btn-primary mt-2">Back to Appointments</router-link>
      </div>

      <div v-else>
        <div class="card-panel mb-4" v-if="details">
          <h6 class="panel-title">Appointment Summary</h6>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-muted">Doctor</span>
            <span class="fw-600">Dr. {{ details.doctor_name }}</span>
          </div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-muted">Date & Time</span>
            <span class="fw-600">{{ details.appointment?.date }} at {{ details.appointment?.time }}</span>
          </div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-muted">Status</span>
            <span class="badge bg-success">{{ details.appointment?.status }}</span>
          </div>
          <hr />
          <div class="d-flex justify-content-between align-items-center">
            <span class="fw-600">Consultation Fee</span>
            <span class="fw-800 text-primary" style="font-size:20px">₹{{ details.consultation_fee }}</span>
          </div>
          <div v-if="details.payment?.status === 'Paid'" class="alert alert-success mt-3 mb-0">
            <i class="bi bi-check-circle me-2"></i>Already paid · TXN: {{ details.payment.transaction_id }}
          </div>
        </div>

        <div class="card-panel" v-if="details && details.payment?.status !== 'Paid'">
          <h6 class="panel-title">Payment Details</h6>
          <div class="mb-3">
            <label class="form-label">Payment Method *</label>
            <div class="d-flex gap-2">
              <button v-for="m in methods" :key="m.value"
                :class="['method-btn', form.payment_method === m.value ? 'active' : '']"
                @click="form.payment_method = m.value">
                <i :class="'bi ' + m.icon"></i> {{ m.label }}
              </button>
            </div>
          </div>

          <div v-if="form.payment_method === 'Card'">
            <div class="dummy-card mb-4">
              <div class="dummy-card-chip"><i class="bi bi-cpu"></i></div>
              <div class="dummy-card-number">{{ displayCard }}</div>
              <div class="d-flex justify-content-between">
                <div><small>Card Holder</small><div>{{ authStore.profile?.name || 'YOUR NAME' }}</div></div>
                <div><small>Expires</small><div>{{ form.expiry || 'MM/YY' }}</div></div>
              </div>
            </div>
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label">Card Number *</label>
                <input v-model="form.card_number" @input="formatCard"
                  class="form-control" placeholder="1234 5678 9012 3456"
                  maxlength="19" required />
              </div>
              <div class="col-md-6">
                <label class="form-label">Expiry Date *</label>
                <input v-model="form.expiry" class="form-control"
                  placeholder="MM/YY" maxlength="5" required />
              </div>
              <div class="col-md-6">
                <label class="form-label">CVV *</label>
                <input v-model="form.cvv" type="password" class="form-control"
                  placeholder="***" maxlength="3" required />
              </div>
            </div>
          </div>

          <div v-if="form.payment_method === 'UPI'" class="mt-2">
            <label class="form-label">UPI ID *</label>
            <input v-model="form.upi_id" class="form-control"
              placeholder="yourname@upi" required />
            <div class="form-text">Enter any UPI ID for demo purposes</div>
          </div>

          <div v-if="form.payment_method === 'NetBanking'" class="mt-2">
            <label class="form-label">Select Bank *</label>
            <select v-model="form.bank" class="form-select">
              <option value="">Choose your bank</option>
              <option v-for="b in banks" :key="b">{{ b }}</option>
            </select>
          </div>

          <div class="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
            <div>
              <div class="text-muted small">Total Amount</div>
              <div class="fw-800 text-primary" style="font-size:22px">₹{{ details?.consultation_fee }}</div>
            </div>
            <button class="btn btn-primary btn-lg px-4" @click="pay" :disabled="paying || !form.payment_method">
              <span v-if="paying" class="spinner-border spinner-border-sm me-2"></span>
              <i v-else class="bi bi-lock-fill me-2"></i>Pay Now
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const route = VueRouter.useRoute();
    const details = ref(null);
    const form = reactive({ payment_method:'', card_number:'', expiry:'', cvv:'', upi_id:'', bank:'' });
    const msg = reactive({ text:'', type:'danger' });
    const paying = ref(false);
    const success = ref(false);
    const txnId = ref('');
    const amount = ref(0);
    const methods = [
      { value:'Card', label:'Card', icon:'bi-credit-card' },
      { value:'UPI', label:'UPI', icon:'bi-phone' },
      { value:'NetBanking', label:'Net Banking', icon:'bi-bank' }
    ];
    const banks = ['State Bank of India','HDFC Bank','ICICI Bank','Axis Bank','Kotak Bank','Punjab National Bank'];

    const displayCard = computed(() => {
      const n = form.card_number.replace(/\s/g,'');
      if (!n) return '**** **** **** ****';
      return (n + '****************').slice(0,16).replace(/(\d{4})/g,'$1 ').trim();
    });

    function formatCard() {
      let v = form.card_number.replace(/\D/g,'').slice(0,16);
      form.card_number = v.replace(/(\d{4})/g,'$1 ').trim();
    }

    onMounted(async () => {
      const aptId = route.params.id;
      try {
        details.value = await api('GET', `/payment/appointment/${aptId}`, null, authStore.token);
      } catch(e) { msg.text = e.message; }
    });

    async function pay() {
      if (!form.payment_method) { msg.text = 'Select a payment method'; return; }
      paying.value = true;
      try {
        const res = await api('POST', '/payment/pay', {
          appointment_id: parseInt(route.params.id),
          payment_method: form.payment_method,
          card_number: form.card_number,
          expiry: form.expiry,
          cvv: form.cvv
        }, authStore.token);
        txnId.value = res.transaction_id;
        amount.value = res.amount;
        success.value = true;
      } catch(e) { msg.text = e.message; msg.type = 'danger'; }
      finally { paying.value = false; }
    }

    return { details, form, msg, paying, success, txnId, amount, methods, banks, displayCard, formatCard, pay, authStore };
  }
};

// ── Doctor Fee Setting ────────────────────────────────────────────────────────
const DoctorRevenue = {
  components: { AlertComponent },
  template: `
  <div>
    <AlertComponent :message="msg.text" :type="msg.type" />
    <div class="row g-4 mb-4">
      <div class="col-md-4">
        <div class="stat-card" style="--accent-color:#2e7d32">
          <div class="stat-icon"><i class="bi bi-currency-rupee"></i></div>
          <div class="stat-info">
            <div class="stat-value">₹{{ data.total_revenue?.toLocaleString() || 0 }}</div>
            <div class="stat-label">Total Revenue</div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="stat-card" style="--accent-color:#1a6fc4">
          <div class="stat-icon"><i class="bi bi-receipt"></i></div>
          <div class="stat-info">
            <div class="stat-value">{{ data.total_payments || 0 }}</div>
            <div class="stat-label">Total Payments</div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card-panel">
          <h6 class="panel-title">Set Consultation Fee</h6>
          <div class="input-group">
            <span class="input-group-text">₹</span>
            <input v-model="fee" type="number" class="form-control" min="0" placeholder="e.g. 500" />
            <button class="btn btn-primary" @click="setFee">Update</button>
          </div>
          <small class="text-muted">Current fee: ₹{{ data.consultation_fee || 0 }}</small>
        </div>
      </div>
    </div>
    <div class="card-panel">
      <h6 class="panel-title">Payment History</h6>
      <div class="table-responsive">
        <table class="table align-middle">
          <thead><tr><th>Date</th><th>Patient</th><th>Amount</th><th>Method</th><th>Transaction ID</th></tr></thead>
          <tbody>
            <tr v-if="!data.payments?.length"><td colspan="5" class="text-center text-muted py-4">No payments yet</td></tr>
            <tr v-for="p in data.payments" :key="p.id">
              <td>{{ p.paid_at?.split('T')[0] }}</td>
              <td>{{ p.patient_name }}</td>
              <td class="fw-600 text-success">₹{{ p.amount }}</td>
              <td>{{ p.payment_method }}</td>
              <td><small class="text-muted">{{ p.transaction_id }}</small></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `,
  setup() {
    const data = reactive({ total_revenue:0, total_payments:0, consultation_fee:0, payments:[] });
    const fee = ref('');
    const msg = reactive({ text:'', type:'success' });

    onMounted(async () => {
      const res = await api('GET', '/payment/doctor-revenue', null, authStore.token);
      Object.assign(data, res);
      fee.value = res.consultation_fee;
    });

    async function setFee() {
      try {
        const res = await api('PUT', '/payment/set-fee', { consultation_fee: parseFloat(fee.value) }, authStore.token);
        data.consultation_fee = res.consultation_fee;
        msg.text = 'Fee updated successfully!'; msg.type = 'success';
      } catch(e) { msg.text = e.message; msg.type = 'danger'; }
    }

    return { data, fee, msg, setFee };
  }
};

// ── Admin Revenue Analytics ───────────────────────────────────────────────────
const AdminRevenue = {
  template: `
  <div>
    <div class="row g-4 mb-4">
      <div class="col-md-4">
        <div class="stat-card" style="--accent-color:#2e7d32">
          <div class="stat-icon"><i class="bi bi-currency-rupee"></i></div>
          <div class="stat-info">
            <div class="stat-value">₹{{ data.total_revenue?.toLocaleString() || 0 }}</div>
            <div class="stat-label">Total Revenue</div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="stat-card" style="--accent-color:#1a6fc4">
          <div class="stat-icon"><i class="bi bi-receipt-cutoff"></i></div>
          <div class="stat-info">
            <div class="stat-value">{{ data.total_payments || 0 }}</div>
            <div class="stat-label">Total Transactions</div>
          </div>
        </div>
      </div>
    </div>
    <div class="row g-4">
      <div class="col-lg-6">
        <div class="card-panel">
          <h6 class="panel-title">Revenue by Doctor</h6>
          <canvas ref="doctorChart" height="250"></canvas>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="card-panel">
          <h6 class="panel-title">Revenue by Department</h6>
          <canvas ref="deptChart" height="250"></canvas>
        </div>
      </div>
      <div class="col-12">
        <div class="card-panel">
          <h6 class="panel-title">Doctor Revenue Breakdown</h6>
          <table class="table align-middle">
            <thead><tr><th>Doctor</th><th>Department</th><th>Patients Paid</th><th>Total Revenue</th></tr></thead>
            <tbody>
              <tr v-if="!data.by_doctor?.length"><td colspan="4" class="text-center text-muted py-4">No revenue data yet</td></tr>
              <tr v-for="d in data.by_doctor" :key="d.doctor_id">
                <td class="fw-600">Dr. {{ d.doctor_name }}</td>
                <td>{{ d.department }}</td>
                <td>{{ d.count }}</td>
                <td class="fw-600 text-success">₹{{ d.total.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const data = reactive({ total_revenue:0, total_payments:0, by_doctor:[], by_department:[] });
    const doctorChart = ref(null);
    const deptChart = ref(null);

    onMounted(async () => {
      const res = await api('GET', '/payment/admin/revenue', null, authStore.token);
      Object.assign(data, res);

      if (doctorChart.value && res.by_doctor?.length) {
        new Chart(doctorChart.value, {
          type: 'bar',
          data: {
            labels: res.by_doctor.map(d => 'Dr. ' + d.doctor_name),
            datasets: [{ label: 'Revenue (₹)', data: res.by_doctor.map(d => d.total),
              backgroundColor: '#1a6fc4', borderRadius: 6 }]
          },
          options: { responsive:true, plugins:{ legend:{ display:false } },
            scales:{ y:{ beginAtZero:true } } }
        });
      }

      if (deptChart.value && res.by_department?.length) {
        new Chart(deptChart.value, {
          type: 'doughnut',
          data: {
            labels: res.by_department.map(d => d.department),
            datasets: [{ data: res.by_department.map(d => d.total),
              backgroundColor: ['#1a6fc4','#00bcd4','#2e7d32','#f9a825','#e53935','#9c27b0','#ff5722','#607d8b'],
              borderWidth: 0 }]
          },
          options: { responsive:true, plugins:{ legend:{ position:'bottom' } } }
        });
      }
    });

    return { data, doctorChart, deptChart };
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ROUTER
// ══════════════════════════════════════════════════════════════════════════════
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: () => authStore.isLoggedIn ? `/${authStore.role}/dashboard` : '/login' },
    { path: '/login', component: LoginPage },
    { path: '/register', component: RegisterPage },
    {
      path: '/',
      component: LayoutComponent,
      children: [
        { path: 'admin/dashboard', component: AdminDashboard, meta: { title: 'Dashboard', role: 'admin' } },
        { path: 'admin/doctors', component: AdminDoctors, meta: { title: 'Manage Doctors', role: 'admin' } },
        { path: 'admin/patients', component: AdminPatients, meta: { title: 'Manage Patients', role: 'admin' } },
        { path: 'admin/appointments', component: AdminAppointments, meta: { title: 'All Appointments', role: 'admin' } },
        { path: 'admin/departments', component: AdminDepartments, meta: { title: 'Departments', role: 'admin' } },
        { path: 'doctor/dashboard', component: DoctorDashboard, meta: { title: 'Dashboard', role: 'doctor' } },
        { path: 'doctor/appointments', component: DoctorAppointments, meta: { title: 'Appointments', role: 'doctor' } },
        { path: 'doctor/patients', component: DoctorPatients, meta: { title: 'My Patients', role: 'doctor' } },
        { path: 'doctor/availability', component: DoctorAvailability, meta: { title: 'Availability', role: 'doctor' } },
        { path: 'patient/dashboard', component: PatientDashboard, meta: { title: 'Dashboard', role: 'patient' } },
        { path: 'patient/doctors', component: PatientDoctors, meta: { title: 'Find Doctors', role: 'patient' } },
        { path: 'patient/appointments', component: PatientAppointments, meta: { title: 'My Appointments', role: 'patient' } },
        { path: 'patient/profile', component: PatientProfile, meta: { title: 'My Profile', role: 'patient' } },
        { path: 'patient/payment/:id', component: PaymentPortal, meta: { title: 'Payment', role: 'patient' } },
        { path: 'doctor/revenue', component: DoctorRevenue, meta: { title: 'Revenue & Fees', role: 'doctor' } },
        { path: 'admin/revenue', component: AdminRevenue, meta: { title: 'Revenue Analytics', role: 'admin' } },
      ]
    }
  ]
});

// Navigation Guard
router.beforeEach((to) => {
  if (to.meta?.role) {
    if (!authStore.isLoggedIn) return '/login';
    if (authStore.role !== to.meta.role) return `/${authStore.role}/dashboard`;
  }
  if ((to.path === '/login' || to.path === '/register') && authStore.isLoggedIn) {
    return `/${authStore.role}/dashboard`;
  }
});

// ── App Styles ──────────────────────────────────────────────────────────────
const appStyles = `
/* Auth */
.auth-page { min-height:100vh; display:flex; align-items:center; justify-content:center; background: linear-gradient(135deg, #0f4c81 0%, #1a6fc4 50%, #00bcd4 100%); padding:20px; }
.auth-card { background:#fff; border-radius:20px; padding:40px; width:100%; max-width:420px; box-shadow:0 20px 60px rgba(0,0,0,0.2); }
.auth-brand { text-align:center; margin-bottom:32px; }
.brand-icon-lg { width:64px; height:64px; background:linear-gradient(135deg,#0f4c81,#00bcd4); border-radius:16px; display:inline-flex; align-items:center; justify-content:center; font-size:28px; color:#fff; margin-bottom:12px; }
.auth-title { font-family:'DM Serif Display',serif; font-size:28px; color:#1a2332; margin:0; }
.auth-subtitle { color:#5f7082; font-size:14px; margin:4px 0 0; }
.demo-creds { background:#f8fafc; border-radius:10px; padding:12px; }

/* Layout */
.layout { display:flex; min-height:100vh; }
.sidebar { width:var(--sidebar-width); background:linear-gradient(180deg,#0f4c81 0%,#0a3560 100%); display:flex; flex-direction:column; transition:width .3s; position:fixed; top:0; left:0; height:100vh; z-index:100; overflow:hidden; }
.sidebar.collapsed { width:68px; }
.sidebar-header { display:flex; align-items:center; justify-content:space-between; padding:20px 16px; border-bottom:1px solid rgba(255,255,255,0.1); }
.brand { display:flex; align-items:center; gap:10px; overflow:hidden; }
.brand-icon { width:36px; height:36px; background:rgba(255,255,255,0.15); border-radius:10px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px; flex-shrink:0; }
.brand-name { color:#fff; font-weight:700; font-size:18px; font-family:'DM Serif Display',serif; white-space:nowrap; }
.collapse-btn { color:rgba(255,255,255,0.7); border:none; background:none; padding:4px 8px; }
.collapse-btn:hover { color:#fff; }
.sidebar-nav { flex:1; padding:16px 8px; overflow-y:auto; overflow-x:hidden; }
.nav-item { display:flex; align-items:center; gap:12px; padding:10px 12px; color:rgba(255,255,255,0.7); text-decoration:none; border-radius:10px; margin-bottom:4px; white-space:nowrap; transition:all .2s; }
.nav-item:hover, .nav-item.active { background:rgba(255,255,255,0.15); color:#fff; }
.nav-item i { font-size:18px; flex-shrink:0; }
.sidebar-footer { padding:16px 8px; border-top:1px solid rgba(255,255,255,0.1); }
.user-info { display:flex; align-items:center; gap:10px; padding:8px; margin-bottom:8px; }
.avatar { width:36px; height:36px; background:rgba(255,255,255,0.2); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:13px; flex-shrink:0; }
.user-info .fw-600 { color:#fff; font-size:13px; }
.role-badge { color:rgba(255,255,255,0.6); font-size:11px; text-transform:capitalize; }
.btn-logout { display:flex; align-items:center; gap:10px; color:rgba(255,255,255,0.7); background:none; border:none; padding:10px 12px; width:100%; border-radius:10px; }
.btn-logout:hover { background:rgba(255,255,255,0.1); color:#fff; }

/* Main Content */
.main-content { margin-left:var(--sidebar-width); flex:1; transition:margin-left .3s; display:flex; flex-direction:column; min-height:100vh; }
.main-content.expanded { margin-left:68px; }
.topbar { background:#fff; padding:16px 28px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--border); position:sticky; top:0; z-index:50; }
.page-title { margin:0; font-weight:700; font-size:18px; color:var(--text); }
.content-area { padding:28px; flex:1; }
.bg-primary-soft { background:#e8f0fe !important; }
.text-primary { color:var(--primary) !important; }

/* Cards */
.card-panel { background:#fff; border-radius:16px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.panel-title { font-weight:700; font-size:15px; color:var(--text); margin-bottom:18px; }
.stat-card { background:#fff; border-radius:16px; padding:24px; display:flex; align-items:center; gap:16px; box-shadow:0 1px 3px rgba(0,0,0,0.08); border-left:4px solid var(--accent-color,#1a6fc4); }
.stat-icon { width:48px; height:48px; background: color-mix(in srgb, var(--accent-color,#1a6fc4) 15%, white); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:22px; color:var(--accent-color,#1a6fc4); }
.stat-value { font-size:28px; font-weight:800; color:var(--text); line-height:1; }
.stat-label { font-size:13px; color:var(--text-muted); margin-top:4px; }

/* Table */
.table-panel { background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.table-panel .table { margin:0; }
.table thead th { background:#f8fafc; font-weight:600; font-size:13px; color:var(--text-muted); border-bottom:2px solid var(--border); padding:14px 16px; }
.table td { padding:14px 16px; vertical-align:middle; }
.fw-600 { font-weight:600; }

/* Search */
.search-bar { position:relative; display:flex; align-items:center; background:#fff; border:1px solid var(--border); border-radius:10px; padding:0 14px; flex:1; max-width:400px; }
.search-bar i { color:var(--text-muted); margin-right:8px; }
.search-bar input { border:none; outline:none; padding:10px 0; background:transparent; width:100%; font-size:14px; }

/* Doctor Card */
.doctor-card { background:#fff; border-radius:16px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); display:flex; flex-direction:column; align-items:center; text-align:center; transition:transform .2s, box-shadow .2s; }
.doctor-card:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.12); }
.doc-avatar { width:64px; height:64px; background:linear-gradient(135deg,#1a6fc4,#00bcd4); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:24px; font-weight:700; margin-bottom:12px; }
.avail-chips { display:flex; gap:4px; flex-wrap:wrap; justify-content:center; margin-top:6px; }
.avail-chip { background:#e8f0fe; color:#1a6fc4; font-size:11px; padding:2px 8px; border-radius:20px; }

/* Patient Card */
.patient-card { background:#fff; border-radius:12px; padding:16px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 3px rgba(0,0,0,0.08); cursor:pointer; transition:all .2s; }
.patient-card:hover { box-shadow:0 4px 12px rgba(0,0,0,0.12); }
.patient-avatar { width:44px; height:44px; background:linear-gradient(135deg,#00bcd4,#0f4c81); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:18px; flex-shrink:0; }

/* Dept Card */
.dept-card { background:#fff; border-radius:12px; padding:16px; display:flex; align-items:flex-start; gap:14px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.dept-icon { font-size:24px; color:#1a6fc4; flex-shrink:0; margin-top:2px; }
.dept-info { flex:1; }
.dept-actions { display:flex; gap:6px; }
.dept-grid { display:flex; flex-wrap:wrap; gap:8px; }
.dept-chip { background:#e8f0fe; color:#1a6fc4; padding:6px 14px; border-radius:20px; font-size:13px; font-weight:500; cursor:pointer; transition:all .2s; }
.dept-chip:hover { background:#1a6fc4; color:#fff; }
.dept-chip i { margin-right:4px; }

/* Appointment */
.appt-item { display:flex; align-items:center; gap:14px; padding:12px 0; border-bottom:1px solid var(--border); }
.appt-item:last-child { border-bottom:none; }
.appt-date { text-align:center; background:#e8f0fe; border-radius:10px; padding:8px 12px; min-width:50px; }
.appt-date .day { font-size:20px; font-weight:800; color:#1a6fc4; line-height:1; }
.appt-date .month { font-size:11px; color:#5f7082; }
.appt-info { flex:1; }

.appt-full-card { background:#fff; border-radius:16px; padding:20px; display:flex; gap:20px; align-items:flex-start; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.afc-left { text-align:center; min-width:70px; }
.afc-date { font-size:13px; color:var(--text-muted); }
.afc-time { font-size:16px; font-weight:700; color:var(--text); }
.afc-mid { flex:1; }
.afc-right { display:flex; flex-direction:column; align-items:flex-end; min-width:120px; }

/* Welcome Banner */
.welcome-banner { background:linear-gradient(135deg,#0f4c81,#1a6fc4); border-radius:16px; padding:24px 28px; display:flex; align-items:center; justify-content:space-between; color:#fff; }
.welcome-banner h4 { margin:0; font-weight:700; }

/* Profile */
.profile-header { display:flex; align-items:center; gap:16px; }
.profile-avatar { width:64px; height:64px; background:linear-gradient(135deg,#1a6fc4,#00bcd4); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:24px; font-weight:700; flex-shrink:0; }


/* Payment Portal */
.payment-success { text-align:center; padding:40px 20px; }
.success-icon { font-size:64px; color:#2e7d32; margin-bottom:16px; }
.method-btn { display:flex; align-items:center; gap:6px; padding:10px 18px; border:2px solid var(--border); border-radius:10px; background:#fff; cursor:pointer; font-size:14px; font-weight:500; transition:all .2s; }
.method-btn.active { border-color:#1a6fc4; background:#e8f0fe; color:#1a6fc4; }
.method-btn:hover { border-color:#1a6fc4; }
.dummy-card { background:linear-gradient(135deg,#0f4c81,#1a6fc4); color:white; border-radius:16px; padding:24px; position:relative; overflow:hidden; }
.dummy-card::before { content:''; position:absolute; top:-30px; right:-30px; width:120px; height:120px; background:rgba(255,255,255,0.1); border-radius:50%; }
.dummy-card-chip { font-size:28px; margin-bottom:16px; opacity:0.9; }
.dummy-card-number { font-size:18px; letter-spacing:3px; margin-bottom:20px; font-family:monospace; }

@media (max-width:768px) {
  .sidebar { transform:translateX(-100%); }
  .sidebar.collapsed { transform:translateX(0); width:68px; }
  .main-content { margin-left:0; }
  .content-area { padding:16px; }
}
`;

// ── Mount App ──────────────────────────────────────────────────────────────
const styleEl = document.createElement('style');
styleEl.textContent = appStyles;
document.head.appendChild(styleEl);

const app = createApp({ template: '<router-view />' });
app.use(router);
app.mount('#app');
