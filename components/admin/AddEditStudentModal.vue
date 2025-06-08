<template>
  <div class="modal fade" :class="{ 'show d-block': show }" tabindex="-1" role="dialog" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title">{{ isEditMode ? 'Edit Student' : 'Add New Student' }}</h5>
          <button type="button" class="btn-close btn-close-white" @click="$emit('close')" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveStudent">
            <div class="mb-3">
              <label for="studentName" class="form-label">Student Name</label>
              <input type="text" class="form-control" id="studentName" v-model="form.name" required />
            </div>
            <div class="mb-3">
              <label for="studentEmail" class="form-label">Student Email (Optional)</label>
              <input type="email" class="form-control" id="studentEmail" v-model="form.email" placeholder="Optional" />
            </div>
            <div class="mb-3">
              <label for="studentClass" class="form-label">Assign Class</label>
              <select class="form-select" id="studentClass" v-model="form.classId" required>
                <option :value="null" disabled>Select a Class</option>
                <option v-for="cls in classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
              </select>
            </div>
            <div v-if="errorMessage" class="alert alert-danger mt-3">{{ errorMessage }}</div>
            <div class="d-flex justify-content-end">
              <button type="button" class="btn btn-secondary me-2" @click="$emit('close')">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span v-else>{{ isEditMode ? 'Save Changes' : 'Add Student' }}</span>
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

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  student: {
    type: Object,
    default: null,
  },
  classes: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'saved']);

const nuxtApp = useNuxtApp();
const auth = nuxtApp.$auth;
const db = nuxtApp.$db;

const form = ref({
  name: '',
  email: '',
  classId: null,
});
const loading = ref(false);
const errorMessage = ref(null);

const isEditMode = computed(() => !!props.student);

watch(() => props.student, (newStudent) => {
  if (newStudent) {
    form.value.name = newStudent.name || '';
    form.value.email = newStudent.email || '';
    form.value.classId = newStudent.classId || null;
  } else {
    form.value = {
      name: '',
      email: '',
      classId: null,
    };
  }
}, { immediate: true });

const saveStudent = async () => {
  loading.value = true;
  errorMessage.value = null;

  try {
    if (isEditMode.value) {
      // Edit Student
      await setDoc(doc(db, 'students', props.student.id), {
        name: form.value.name,
        email: form.value.email || null,
        classId: form.value.classId,
        updatedBy: auth.currentUser.uid, // Track who updated
        updatedAt: Timestamp.now(),
      }, { merge: true });
      emit('saved', { isNew: false });
    } else {
      // Add New Student
      await addDoc(collection(db, 'students'), {
        name: form.value.name,
        email: form.value.email || null,
        classId: form.value.classId,
        addedBy: auth.currentUser.uid,
        addedAt: Timestamp.now(),
      });
      emit('saved', { isNew: true });
    }
  } catch (error) {
    console.error('Error saving student:', error);
    errorMessage.value = `Failed to save student: ${error.message}`;
  } finally {
    loading.value = false;
  }
};

// Bootstrap modal functionality
watch(() => props.show, (newVal) => {
  if (process.client) {
    const modalElement = document.querySelector('.modal');
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
/* Specific styles for the modal */
.modal {
  background-color: rgba(0, 0, 0, 0.5);
}
</style>