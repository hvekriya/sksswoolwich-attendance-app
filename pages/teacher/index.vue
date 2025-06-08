<template>
  <div class="container mt-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">My Class: <span class="text-primary">{{ className }}</span></h2>
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
            <button class="btn btn-primary" @click="saveAttendance" :disabled="loading || !students.length">
              <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <span v-else>Save Attendance</span>
            </button>
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
            <td>{{ student.name }}</td>
            <td class="text-center">
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

    <div v-if="saveMessage" :class="['alert mt-4', saveMessageType === 'success' ? 'alert-success' : 'alert-danger']" role="alert">
      {{ saveMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { format, subWeeks, startOfWeek, isSaturday, addDays } from 'date-fns';

// Page-specific middleware
definePageMeta({
  middleware: ['auth', 'teacher'], // Assuming you will create a teacher.ts middleware similar to admin.ts
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
const loadingAttendance = ref(false); // Not currently used but good to keep
const loading = ref(false); // For save button
const saveMessage = ref(null);
const saveMessageType = ref(null);

// Computed property to convert selectedDateTimestamp to a Firebase Timestamp object
const selectedDate = computed(() => {
  return selectedDateTimestamp.value ? Timestamp.fromMillis(selectedDateTimestamp.value) : null;
});

const addStudent = () => {
  router.push('/teacher/add-student');
};

const generateSaturdays = () => {
  const today = new Date();
  let currentSaturday = startOfWeek(today, { weekStartsOn: 0 }); // Sunday as start of week
  if (!isSaturday(currentSaturday)) {
    currentSaturday = addDays(currentSaturday, (6 - currentSaturday.getDay() + 7) % 7); // Find next Saturday
  }

  const saturdays = [];
  // Generate past 8 Saturdays + current Saturday if it's a Saturday
  for (let i = 0; i < 9; i++) {
    const date = subWeeks(currentSaturday, i);
    saturdays.push({
      timestamp: Timestamp.fromDate(date),
      displayDate: format(date, 'MMMM dd, yyyy') + (i === 0 && isSaturday(today) ? ' (Today)' : '')
    });
  }
  pastSaturdays.value = saturdays.reverse(); // Show oldest first
  selectedDateTimestamp.value = pastSaturdays.value[pastSaturdays.value.length - 1]?.timestamp.toMillis(); // Default to most recent Saturday
};

const fetchStudents = async () => {
  loadingStudents.value = true;
  students.value = [];
  if (!classId.value) return;

  try {
    const q = query(collection(db, 'students'), where('classId', '==', classId.value));
    const querySnapshot = await getDocs(q);
    students.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Initialize attendance status for all students as absent by default
    students.value.forEach(student => {
      attendanceStatus.value[student.id] = false;
    });
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

  // Reset attendance status to default (absent) before fetching
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
    querySnapshot.forEach(doc => {
      const data = doc.data();
      if (attendanceStatus.value.hasOwnProperty(data.studentId)) { // Ensure student exists
        attendanceStatus.value[data.studentId] = data.present;
      }
    });
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
      // Create a predictable document ID for easier updates
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
  } catch (error) {
    console.error('Error saving attendance:', error);
    saveMessage.value = 'Failed to save attendance. Please try again.';
    saveMessageType.value = 'danger';
  } finally {
    loading.value = false;
    setTimeout(() => saveMessage.value = null, 3000); // Clear message after 3 seconds
  }
};

onMounted(async () => {
  // Wait for the Firebase auth state to be established
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
          await fetchStudents();
          // Fetch attendance for the initially selected date
          if (selectedDate.value) {
            await fetchAttendance();
          }
        } else {
          console.warn('Teacher is not assigned to a class.');
          className.value = 'No Class Assigned';
          loadingStudents.value = false;
        }
      } else {
        // If not a teacher or user data missing, redirect or show error
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching teacher data or class:', error);
      //errorMessage.value = 'Failed to load teacher or class data.'; // You'd likely use a global notification
      loadingStudents.value = false;
    }
  } else {
    // User not logged in, auth middleware should handle redirect
    loadingStudents.value = false;
  }
});
</script>

<style scoped>
/* Optional: specific styles for teacher dashboard */
</style>