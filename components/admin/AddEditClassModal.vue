<template>
  <div class="modal fade" :class="{ 'show d-block': show }" tabindex="-1" role="dialog" aria-hidden="true" id="classModal">
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
              <label class="form-label">Assign Teachers</label>
              <div class="teacher-checkbox-group">
                <div class="form-check" v-for="teacher in teachers" :key="teacher.id">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :id="'teacher_' + teacher.id"
                    :value="teacher.id"
                    v-model="form.teacherIds"
                  />
                  <label class="form-check-label" :for="'teacher_' + teacher.id">
                    {{ teacher.name }} ({{ teacher.email ? teacher.email : 'Admin' }})
                  </label>
                </div>
                <p v-if="teachers.length === 0" class="text-muted small mt-2">No teachers available. Please add teachers first.</p>
              </div>
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
import { doc, setDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { useNuxtApp } from '#app';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  classItem: {
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
const auth = nuxtApp.$auth;

const form = ref({
  name: '',
  teacherIds: [],
});
const loading = ref(false);
const errorMessage = ref(null);

const isEditMode = computed(() => !!props.classItem);

watch(() => props.classItem, (newClassItem) => {
  if (newClassItem) {
    form.value.name = newClassItem.name || '';
    // Ensure teacherIds is an array, even if it comes in as null or undefined
    form.value.teacherIds = newClassItem.teacherIds ? [...newClassItem.teacherIds] : [];
  } else {
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
      const classDocRef = doc(db, 'classes', props.classItem.id);
      await setDoc(classDocRef, {
        name: form.value.name,
        teacherIds: form.value.teacherIds || [],
        updatedAt: Timestamp.now(),
      }, { merge: true });

      emit('saved', { isNew: false });
    } else {
      await addDoc(collection(db, 'classes'), {
        name: form.value.name,
        teacherIds: form.value.teacherIds || [],
        createdAt: Timestamp.now(),
        createdBy: auth.currentUser.uid,
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

watch(() => props.show, (newVal) => {
  if (process.client) {
    const modalElement = document.getElementById('classModal');
    if (modalElement) {
      if (newVal) {
        modalElement.classList.add('show', 'd-block');
        modalElement.setAttribute('aria-modal', 'true');
        modalElement.style.backgroundColor = 'rgba(0,0,0,0.5)';
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
.modal {
  background-color: rgba(0, 0, 0, 0.5);
}

.teacher-checkbox-group {
  max-height: 200px; /* Optional: Add a max-height and scroll if many teachers */
  overflow-y: auto; /* Enable scrolling if max-height is hit */
  border: 1px solid #dee2e6; /* Optional: Add a border */
  padding: 10px;
  border-radius: 0.25rem;
}

.form-check {
  margin-bottom: 0.5rem; /* Spacing between checkboxes */
}
</style>