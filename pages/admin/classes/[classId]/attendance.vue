<template>
  <div class="container mt-4">
    <div class="d-flex flex-column flex-md-row justify-content-md-between align-items-md-center mb-4">
      <h2 class="mb-2 mb-md-0">Class Attendance: <span class="text-primary">{{ className }}</span></h2>
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-secondary" @click="goBackToClasses">
          <i class="bi bi-arrow-left-circle me-2"></i>Back to All Classes
        </button>
        <NuxtLink :to="`/admin/manage-students`" class="btn btn-success">Manage students</NuxtLink>
      </div>
    </div>

    <div class="card shadow-sm mb-4">
      <div class="card-body">
        <h5 class="card-title">Select Attendance Date</h5>
        <div class="row align-items-center">
          <div class="col-md-6 mb-3 mb-md-0">
            <select v-model="selectedDateTimestamp" class="form-select" @change="fetchAttendance">
              <option v-for="saturday in pastSaturdays" :key="saturday.timestamp.toMillis()" :value="saturday.timestamp.toMillis()">
                {{ saturday.displayDate }}
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

    <div v-if="!loadingStudents && students.length > 0" class="table-responsive">
      <table class="table table-hover table-striped align-middle">
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

    <button class="btn btn-primary" @click="saveAttendance" :disabled="loading || !students.length">
      <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      <span v-else>Save Attendance</span>
    </button>

    <div v-if="saveMessage" :class="['alert mt-4', saveMessageType === 'success' ? 'alert-success' : 'alert-danger']" role="alert">
      {{ saveMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'; // Import 'watch'
import { useRoute } from 'vue-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { format, subWeeks, startOfWeek, isSaturday, addDays } from 'date-fns';

definePageMeta({
  middleware: ['auth', 'admin'],
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
const attendanceStatus = ref({});
const selectedDateTimestamp = ref(null);
const pastSaturdays = ref([]);
const loadingStudents = ref(true);
const loadingAttendance = ref(false);
const loading = ref(false);
const saveMessage = ref(null);
const saveMessageType = ref(null);

// New refs for attendance counts
const presentCount = ref(0);
const absentCount = ref(0);

const selectedDate = computed(() => {
  return selectedDateTimestamp.value ? Timestamp.fromMillis(selectedDateTimestamp.value) : null;
});

// Watch for changes in attendanceStatus and update counts
watch(attendanceStatus.value, () => {
  updateAttendanceCounts();
}, { deep: true }); // Use deep: true to watch for changes inside the attendanceStatus object

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
      attendanceStatus.value[student.id] = false;
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
  if (!selectedDate.value || !currentClassId.value || loadingStudents.value) return;

  loadingAttendance.value = true;
  saveMessage.value = null;

  // Reset attendance status to default (absent) for all *currently loaded* students before fetching
  students.value.forEach(student => {
    attendanceStatus.value[student.id] = false;
  });

  try {
    const q = query(
      collection(db, 'attendance'),
      where('classId', '==', currentClassId.value),
      where('date', '==', selectedDate.value)
    );
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(doc => {
      const data = doc.data();
      // Ensure student exists in the current 'students' array before updating status
      if (students.value.some(s => s.id === data.studentId)) {
        attendanceStatus.value[data.studentId] = data.present;
      }
    });

    // Manually trigger count update after attendance is fetched
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

const generateSaturdays = () => {
  const today = new Date();
  let currentSaturday = new Date(today);
  if (!isSaturday(currentSaturday)) {
    // If today is not Saturday, find the previous Saturday
    currentSaturday = subWeeks(startOfWeek(today, { weekStartsOn: 0 }), 0); // This gets the Sunday of current week
    if (!isSaturday(currentSaturday)) {
      currentSaturday = addDays(currentSaturday, (6 - currentSaturday.getDay() + 7) % 7); // Find next Saturday from Sunday
    }
    currentSaturday = subWeeks(currentSaturday, 1); // Go back one week to get the previous Saturday if today isn't one
  }

  const saturdays = [];
  for (let i = 0; i < 9; i++) { // Generate current + 8 past Saturdays
    const date = subWeeks(currentSaturday, i);
    saturdays.push({
      timestamp: Timestamp.fromDate(date),
      displayDate: format(date, 'MMMM dd,yyyy') + (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') && isSaturday(today) ? ' (Today)' : '')
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

  try {
    for (const student of students.value) {
      const isPresent = attendanceStatus.value[student.id];
      const attendanceDocId = `${currentClassId.value}_${selectedDate.value.toDate().toISOString().split('T')[0]}_${student.id}`;
      const attendanceRef = doc(db, 'attendance', attendanceDocId);

      await setDoc(attendanceRef, {
        classId: currentClassId.value,
        studentId: student.id,
        date: selectedDate.value,
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
  let currentPresent = 0;
  let currentAbsent = 0;
  // Make sure students.value is populated before trying to count
  if (students.value.length > 0) {
    students.value.forEach(student => {
      // Check if the student's status is explicitly true (present)
      // Otherwise, consider them absent (false, undefined, or null)
      if (attendanceStatus.value[student.id] === true) {
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
    if (selectedDate.value) {
      await fetchAttendance(); // This will also call updateAttendanceCounts
    }
  } else {
    className.value = 'No Class Selected';
    students.value = [];
    attendanceStatus.value = {};
    loadingStudents.value = false;
    saveMessage.value = 'Invalid class ID provided in URL.';
    saveMessageType.value = 'danger';
    updateAttendanceCounts(); // Update counts even if no class is selected
  }
}, { immediate: true });

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
    updateAttendanceCounts(); // Update counts if no class ID is present
    return;
  }

  generateSaturdays();
});
</script>

<style scoped>
/* Specific styles for this attendance recording page */
</style>