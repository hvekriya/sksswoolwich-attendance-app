<template>
  <div class="container mt-4">
    <div class="d-flex flex-column flex-md-row justify-content-md-between align-items-md-center mb-4"> 
      <h2 class="mb-2 mb-md-0">Manage Teachers</h2>
      <button class="btn btn-primary" @click="openAddTeacherModal">
        <i class="bi bi-person-plus-fill me-2"></i>Add New Teacher
      </button>
    </div>

    <div v-if="message" :class="['alert mt-4', messageType === 'success' ? 'alert-success' : 'alert-danger']" role="alert">
      {{ message }}
    </div>

    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading teachers...</span>
      </div>
      <p class="mt-2">Loading teachers...</p>
    </div>

    <div v-if="!loading && teachers.length === 0" class="alert alert-info text-center mt-5">
      No teachers found. Click "Add New Teacher" to get started.
    </div>

    <div v-if="!loading && teachers.length > 0" class="table-responsive">
      <table class="table table-hover table-striped align-middle">
        <thead class="table-dark">
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Assigned Class</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="teacher in teachers" :key="teacher.id">
            <td data-label="Name">{{ teacher.name }}</td>
            <td data-label="Email">{{ teacher.email }}</td>
            <td data-label="Class name">{{ teacher.className || 'N/A' }}</td>
            <td data-label="Actions">
              <button class="btn btn-sm btn-info me-2" @click="openEditTeacherModal(teacher)">
                <i class="bi bi-pencil-fill"></i> Edit
              </button>
              <button class="btn btn-sm btn-danger" @click="deleteTeacher(teacher.id)">
                <i class="bi bi-trash-fill"></i> Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AddEditTeacherModal
      :show="showTeacherModal"
      :teacher="selectedTeacher"
      :classes="classes"
      @close="closeTeacherModal"
      @saved="handleTeacherSaved"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updatePassword, updateEmail, deleteUser, signOut } from 'firebase/auth'; // For auth actions

import AddEditTeacherModal from '~/components/admin/AddEditTeacherModal.vue';

definePageMeta({
  middleware: ['auth', 'admin'],
});

const nuxtApp = useNuxtApp();
const auth = nuxtApp.$auth;
const db = nuxtApp.$db;

const teachers = ref([]);
const classes = ref([]); // To populate class dropdown in modal
const loading = ref(true);
const message = ref(null);
const messageType = ref(null);

const showTeacherModal = ref(false);
const selectedTeacher = ref(null); // For editing, holds the teacher object

const fetchTeachersAndClasses = async () => {
  loading.value = true;
  teachers.value = [];
  classes.value = [];
  try {
    // Fetch all classes first
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    classes.value = classesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fetch all users with role 'teacher'
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const querySnapshot = await getDocs(q);
    const fetchedTeachers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Enhance teacher data with class names
    teachers.value = fetchedTeachers.map(teacher => {
      const assignedClass = classes.value.find(c => c.id === teacher.classId);
      return {
        ...teacher,
        className: assignedClass ? assignedClass.name : 'Unassigned'
      };
    });
  } catch (error) {
    console.error('Error fetching teachers or classes:', error);
    message.value = `Failed to load data: ${error.message}`;
    messageType.value = 'danger';
  } finally {
    loading.value = false;
  }
};

onMounted(fetchTeachersAndClasses);

const openAddTeacherModal = () => {
  selectedTeacher.value = null; // Clear selection for add mode
  showTeacherModal.value = true;
};

const openEditTeacherModal = (teacher) => {
  selectedTeacher.value = { ...teacher }; // Pass a copy to avoid direct mutation
  showTeacherModal.value = true;
};

const closeTeacherModal = () => {
  showTeacherModal.value = false;
};

const handleTeacherSaved = async (data) => {
  // This event is emitted from the modal when a teacher is added/edited
  await fetchTeachersAndClasses(); // Re-fetch data to update table
  message.value = data.isNew ? 'Teacher added successfully!' : 'Teacher updated successfully!';
  messageType.value = 'success';
  closeTeacherModal();
  setTimeout(() => message.value = null, 3000);
};

const deleteTeacher = async (teacherIdToDelete) => {
  if (!confirm('Are you sure you want to delete this teacher? This action is irreversible.')) {
    return;
  }
  loading.value = true;
  message.value = null;
  try {
    // 1. Delete user from Firebase Authentication
    // IMPORTANT: This requires a Firebase Cloud Function for security,
    // or the admin SDK if running on a server.
    // Client-side deleteUser only works for the currently logged-in user.
    // For now, I'll simulate or add a placeholder comment.
    // A robust solution needs a Cloud Function called by the Admin.
    // Example: firebase functions: `admin.auth().deleteUser(teacherIdToDelete)`

    // Placeholder for actual deletion logic (requires Cloud Function)
    // await someCloudFunction.deleteUser({ uid: teacherIdToDelete });
    console.warn(`Simulating Auth user deletion for ${teacherIdToDelete}. A Cloud Function is recommended for secure deletion.`);
    // If the teacher being deleted is the currently logged-in admin,
    // you'll get an error, or the admin will be logged out.
    // Ensure you're not deleting the active admin account.

    // 2. Delete teacher document from Firestore
    await deleteDoc(doc(db, 'users', teacherIdToDelete));

    // Optional: Remove classId from 'classes' if this was the only teacher for that class,
    // or handle student reassignment. This gets complex quickly.

    await fetchTeachersAndClasses(); // Refresh data
    message.value = 'Teacher deleted successfully!';
    messageType.value = 'success';
  } catch (error) {
    console.error('Error deleting teacher:', error);
    message.value = `Failed to delete teacher: ${error.message}`;
    messageType.value = 'danger';
  } finally {
    loading.value = false;
    setTimeout(() => message.value = null, 3000);
  }
};
</script>

<style scoped>
/* Specific styles for manage teachers page */
</style>