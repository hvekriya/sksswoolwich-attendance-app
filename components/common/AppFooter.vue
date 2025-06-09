<template>
  <footer class="text-primary py-4 mt-5">
    <div class="container text-center">
      <NuxtLink to="/">
        <img
          src="https://www.sksswoolwich.org/img/WoolwichMandirLogo.png"
          alt="Shree Kutch Satsang Swaminarayan Temple Woolwich Logo"
          class="footer-logo mb-3"
        />
      </NuxtLink>
      <p class="mb-0">&copy; Shree Kutch Satsang Swaminarayan Temple Woolwich 2025</p>
    </div>
  </footer>
</template>

<script setup>
// No script logic needed for a static footer
</script>

<style scoped>
footer {
  font-size: 0.9rem;
  position: relative;
  bottom: 0;
  width: 100%;
}

.footer-logo {
  max-width: 100px; /* Adjust logo size as needed */
  height: auto;
  display: block; /* Ensures it takes up full width for proper margin */
  margin-left: auto;
  margin-right: auto; /* Center the image */
}
</style>