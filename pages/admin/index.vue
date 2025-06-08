<template>
  <div class="container mt-4">
    <h2 class="mb-4">Admin Dashboard</h2>

    <div class="row g-4">
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 shadow-sm card-custom-shadow">
          <div class="card-body text-center d-flex flex-column justify-content-center">
            <i class="bi bi-person-fill-gear fs-1 text-primary mb-3"></i>
            <h5 class="card-title">Manage Teachers</h5>
            <p class="card-text">Add, edit, or remove teacher accounts and assign them to classes.</p>
            <NuxtLink to="/admin/manage-teachers" class="btn btn-primary mt-auto">Go to Teachers</NuxtLink>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 shadow-sm card-custom-shadow">
          <div class="card-body text-center d-flex flex-column justify-content-center">
            <i class="bi bi-person-lines-fill fs-1 text-success mb-3"></i>
            <h5 class="card-title">Manage Students</h5>
            <p class="card-text">View and manage all students across all classes in the system.</p>
            <NuxtLink to="/admin/manage-students" class="btn btn-success mt-auto">Go to Students</NuxtLink>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 shadow-sm card-custom-shadow">
          <div class="card-body text-center d-flex flex-column justify-content-center">
            <i class="bi bi-file-earmark-bar-graph fs-1 text-info mb-3"></i>
            <h5 class="card-title">Attendance Reports</h5>
            <p class="card-text">Generate attendance reports for specific classes and date ranges.</p>
            <NuxtLink to="/admin/reports" class="btn btn-info mt-auto">Go to Reports</NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: ['auth', 'admin'],
});
</script>

<style scoped>
/* Optional: specific styles for admin dashboard cards */
.card-body i {
  display: block;
}
</style>