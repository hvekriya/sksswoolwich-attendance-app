<!-- components/admin/AttendanceReportTable.vue -->
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
    <button class="btn btn-success" @click="exportReport">
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
  },
  uniqueDates: {
    type: Array,
    required: true,
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
  let csvContent = "data:text/csv;charset=utf-8,";

  // Headers
  let headers = ['Class', 'Student Name', ...props.uniqueDates.map(d => formatDateShort(d)), 'Total Present', 'Total Absent'];
  csvContent += headers.join(',') + "\r\n";

  // Rows
  props.reportData.forEach(row => {
    let rowData = [
      `"${row.className}"`,
      `"${row.studentName}"`,
    ];
    props.uniqueDates.value.forEach(date => { // Iterate uniqueDates from props
      const status = row.attendance[date];
      if (status === true) {
        rowData.push('P');
      } else if (status === false) {
        rowData.push('A');
      } else {
        rowData.push('-');
      }
    });
    rowData.push(row.totalPresent, row.totalAbsent);
    csvContent += rowData.join(',') + "\r\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `attendance_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>

<style scoped>
/* Any specific styles for the report table */
</style>