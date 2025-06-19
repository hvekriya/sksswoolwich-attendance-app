<template>
  <div class="container mt-4">
    <div class="d-flex flex-column flex-md-row justify-content-md-between align-items-md-center mb-4">
      <h2 class="mb-md-0 mb-3">My Class: <span class="text-primary">{{ className }}</span></h2>
      <button class="btn btn-success" @click="addStudent">
        <i class="bi bi-plus-circle me-2"></i>Add Student
      </button>
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
      No students found in your class. <NuxtLink to="/teacher/add-student" class="alert-link">Add a student</NuxtLink> to get started.
    </div>

    <div v-if="!loadingStudents && students.length > 0 && !attendanceRecorded" class="alert alert-warning text-center mt-3" role="alert">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>Attendance has not been recorded for **{{ selectedDateDisplay }}**. Please mark students present or absent and click "Save Attendance".
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
import { ref, onMounted, computed, watch } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { format, subWeeks, startOfWeek, isSaturday, addDays } from 'date-fns';

// Page-specific middleware
definePageMeta({
  middleware: ['auth', 'teacher'],
});

// Access Firebase services
const nuxtApp = useNuxtApp();
const auth = nuxtApp.$auth;
const db = nuxtApp.$db;
const router = useRouter();

const teacherId = ref(null);
const classId = ref(null);
const className = ref('Loading...');
const students = ref([]);
const attendanceStatus = ref({}); // { studentId: boolean }
const selectedDateTimestamp = ref(null); // Unix timestamp for the selected Saturday
const pastSaturdays = ref([]);
const loadingStudents = ref(true);
const loadingAttendance = ref(false);
const loading = ref(false); // For save button
const saveMessage = ref(null);
const saveMessageType = ref(null);

const presentCount = ref(0);
const absentCount = ref(0);
const attendanceRecorded = ref(true); // New ref: Assume true until proven false

// Computed property to convert selectedDateTimestamp to a Firebase Timestamp object
const selectedDate = computed(() => {
  return selectedDateTimestamp.value ? Timestamp.fromMillis(selectedDateTimestamp.value) : null;
});

// Computed property to display the selected date in a readable format for the banner
const selectedDateDisplay = computed(() => {
  return selectedDateTimestamp.value ? format(new Date(selectedDateTimestamp.value), 'MMMM dd,yyyy') : '';
});


// Watch for changes in attendanceStatus and update counts
// Use a deep watcher on attendanceStatus object
watch(attendanceStatus.value, () => {
  updateAttendanceCounts();
}, { deep: true });

const addStudent = () => {
  router.push('/teacher/add-student');
};

const generateSaturdays = () => {
  const today = new Date();
  let currentSaturday = new Date(today);
  // Ensure currentSaturday is actually a Saturday, if today is one. Otherwise, find the most recent past Saturday.
  if (!isSaturday(currentSaturday)) {
    // If today is not Saturday, go back to the previous Saturday.
    // startOfWeek with weekStartsOn: 0 gives Sunday. Add 6 days to get Saturday.
    currentSaturday = addDays(startOfWeek(today, { weekStartsOn: 0 }), 6);
    // If the calculated Saturday is in the future, go back a week.
    if (currentSaturday > today) {
      currentSaturday = subWeeks(currentSaturday, 1);
    }
  }

  const saturdays = [];
  // Generate past 8 Saturdays + current Saturday if it's a Saturday
  for (let i = 0; i < 9; i++) {
    const date = subWeeks(currentSaturday, i);
    saturdays.push({
      timestamp: Timestamp.fromDate(date),
      displayDate: format(date, 'MMMM dd,yyyy') + (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') && isSaturday(today) ? ' (Today)' : '')
    });
  }
  pastSaturdays.value = saturdays.reverse(); // Show oldest first
  selectedDateTimestamp.value = pastSaturdays.value[pastSaturdays.value.length - 1]?.timestamp.toMillis(); // Default to most recent Saturday
};

const fetchStudents = async () => {
  loadingStudents.value = true;
  students.value = [];
  if (!classId.value) {
    loadingStudents.value = false;
    return;
  }

  try {
    const q = query(collection(db, 'students'), where('classId', '==', classId.value));
    const querySnapshot = await getDocs(q);
    // Sort students by name A-Z
    students.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                     .sort((a, b) => a.name.localeCompare(b.name));

    // Initialize attendance status for all students as absent by default
    students.value.forEach(student => {
      attendanceStatus.value[student.id] = false;
    });

    // Manually trigger count update after students are loaded and attendanceStatus initialized
    updateAttendanceCounts(); // Initial count assuming all absent
  } catch (error) {
    console.error('Error fetching students:', error);
    // You might want to use a global notification system here
  } finally {
    loadingStudents.value = false;
  }
};

const fetchAttendance = async () => {
  if (!selectedDate.value || !classId.value || loadingStudents.value) return;

  loadingAttendance.value = true;
  saveMessage.value = null;
  attendanceRecorded.value = true; // Reset to true at the start of fetchAttendance

  // Reset attendance status to default (absent) for all *currently loaded* students before fetching
  students.value.forEach(student => {
    attendanceStatus.value[student.id] = false;
  });

  try {
    const q = query(
      collection(db, 'attendance'),
      where('classId', '==', classId.value),
      where('date', '==', selectedDate.value)
    );
    const querySnapshot = await getDocs(q);

    // Check if any attendance records were found for the selected date
    if (querySnapshot.empty) {
      attendanceRecorded.value = false; // No records found, so attendance is not recorded
    } else {
      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (students.value.some(s => s.id === data.studentId)) {
          attendanceStatus.value[data.studentId] = data.present;
        }
      });
      attendanceRecorded.value = true; // Records were found
    }

    // Manually trigger count update after attendance is fetched (or determined empty)
    updateAttendanceCounts();

  } catch (error) {
    console.error('Error fetching attendance:', error);
    // You might want to use a global notification system here
  } finally {
    loadingAttendance.value = false;
  }
};

const saveAttendance = async () => {
  loading.value = true;
  saveMessage.value = null;

  if (!classId.value || !selectedDate.value || !teacherId.value) {
    saveMessage.value = 'Missing class, date, or teacher information.';
    saveMessageType.value = 'danger';
    loading.value = false;
    return;
  }

  try {
    for (const student of students.value) {
      const isPresent = attendanceStatus.value[student.id];
      const attendanceDocId = `${classId.value}_${selectedDate.value.toDate().toISOString().split('T')[0]}_${student.id}`;
      const attendanceRef = doc(db, 'attendance', attendanceDocId);

      await setDoc(attendanceRef, {
        classId: classId.value,
        studentId: student.id,
        date: selectedDate.value,
        present: isPresent,
        recordedBy: teacherId.value,
        recordedAt: Timestamp.now(),
      }, { merge: true }); // Use merge to update existing or create new
    }
    saveMessage.value = 'Attendance saved successfully!';
    saveMessageType.value = 'success';
    attendanceRecorded.value = true; // Mark as recorded after saving
  } catch (error) {
    console.error('Error saving attendance:', error);
    saveMessage.value = 'Failed to save attendance. Please try again.';
    saveMessageType.value = 'danger';
  } finally {
    loading.value = false;
    setTimeout(() => saveMessage.value = null, 3000); // Clear message after 3 seconds
  }
};

// Helper function to update present/absent counts
const updateAttendanceCounts = () => {
  let currentPresent = 0;
  students.value.forEach(student => {
    if (attendanceStatus.value[student.id] === true) {
      currentPresent++;
    }
  });
  presentCount.value = currentPresent;
  absentCount.value = students.value.length - currentPresent; // Calculate absent based on total students
};


onMounted(async () => {
  const user = await new Promise(resolve => {
    const unsubscribe = auth.onAuthStateChanged(firebaseUser => {
      unsubscribe();
      resolve(firebaseUser);
    });
  });

  if (user) {
    teacherId.value = user.uid;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists() && userDoc.data()?.role === 'teacher') {
        classId.value = userDoc.data().classId;
        if (classId.value) {
          const classDoc = await getDoc(doc(db, 'classes', classId.value));
          if (classDoc.exists()) {
            className.value = classDoc.data().name;
          } else {
            className.value = 'Class not found';
            console.warn(`Class with ID ${classId.value} not found.`);
          }
          generateSaturdays();
          // *** IMPORTANT CHANGE HERE ***
          // Fetch students first
          await fetchStudents();
          // THEN, and only then, fetch attendance for the selected date
          if (selectedDate.value) {
            await fetchAttendance();
          }
        } else {
          console.warn('Teacher is not assigned to a class.');
          className.value = 'No Class Assigned';
          loadingStudents.value = false;
          attendanceRecorded.value = true; // No class, so no attendance to record state
        }
      } else {
        // If not a teacher or user data missing, redirect or show error
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching teacher data or class:', error);
      loadingStudents.value = false;
      attendanceRecorded.value = true; // Error, so no attendance state to show banner
    }
  } else {
    // User not logged in, auth middleware should handle redirect
    loadingStudents.value = false;
    attendanceRecorded.value = true; // Not logged in, no attendance state
  }
});
</script>

<style scoped>
/* Optional: specific styles for teacher dashboard */
</style>