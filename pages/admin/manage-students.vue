<template>
  <div class="container mt-4">
    <div class="d-flex flex-column flex-md-row justify-content-md-between align-items-md-center mb-4">
      <h2 class="mb-2 mb-md-0">Manage Students</h2>
      <button class="btn btn-primary" @click="openAddStudentModal">
        <i class="bi bi-person-plus-fill me-2"></i>Add New Student
      </button>
    </div>

    <div class="card shadow-sm p-3 mb-4">
      <div class="row g-3 align-items-end">
        <div class="col-md-6">
          <label for="filterClass" class="form-label">Filter by Class</label>
          <select class="form-select" id="filterClass" v-model="selectedFilterClassId">
            <option :value="null">All Classes</option>
            <option v-for="cls in classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
          </select>
        </div>
        <div class="col-md-6 text-md-end">
          </div>
      </div>
    </div>

    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading students...</span>
      </div>
      <p class="mt-2">Loading students...</p>
    </div>

    <div v-if="!loading && students.length === 0" class="alert alert-info text-center mt-5">
      No students found for the selected criteria.
    </div>

    <div v-if="!loading && students.length > 0" class="d-none d-md-block table-responsive">
      <table class="table table-hover table-striped align-middle">
        <thead class="table-dark">
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Class</th>
            <th>Added By</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="student in students" :key="student.id">
            <td data-label="Name">{{ student.name }}</td>
            <td data-label="Email">{{ student.email || 'N/A' }}</td>
            <td data-label="Class name">{{ student.className || 'N/A' }}</td>
            <td data-label="Added by">{{ student.addedByEmail || 'N/A' }}</td>
            <td data-label="Actions">
              <button class="btn btn-sm btn-info me-2" @click="openEditStudentModal(student)">
                <i class="bi bi-pencil-fill"></i> Edit
              </button>
              <button class="btn btn-sm btn-danger" @click="deleteStudent(student.id)">
                <i class="bi bi-trash-fill"></i> Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!loading && students.length > 0" class="d-md-none mt-3">
      <div v-for="student in students" :key="student.id" class="card mb-3 shadow-sm student-card-mobile">
        <div class="card-body">
          <h5 class="card-title text-primary">{{ student.name }}</h5>
          <p class="card-text mb-1">
            <strong>Email:</strong> {{ student.email || 'N/A' }}
          </p>
          <p class="card-text mb-1">
            <strong>Class:</strong> {{ student.className || 'N/A' }}
          </p>
          <p class="card-text mb-3">
            <strong>Added By:</strong> {{ student.addedByEmail || 'N/A' }}
          </p>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-info" @click="openEditStudentModal(student)">
              <i class="bi bi-pencil-fill me-1"></i> Edit
            </button>
            <button class="btn btn-sm btn-danger" @click="deleteStudent(student.id)">
              <i class="bi bi-trash-fill me-1"></i> Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="message" :class="['alert mt-4', messageType === 'success' ? 'alert-success' : 'alert-danger']" role="alert">
      {{ message }}
    </div>

    <AddEditStudentModal
      :show="showStudentModal"
      :student="selectedStudent"
      :classes="classes"
      @close="closeStudentModal"
      @saved="handleStudentSaved"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { getFirestore, collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';

import AddEditStudentModal from '~/components/admin/AddEditStudentModal.vue';

definePageMeta({
  middleware: ['auth', 'admin'],
});

const nuxtApp = useNuxtApp();
const db = nuxtApp.$db;

const students = ref([]);
const classes = ref([]); // For class dropdown in modal AND filter
const users = ref([]); // For displaying 'added by' user email
const loading = ref(true);
const message = ref(null);
const messageType = ref(null);

const showStudentModal = ref(false);
const selectedStudent = ref(null);

const selectedFilterClassId = ref(null); // New ref for the filter

// Watch for changes in the selected filter class and re-fetch students
watch(selectedFilterClassId, () => {
  fetchStudentsOnly(); // Call a dedicated function to fetch only students
});

const fetchAllInitialData = async () => {
  loading.value = true;
  classes.value = [];
  users.value = []; // To get 'addedBy' user emails

  try {
    // Fetch all classes (needed for both filter and modal)
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    classes.value = classesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fetch relevant users (admins/teachers for 'addedBy' info)
    const usersSnapshot = await getDocs(collection(db, 'users'));
    users.value = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Now fetch students based on the initial filter (which is null by default)
    await fetchStudentsOnly();

  } catch (error) {
    console.error('Error fetching initial data (classes or users):', error);
    message.value = `Failed to load initial data: ${error.message}`;
    messageType.value = 'danger';
  } finally {
    loading.value = false;
  }
};


const fetchStudentsOnly = async () => {
  loading.value = true;
  students.value = []; // Clear current students before fetching

  try {
    let studentsCollectionRef = collection(db, 'students');
    let studentsQueryToExecute;

    // Apply the class filter if a class is selected
    if (selectedFilterClassId.value) {
      studentsQueryToExecute = query(studentsCollectionRef, where('classId', '==', selectedFilterClassId.value));
    } else {
      studentsQueryToExecute = query(studentsCollectionRef); // No filter applied
    }


    const studentsSnapshot = await getDocs(studentsQueryToExecute);
    let fetchedStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // --- NEW: Sort students by name A-Z ---
    fetchedStudents.sort((a, b) => a.name.localeCompare(b.name));

    // Enhance student data with class name and 'addedBy' user email
    students.value = fetchedStudents.map(student => {
      const assignedClass = classes.value.find(c => c.id === student.classId);
      const addedByUser = users.value.find(u => u.id === student.addedBy);
      return {
        ...student,
        className: assignedClass ? assignedClass.name : 'Unknown Class',
        addedByEmail: addedByUser ? (addedByUser.name || addedByUser.email) : 'Unknown User'
      };
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    message.value = `Failed to load students: ${error.message}`;
    messageType.value = 'danger';
  } finally {
    loading.value = false;
  }
};


onMounted(fetchAllInitialData); // Call the new initial data fetcher

const openAddStudentModal = () => {
  selectedStudent.value = null;
  showStudentModal.value = true;
};

const openEditStudentModal = (student) => {
  selectedStudent.value = { ...student };
  showStudentModal.value = true;
};

const closeStudentModal = () => {
  showStudentModal.value = false;
};

const handleStudentSaved = async (data) => {
  // After saving, re-fetch all data to ensure lists are up-to-date,
  // respecting the current filter.
  await fetchStudentsOnly();
  message.value = data.isNew ? 'Student added successfully!' : 'Student updated successfully!';
  messageType.value = 'success';
  closeStudentModal();
  setTimeout(() => message.value = null, 3000);
};

const deleteStudent = async (studentIdToDelete) => {
  if (!confirm('Are you sure you want to delete this student? This will also remove their attendance records.')) {
    return;
  }
  loading.value = true;
  message.value = null;
  try {
    // Delete student document
    await deleteDoc(doc(db, 'students', studentIdToDelete));

    // To properly remove attendance records related to this student,
    // you would typically use a Cloud Function triggered by student deletion.
    // Manually deleting all here could be very slow and hit read/write limits.
    // Example (not recommended for large scale without batching/functions):
    /*
    const attendanceQuery = query(collection(db, 'attendance'), where('studentId', '==', studentIdToDelete));
    const attendanceSnapshot = await getDocs(attendanceQuery);
    const deletePromises = [];
    attendanceSnapshot.forEach(attDoc => {
      deletePromises.push(deleteDoc(doc(db, 'attendance', attDoc.id)));
    });
    await Promise.all(deletePromises);
    */

    await fetchStudentsOnly(); // Re-fetch students with current filter
    message.value = 'Student deleted successfully!';
    messageType.value = 'success';
  } catch (error) {
    console.error('Error deleting student:', error);
    message.value = `Failed to delete student: ${error.message}`;
    messageType.value = 'danger';
  } finally {
    loading.value = false;
    setTimeout(() => message.value = null, 3000);
  }
};
</script>

<style lang="scss" scoped>
/* Common styles for both desktop table & mobile cards for consistent action button spacing */
.d-flex.flex-wrap.gap-2 {
  gap: 0.5rem; /* Standard Bootstrap gap for spacing buttons */
}

/* Specific styles for the mobile card view */
.student-card-mobile {
  border: 1px solid #e0e0e0;
}

.student-card-mobile .card-title {
  font-size: 1.25rem;
  margin-bottom: 0.75rem;
}

.student-card-mobile .card-text strong {
  display: inline-block;
  min-width: 90px; /* Align labels */
}

/* Responsive Table Styling (for Mobile: hiding table headers, showing data labels) */
/* These styles apply to the table structure, useful if you ever wanted a responsive table for some elements */
@media (max-width: 767.98px) {
  /* Hide table headers on small screens */
  table.table thead {
    display: none;
  }

  /* Make table rows behave like blocks */
  table.table tbody tr {
    display: block;
    margin-bottom: 1rem;
    border: 1px solid #dee2e6;
    border-radius: 0.25rem;
    box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  }

  /* Make table data cells behave like blocks */
  table.table tbody td {
    display: block;
    text-align: right !important;
    padding-left: 50%; /* Make space for the data label */
    position: relative;
    border: none; /* Remove cell borders within the "card" */
  }

  /* Use pseudo-elements for data labels on mobile */
  table.table tbody td::before {
    content: attr(data-label);
    position: absolute;
    left: 10px;
    width: calc(50% - 20px); /* Adjust width for label */
    padding-right: 10px;
    text-align: left;
    font-weight: bold;
    color: #495057;
  }

  /* Special handling for action buttons in the mobile table view if it were used */
  table.table tbody td[data-label="Actions"] {
    text-align: left !important; /* Override right-align for action buttons */
    padding-left: 10px; /* Reset padding for action column */
  }
}
</style>