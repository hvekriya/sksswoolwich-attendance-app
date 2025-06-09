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
            </form>

            <div class="text-center my-3">OR</div>

            <button @click="signInWithGoogle" class="btn btn-outline-primary w-100 py-2" :disabled="loading">
              <i class="bi bi-google me-2"></i> Sign in with Google
            </button>

            <div v-if="errorMessage" class="alert alert-danger mt-4 text-center" role="alert">
              {{ errorMessage }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'; // Added Google Auth imports
import { doc, getDoc } from 'firebase/firestore';

// Access Firebase services
const nuxtApp = useNuxtApp();
const auth = nuxtApp.$auth;
const db = nuxtApp.$db;
const router = useRouter();

const email = ref('');
const password = ref('');
const errorMessage = ref(null);
const loading = ref(false); // Controls loading state for both email/password and Google login

// Function to handle email/password login
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

    // Check user's role in Firestore and redirect
    await checkUserRoleAndRedirect(user);

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

// Function to handle Google Sign-in
const signInWithGoogle = async () => {
  errorMessage.value = null;
  loading.value = true;
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check user's role in Firestore and redirect
    await checkUserRoleAndRedirect(user);

  } catch (err) {
    console.error('Google Sign-in error:', err);
    switch (err.code) {
      case 'auth/popup-closed-by-user':
        errorMessage.value = 'Google sign-in was cancelled.';
        break;
      case 'auth/cancelled-popup-request':
        errorMessage.value = 'You already have a Google sign-in attempt in progress.';
        break;
      case 'auth/account-exists-with-different-credential':
        errorMessage.value = 'An account with this email already exists. Please sign in with your original method.';
        break;
      default:
        errorMessage.value = `Error signing in with Google: ${err.message}`;
    }
  } finally {
    loading.value = false;
  }
};

// Helper function to check user role and redirect
const checkUserRoleAndRedirect = async (user) => {
  const userDocRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);

  if (userDoc.exists()) {
    const userData = userDoc.data();
    if (userData.role === 'admin') {
      router.push('/admin');
    } else if (userData.role === 'teacher') {
      router.push('/teacher');
    } else if (userData.role === 'student') {
      router.push('/student-dashboard'); // Or your generic student dashboard path
    }
    else {
      errorMessage.value = 'Your account has an unrecognized role. Please contact support.';
      await auth.signOut(); // Sign out the user if role is unrecognized
    }
  } else {
    // This scenario happens if a new Google user signs in and their profile
    // hasn't been provisioned in the 'users' Firestore collection yet.
    // You have two main options here:
    // 1. Automatically create a basic user profile with a default role (e.g., 'student').
    //    (Often done via a Firebase Cloud Function onCreate trigger for robustness).
    // 2. Inform the user to contact support for account setup.
    // For consistency with your existing error handling, we'll go with option 2 for now.
    errorMessage.value = 'Your profile was not found. Please contact support to set up your account.';
    await auth.signOut(); // Sign out the user until their profile is set up
  }
};

// Define page meta for layout
definePageMeta({
  layout: 'auth', // This tells Nuxt to use layouts/auth.vue for this page
});
</script>

<style scoped>
.card-header {
  border-bottom: none;
}
/* Optional: Style for the 'OR' separator */
.text-center.my-3 {
  font-size: 0.9rem;
  color: #6c757d;
  position: relative;
  overflow: hidden;
}
.text-center.my-3::before,
.text-center.my-3::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 45%; /* Adjust width as needed */
  height: 1px;
  background: #e9ecef; /* Light gray line */
}
.text-center.my-3::before {
  left: 0;
}
.text-center.my-3::after {
  right: 0;
}
</style>