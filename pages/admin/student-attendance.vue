<template>
  <div class="container mt-4 pb-5">
    <h2 class="mb-4">Attendance by student</h2>
    <p class="text-muted mb-4">Search or pick a student, then choose a UK academic period or a custom date range.</p>

    <div class="card glass-card shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label" for="studentSearch">Student</label>
            <input
              id="studentSearch"
              v-model="searchQuery"
              type="search"
              class="form-control mb-2"
              placeholder="Search by name…"
              autocomplete="off"
            />
            <select id="studentSelect" v-model="selectedStudentId" class="form-select">
              <option value="">Select a student…</option>
              <option v-for="s in filteredStudents" :key="s.id" :value="s.id">
                {{ s.name }} — {{ s.classLabel }}
              </option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Preset range</label>
            <select v-model="preset" class="form-select" @change="applyPreset">
              <option value="current_year">Current academic year</option>
              <option value="full_custom">Custom dates (below)</option>
            </select>
          </div>
          <div class="col-md-3" v-if="preset === 'full_custom'">
            <label class="form-label">&nbsp;</label>
            <button type="button" class="btn btn-outline-primary w-100 rounded-pill" @click="loadAttendance">
              Apply dates
            </button>
          </div>
        </div>

        <div v-if="preset === 'full_custom'" class="row g-3 mt-1">
          <div class="col-md-4">
            <label class="form-label" for="fromDate">From</label>
            <input id="fromDate" v-model="customStart" type="date" class="form-control" />
          </div>
          <div class="col-md-4">
            <label class="form-label" for="toDate">To</label>
            <input id="toDate" v-model="customEnd" type="date" class="form-control" />
          </div>
        </div>

        <div v-else class="small text-muted mt-3">
          {{ rangeDescription }}
        </div>
      </div>
    </div>

    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border text-info" role="status">
        <span class="visually-hidden">Loading…</span>
      </div>
      <p class="mt-2">Loading attendance…</p>
    </div>

    <div v-else-if="selectedStudentId && sessions.length" class="card glass-card shadow-sm">
      <div class="card-body">
        <h5 class="card-title">{{ selectedStudentName }}</h5>
        <p class="small text-muted mb-3">{{ rangeDescription }}</p>
        <div class="d-flex flex-wrap gap-2 mb-3">
          <span class="badge bg-success">Present: {{ summary.present }}</span>
          <span class="badge bg-danger">Absent: {{ summary.absent }}</span>
          <span class="badge bg-secondary">Recorded sessions: {{ summary.recorded }}</span>
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-hover table-glass mb-0">
            <thead>
              <tr>
                <th>Date</th>
                <th class="text-end">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sessions" :key="row.dateKey">
                <td>{{ row.dateLabel }}</td>
                <td class="text-end">
                  <span v-if="row.present === true" class="badge bg-success">Present</span>
                  <span v-else-if="row.present === false" class="badge bg-danger">Absent</span>
                  <span v-else class="badge bg-secondary">Not recorded</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-else-if="selectedStudentId && !loading" class="alert alert-info border-0 shadow-sm">
      No attendance records in this range.
    </div>

    <div v-if="errorMessage" class="alert alert-danger mt-3" role="alert">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { format, parseISO, startOfDay, endOfDay, isValid, isAfter } from 'date-fns';
import {
  recentAcademicYearOptions,
  getAcademicYearRange,
  formatAcademicYearLabel,
} from '~/utils/ukSchoolTerms';

definePageMeta({
  middleware: ['auth', 'admin'],
});

const nuxtApp = useNuxtApp();
const db = nuxtApp.$db;

const students = ref([]);
const searchQuery = ref('');
const selectedStudentId = ref('');
const loading = ref(false);
const errorMessage = ref(null);

const preset = ref('current_year');
const customStart = ref(format(new Date(), 'yyyy-MM-dd'));
const customEnd = ref(format(new Date(), 'yyyy-MM-dd'));

const sessions = ref([]);

const filteredStudents = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const list = students.value;
  if (!q) return list;
  return list.filter((s) => s.name.toLowerCase().includes(q));
});

const selectedStudentName = computed(() => {
  const s = students.value.find((x) => x.id === selectedStudentId.value);
  return (s && s.name) || '';
});

const activeRange = computed(() => {
  if (preset.value === 'full_custom') {
    const a = parseISO(customStart.value);
    const b = parseISO(customEnd.value);
    if (!isValid(a) || !isValid(b) || isAfter(a, b)) return null;
    return { start: startOfDay(a), end: endOfDay(b) };
  }
  const startYear = recentAcademicYearOptions()[0];
  return getAcademicYearRange(startYear);
});

const rangeDescription = computed(() => {
  const r = activeRange.value;
  if (!r) return '';
  if (preset.value === 'current_year') {
    const y = recentAcademicYearOptions()[0];
    return `${formatAcademicYearLabel(y)}: ${format(r.start, 'd MMM yyyy')} – ${format(r.end, 'd MMM yyyy')}`;
  }
  return `${format(r.start, 'd MMM yyyy')} – ${format(r.end, 'd MMM yyyy')}`;
});

const summary = computed(() => {
  let present = 0;
  let absent = 0;
  sessions.value.forEach((row) => {
    if (row.present === true) present++;
    else if (row.present === false) absent++;
  });
  return { present, absent, recorded: present + absent };
});

const fetchStudents = async () => {
  try {
    const [stuSnap, clsSnap] = await Promise.all([
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'classes')),
    ]);
    const classNames = {};
    clsSnap.forEach((d) => {
      classNames[d.id] = d.data().name || 'Class';
    });
    const list = [];
    stuSnap.forEach((d) => {
      const data = d.data();
      const cid = data.classId;
      list.push({
        id: d.id,
        name: data.name || 'Unknown',
        classLabel: cid ? classNames[cid] || 'Unknown class' : 'No class',
      });
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    students.value = list;
  } catch (e) {
    console.error(e);
    errorMessage.value = 'Failed to load students.';
  }
};

const applyPreset = () => {
  loadAttendance();
};

const loadAttendance = async () => {
  if (!selectedStudentId.value) {
    sessions.value = [];
    return;
  }
  const range = activeRange.value;
  if (!range) {
    errorMessage.value = 'Invalid date range.';
    sessions.value = [];
    return;
  }

  loading.value = true;
  errorMessage.value = null;
  sessions.value = [];

  try {
    const startTs = Timestamp.fromDate(range.start);
    const endTs = Timestamp.fromDate(range.end);
    const q = query(
      collection(db, 'attendance'),
      where('date', '>=', startTs),
      where('date', '<=', endTs)
    );
    const snap = await getDocs(q);
    const byDay = {};
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.studentId !== selectedStudentId.value) return;
      const dk = format(data.date.toDate(), 'yyyy-MM-dd');
      byDay[dk] = data.present === true ? true : false;
    });

    const keys = Object.keys(byDay).sort();
    sessions.value = keys.map((dateKey) => ({
      dateKey,
      dateLabel: format(parseISO(dateKey), 'EEEE d MMM yyyy'),
      present: byDay[dateKey],
    }));
  } catch (e) {
    console.error(e);
    errorMessage.value = (e && e.message) || 'Failed to load attendance.';
  } finally {
    loading.value = false;
  }
};

watch(selectedStudentId, () => {
  loadAttendance();
});

watch([preset, customStart, customEnd], () => {
  if (preset.value === 'full_custom') return;
  loadAttendance();
});

onMounted(async () => {
  await fetchStudents();
});
</script>
