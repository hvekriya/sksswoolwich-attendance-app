<template>
  <div class="modal fade" :class="{ 'show d-block': show }" tabindex="-1" role="dialog" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title">{{ isEditMode ? 'Edit Teacher' : 'Add New Teacher' }}</h5>
          <button type="button" class="btn-close btn-close-white" @click="$emit('close')" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveTeacher">
            <div class="mb-3">
              <label for="teacherName" class="form-label">Teacher Name</label>
              <input type="text" class="form-control" id="teacherName" v-model="form.name" required />
            </div>
            <div class="mb-3">
              <label for="teacherEmail" class="form-label">Teacher Email</label>
              <input type="email" class="form-control" id="teacherEmail" v-model="form.email" :disabled="isEditMode" required />
              <small v-if="isEditMode" class="form-text text-muted">Email cannot be changed after creation.</small>
            </div>
            <div class="mb-3" v-if="!isEditMode">
              <label for="teacherPassword" class="form-label">Password</label>
              <input type="password" class="form-control" id="teacherPassword" v-model="form.password" required minlength="6" />
              <small class="form-text text-muted">Minimum 6 characters for password.</small>
            </div>
            <div class="mb-3">
              <label for="assignedClass" class="form-label">Assign Class</label>
              <select class="form-select" id="assignedClass" v-model="form.classId" required>
                <option :value="null" disabled>Select a Class</option>
                <option v-for="cls in classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
              </select>
            </div>
            <div v-if="errorMessage" class="alert alert-danger mt-3">{{ errorMessage }}</div>
            <div class="d-flex justify-content-end">
              <button type="button" class="btn btn-secondary me-2" @click="$emit('close')">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span v-else>{{ isEditMode ? 'Save Changes' : 'Add Teacher' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
// NO LONGER NEED createUserWithEmailAndPassword here:
// import { createUserWithEmailAndPassword, updatePassword, updateEmail } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions'; // <--- NEW IMPORT

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  teacher: { // The teacher object for editing, or null for adding
    type: Object,
    default: null,
  },
  classes: { // List of available classes for dropdown
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'saved']);

const nuxtApp = useNuxtApp();
// auth is still needed for context, but not for direct user creation
const auth = nuxtApp.$auth;
const db = nuxtApp.$db;
// Initialize Cloud Functions client
const functions = getFunctions(nuxtApp.$firebaseApp); // Assuming you pass $firebaseApp from your plugin

const form = ref({
  name: '',
  email: '',
  password: '',
  classId: null,
});
const loading = ref(false);
const errorMessage = ref(null);

const isEditMode = computed(() => !!props.teacher);

// Watch for changes in props.teacher to populate the form
watch(() => props.teacher, (newTeacher) => {
  if (newTeacher) {
    form.value.name = newTeacher.name || '';
    form.value.email = newTeacher.email || '';
    form.value.classId = newTeacher.classId || null;
    form.value.password = ''; // Don't pre-fill password in edit mode
  } else {
    // Reset for add mode
    form.value = {
      name: '',
      email: '',
      password: '',
      classId: null,
    };
  }
}, { immediate: true });

const saveTeacher = async () => {
  loading.value = true;
  errorMessage.value = null;

  try {
    if (isEditMode.value) {
      // Edit Teacher (still client-side for Firestore document update)
      await setDoc(doc(db, 'users', props.teacher.id), {
        name: form.value.name,
        classId: form.value.classId,
      }, { merge: true });

      // Note: Updating email/password for an existing user via client-side SDK is complex
      // and best handled by a Cloud Function with Admin SDK for other users.

      emit('saved', { isNew: false });
    } else {
      // Add New Teacher using Cloud Function
      // You need to ensure your firebase.client.ts plugin exposes $firebaseApp:
      // nuxtApp.provide('firebaseApp', app); // The Firebase app instance itself
      // This is crucial for getFunctions(app) to work.

      const addTeacherCallable = httpsCallable(functions, 'addTeacher');
      const result = await addTeacherCallable({
        email: form.value.email,
        password: form.value.password,
        name: form.value.name,
        classId: form.value.classId,
      });

      console.log('Cloud Function Result:', result.data);
      if (result.data.success) {
        emit('saved', { isNew: true });
      } else {
        // If the function throws an HttpsError, result.data will contain its details
        throw new Error(result.data.message || 'Unknown error from Cloud Function.');
      }
    }
  } catch (error) {
    console.error('Error saving teacher:', error);
    // Cloud Function errors will be wrapped in an HttpsError.
    // The message will be in error.message, and details in error.details.
    errorMessage.value = `Failed to save teacher: ${error.message}`;
    // You might want to parse error.code for more specific messages if the Cloud Function returns them
  } finally {
    loading.value = false;
  }
};

// Bootstrap modal functionality - necessary for the 'fade' and 'show/hide'
watch(() => props.show, (newVal) => {
  if (process.client) {
    const modalElement = document.querySelector('.modal');
    if (modalElement) {
      if (newVal) {
        modalElement.classList.add('show', 'd-block');
        modalElement.setAttribute('aria-modal', 'true');
        modalElement.style.backgroundColor = 'rgba(0,0,0,0.5)'; // Add backdrop
        document.body.classList.add('modal-open');
      } else {
        modalElement.classList.remove('show', 'd-block');
        modalElement.removeAttribute('aria-modal');
        modalElement.style.backgroundColor = '';
        document.body.classList.remove('modal-open');
      }
    }
  }
});
</script>

<style scoped>
/* Specific styles for the modal if needed */
.modal {
  background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent backdrop */
}
</style>