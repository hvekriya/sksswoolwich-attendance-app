<!-- pages/teacher/add-student.vue -->
<template>
  <div class="container mt-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Add New Student to <span class="text-primary">{{ className }}</span></h2>
      <NuxtLink to="/teacher" class="btn btn-secondary">
        <i class="bi bi-arrow-left me-2"></i>Back to My Class
      </NuxtLink>
    </div>

    <div class="card shadow-sm p-4">
      <form @submit.prevent="addStudent">
        <div class="mb-3">
          <label for="studentName" class="form-label">Student Name</label>
          <input
            type="text"
            class="form-control"
            id="studentName"
            v-model="studentName"
            required
            placeholder="e.g., John Doe"
          />
        </div>
        <div class="mb-3">
          <label for="studentEmail" class="form-label">Student Email (Optional)</label>
          <input
            type="email"
            class="form-control"
            id="studentEmail"
            v-model="studentEmail"
            placeholder="e.g., student@example.com"
          />
          <small class="form-text text-muted">Email is optional but can be useful for future features.</small>
        </div>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          <span v-else>Add Student</span>
        </button>

        <div v-if="message" :class="['alert mt-4', messageType === 'success' ? 'alert-success' : 'alert-danger']" role="alert">
          {{ message }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, addDoc, Timestamp } from 'firebase/firestore'; // Import Timestamp

definePageMeta({
  middleware: ['auth', 'teacher'], // Assuming a 'teacher' middleware exists for role check
});

const nuxtApp = useNuxtApp();
const auth = nuxtApp.$auth;
const db = nuxtApp.$db;
const router = useRouter();

const studentName = ref('');
const studentEmail = ref('');
const className = ref('Loading...');
const teacherClassId = ref(null);
const loading = ref(false);
const message = ref(null);
const messageType = ref(null);

onMounted(async () => {
  const user = await new Promise(resolve => {
    const unsubscribe = auth.onAuthStateChanged(firebaseUser => {
      unsubscribe();
      resolve(firebaseUser);
    });
  });

  if (user) {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists() && userDoc.data()?.role === 'teacher') {
        teacherClassId.value = userDoc.data().classId;
        if (teacherClassId.value) {
          const classDoc = await getDoc(doc(db, 'classes', teacherClassId.value));
          if (classDoc.exists()) {
            className.value = classDoc.data().name;
          } else {
            className.value = 'Class not found';
            console.warn(`Class with ID ${teacherClassId.value} not found for teacher.`);
          }
        } else {
          console.warn('Teacher is not assigned to a class.');
          className.value = 'No Class Assigned';
        }
      } else {
        router.push('/'); // Not a teacher or user data missing
      }
    } catch (error) {
      console.error('Error fetching teacher class info:', error);
      message.value = 'Failed to load class information. Please try again.';
      messageType.value = 'danger';
    }
  } else {
    router.push('/login'); // Not logged in
  }
});

const addStudent = async () => {
  loading.value = true;
  message.value = null;

  if (!teacherClassId.value) {
    message.value = 'Your class is not assigned. Cannot add student.';
    messageType.value = 'danger';
    loading.value = false;
    return;
  }

  try {
    // *** CRITICAL CHANGE: Add to 'users' collection with role 'student' ***
    await addDoc(collection(db, 'students'), { // Changed from 'students' to 'users'
      name: studentName.value,
      email: studentEmail.value || null,
      classId: teacherClassId.value,
      addedBy: auth.currentUser.uid,
      addedAt: Timestamp.now(),
    });

    message.value = 'Student added successfully!';
    messageType.value = 'success';
    studentName.value = ''; // Clear form
    studentEmail.value = '';
  } catch (error) {
    console.error('Error adding student:', error);
    message.value = `Failed to add student: ${error.message}`;
    messageType.value = 'danger';
  } finally {
    loading.value = false;
    setTimeout(() => message.value = null, 3000); // Clear message after 3 seconds
  }
};
</script>

<style scoped>
/* Add any specific styles for this page */
</style>