<template>
  <div class="container mt-4 pb-5">
    <h2 class="mb-4">Admin Dashboard</h2>

    <div v-if="loadingMissingAttendance" class="alert alert-info text-center border-0 shadow-sm">
      <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
      Checking for missing attendance records...
    </div>
    <div v-else-if="classesNeedingAttendance.length > 0" class="alert alert-warning shadow-sm" role="alert">
      <h4 class="alert-heading"><i class="bi bi-exclamation-triangle-fill me-2"></i>Action Required: Missing Attendance!</h4>
      <p>The following classes have **not recorded any attendance in the past 14 days**. Please remind the assigned teachers to update their records:</p>
      <ul class="list-group list-group-flush mb-3">
        <li v-for="cls in classesNeedingAttendance" :key="cls.id"
            class="list-group-item d-flex flex-column flex-sm-row justify-content-sm-between align-items-sm-center mb-2 list-item-mobile-spacing">
          <span class="text-start mb-2 mb-sm-0 flex-grow-1">
            <strong>{{ cls.name }}</strong>
            <span v-if="cls.teacherNames && cls.teacherNames.length" class="text-muted d-block d-sm-inline ms-sm-2 small-text-on-mobile">
              (Teachers: {{ cls.teacherNames.join(', ') }})
            </span>
            <span v-else class="text-muted d-block d-sm-inline ms-sm-2 small-text-on-mobile">(No teachers assigned)</span>
          </span>
          <NuxtLink :to="`/admin/classes/${cls.id}/attendance`" class="btn btn-sm btn-outline-warning text-nowrap">
            Record Now <i class="bi bi-arrow-right"></i>
          </NuxtLink>
        </li>
      </ul>
      <p class="mb-0 text-muted">Last checked: {{ lastCheckedTime }}</p>
    </div>
    <div v-else-if="!loadingMissingAttendance && classesNeedingAttendance.length === 0 && !missingAttendanceError" class="alert alert-success shadow-sm" role="alert">
      <h4 class="alert-heading"><i class="bi bi-check-circle-fill me-2"></i>Great Job!</h4>
      <p class="mb-0">All classes have recorded attendance in the past 14 days. Keep up the good work!</p>
    </div>
    <div v-else-if="missingAttendanceError" class="alert alert-danger shadow-sm" role="alert">
      <h4 class="alert-heading"><i class="bi bi-x-circle-fill me-2"></i>Error Checking Attendance</h4>
      <p>{{ missingAttendanceError }}</p>
      <button class="btn btn-danger btn-sm" @click="checkForMissingAttendance">Retry</button>
    </div>

    <div class="row g-4 mb-4">
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 glass-card card-custom-shadow border-0">
          <div class="card-body text-center d-flex flex-column justify-content-center">
            <i class="bi bi-person-fill-gear fs-1 text-info mb-3"></i>
            <h5 class="card-title">Manage Teachers</h5>
            <p class="card-text">Add, edit, or remove teacher accounts and assign them to classes.</p>
            <NuxtLink to="/admin/manage-teachers" class="btn btn-primary mt-auto rounded-pill">Go to Teachers</NuxtLink>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 glass-card card-custom-shadow border-0">
          <div class="card-body text-center d-flex flex-column justify-content-center">
            <i class="bi bi-person-lines-fill fs-1 text-success mb-3"></i>
            <h5 class="card-title">Manage Students</h5>
            <p class="card-text">View and manage all students across all classes in the system.</p>
            <NuxtLink to="/admin/manage-students" class="btn btn-success mt-auto rounded-pill">Go to Students</NuxtLink>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 glass-card card-custom-shadow border-0">
          <div class="card-body text-center d-flex flex-column justify-content-center">
            <i class="bi bi-collection-fill fs-1 text-info mb-3"></i>
            <h5 class="card-title">Manage Classes</h5>
            <p class="card-text">Create, view, edit, and delete classes.</p>
            <NuxtLink to="/admin/manage-classes" class="btn btn-primary mt-auto rounded-pill">Go to Classes</NuxtLink>
          </div>
        </div>
      </div>
    </div>
    <div class="row g-4">
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 glass-card card-custom-shadow border-0">
          <div class="card-body text-center d-flex flex-column justify-content-center">
            <i class="bi bi-file-earmark-bar-graph fs-1 text-info mb-3"></i>
            <h5 class="card-title">Attendance Reports</h5>
            <p class="card-text">Generate attendance reports for specific classes and date ranges.</p>
            <NuxtLink to="/admin/reports" class="btn btn-info mt-auto rounded-pill">Go to Reports</NuxtLink>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 glass-card card-custom-shadow border-0">
          <div class="card-body text-center d-flex flex-column justify-content-center">
            <i class="bi bi-trophy fs-1 text-warning mb-3"></i>
            <h5 class="card-title">Attendance leaderboard</h5>
            <p class="card-text">Whole-school rankings by sessions attended, with UK term filters.</p>
            <NuxtLink to="/admin/leaderboard" class="btn btn-warning mt-auto rounded-pill text-dark">Open leaderboard</NuxtLink>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 glass-card card-custom-shadow border-0">
          <div class="card-body text-center d-flex flex-column justify-content-center">
            <i class="bi bi-search fs-1 text-primary mb-3"></i>
            <h5 class="card-title">Attendance by student</h5>
            <p class="card-text">Look up one student’s attendance history for an academic year or custom dates.</p>
            <NuxtLink to="/admin/student-attendance" class="btn btn-outline-primary mt-auto rounded-pill">Look up student</NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { subDays, format } from 'date-fns';

definePageMeta({
  middleware: ['auth', 'admin'],
});

const nuxtApp = useNuxtApp();
const db = nuxtApp.$db;

const classesNeedingAttendance = ref([]);
const loadingMissingAttendance = ref(true);
const missingAttendanceError = ref(null);
const lastCheckedTime = ref('');

// Helper function to format date/time
const formatDateTime = (date) => {
  return format(date, 'MMM do, yyyy HH:mm');
};

const checkForMissingAttendance = async () => {
  loadingMissingAttendance.value = true;
  missingAttendanceError.value = null;
  classesNeedingAttendance.value = [];
  lastCheckedTime.value = '';

  try {
    const fourteenDaysAgo = subDays(new Date(), 14);
    const fourteenDaysAgoTimestamp = Timestamp.fromDate(fourteenDaysAgo);

    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const allClasses = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const usersSnapshot = await getDocs(collection(db, 'users'));
    const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const teacherMap = allUsers.reduce((map, user) => {
      if (user.role === 'teacher' || user.role === 'admin') {
        map[user.id] = user.name || user.email;
      }
      return map;
    }, {});

    const classesWithoutAttendance = [];

    for (const cls of allClasses) {
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('classId', '==', cls.id),
        where('date', '>=', fourteenDaysAgoTimestamp)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);

      if (attendanceSnapshot.empty) {
        const teacherNames = cls.teacherIds?.map(id => teacherMap[id]).filter(Boolean) || [];
        classesWithoutAttendance.push({
          ...cls,
          teacherNames: teacherNames
        });
      }
    }
    classesNeedingAttendance.value = classesWithoutAttendance;
    lastCheckedTime.value = formatDateTime(new Date());

  } catch (error) {
    console.error('Error checking for missing attendance:', error);
    missingAttendanceError.value = `Failed to check attendance records: ${error.message}`;
  } finally {
    loadingMissingAttendance.value = false;
  }
};

onMounted(checkForMissingAttendance);
</script>

<style scoped>
/* Optional: specific styles for admin dashboard cards */
.card-body i {
  display: block;
}

.card-custom-shadow {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.card-custom-shadow:hover {
  transform: translateY(-5px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
}

/* Styles for the alert section */
.alert.alert-warning {
  border-left: 5px solid #ffc107; /* Bootstrap warning color */
  padding: 1rem 1.25rem; /* Standard Bootstrap alert padding */
}

.alert.alert-success {
  border-left: 5px solid #28a745; /* Bootstrap success color */
}

.alert-heading {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem; /* Ensure heading has bottom margin */
}

.list-group-item {
  border-color: rgba(0, 0, 0, 0.05); /* Lighter border for list items in alert */
  padding: 0.75rem 1rem; /* Adjust padding for list items */
  border-radius: 0.25rem; /* Slight roundness */
}

/* New: Spacing between list items */
.list-item-mobile-spacing {
  margin-bottom: 0.5rem; /* Add some space between stacked list items */
}

/* New: Ensure the content of the list item flexes correctly on small screens */
@media (max-width: 575.98px) { /* Extra small devices */
  .list-group-item {
    padding: 0.75rem; /* Slightly reduced padding on very small screens */
  }

  /* Make teacher names appear on their own line on very small screens */
  .list-group-item .small-text-on-mobile {
    font-size: 0.875em; /* Slightly smaller text for teachers */
    line-height: 1.2; /* Tighter line height for the teachers line */
  }

  /* Ensure button doesn't wrap unnecessarily */
  .list-group-item .btn {
    flex-shrink: 0; /* Prevent the button from shrinking */
    min-width: 120px; /* Ensure a minimum width for the button */
    justify-content: center; /* Center text in button if wider */
  }
}
</style>