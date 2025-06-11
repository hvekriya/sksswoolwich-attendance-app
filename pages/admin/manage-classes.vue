<template>
  <div class="container mt-4">
    <div class="d-flex flex-column flex-md-row justify-content-md-between align-items-md-center mb-4">
      <h2 class="mb-2 mb-md-0">Manage Classes</h2>
      <button class="btn btn-primary" @click="openAddClassModal">
        <i class="bi bi-plus-circle-fill me-2"></i>Create New Class
      </button>
    </div>

    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading classes...</span>
      </div>
      <p class="mt-2">Loading classes...</p>
    </div>
    <div v-else-if="classes.length === 0" class="alert alert-info text-center mt-5">
      No classes found. Click "Create New Class" to add one.
    </div>
    <div v-else class="table-responsive">
      <table class="table table-striped table-hover align-middle">
        <thead class="table-dark">
          <tr>
            <th>Class Name</th>
            <th>Assigned Teachers</th>
            <th>Created By</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cls in classes" :key="cls.id">
            <td data-label="Name">{{ cls.name }}</td>
            <td data-label="Teachers">
              <span v-if="cls.teacherNames && cls.teacherNames.length">
                {{ cls.teacherNames.join(', ') }}
              </span>
              <span v-else class="text-muted">No teachers assigned</span>
            </td>
            <td data-label="Created by">{{ cls.createdByUserEmail || 'N/A' }}</td>
            <td data-label="Created on">{{ formatDate(cls.createdAt) }}</td>
            <td data-label="Actions">
              <div class="d-flex flex-wrap gap-2"> <NuxtLink :to="`/admin/classes/${cls.id}/attendance`" class="btn btn-sm btn-success" title="Record Attendance">
                  <i class="bi bi-calendar-check-fill me-1"></i> Attendance
                </NuxtLink>
                <button class="btn btn-sm btn-info" @click="openEditClassModal(cls)" title="Edit Class">
                  <i class="bi bi-pencil-fill me-1"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger" @click="deleteClassConfirmation(cls)" title="Delete Class">
                  <i class="bi bi-trash-fill me-1"></i> Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="message" :class="['alert mt-4', messageType === 'success' ? 'alert-success' : 'alert-danger']" role="alert">
      {{ message }}
    </div>

    <AddEditClassModal
      :show="showClassModal"
      :class-item="selectedClass"
      :teachers="teachers"
      @close="closeClassModal"
      @saved="handleClassSaved"
    />

    <div class="modal fade" :class="{ 'show d-block': showDeleteConfirmModal }" tabindex="-1" aria-labelledby="deleteClassModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title" id="deleteClassModalLabel">Confirm Deletion</h5>
            <button type="button" class="btn-close btn-close-white" @click="closeDeleteConfirmModal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            Are you sure you want to delete class **{{ classToDelete?.name }}**? This action cannot be undone.
            <div v-if="deleteError" class="alert alert-danger mt-3">{{ deleteError }}</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeDeleteConfirmModal">Cancel</button>
            <button type="button" class="btn btn-danger" @click="deleteClass" :disabled="deletingClass">
              <span v-if="deletingClass" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              {{ deletingClass ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showDeleteConfirmModal" class="modal-backdrop fade show"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getFirestore, collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import AddEditClassModal from '~/components/admin/AddEditClassModal.vue';

definePageMeta({
  middleware: ['auth', 'admin'],
});

const nuxtApp = useNuxtApp();
const db = nuxtApp.$db;

// --- Reactive State ---
const classes = ref([]);
const teachers = ref([]); // To populate the teacher selection dropdowns in the modal
const users = ref([]); // To get 'created by' user emails (admins)
const loading = ref(true); // For initial page load
const message = ref(null); // General success/error messages for the page
const messageType = ref(null);

// Modal state for AddEditClassModal
const showClassModal = ref(false);
const selectedClass = ref(null); // Holds the class being edited, or null for new

// Delete Confirmation Modal State
const showDeleteConfirmModal = ref(false);
const classToDelete = ref(null); // Holds the class to be deleted
const deletingClass = ref(false);
const deleteError = ref('');

// --- Helper Functions ---
const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  // Firestore timestamps are objects, convert to JS Date
  const date = timestamp.toDate();
  return date.toLocaleString(); // Or format as desired
};

const showPageMessage = (msg, type = 'success') => {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => message.value = null, 3000); // Clear message after 3 seconds
};

// --- Data Fetching ---
const fetchClassesAndUsers = async () => {
  loading.value = true;
  classes.value = []; // Clear previous data
  teachers.value = [];
  users.value = [];

  try {
    // Fetch all users (admins and teachers) to resolve 'created by' and 'assigned teachers' names
    const usersSnapshot = await getDocs(collection(db, 'users'));
    users.value = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Separate teachers for the modal's dropdown
    teachers.value = users.value.filter(u => u.role === 'teacher');

    // Fetch all classes
    const classesCollection = collection(db, 'classes');
    const querySnapshot = await getDocs(classesCollection);
    const fetchedClasses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Create maps for quick lookup of names
    const allUsersMap = users.value.reduce((map, user) => {
      map[user.id] = user.name || user.email; // Use name if available, else email
      return map;
    }, {});
    const teachersMap = teachers.value.reduce((map, teacher) => {
      map[teacher.id] = teacher.name || teacher.email;
      return map;
    }, {});

    // Enhance classes with teacher names and created by user email for display
    classes.value = fetchedClasses.map(cls => ({
      ...cls,
      teacherNames: cls.teacherIds?.map(id => teachersMap[id]).filter(Boolean) || [],
      createdByUserEmail: allUsersMap[cls.createdBy] || 'Unknown User', // Resolve createdBy UID to name/email
    }));

  } catch (error) {
    console.error('Error fetching classes, teachers, or users:', error);
    showPageMessage(`Error loading data: ${error.message}`, 'danger');
  } finally {
    loading.value = false;
  }
};

// --- Modal Controls for AddEditClassModal ---
const openAddClassModal = () => {
  selectedClass.value = null; // Important: null means add mode
  showClassModal.value = true;
};

const openEditClassModal = (cls) => {
  selectedClass.value = { ...cls }; // Pass a copy for editing
  showClassModal.value = true;
};

const closeClassModal = () => {
  showClassModal.value = false;
};

const handleClassSaved = async (data) => {
  await fetchClassesAndUsers(); // Re-fetch all data to update the table
  showPageMessage(data.isNew ? 'Class created successfully!' : 'Class updated successfully!', 'success');
  closeClassModal(); // Close the modal
};

// --- Delete Operation ---
const deleteClassConfirmation = (cls) => {
  classToDelete.value = cls;
  deleteError.value = ''; // Reset error
  showDeleteConfirmModal.value = true;
};

const closeDeleteConfirmModal = () => {
  showDeleteConfirmModal.value = false;
  classToDelete.value = null;
};

const deleteClass = async () => {
  deleteError.value = '';
  if (!classToDelete.value?.id) {
    deleteError.value = 'No class selected for deletion.';
    return;
  }
  deletingClass.value = true;
  try {
    // Delete class document
    await deleteDoc(doc(db, 'classes', classToDelete.value.id));

    // FUTURE CONSIDERATION: Implement Cloud Function to clean up related data (e.g., students in this class, attendance records)
    // For now, students assigned to this class will show 'Unknown Class' if not updated/deleted.

    showPageMessage(`Class '${classToDelete.value.name}' deleted successfully!`, 'success');
    closeDeleteConfirmModal();
    await fetchClassesAndUsers(); // Refresh the list
  } catch (error) {
    console.error('Error deleting class:', error);
    deleteError.value = `Error: ${error.message}`;
    showPageMessage(`Failed to delete class: ${error.message}`, 'danger');
  } finally {
    deletingClass.value = false;
  }
};

// --- Lifecycle Hooks ---
onMounted(fetchClassesAndUsers);
</script>

<style scoped>
/* Specific styles for manage classes page */
.modal.show {
  display: block;
}
.modal-backdrop.show {
  opacity: 0.5;
}
.d-flex.flex-wrap.gap-2 { /* Added for the action buttons layout */
  gap: 0.5rem; /* Standard Bootstrap gap for spacing */
}
</style>