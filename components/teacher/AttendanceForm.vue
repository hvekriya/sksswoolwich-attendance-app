<template>
  <div class="teacher-attendance-form card shadow-sm p-4">
    <h3 class="card-title text-primary mb-4">Record Class Attendance</h3>

    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Loading classes and students...</p>
    </div>

    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
    </div>

    <div v-if="!loading && !error">
      <div class="mb-3">
        <label for="classSelect" class="form-label">Select Class:</label>
        <select
          id="classSelect"
          v-model="selectedClassId"
          class="form-select"
          @change="fetchStudentsForClass"
          :disabled="isSubmitting"
        >
          <option value="" disabled>-- Choose a class --</option>
          <option v-for="cls in teacherClasses" :key="cls.id" :value="cls.id">
            {{ cls.name }} ({{ cls.grade }})
          </option>
        </select>
      </div>

      <div v-if="selectedClassId && students.length > 0" class="mt-4">
        <h4 class="mb-3">Students in {{ selectedClassName }}</h4>
        <div class="list-group">
          <div
            v-for="student in students"
            :key="student.id"
            class="list-group-item d-flex justify-content-between align-items-center"
          >
            <div>
              <h5 class="mb-1">{{ student.name }}</h5>
              <small class="text-muted">{{ student.email }}</small>
            </div>
            <div>
              <div class="form-check form-check-inline me-3">
                <input
                  class="form-check-input"
                  type="radio"
                  :name="'attendance-' + student.id"
                  :id="'present-' + student.id"
                  :value="true"
                  v-model="attendanceStatus[student.id]"
                  :disabled="isSubmitting"
                />
                <label class="form-check-label" :for="'present-' + student.id"
                  >Present</label
                >
              </div>
              <div class="form-check form-check-inline">
                <input
                  class="form-check-input"
                  type="radio"
                  :name="'attendance-' + student.id"
                  :id="'absent-' + student.id"
                  :value="false"
                  v-model="attendanceStatus[student.id]"
                  :disabled="isSubmitting"
                />
                <label class="form-check-label" :for="'absent-' + student.id"
                  >Absent</label
                >
              </div>
            </div>
          </div>
        </div>

        <div v-if="students.length > 0" class="mt-4 text-center">
          <button
            class="btn btn-primary btn-lg"
            @click="submitAttendance"
            :disabled="isSubmitting || !allStudentsMarked"
          >
            <span
              v-if="isSubmitting"
              class="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            ></span>
            {{ isSubmitting ? 'Submitting...' : 'Submit Attendance' }}
          </button>
        </div>
        <div v-if="!allStudentsMarked && students.length > 0" class="alert alert-warning mt-3" role="alert">
          Please mark attendance for all students before submitting.
        </div>
      </div>

      <div v-else-if="selectedClassId && students.length === 0" class="alert alert-info mt-4">
        No students found for this class.
      </div>
      <div v-else-if="teacherClasses.length === 0" class="alert alert-info mt-4">
        You are not assigned to any classes yet.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const nuxtApp = useNuxtApp();
const db = nuxtApp.$db;
const auth = nuxtApp.$auth; // Get the auth instance

const loading = ref(true);
const error = ref(null);
const teacherClasses = ref([]);
const selectedClassId = ref('');
const selectedClassName = ref('');
const students = ref([]);
const attendanceStatus = ref({}); // { studentId: true/false (present/absent) }
const isSubmitting = ref(false);

// Computed property to check if all students have been marked
const allStudentsMarked = computed(() => {
  if (students.value.length === 0) return false;
  return students.value.every(student => Object.prototype.hasOwnProperty.call(attendanceStatus.value, student.id));
});

onMounted(async () => {
  await fetchTeacherClasses();
});

const fetchTeacherClasses = async () => {
  loading.value = true;
  error.value = null;
  const currentUser = auth.currentUser;

  if (!currentUser) {
    error.value = 'User not authenticated. Please log in.';
    loading.value = false;
    return;
  }

  try {
    // 1. Get the current teacher's user document to find their assigned classId
    const teacherDocRef = doc(db, 'users', currentUser.uid);
    const teacherDocSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', currentUser.uid))); // Use getDocs with query for doc snapshot

    if (!teacherDocSnap.empty) {
      const teacherData = teacherDocSnap.docs[0].data();
      if (teacherData.role !== 'teacher') {
        error.value = 'You do not have permission to access attendance features (role is not teacher).';
        loading.value = false;
        return;
      }

      const assignedClassId = teacherData.classId; // Assuming teacherDoc.data().classId holds the ID of the class they teach

      if (assignedClassId) {
        // 2. Fetch the class details using the assigned classId
        const q = query(collection(db, 'classes'), where('__name__', '==', assignedClassId)); // Use getDocs with query for doc snapshot
        const classSnap = await getDocs(q);

        if (!classSnap.empty) {
          teacherClasses.value = [{ id: classSnap.docs[0].id, ...classSnap.docs[0].data() }];
          // Automatically select the assigned class if there's only one
          selectedClassId.value = teacherClasses.value[0].id;
          selectedClassName.value = teacherClasses.value[0].name;
          await fetchStudentsForClass(); // Fetch students immediately
        } else {
          teacherClasses.value = [];
          error.value = 'Assigned class not found or you are not assigned to a valid class.';
        }
      } else {
        teacherClasses.value = [];
        error.value = 'You are not assigned to any class.';
      }
    } else {
      error.value = 'Teacher user document not found.';
    }
  } catch (err) {
    console.error('Error fetching teacher classes:', err);
    error.value = `Failed to load classes: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

const fetchStudentsForClass = async () => {
  students.value = [];
  attendanceStatus.value = {}; // Reset attendance status
  if (!selectedClassId.value) return;

  try {
    // Fetch students belonging to the selected class
    const q = query(collection(db, 'users'), where('classId', '==', selectedClassId.value), where('role', '==', 'student'));
    const querySnapshot = await getDocs(q);
    students.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Initialize attendance status for each student to undefined (unmarked)
    students.value.forEach(student => {
      attendanceStatus.value[student.id] = undefined;
    });

    // Update selected class name for display
    const selectedClass = teacherClasses.value.find(cls => cls.id === selectedClassId.value);
    selectedClassName.value = selectedClass ? selectedClass.name : 'Unknown Class';

  } catch (err) {
    console.error('Error fetching students:', err);
    error.value = `Failed to load students: ${err.message}`;
  }
};

const submitAttendance = async () => {
  if (!selectedClassId.value || !allStudentsMarked.value) {
    alert('Please select a class and mark attendance for all students.');
    return;
  }

  isSubmitting.value = true;
  error.value = null;

  try {
    const batch = db.batch(); // Use a Firestore batch for atomic writes

    // Get today's date in YYYY-MM-DD format for the document ID
    const today = new Date();
    const dateId = today.toISOString().split('T')[0]; // e.g., '2023-10-26'

    // Create or update an attendance record for today for the selected class
    const attendanceDocRef = doc(db, 'attendance', `${selectedClassId.value}_${dateId}`);
    
    const attendanceData = {
      classId: selectedClassId.value,
      className: selectedClassName.value,
      teacherId: auth.currentUser.uid,
      teacherName: auth.currentUser.displayName || auth.currentUser.email,
      date: serverTimestamp(), // Use server timestamp for accuracy
      students: {}, // Nested object for student attendance status
    };

    // Populate student attendance status
    students.value.forEach(student => {
      attendanceData.students[student.id] = {
        name: student.name,
        present: attendanceStatus.value[student.id], // true for present, false for absent
      };
    });

    batch.set(attendanceDocRef, attendanceData); // Set the attendance record

    await batch.commit();
    alert('Attendance submitted successfully!');
    // Optionally reset form or navigate
    students.value = [];
    attendanceStatus.value = {};
    selectedClassId.value = '';

  } catch (err) {
    console.error('Error submitting attendance:', err);
    error.value = `Failed to submit attendance: ${err.message}`;
    alert(`Failed to submit attendance: ${err.message}`);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.teacher-attendance-form {
  max-width: 800px;
  margin: 2rem auto;
}

.list-group-item {
  border-left: 5px solid #007bff; /* Primary color for left border */
  margin-bottom: 0.5rem;
}

.form-check-inline {
  display: inline-flex; /* Align radio buttons and labels nicely */
  align-items: center;
}

.form-check-input {
  margin-right: 0.5rem;
}
</style>