<!-- app.vue -->
<template>
  <div class="app-shell">
    <Navbar />
    <main class="py-4 px-2 px-sm-3">
      <NuxtPage /> <!-- This is where your page content is rendered -->
    </main>
    <!-- Optional: Add a global notification component here if you implement one later -->
    <!-- <GlobalNotifications /> -->
    <AppFooter />
  </div>
</template>

<script setup>
import Navbar from '~/components/common/Navbar.vue';
import AppFooter from '~/components/common/AppFooter.vue';

// Define global middleware to run on every page unless specifically overridden
// The 'auth' middleware will ensure users are redirected to login if not authenticated.
definePageMeta({
  middleware: ['auth']
});
</script>