<!-- app.vue -->
<template>
  <div>
    <Navbar />
    <main class="py-4">
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

<style>
/* Any global layout-specific styles */
main {
  margin-top: 56px; /* Offset for fixed Bootstrap navbar height */
}
</style>