<template>
  <div class="container mt-4">
    <h2 class="mb-4">Attendance Reports</h2>

    <div class="card shadow-sm p-4 mb-4">
      <div class="row g-3 align-items-end">
        <div class="col-md-4">
          <label for="reportClass" class="form-label">Select Class</label>
          <select class="form-select" id="reportClass" v-model="selectedClassId">
            <option :value="null">All Classes</option>
            <option v-for="cls in classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
          </select>
        </div>
        <div class="col-md-3">
          <label for="startDate" class="form-label">Start Date</label>
          <input type="date" class="form-control" id="startDate" v-model="startDate" />
        </div>
        <div class="col-md-3">
          <label for="endDate" class="form-label">End Date</label>
          <input type="date" class="form-control" id="endDate" v-model="endDate" />
        </div>
        <div class="col-md-2">
          <button class="btn btn-primary w-100" @click="generateReport" :disabled="loading">
            <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            <span v-else>Generate Report</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Generating report...</span>
      </div>
      <p class="mt-2">Generating report...</p>
    </div>

    <div v-if="reportData.length > 0 && !loading" class="mt-4">
      <h3 class="mb-3">Report Details</h3>

      <div v-if="selectedClassId === null && classAttendanceSummary.length > 0" class="card shadow-sm p-3 mb-4">
        <h4 class="card-title text-center mb-3">Class Attendance Ranking</h4>
        <div class="table-responsive">
          <table class="table table-bordered table-striped align-middle">
            <thead class="table-dark">
              <tr>
                <th>Rank</th>
                <th>Class Name</th>
                <th class="text-center">Total Present</th>
                <th class="text-center">Total Absent</th>
                <th class="text-center">Overall Attendance (%)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(cls, index) in classAttendanceSummary" :key="cls.className">
                <td>{{ index + 1 }}</td>
                <td>{{ cls.className }}</td>
                <td class="text-center">{{ cls.totalPresent }}</td>
                <td class="text-center">{{ cls.totalAbsent }}</td>
                <td class="text-center fw-bold" :class="{ 'text-success': cls.attendancePercentage >= 80, 'text-warning': cls.attendancePercentage < 80 && cls.attendancePercentage >= 60, 'text-danger': cls.attendancePercentage < 60 }">
                  {{ cls.attendancePercentage }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="row mb-4">
        <div class="col-md-6">
          <div class="card shadow-sm p-3 h-100">
            <h4 class="card-title text-center mb-3">Overall Attendance Summary</h4>
            <ClientOnly>
              <div v-if="hasChartData">
                <Doughnut :data="doughnutChartData" :options="chartOptions" :key="reportGenerated" />
              </div>
              <div v-else class="text-center text-muted">No data for attendance summary.</div>
              <template #fallback>
                <div class="text-center text-muted">Loading chart...</div>
              </template>
            </ClientOnly>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card shadow-sm p-3 h-100">
            <h4 class="card-title text-center mb-3">Attendance Trend Over Time</h4>
            <ClientOnly>
              <div v-if="hasChartData">
                <Line :data="lineChartData" :options="chartOptions" :key="reportGenerated" />
              </div>
              <div v-else class="text-center text-muted">No data for attendance trend.</div>
              <template #fallback>
                <div class="text-center text-muted">Loading chart...</div>
              </template>
            </ClientOnly>
          </div>
        </div>
      </div>

      <div class="d-none d-md-block">
        <AttendanceReportTable
          :report-data="reportData"
          :unique-dates="uniqueDates"
        />
      </div>

      <div class="d-md-none mt-4">
        <h3 class="mb-3">Student Attendance Details</h3>
        <div class="report-cards-container">
          <div v-for="studentReport in reportData" :key="studentReport.studentId" class="card student-attendance-card mb-3 shadow-sm">
            <div class="card-body">
              <h5 class="card-title text-primary">
                {{ studentReport.studentName }}
                <span class="badge bg-info text-dark ms-2">{{ studentReport.className }}</span>
              </h5>
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="text-success fw-bold">Present: {{ studentReport.totalPresent }}</span>
                <span class="text-danger fw-bold">Absent: {{ studentReport.totalAbsent }}</span>
              </div>

              <h6>Attendance by Date:</h6>
              <div class="attendance-dates-list">
                <div v-for="date in uniqueDates" :key="date" class="d-flex justify-content-between align-items-center attendance-item py-1">
                  <span class="text-muted">{{ formatDateShort(date) }}</span>
                  <span v-if="studentReport.attendance[date] === true" class="badge bg-success">P</span>
                  <span v-else-if="studentReport.attendance[date] === false" class="badge bg-danger">A</span>
                  <span v-else class="badge bg-secondary">-</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex justify-content-end mt-3">
        <button class="btn btn-success" @click="exportReport" :disabled="reportData.length === 0">
          <i class="bi bi-file-earmark-arrow-down-fill me-2"></i>Export to CSV
        </button>
      </div>
    </div>

    <div v-if="!loading && reportData.length === 0 && reportGenerated" class="alert alert-warning text-center mt-5">
      No attendance data found for the selected criteria.
    </div>

    <div v-if="errorMessage" class="alert alert-danger mt-4" role="alert">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { format, parseISO, startOfDay, endOfDay, isAfter, isValid, subDays } from 'date-fns';

import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement, CategoryScale, LinearScale, LineElement, PointElement } from 'chart.js';
import { Doughnut, Line } from 'vue-chartjs';
ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale, LinearScale, LineElement, PointElement);

import AttendanceReportTable from '~/components/admin/AttendanceReportTable.vue';

definePageMeta({
  middleware: ['auth', 'admin'],
});

const nuxtApp = useNuxtApp();
const db = nuxtApp.$db;

const classes = ref([]);
const selectedClassId = ref(null);
const startDate = ref(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
const endDate = ref(format(new Date(), 'yyyy-MM-dd'));

const reportData = ref([]);
const uniqueDates = ref([]);
const loading = ref(false);
const errorMessage = ref(null);
const reportGenerated = ref(false); // This will be used as a key

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
    },
    tooltip: {
      callbacks: {
        label: function(context) {
          let label = context.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed !== null) {
            const total = context.dataset.data.reduce((sum, current) => sum + current, 0);
            const percentage = (context.parsed / total * 100).toFixed(2);
            label += percentage + '%';
          }
          return label;
        }
      }
    }
  }
};

const hasChartData = computed(() => reportData.value.length > 0 && uniqueDates.value.length > 0);

const doughnutChartData = computed(() => {
  if (!hasChartData.value) {
    return { labels: [], datasets: [] };
  }
  let totalPresent = 0;
  let totalAbsent = 0;
  reportData.value.forEach(student => {
    totalPresent += student.totalPresent;
    totalAbsent += student.totalAbsent;
  });
  return {
    labels: ['Present', 'Absent'],
    datasets: [{ backgroundColor: ['#42b983', '#ff6384'], data: [totalPresent, totalAbsent] }],
  };
});

const lineChartData = computed(() => {
  if (!hasChartData.value) {
    return { labels: [], datasets: [] };
  }
  const dailyAttendance = {};
  uniqueDates.value.forEach(date => {
    dailyAttendance[date] = { present: 0, absent: 0 };
  });
  reportData.value.forEach(student => {
    uniqueDates.value.forEach(date => {
      const isPresent = student.attendance[date];
      if (isPresent === true) {
        dailyAttendance[date].present++;
      } else if (isPresent === false) {
        dailyAttendance[date].absent++;
      }
    });
  });
  const trendData = uniqueDates.value.map(date => {
    const totalPossibleStudentsForDay = reportData.value.length;
    if (totalPossibleStudentsForDay === 0) return 0;
    const presentStudentsCount = reportData.value.filter(student => student.attendance[date] === true).length;
    return (presentStudentsCount / totalPossibleStudentsForDay) * 100;
  });
  return {
    labels: uniqueDates.value,
    datasets: [{ label: 'Overall Attendance Rate (%)', backgroundColor: '#42b983', borderColor: '#42b983', tension: 0.3, data: trendData, fill: false }],
  };
});

const classAttendanceSummary = computed(() => {
  if (selectedClassId.value !== null || !reportData.value.length) {
    return [];
  }

  const classAggregates = {};
  reportData.value.forEach(student => {
    if (!classAggregates[student.className]) {
      classAggregates[student.className] = {
        className: student.className,
        totalPresent: 0,
        totalAbsent: 0,
      };
    }
    classAggregates[student.className].totalPresent += student.totalPresent;
    classAggregates[student.className].totalAbsent += student.totalAbsent;
  });

  const summary = Object.values(classAggregates).map(cls => {
    const totalAttendanceRecords = cls.totalPresent + cls.totalAbsent;
    const attendancePercentage = totalAttendanceRecords > 0
      ? (cls.totalPresent / totalAttendanceRecords) * 100
      : 0;

    return {
      className: cls.className,
      totalPresent: cls.totalPresent,
      totalAbsent: cls.totalAbsent,
      attendancePercentage: parseFloat(attendancePercentage.toFixed(2)),
    };
  });

  return summary.sort((a, b) => b.attendancePercentage - a.attendancePercentage);
});

const fetchClasses = async () => {
  try {
    const q = query(collection(db, 'classes'));
    const querySnapshot = await getDocs(q);
    classes.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching classes:', error);
    errorMessage.value = 'Failed to load classes.';
  }
};

onMounted(fetchClasses);

const generateReport = async () => {
  loading.value = true;
  errorMessage.value = null;
  reportData.value = [];
  uniqueDates.value = [];
  reportGenerated.value = false; // Reset before generating

  const startParsed = parseISO(startDate.value);
  const endParsed = parseISO(endDate.value);

  if (!isValid(startParsed) || !isValid(endParsed) || isAfter(startParsed, endParsed)) {
    errorMessage.value = 'Please select valid start and end dates.';
    loading.value = false;
    return;
  }

  const startTimestamp = Timestamp.fromDate(startOfDay(startParsed));
  const endTimestamp = Timestamp.fromDate(endOfDay(endParsed));

  try {
    let attendanceCollectionRef = collection(db, 'attendance');
    let studentsCollectionRef = collection(db, 'students');

    let attendanceConditions = [
      where('date', '>=', startTimestamp),
      where('date', '<=', endTimestamp)
    ];
    let studentConditions = [];

    if (selectedClassId.value) {
      attendanceConditions.push(where('classId', '==', selectedClassId.value));
      studentConditions.push(where('classId', '==', selectedClassId.value));
    }

    const attendanceQuery = query(attendanceCollectionRef, ...attendanceConditions);
    const studentsQuery = query(studentsCollectionRef, ...studentConditions);

    const [attendanceSnapshot, studentsSnapshot] = await Promise.all([
      getDocs(attendanceQuery),
      getDocs(studentsQuery)
    ]);

    const attendanceRecords = {};
    const studentNames = {};
    const studentClasses = {};
    const datesSet = new Set();

    studentsSnapshot.forEach(doc => {
      const data = doc.data();
      studentNames[doc.id] = data.name;
      const classNameObj = classes.value.find(c => c.id === data.classId);
      studentClasses[doc.id] = classNameObj ? classNameObj.name : 'Unknown Class';
      attendanceRecords[doc.id] = {}; // Initialize attendance for each student
    });

    attendanceSnapshot.forEach(doc => {
      const data = doc.data();
      const dateString = format(data.date.toDate(), 'yyyy-MM-dd');
      datesSet.add(dateString);
      // Ensure studentAttendance object exists before assigning
      if (!attendanceRecords[data.studentId]) {
          attendanceRecords[data.studentId] = {};
      }
      attendanceRecords[data.studentId][dateString] = data.present;
    });

    uniqueDates.value = Array.from(datesSet).sort();

    if (Object.keys(studentNames).length === 0 && attendanceSnapshot.empty) {
      loading.value = false;
      reportGenerated.value = true; // Still set to true even if no data, to trigger updates
      return;
    }

    reportData.value = Object.keys(studentNames).map(studentId => {
      let totalPresent = 0;
      let totalAbsent = 0;
      const studentAttendance = attendanceRecords[studentId] || {};

      const fullAttendance = {};
      uniqueDates.value.forEach(date => {
        const isPresentRecorded = studentAttendance[date];
        if (isPresentRecorded === true) {
          fullAttendance[date] = true;
          totalPresent++;
        } else if (isPresentRecorded === false) {
          fullAttendance[date] = false;
          totalAbsent++;
        } else {
          fullAttendance[date] = null; // Use null to indicate "Not Recorded"
          totalAbsent++; // Count as absent if not recorded for report purposes
        }
      });

      return {
        studentId,
        studentName: studentNames[studentId],
        className: studentClasses[studentId],
        attendance: fullAttendance,
        totalPresent,
        totalAbsent,
      };
    });
    reportGenerated.value = true; // Set to true after data is populated
  } catch (error) {
    console.error('Error generating report:', error);
    errorMessage.value = `Failed to generate report: ${error.message}`;
  } finally {
    loading.value = false;
  }
};

// Helper function for date formatting (used by mobile cards and CSV export)
const formatDateShort = (dateString) => {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'MMM dd');
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return dateString;
  }
};

// Export Report function (moved here to be consistent across desktop/mobile views)
const exportReport = () => {
  if (reportData.value.length === 0 || uniqueDates.value.length === 0) {
    alert('No data to export.');
    return;
  }

  let csvRows = [];

  // Headers
  const headers = ['Class', 'Student Name', ...uniqueDates.value.map(d => formatDateShort(d)), 'Total Present', 'Total Absent'];
  csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

  // Rows
  reportData.value.forEach(student => {
    let rowData = [
      `"${student.className.replace(/"/g, '""')}"`,
      `"${student.studentName.replace(/"/g, '""')}"`,
    ];

    uniqueDates.value.forEach(date => {
      const status = student.attendance[date];
      if (status === true) {
        rowData.push('P');
      } else if (status === false) {
        rowData.push('A');
      } else {
        rowData.push('-');
      }
    });
    rowData.push(student.totalPresent, student.totalAbsent);
    csvRows.push(rowData.join(','));
  });

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

  const filename = `attendance_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;

  const link = document.createElement("a");
  link.setAttribute("href", URL.createObjectURL(blob));
  link.setAttribute("download", filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};
</script>

<style scoped>
/* Common styles */
.text-success { color: #28a745; }
.text-warning { color: #ffc107; }
.text-danger { color: #dc3545; }
.fw-bold { font-weight: bold; }

/* Styles for Stacked Cards (Mobile View) */
.report-cards-container {
  /* Optional: Add some padding or margin if needed */
}

.student-attendance-card {
  border: 1px solid #e0e0e0;
}

.card-title .badge {
  font-size: 0.8rem;
}

.attendance-dates-list {
  max-height: 200px; /* Limit height for long lists of dates */
  overflow-y: auto; /* Enable vertical scrolling within the list */
  border: 1px solid #f0f0f0;
  border-radius: 0.25rem;
  padding: 0.5rem;
  background-color: #f8f9fa; /* Light background for the date list */
}

.attendance-item {
  font-size: 0.9rem;
}

.attendance-item:not(:last-child) {
  border-bottom: 1px dashed #e9ecef; /* Subtle separator */
}

.attendance-item span.badge {
  min-width: 25px; /* Ensure badges have consistent width */
  text-align: center;
  font-size: 0.8em; /* Make badges slightly smaller for mobile */
}

/* Bootstrap responsive utility classes for display */
/* Hide Main Student Table on extra small and small screens (d-none d-md-block on parent div) */
@media (max-width: 767.98px) {
  .d-none.d-md-block {
    display: none !important;
  }
}

/* Hide Stacked Cards on medium and larger screens (d-md-none on parent div) */
@media (min-width: 768px) {
  .d-md-none {
    display: none !important;
  }
}
</style>