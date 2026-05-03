<template>
  <div class="container mt-4 pb-5">
    <div class="d-flex flex-column flex-md-row justify-content-md-between align-items-md-center mb-4 gap-3">
      <h2 class="mb-2 mb-md-0">Class Attendance: <span class="text-primary">{{ className }}</span></h2>
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-secondary rounded-pill" @click="goBackToClasses">
          <i class="bi bi-arrow-left-circle me-2"></i>Back to All Classes
        </button>
        <NuxtLink :to="`/admin/manage-students`" class="btn btn-success rounded-pill">Manage students</NuxtLink>
      </div>
    </div>

    <div class="card glass-card shadow-sm mb-4">
      <div class="card-body">
        <h5 class="card-title">Select Attendance Date</h5>
        <div class="row align-items-center">
          <div class="col-md-6 mb-3 mb-md-0">
            <select v-model="selectedDateTimestamp" class="form-select form-select-lg" @change="fetchAttendance">
              <option v-for="saturday in pastSaturdays" :key="saturday.timestamp.toMillis()" :value="saturday.timestamp.toMillis()">
                {{ saturday.displayDate }}
                <template v-if="isClient && todayForClientCheck && isSameDay(saturday.timestamp, todayForClientCheck)">
                  (Today)
                </template>
              </option>
            </select>
            <small class="form-text text-muted">Attendance is recorded for Saturdays only.</small>
          </div>
          <div class="col-md-6 text-md-end">
            <p class="mb-0">
              <span class="badge bg-success me-2">Present: {{ presentCount }}</span>
              <span class="badge bg-danger">Absent: {{ absentCount }}</span>
            </p>
          </div>
        </div>

        <div class="mt-4 p-3 rounded-3 bg-light border">
          <div class="form-check form-switch mb-2">
            <input
              id="adminSessionNoClass"
              v-model="sessionNoClass"
              class="form-check-input"
              type="checkbox"
              role="switch"
              @change="onSessionNoClassToggle"
            />
            <label class="form-check-label" for="adminSessionNoClass">
              No class or class had a holiday (no attendance to record for this date)
            </label>
          </div>
          <div v-if="sessionNoClass" class="row g-2 align-items-center">
            <div class="col-12 col-sm-auto">
              <label class="form-label mb-0 small text-muted" for="adminSkipReason">Reason</label>
            </div>
            <div class="col-12 col-sm-6 col-md-4">
              <select id="adminSkipReason" v-model="skipReasonChoice" class="form-select form-select-sm">
                <option value="holiday">Holiday / centre closed</option>
                <option value="no_class">No class scheduled</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loadingStudents" class="text-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading students...</span>
      </div>
      <p class="mt-2">Loading students...</p>
    </div>

    <div v-if="!loadingStudents && students.length === 0" class="alert alert-info text-center mt-5">
      No students found in this class.
      <NuxtLink :to="`/admin/manage-students`" class="alert-link">Manage students</NuxtLink> to assign a class to them.
    </div>

    <div v-if="!loadingStudents && students.length > 0 && sessionNoClass" class="alert alert-info text-center mt-3 border-0 shadow-sm" role="alert">
      <i class="bi bi-calendar-x me-2"></i>This date is marked as <strong>no session</strong>. Save to confirm.
    </div>

    <div v-if="!loadingStudents && students.length > 0 && !sessionNoClass" class="table-responsive card glass-card p-2 p-md-3">
      <table class="table table-hover table-striped align-middle table-glass mb-0">
        <thead class="table-dark">
          <tr>
            <th>Student Name</th>
            <th class="text-center">Present</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="student in students" :key="student.id">
            <td data-label="Name">{{ student.name }}</td>
            <td data-label="Present?" class="text-center">
              <div class="form-check form-switch d-inline-block">
                <input
                  class="form-check-input"
                  type="checkbox"
                  role="switch"
                  :id="`attendance-${student.id}`"
                  v-model="attendanceStatus[student.id]"
                />
                <label class="form-check-label visually-hidden" :for="`attendance-${student.id}`">
                  {{ student.name }} Present
                </label>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button class="btn btn-primary btn-lg rounded-pill mt-3 px-4" @click="saveAttendance" :disabled="loading || !students.length">
      <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      <span v-else>Save Attendance</span>
    </button>

    <div v-if="saveMessage" :class="['alert mt-4', saveMessageType === 'success' ? 'alert-success' : 'alert-danger']" role="alert">
      {{ saveMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { format, subWeeks, isSaturday } from 'date-fns';
import {
  fetchSkipForClassDay,
  dateKeyFromDate,
  deleteAttendanceDocsForClassDay,
  setSkipForClassDay,
  deleteSkipForClassDay,
} from '~/utils/classAttendanceSkips';

definePageMeta({
  middleware: ['auth', 'admin']
});

const nuxtApp = useNuxtApp();
const auth = nuxtApp.$auth;
const db = nuxtApp.$db;
const router = useRouter();
const route = useRoute();

const currentUserId = ref(null);
const currentClassId = ref(route.params.classId);
const className = ref('Loading class...');

const students = ref([]);
const attendanceStatus = reactive({});
const selectedDateTimestamp = ref(null);
const pastSaturdays = ref([]);
const loadingStudents = ref(true);
const loadingAttendance = ref(false);
const loading = ref(false);
const saveMessage = ref(null);
const saveMessageType = ref(null);

const isClient = import.meta.client;

// New refs for attendance counts
const presentCount = ref(0);
const absentCount = ref(0);
const sessionNoClass = ref(false);
const skipReasonChoice = ref('holiday');

const selectedDate = computed(() => {
  return selectedDateTimestamp.value ? Timestamp.fromMillis(selectedDateTimestamp.value) : null;
});

// Watch for changes in attendanceStatus and update counts
watch(attendanceStatus, () => {
  updateAttendanceCounts();
}, { deep: true });

watch(sessionNoClass, () => {
  updateAttendanceCounts();
});

// --- Data Fetching Functions ---
const fetchClassName = async (classIdToFetch) => {
  try {
    const classDocRef = doc(db, 'classes', classIdToFetch);
    const classDoc = await getDoc(classDocRef);
    if (classDoc.exists()) {
      className.value = classDoc.data().name;
    } else {
      className.value = 'Class not found';
      saveMessage.value = 'Class not found for the provided ID.';
      saveMessageType.value = 'danger';
    }
  } catch (error) {
    console.error('Error fetching class name:', error);
    className.value = 'Error loading class name';
    saveMessage.value = 'Error loading class details: ' + error.message;
    saveMessageType.value = 'danger';
  }
};

const fetchStudents = async () => {
  loadingStudents.value = true;
  students.value = [];
  if (!currentClassId.value) {
    loadingStudents.value = false;
    return;
  }

  try {
    const q = query(collection(db, 'students'), where('classId', '==', currentClassId.value));
    const querySnapshot = await getDocs(q);
    // Sort students by name A-Z
    students.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                     .sort((a, b) => a.name.localeCompare(b.name));

    // Initialize attendance status for all students as absent by default
    students.value.forEach(student => {
      attendanceStatus[student.id] = false;
    });

    // Manually trigger count update after students are loaded and attendanceStatus initialized
    updateAttendanceCounts();

  } catch (error) {
    console.error('Error fetching students:', error);
    saveMessage.value = 'Error fetching students for this class: ' + error.message;
    saveMessageType.value = 'danger';
  } finally {
    loadingStudents.value = false;
  }
};

const fetchAttendance = async () => {
  if (!selectedDate.value || !currentClassId.value || students.value.length === 0) {
    return;
  }

  loadingAttendance.value = true;
  saveMessage.value = null;

  const dayMidnight = new Date(selectedDate.value.toDate());
  dayMidnight.setHours(0, 0, 0, 0);

  students.value.forEach(student => {
    attendanceStatus[student.id] = false;
  });

  try {
    const skip = await fetchSkipForClassDay(db, currentClassId.value, dayMidnight);
    if (skip) {
      sessionNoClass.value = true;
      skipReasonChoice.value = skip.skipReason === 'no_class' ? 'no_class' : 'holiday';
      updateAttendanceCounts();
      return;
    }

    sessionNoClass.value = false;

    const startOfDay = new Date(selectedDate.value.toDate());
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate.value.toDate());
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'attendance'),
      where('classId', '==', currentClassId.value),
      where('date', '>=', Timestamp.fromDate(startOfDay)),
      where('date', '<=', Timestamp.fromDate(endOfDay))
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (students.value.some(s => s.id === data.studentId)) {
        attendanceStatus[data.studentId] = data.present;
      }
    });

    updateAttendanceCounts();
  } catch (error) {
    console.error('Error fetching attendance:', error);
    saveMessage.value = 'Error fetching attendance for this date: ' + error.message;
    saveMessageType.value = 'danger';
  } finally {
    loadingAttendance.value = false;
  }
};

// --- Utility Functions ---
const addStudent = () => {
  // Directing to admin/manage-students as an admin would manage all students there
  // The teacher version had a specific add-student route.
  router.push(`/admin/manage-students`);
};

const goBackToClasses = () => {
  router.push('/admin/manage-classes');
};

const onSessionNoClassToggle = async () => {
  if (!sessionNoClass.value && selectedDate.value && currentClassId.value && students.value.length > 0) {
    await fetchAttendance();
  }
};

const generateSaturdays = () => {
  const today = new Date();
  let currentSaturday = new Date(today);

  // Adjust to the most recent past or current Saturday
  if (!isSaturday(currentSaturday)) {
    const dayOfWeek = currentSaturday.getDay(); // 0 for Sunday, 6 for Saturday
    const daysSinceLastSaturday = (dayOfWeek + 1) % 7; // Number of days to subtract to get to last Saturday
    currentSaturday = new Date(currentSaturday.setDate(currentSaturday.getDate() - daysSinceLastSaturday));
  }

  const saturdays = [];
  for (let i = 0; i < 9; i++) { // Generate current + 8 past Saturdays
    const date = subWeeks(currentSaturday, i);
    // Normalize to midnight
    date.setHours(0, 0, 0, 0);
    saturdays.push({
      timestamp: Timestamp.fromDate(date),
      displayDate: format(date, 'MMMM dd,yyyy')
    });
  }
  pastSaturdays.value = saturdays.reverse(); // Show oldest first
  selectedDateTimestamp.value = pastSaturdays.value[pastSaturdays.value.length - 1]?.timestamp.toMillis(); // Default to most recent Saturday
};

const saveAttendance = async () => {
  loading.value = true;
  saveMessage.value = null;

  if (!currentClassId.value || !selectedDate.value || !currentUserId.value) {
    saveMessage.value = 'Missing class, date, or user information. Cannot save attendance.';
    saveMessageType.value = 'danger';
    loading.value = false;
    return;
  }
  if (students.value.length === 0) {
    saveMessage.value = 'No students in this class to save attendance for.';
    saveMessageType.value = 'info';
    loading.value = false;
    return;
  }

  const dateAtMidnight = new Date(selectedDate.value.toDate());
  dateAtMidnight.setHours(0, 0, 0, 0);
  const dateKey = dateKeyFromDate(dateAtMidnight);
  const normalizedDate = Timestamp.fromDate(dateAtMidnight);
  const startOfDay = new Date(dateAtMidnight);
  const endOfDay = new Date(dateAtMidnight);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    if (sessionNoClass.value) {
      await deleteAttendanceDocsForClassDay(db, currentClassId.value, startOfDay, endOfDay);
      await setSkipForClassDay(
        db,
        currentClassId.value,
        dateKey,
        normalizedDate,
        skipReasonChoice.value,
        currentUserId.value
      );
      saveMessage.value = 'Saved: no session for this date.';
      saveMessageType.value = 'success';
      return;
    }

    await deleteSkipForClassDay(db, currentClassId.value, dateKey);

    for (const student of students.value) {
      const isPresent = attendanceStatus[student.id];
      const attendanceDocId = `${currentClassId.value}_${dateAtMidnight.toISOString().split('T')[0]}_${student.id}`;
      const attendanceRef = doc(db, 'attendance', attendanceDocId);

      await setDoc(attendanceRef, {
        classId: currentClassId.value,
        studentId: student.id,
        date: normalizedDate,
        present: isPresent,
        recordedBy: currentUserId.value,
        recordedAt: Timestamp.now(),
      }, { merge: true });
    }
    saveMessage.value = 'Attendance saved successfully!';
    saveMessageType.value = 'success';
  } catch (error) {
    console.error('Error saving attendance:', error);
    saveMessage.value = 'Failed to save attendance. Please try again: ' + error.message;
    saveMessageType.value = 'danger';
  } finally {
    loading.value = false;
    setTimeout(() => saveMessage.value = null, 3000);
  }
};

// Helper function to update present/absent counts
const updateAttendanceCounts = () => {
  if (sessionNoClass.value) {
    presentCount.value = 0;
    absentCount.value = 0;
    return;
  }
  let currentPresent = 0;
  let currentAbsent = 0;
  if (students.value.length > 0) {
    students.value.forEach(student => {
      if (attendanceStatus[student.id] === true) {
        currentPresent++;
      } else {
        currentAbsent++;
      }
    });
  }
  presentCount.value = currentPresent;
  absentCount.value = currentAbsent;
};

// --- Watcher for currentClassId ---
watch(currentClassId, async (newClassId) => {
  if (newClassId) {
    loadingStudents.value = true;
    await fetchClassName(newClassId);
    await fetchStudents(); // This will also call updateAttendanceCounts
    // After students are loaded, fetch attendance if date is already selected
    if (selectedDateTimestamp.value) {
      await fetchAttendance();
    }
  } else {
    className.value = 'No Class Selected';
    students.value = [];
    Object.keys(attendanceStatus).forEach(key => delete attendanceStatus[key]);
    loadingStudents.value = false;
    saveMessage.value = 'Invalid class ID provided in URL.';
    saveMessageType.value = 'danger';
    updateAttendanceCounts(); // Update counts even if no class is selected
  }
}, { immediate: true });

// --- Watcher for selectedDateTimestamp ---
watch(selectedDateTimestamp, async (newDateTimestamp) => {
  if (newDateTimestamp && currentClassId.value && students.value.length > 0) {
    await fetchAttendance();
  }
});

// In script setup, add this helper function
const isSameDay = (firestoreTimestamp1, date2) => {
  if (!firestoreTimestamp1 || !date2) return false;
  const date1 = firestoreTimestamp1.toDate();
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

const todayForClientCheck = ref(null); // Declare a ref to hold today's date

// --- Lifecycle Hooks ---
onMounted(async () => {
  const user = await new Promise(resolve => {
    const unsubscribe = auth.onAuthStateChanged(firebaseUser => {
      unsubscribe();
      resolve(firebaseUser);
    });
  });

  if (!user) {
    router.push('/login');
    return;
  }
  currentUserId.value = user.uid;

  if (!route.params.classId) {
    className.value = 'No Class ID Provided';
    saveMessage.value = 'No class ID provided in the URL. Please navigate from the Manage Classes page.';
    saveMessageType.value = 'danger';
    loadingStudents.value = false;
    updateAttendanceCounts();
    return;
  }

  todayForClientCheck.value = new Date();
  generateSaturdays();
  
  await nextTick();
  
  // Give the watchers time to complete
  setTimeout(async () => {
    if (currentClassId.value && selectedDateTimestamp.value && students.value.length > 0) {
      await fetchAttendance();
    }
  }, 500);
});
</script>

<style scoped>
/* Specific styles for this attendance recording page */
</style>