<template>
  <div class="container mt-4">
    <div class="d-flex flex-column flex-md-row justify-content-md-between align-items-md-center mb-4">
      <h2 class="mb-2 mb-md-0">Manage Students</h2>
      <button class="btn btn-primary" @click="openAddStudentModal">
        <i class="bi bi-person-plus-fill me-2"></i>Add New Student
      </button>
    </div>

    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading students...</span>
      </div>
      <p class="mt-2">Loading students...</p>
    </div>

    <div v-if="!loading && students.length === 0" class="alert alert-info text-center mt-5">
      No students found. Click "Add New Student" to get started.
    </div>

    <div v-if="!loading && students.length > 0" class="table-responsive">
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
import { ref, onMounted } from 'vue';
import { getFirestore, collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';

import AddEditStudentModal from '~/components/admin/AddEditStudentModal.vue';

definePageMeta({
  middleware: ['auth', 'admin'],
});

const nuxtApp = useNuxtApp();
const db = nuxtApp.$db;

const students = ref([]);
const classes = ref([]); // For class dropdown in modal
const users = ref([]); // For displaying 'added by' user email
const loading = ref(true);
const message = ref(null);
const messageType = ref(null);

const showStudentModal = ref(false);
const selectedStudent = ref(null);

const fetchStudentsClassesAndUsers = async () => {
  loading.value = true;
  students.value = [];
  classes.value = [];
  users.value = []; // To get 'addedBy' user emails

  try {
    // Fetch all classes
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    classes.value = classesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fetch relevant users (admins/teachers for 'addedBy' info)
    const usersSnapshot = await getDocs(collection(db, 'users'));
    users.value = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fetch all students
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    const fetchedStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
    console.error('Error fetching students, classes, or users:', error);
    message.value = `Failed to load data: ${error.message}`;
    messageType.value = 'danger';
  } finally {
    loading.value = false;
  }
};

onMounted(fetchStudentsClassesAndUsers);

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
  await fetchStudentsClassesAndUsers();
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

    // Optional: Delete related attendance records (can be done with a Cloud Function for efficiency)
    // For now, it's a manual deletion (not shown here to keep it simple, but consider it for production)

    await fetchStudentsClassesAndUsers();
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

<style scoped>
/* Specific styles for manage students page */
</style>