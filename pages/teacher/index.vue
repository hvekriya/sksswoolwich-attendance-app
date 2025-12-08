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
const attendanceStatus = reactive({});
const selectedDateTimestamp = ref(null);
const pastSaturdays = ref([]);
const loadingStudents = ref(true);
const loadingAttendance = ref(false);
const loading = ref(false);
const saveMessage = ref(null);
const saveMessageType = ref(null);

const presentCount = ref(0);
const absentCount = ref(0);
const attendanceRecorded = ref(true);

const isClient = import.meta.client;

// Computed property to convert selectedDateTimestamp to a Firebase Timestamp object
const selectedDate = computed(() => {
  return selectedDateTimestamp.value ? Timestamp.fromMillis(selectedDateTimestamp.value) : null;
});

// Computed property to display the selected date in a readable format for the banner
const selectedDateDisplay = computed(() => {
  return selectedDateTimestamp.value ? format(new Date(selectedDateTimestamp.value), 'MMMM dd,yyyy') : '';
});

// Watch for changes in attendanceStatus and update counts
watch(attendanceStatus, () => {
  updateAttendanceCounts();
}, { deep: true });

const addStudent = () => {
  router.push('/teacher/add-student');
};

const generateSaturdays = () => {
  const today = new Date();
  let currentSaturday = new Date(today);

  // Adjust to the most recent past or current Saturday
  if (!isSaturday(currentSaturday)) {
    const dayOfWeek = currentSaturday.getDay();
    const daysSinceLastSaturday = (dayOfWeek + 1) % 7;
    currentSaturday = new Date(currentSaturday.setDate(currentSaturday.getDate() - daysSinceLastSaturday));
  }

  const saturdays = [];
  for (let i = 0; i < 9; i++) {
    const date = subWeeks(currentSaturday, i);
    // Normalize to midnight
    date.setHours(0, 0, 0, 0);
    saturdays.push({
      timestamp: Timestamp.fromDate(date),
      displayDate: format(date, 'MMMM dd,yyyy')
    });
  }
  pastSaturdays.value = saturdays.reverse();
  selectedDateTimestamp.value = pastSaturdays.value[pastSaturdays.value.length - 1]?.timestamp.toMillis();
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
    students.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                     .sort((a, b) => a.name.localeCompare(b.name));

    // Initialize attendance status for all students as absent by default
    students.value.forEach(student => {
      attendanceStatus[student.id] = false;
    });

    updateAttendanceCounts();
  } catch (error) {
    console.error('Error fetching students:', error);
  } finally {
    loadingStudents.value = false;
  }
};

const fetchAttendance = async () => {
  if (!selectedDate.value || !classId.value || students.value.length === 0) {
    return;
  }

  loadingAttendance.value = true;
  saveMessage.value = null;
  attendanceRecorded.value = true;

  // Reset attendance status to default (absent) for all students before fetching
  students.value.forEach(student => {
    attendanceStatus[student.id] = false;
  });

  try {
    // Create date range for the entire day (midnight to just before next midnight)
    const startOfDay = new Date(selectedDate.value.toDate());
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate.value.toDate());
    endOfDay.setHours(23, 59, 59, 999);
    
    const q = query(
      collection(db, 'attendance'),
      where('classId', '==', classId.value),
      where('date', '>=', Timestamp.fromDate(startOfDay)),
      where('date', '<=', Timestamp.fromDate(endOfDay))
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      attendanceRecorded.value = false;
    } else {
      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (students.value.some(s => s.id === data.studentId)) {
          attendanceStatus[data.studentId] = data.present;
        }
      });
      attendanceRecorded.value = true;
    }

    updateAttendanceCounts();

  } catch (error) {
    console.error('Error fetching attendance:', error);
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
    // Normalize the date to midnight (start of day) for consistency
    const dateAtMidnight = new Date(selectedDate.value.toDate());
    dateAtMidnight.setHours(0, 0, 0, 0);
    const normalizedDate = Timestamp.fromDate(dateAtMidnight);
    
    for (const student of students.value) {
      const isPresent = attendanceStatus[student.id];
      const attendanceDocId = `${classId.value}_${dateAtMidnight.toISOString().split('T')[0]}_${student.id}`;
      const attendanceRef = doc(db, 'attendance', attendanceDocId);

      await setDoc(attendanceRef, {
        classId: classId.value,
        studentId: student.id,
        date: normalizedDate,
        present: isPresent,
        recordedBy: teacherId.value,
        recordedAt: Timestamp.now(),
      }, { merge: true });
    }
    saveMessage.value = 'Attendance saved successfully!';
    saveMessageType.value = 'success';
    attendanceRecorded.value = true;
  } catch (error) {
    console.error('Error saving attendance:', error);
    saveMessage.value = 'Failed to save attendance. Please try again.';
    saveMessageType.value = 'danger';
  } finally {
    loading.value = false;
    setTimeout(() => saveMessage.value = null, 3000);
  }
};

// Helper function to update present/absent counts
const updateAttendanceCounts = () => {
  let currentPresent = 0;
  if (students.value.length > 0) {
    students.value.forEach(student => {
      if (attendanceStatus[student.id] === true) {
        currentPresent++;
      }
    });
  }
  presentCount.value = currentPresent;
  absentCount.value = students.value.length - currentPresent;
};

const isSameDay = (firestoreTimestamp1, date2) => {
  if (!firestoreTimestamp1 || !date2) return false;
  const date1 = firestoreTimestamp1.toDate();
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

const todayForClientCheck = ref(null);

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
          todayForClientCheck.value = new Date();
          generateSaturdays();
          await fetchStudents();
          if (selectedDate.value) {
            await fetchAttendance();
          }
        } else {
          console.warn('Teacher is not assigned to a class.');
          className.value = 'No Class Assigned';
          loadingStudents.value = false;
          attendanceRecorded.value = true;
        }
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching teacher data or class:', error);
      loadingStudents.value = false;
      attendanceRecorded.value = true;
    }
  } else {
    loadingStudents.value = false;
    attendanceRecorded.value = true;
  }
});
</script>

<style scoped>
/* Optional: specific styles for teacher dashboard */
</style>