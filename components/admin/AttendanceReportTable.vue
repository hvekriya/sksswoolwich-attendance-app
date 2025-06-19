<template>
  <div class="table-responsive">
    <table class="table table-bordered table-striped align-middle">
      <thead class="table-dark">
        <tr>
          <th>Class</th>
          <th>Student Name</th>
          <th v-for="date in uniqueDates" :key="date" class="text-center">{{ formatDateShort(date) }}</th>
          <th class="text-center">Total Present</th>
          <th class="text-center">Total Absent</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="studentReport in reportData" :key="studentReport.studentId">
          <td>{{ studentReport.className }}</td>
          <td>{{ studentReport.studentName }}</td>
          <td v-for="date in uniqueDates" :key="date" class="text-center">
            <span v-if="studentReport.attendance[date] === true" class="badge bg-success">P</span>
            <span v-else-if="studentReport.attendance[date] === false" class="badge bg-danger">A</span>
            <span v-else class="badge bg-secondary">-</span>
          </td>
          <td class="text-center text-success fw-bold">{{ studentReport.totalPresent }}</td>
          <td class="text-center text-danger fw-bold">{{ studentReport.totalAbsent }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  </template>

<script setup>
import { format, parseISO } from 'date-fns';

const props = defineProps({
  reportData: {
    type: Array,
    required: true,
    default: () => []
  },
  uniqueDates: {
    type: Array,
    required: true,
    default: () => []
  },
});

// No emit or export function needed here anymore
// const emit = defineEmits(['export']);

const formatDateShort = (dateString) => {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'MMM dd');
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return dateString;
  }
};
</script>

<style scoped>
/* Any specific styles for the report table, no sticky logic */
</style>