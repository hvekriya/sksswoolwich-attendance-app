<template>
  <div class="container text-center mt-5">
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
    <p class="mt-3">Loading application...</p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Access Firebase services provided by the plugin
const nuxtApp = useNuxtApp();
const auth = nuxtApp.$auth;
const db = nuxtApp.$db;
const router = useRouter(); // Nuxt 3 auto-import

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role === 'admin') {
            router.push('/admin');
          } else if (userData.role === 'teacher') {
            router.push('/teacher');
          } else {
            console.warn("User has no role defined in Firestore. Redirecting to login.");
            await auth.signOut();
            router.push('/login');
          }
        } else {
          console.warn("User exists in auth but no role defined in Firestore. Redirecting to login.");
          await auth.signOut();
          router.push('/login');
        }
      } catch (error) {
        console.error("Error fetching user role on index page:", error);
        await auth.signOut();
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
  });
});
</script>