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
  <div class="d-flex justify-content-end mt-3">
    <button class="btn btn-success" @click="exportReport" :disabled="reportData.length === 0">
      <i class="bi bi-file-earmark-arrow-down-fill me-2"></i>Export to CSV
    </button>
  </div>
</template>

<script setup>
import { format, parseISO } from 'date-fns';

const props = defineProps({
  reportData: {
    type: Array,
    required: true,
    default: () => [] // Add a default for robustness
  },
  uniqueDates: {
    type: Array,
    required: true,
    default: () => [] // Add a default for robustness
  },
});

const emit = defineEmits(['export']); // Emits an event when export button is clicked

const formatDateShort = (dateString) => {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'MMM dd');
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return dateString; // Fallback
  }
};

const exportReport = () => {
  // Add a check to disable button or prevent export if no data
  if (props.reportData.length === 0 || props.uniqueDates.length === 0) {
    alert('No data to export.');
    return;
  }

  // Use Blob API for cleaner CSV generation, as previously discussed in parent component.
  // This is generally preferred over data URIs for larger files and better browser support.

  let csvRows = [];

  // Headers
  const headers = ['Class', 'Student Name', ...props.uniqueDates.map(d => formatDateShort(d)), 'Total Present', 'Total Absent'];
  csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',')); // Quote and escape quotes in headers

  // Rows
  props.reportData.forEach(student => {
    let rowData = [
      `"${student.className.replace(/"/g, '""')}"`, // Escape quotes for CSV
      `"${student.studentName.replace(/"/g, '""')}"`, // Escape quotes for CSV
    ];

    // FIX: Removed .value from props.uniqueDates
    props.uniqueDates.forEach(date => {
      const status = student.attendance[date]; // true/false/undefined
      if (status === true) {
        rowData.push('P');
      } else if (status === false) {
        rowData.push('A');
      } else {
        rowData.push('-'); // Handle cases where a record for a specific date might be missing
      }
    });
    rowData.push(student.totalPresent, student.totalAbsent);
    csvRows.push(rowData.join(','));
  });

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

  const filename = `attendance_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`; // Unique timestamped filename

  const link = document.createElement("a");
  link.setAttribute("href", URL.createObjectURL(blob));
  link.setAttribute("download", filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href); // Clean up the object URL

  // You are emitting 'export' but not sending any data or handling it in the parent.
  // If the parent is not meant to do anything with this event, you can remove `emit = defineEmits(['export'])`
  // and `emit('export')` if it were present. Since the child handles the download, the emit might be redundant
  // unless the parent needs to know *when* an export happened for logging or other UI updates.
  // emit('export'); // Uncomment if you still need to emit an event to the parent
};
</script>

<style scoped>
/* Any specific styles for the report table */
</style>