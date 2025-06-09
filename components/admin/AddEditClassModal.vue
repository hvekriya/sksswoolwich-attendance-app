<template>
  <div class="modal fade" :class="{ 'show d-block': show }" tabindex="-1" role="dialog" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title">{{ isEditMode ? 'Edit Class' : 'Create New Class' }}</h5>
          <button type="button" class="btn-close btn-close-white" @click="$emit('close')" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveClass">
            <div class="mb-3">
              <label for="className" class="form-label">Class Name</label>
              <input type="text" class="form-control" id="className" v-model="form.name" required />
            </div>
            <div class="mb-3">
              <label for="assignedTeachers" class="form-label">Assign Teachers</label>
              <select multiple class="form-select" id="assignedTeachers" v-model="form.teacherIds">
                <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">
                  {{ teacher.name }} ({{ teacher.email }})
                </option>
              </select>
              <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple teachers.</small>
            </div>
            <div v-if="errorMessage" class="alert alert-danger mt-3">{{ errorMessage }}</div>
            <div class="d-flex justify-content-end">
              <button type="button" class="btn btn-secondary me-2" @click="$emit('close')">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span v-else>{{ isEditMode ? 'Save Changes' : 'Create Class' }}</span>
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
import { doc, setDoc, addDoc, Timestamp } from 'firebase/firestore'; // Changed from setDoc to addDoc/setDoc
import { useNuxtApp } from '#app';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  classItem: { // Renamed from 'teacher' to 'classItem' for clarity
    type: Object,
    default: null,
  },
  teachers: { // List of available teachers for dropdown
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'saved']);

const nuxtApp = useNuxtApp();
const db = nuxtApp.$db;
const auth = nuxtApp.$auth; // Needed for current user's UID (createdBy)

const form = ref({
  name: '',
  teacherIds: [], // This will be an array of teacher UIDs
});
const loading = ref(false);
const errorMessage = ref(null);

const isEditMode = computed(() => !!props.classItem);

// Watch for changes in props.classItem to populate the form
watch(() => props.classItem, (newClassItem) => {
  if (newClassItem) {
    form.value.name = newClassItem.name || '';
    form.value.teacherIds = newClassItem.teacherIds || [];
  } else {
    // Reset for create mode
    form.value = {
      name: '',
      teacherIds: [],
    };
  }
}, { immediate: true });

const saveClass = async () => {
  loading.value = true;
  errorMessage.value = null;

  if (!form.value.name) {
    errorMessage.value = 'Class name is required.';
    loading.value = false;
    return;
  }

  try {
    if (isEditMode.value) {
      // Edit existing class
      const classDocRef = doc(db, 'classes', props.classItem.id);
      await setDoc(classDocRef, {
        name: form.value.name,
        teacherIds: form.value.teacherIds || [], // Ensure it's an array, even if empty
        updatedAt: Timestamp.now(), // Add an update timestamp
      }, { merge: true }); // Use merge to only update specified fields

      emit('saved', { isNew: false });
    } else {
      // Create new class
      await addDoc(collection(db, 'classes'), {
        name: form.value.name,
        teacherIds: form.value.teacherIds || [], // Ensure it's an array
        createdAt: Timestamp.now(),
        createdBy: auth.currentUser.uid, // Record who created the class
      });
      emit('saved', { isNew: true });
    }
  } catch (error) {
    console.error('Error saving class:', error);
    errorMessage.value = `Failed to save class: ${error.message}`;
  } finally {
    loading.value = false;
  }
};

// Bootstrap modal functionality - necessary for the 'fade' and 'show/hide'
watch(() => props.show, (newVal) => {
  if (process.client) {
    // Select based on a more specific class or ID if you have multiple modals
    // For now, assuming this is the only modal for simpler setup.
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