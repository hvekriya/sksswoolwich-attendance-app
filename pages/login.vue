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
              <div class="mb-2"> <label for="password" class="form-label">Password</label>
                <input
                  type="password"
                  class="form-control"
                  id="password"
                  v-model="password"
                  required
                  autocomplete="current-password"
                />
              </div>
              <div class="text-end mb-4"> <a href="#" @click.prevent="openForgotPasswordModal" class="text-primary small">Forgot password?</a>
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

  <div class="modal fade" id="forgotPasswordModal" tabindex="-1" aria-labelledby="forgotPasswordModalLabel" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title" id="forgotPasswordModalLabel">Forgot Password</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <p>Enter your email address below, and we'll send you a link to reset your password.</p>
          <form @submit.prevent="sendResetEmail">
            <div class="mb-3">
              <label for="resetEmail" class="form-label">Email address</label>
              <input type="email" class="form-control" id="resetEmail" v-model="resetEmail" required>
            </div>
            <button type="submit" class="btn btn-primary w-100" :disabled="resetLoading">
              <span v-if="resetLoading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <span v-else>Send Reset Link</span>
            </button>
            <div v-if="resetMessage" :class="['alert mt-3 text-center', resetMessageType === 'success' ? 'alert-success' : 'alert-danger']">
              {{ resetMessage }}
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'auth',
});
import { ref, onMounted } from 'vue'; // Added onMounted
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth'; // Added sendPasswordResetEmail
import { doc, getDoc, setDoc } from 'firebase/firestore'; // Added setDoc for potential new Google user profile

const nuxtApp = useNuxtApp();
const auth = nuxtApp.$auth;
const db = nuxtApp.$db;
const router = useRouter();

const email = ref('');
const password = ref('');
const errorMessage = ref(null);
const loading = ref(false);

// Forgot Password specific refs
const resetEmail = ref('');
const resetMessage = ref(null);
const resetMessageType = ref('info'); // 'success' or 'danger'
const resetLoading = ref(false);

// Bootstrap Modal instance
let forgotPasswordModal = null;

onMounted(() => {
  // Initialize Bootstrap Modal after component is mounted
  // This requires Bootstrap's JS to be loaded globally or imported
  if (process.client) { // Ensure this runs only on the client-side
    // Check if Bootstrap is available
    if (typeof window.bootstrap !== 'undefined') {
      forgotPasswordModal = new window.bootstrap.Modal(document.getElementById('forgotPasswordModal'));
    } else {
      console.warn('Bootstrap JS not loaded. Forgot password modal may not function correctly.');
    }
  }
});


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

const signInWithGoogle = async () => {
  errorMessage.value = null;
  loading.value = true;
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

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
      await auth.signOut();
    }
  } else {
    // This scenario happens if a new Google user signs in and their profile
    // hasn't been provisioned in the 'users' Firestore collection yet.
    // For consistency, we'll inform the user to contact support for account setup.
    errorMessage.value = 'Your profile was not found. Please contact support to set up your account.';
    await auth.signOut();
  }
};

// --- Forgot Password Functions ---
const openForgotPasswordModal = () => {
  resetEmail.value = email.value; // Pre-fill with the email from the login form
  resetMessage.value = null; // Clear previous messages
  resetMessageType.value = 'info';
  if (forgotPasswordModal) {
    forgotPasswordModal.show();
  }
};

const sendResetEmail = async () => {
  resetLoading.value = true;
  resetMessage.value = null;
  resetMessageType.value = 'info';
  try {
    await sendPasswordResetEmail(auth, resetEmail.value);
    resetMessage.value = `A password reset link has been sent to ${resetEmail.value}. Please check your inbox.`;
    resetMessageType.value = 'success';
    // Optionally, hide the modal after a short delay
    setTimeout(() => {
      if (forgotPasswordModal) forgotPasswordModal.hide();
    }, 3000);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    let msg = 'Failed to send password reset email. ';
    switch (error.code) {
      case 'auth/invalid-email':
        msg += 'Please enter a valid email address.';
        break;
      case 'auth/user-not-found':
        msg += 'No user found with that email address.';
        break;
      case 'auth/missing-email':
        msg += 'Please enter your email address.';
        break;
      default:
        msg += error.message;
    }
    resetMessage.value = msg;
    resetMessageType.value = 'danger';
  } finally {
    resetLoading.value = false;
  }
};
</script>

<style scoped>
/* Add any specific styles for the login form if needed */
.card-header {
  border-bottom: none;
}
/* Style for the 'OR' separator */
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
  width: 45%;
  height: 1px;
  background: #e9ecef;
}
.text-center.my-3::before {
  left: 0;
}
.text-center.my-3::after {
  right: 0;
}
</style>