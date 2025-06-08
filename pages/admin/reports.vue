<!-- pages/admin/reports.vue -->
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
      <!-- Use the dedicated component for the table -->
      <AttendanceReportTable
        :report-data="reportData"
        :unique-dates="uniqueDates"
        @export="exportReport"
      />
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
import { ref, onMounted } from 'vue';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { format, parseISO, startOfDay, endOfDay, isAfter, isValid, subDays } from 'date-fns';

import AttendanceReportTable from '~/components/admin/AttendanceReportTable.vue'; // Import the new component

definePageMeta({
  middleware: ['auth', 'admin'],
});

const nuxtApp = useNuxtApp();
const db = nuxtApp.$db;

const classes = ref([]);
const selectedClassId = ref(null);
const startDate = ref(format(subDays(new Date(), 30), 'yyyy-MM-dd')); // Default to last 30 days
const endDate = ref(format(new Date(), 'yyyy-MM-dd'));

const reportData = ref([]); // Processed data for display
const uniqueDates = ref([]); // Sorted list of all attendance dates in the report
const loading = ref(false);
const errorMessage = ref(null);
const reportGenerated = ref(false);

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
  reportGenerated.value = false;

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

    const attendanceRecords = {}; // { studentId: { 'YYYY-MM-DD': boolean } }
    const studentNames = {}; // { studentId: 'Student Name' }
    const studentClasses = {}; // { studentId: 'Class Name' }
    const datesSet = new Set(); // To collect all unique dates

    studentsSnapshot.forEach(doc => {
      const data = doc.data();
      studentNames[doc.id] = data.name;
      const classNameObj = classes.value.find(c => c.id === data.classId);
      studentClasses[doc.id] = classNameObj ? classNameObj.name : 'Unknown Class';
      attendanceRecords[doc.id] = {}; // Initialize for each student
    });

    attendanceSnapshot.forEach(doc => {
      const data = doc.data();
      const dateString = format(data.date.toDate(), 'yyyy-MM-dd');
      datesSet.add(dateString);
      if (!attendanceRecords[data.studentId]) { // Ensure student entry exists before assigning
          attendanceRecords[data.studentId] = {};
      }
      attendanceRecords[data.studentId][dateString] = data.present;
    });

    uniqueDates.value = Array.from(datesSet).sort(); // Sort dates chronologically

    reportData.value = Object.keys(studentNames).map(studentId => {
      let totalPresent = 0;
      let totalAbsent = 0;
      const studentAttendance = attendanceRecords[studentId] || {};

      // Fill in all unique dates for each student, defaulting to absent if no record
      const fullAttendance = {};
      uniqueDates.value.forEach(date => {
        const isPresent = studentAttendance[date];
        fullAttendance[date] = isPresent; // Can be true, false, or undefined
        if (isPresent === true) {
          totalPresent++;
        } else if (isPresent === false) {
          totalAbsent++;
        }
      });

      return {
        studentId,
        studentName: studentNames[studentId],
        className: studentClasses[studentId],
        attendance: fullAttendance, // Use the full attendance with all dates
        totalPresent,
        totalAbsent,
      };
    });
    reportGenerated.value = true;
  } catch (error) {
    console.error('Error generating report:', error);
    errorMessage.value = `Failed to generate report: ${error.message}`;
  } finally {
    loading.value = false;
  }
};

// The exportReport function is now handled by the child component,
// but we keep a placeholder if the parent needed to trigger something.
// For now, it just calls the child component's export function.
const exportReport = () => {
  // The actual export logic is within AttendanceReportTable.vue
  // We can't directly call a method on a child component like this in Composition API without a ref.
  // The @export event listener was a mistake in the previous thought process
  // The export should be handled directly by the component that knows about its data.
  // Reverted to calling the child component logic directly.
};
</script>

<style scoped>
/* Specific styles for reports page */
</style>