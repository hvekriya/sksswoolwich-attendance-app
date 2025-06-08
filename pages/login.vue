<template>
  <div class="container mt-5">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-4">
        <div class="card shadow-lg card-custom-shadow">
          <div class="card-header bg-primary text-white text-center py-3">
            <h4 class="mb-0">Login</h4>
          </div>
          <div class="card-body p-4">
            <form @submit.prevent="handleLogin">
              <div class="mb-3">
                <label for="email" class="form-label">Email address</label>
                <input
                  type="email"
                  class="form-control"
                  id="email"
                  v-model="email"
                  required
                  autocomplete="username"
                />
              </div>
              <div class="mb-4">
                <label for="password" class="form-label">Password</label>
                <input
                  type="password"
                  class="form-control"
                  id="password"
                  v-model="password"
                  required
                  autocomplete="current-password"
                />
              </div>
              <button type="submit" class="btn btn-primary w-100 py-2" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span v-else>Login</span>
              </button>
              <div v-if="errorMessage" class="alert alert-danger mt-4 text-center" role="alert">
                {{ errorMessage }}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>

definePageMeta({
  layout: 'auth', // This tells Nuxt to use layouts/auth.vue for this page
});
import { ref } from 'vue';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Access Firebase services
const nuxtApp = useNuxtApp();
const auth = nuxtApp.$auth;
const db = nuxtApp.$db;
const router = useRouter();

const email = ref('');
const password = ref('');
const errorMessage = ref(null);
const loading = ref(false);

const handleLogin = async () => {
  errorMessage.value = null;
  loading.value = true;
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );
    const user = userCredential.user;

    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.role === 'admin') {
        router.push('/admin');
      } else if (userData.role === 'teacher') {
        router.push('/teacher');
      } else {
        errorMessage.value = 'Your account has an unrecognized role. Please contact support.';
        await auth.signOut();
      }
    } else {
      errorMessage.value = 'User profile not found. Please contact support.';
      await auth.signOut();
    }
  } catch (error) {
    console.error('Login error:', error);
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        errorMessage.value = 'Invalid email or password.';
        break;
      case 'auth/too-many-requests':
        errorMessage.value = 'Too many login attempts. Please try again later.';
        break;
      default:
        errorMessage.value = 'An unexpected error occurred. Please try again.';
    }
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
/* Add any specific styles for the login form if needed */
.card-header {
  border-bottom: none;
}
</style>