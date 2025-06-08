<template>
  <div class="auth-layout d-flex align-items-center justify-content-center min-vh-100 bg-light">
    <div class="auth-container card shadow-lg p-4 p-md-5 rounded-3">
      <div class="text-center mb-4">
        <h2 class="text-primary fw-bold mb-3">Attendance App</h2>
        <p class="text-muted">Sign in to continue</p>
      </div>

      <slot />

    </div>
  </div>
</template>

<script setup>
// No specific script logic needed for a basic layout component
// You might import components here if your layout has reusable elements (e.g., a specific footer)
</script>

<style scoped>
/*
 * Specific styles for the auth layout
 */
.auth-layout {
  /* Ensure the layout takes full viewport height */
  min-height: 100vh;
  background-color: #f8f9fa; /* Light grey background */
  overflow: auto; /* Allow scrolling if content is too tall */
  padding: 20px 0; /* Add some vertical padding */
}

.auth-container {
  max-width: 450px; /* Max width for the form container */
  width: 95%; /* Responsive width */
  margin: auto; /* Center horizontally */
  /* Bootstrap classes handle most of the styling:
     shadow-lg: large shadow
     p-4 p-md-5: padding on all sides, more on medium screens
     rounded-3: rounded corners
  */
}

/* Optional: Adjust for smaller screens if needed */
@media (max-width: 576px) {
  .auth-container {
    padding: 20px; /* Reduce padding on very small screens */
  }
}
</style>