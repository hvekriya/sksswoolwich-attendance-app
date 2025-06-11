<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary fixed-top shadow-sm">
    <div class="container">
      <NuxtLink class="navbar-brand" to="/">
            <img src="/calendar-app-icon-white.png" alt="Calendar App Icon" style="width: 20px;">
        Satsang class attendance
      </NuxtLink>
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarNav"
        aria-controls="navbarNav"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <NuxtLink class="nav-link" to="/">Home</NuxtLink>
          </li>

          <li class="nav-item" v-if="userRole === 'teacher'">
            <NuxtLink class="nav-link" to="/teacher">My Class</NuxtLink>
          </li>
          <li class="nav-item" v-if="userRole === 'teacher'">
            <NuxtLink class="nav-link" to="/teacher/add-student">Add Student</NuxtLink>
          </li>
        </ul>

        <ul class="navbar-nav">
          <li class="nav-item" v-if="!currentUser">
            <NuxtLink class="btn btn-outline-light" to="/login">Login</NuxtLink>
          </li>
          <li class="nav-item dropdown" v-if="currentUser">
            <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
              <i class="bi bi-person-circle me-2"></i>{{ currentUserName || currentUser.email }}
            </a>
            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
              <li><span class="dropdown-item-text text-muted small">Role: {{ userRole || 'Unknown' }}</span></li>
              <li><hr class="dropdown-divider"></li>
              <li>
                <NuxtLink class="dropdown-item" to="/profile">
                  <i class="bi bi-person-gear me-2"></i>Edit Profile
                </NuxtLink>
              </li>
              <li><hr class="dropdown-divider"></li>
              <li><button class="dropdown-item" @click="handleLogout"><i class="bi bi-box-arrow-right me-2"></i>Logout</button></li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const nuxtApp = useNuxtApp();
const auth = nuxtApp.$auth;
const db = nuxtApp.$db;
const router = useRouter();

const currentUser = ref(null);
const userRole = ref(null);
const currentUserName = ref('Loading...');

onMounted(() => {
  onAuthStateChanged(auth, async (firebaseUser) => {
    currentUser.value = firebaseUser;
    userRole.value = null; // Reset role
    currentUserName.value = firebaseUser?.email || null; // Default to email

    if (firebaseUser) {
      try {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userRole.value = userData.role;
          currentUserName.value = userData.name || userData.email;
        } else {
          console.warn('User document not found for UID:', firebaseUser.uid);
          userRole.value = 'unregistered'; // Or a default role for users without a Firestore doc
        }
      } catch (error) {
        console.error('Error fetching user data for Navbar:', error);
        userRole.value = 'error';
      }
    }
  });
});

const handleLogout = async () => {
  try {
    await signOut(auth);
    currentUser.value = null;
    userRole.value = null;
    currentUserName.value = null;
    router.push('/login'); // Redirect to login page after logout
  } catch (error) {
    console.error('Error logging out:', error);
    alert('Failed to log out. Please try again.');
  }
};
</script>

<style scoped>
/* Scoped styles for the Navbar component */
.navbar-brand {
  font-weight: bold;
}

.dropdown-item-text {
  padding: 0.5rem 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>