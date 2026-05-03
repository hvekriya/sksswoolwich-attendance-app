<template>
  <div class="container mt-4 pb-5">
    <h2 class="mb-4">Attendance leaderboard</h2>
    <p class="text-muted mb-4">
      Rankings by number of sessions marked <strong>present</strong>. Uses UK academic years (September–August) and approximate term bands.
    </p>

    <div class="card glass-card shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-md-4">
            <label class="form-label" for="academicYear">Academic year</label>
            <select id="academicYear" v-model.number="academicYearStart" class="form-select">
              <option v-for="y in yearOptions" :key="y" :value="y">
                {{ formatAcademicYearLabel(y) }}
              </option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label" for="term">Term</label>
            <select id="term" v-model="termFilter" class="form-select">
              <option value="full">Full academic year</option>
              <option value="autumn">Autumn term</option>
              <option value="spring">Spring term</option>
              <option value="summer">Summer term</option>
            </select>
          </div>
          <div class="col-md-4">
            <button type="button" class="btn btn-primary w-100 rounded-pill" :disabled="loading" @click="loadLeaderboard">
              <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
        <p v-if="rangeLabel" class="small text-muted mt-3 mb-0">{{ rangeLabel }}</p>
      </div>
    </div>

    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border text-info" role="status">
        <span class="visually-hidden">Loading…</span>
      </div>
      <p class="mt-2">Loading leaderboard…</p>
    </div>

    <div v-else class="card glass-card shadow-sm">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle table-glass mb-0">
            <thead>
              <tr>
                <th scope="col" class="text-center" style="width: 4rem">Rank</th>
                <th scope="col">Student</th>
                <th scope="col">Class</th>
                <th scope="col" class="text-end">Sessions attended</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.studentId">
                <td class="text-center">
                  <span v-if="row.rank <= 3 && row.presentCount > 0" class="fs-4" :title="medalTitle(row.rank)">{{ medalIcon(row.rank) }}</span>
                  <span v-else class="text-muted">{{ row.rank }}</span>
                </td>
                <td class="fw-semibold">{{ row.studentName }}</td>
                <td>{{ row.className }}</td>
                <td class="text-end font-monospace">{{ row.presentCount }}</td>
              </tr>
              <tr v-if="!rows.length">
                <td colspan="4" class="text-center text-muted py-4">No students found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="alert alert-danger mt-3" role="alert">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import {
  recentAcademicYearOptions,
  formatAcademicYearLabel,
  getTermRange,
} from '~/utils/ukSchoolTerms';

definePageMeta({
  middleware: ['auth', 'admin'],
});

const nuxtApp = useNuxtApp();
const db = nuxtApp.$db;

const academicYearStart = ref(recentAcademicYearOptions()[0]);
const termFilter = ref('full');
const yearOptions = recentAcademicYearOptions(8);
const loading = ref(false);
const errorMessage = ref(null);

const rows = ref([]);

const rangeLabel = computed(() => {
  const { start, end } = getTermRange(academicYearStart.value, termFilter.value);
  return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
});

function medalIcon(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

function medalTitle(rank) {
  if (rank === 1) return 'First place';
  if (rank === 2) return 'Second place';
  if (rank === 3) return 'Third place';
  return '';
}

const loadLeaderboard = async () => {
  loading.value = true;
  errorMessage.value = null;
  rows.value = [];

  try {
    const { start, end } = getTermRange(academicYearStart.value, termFilter.value);
    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);

    const [studentsSnap, classesSnap, attendanceSnap] = await Promise.all([
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'classes')),
      getDocs(
        query(collection(db, 'attendance'), where('date', '>=', startTs), where('date', '<=', endTs))
      ),
    ]);

    const classNameById = {};
    classesSnap.forEach((d) => {
      classNameById[d.id] = d.data().name || 'Class';
    });

    const presentByStudent = {};
    attendanceSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.present === true && data.studentId) {
        const sid = data.studentId;
        presentByStudent[sid] = (presentByStudent[sid] || 0) + 1;
      }
    });

    const list = [];
    studentsSnap.forEach((d) => {
      const data = d.data();
      const classId = data.classId;
      list.push({
        rank: 0,
        studentId: d.id,
        studentName: data.name || 'Unknown',
        className: classId ? classNameById[classId] || 'Unknown class' : 'No class',
        presentCount: presentByStudent[d.id] || 0,
      });
    });

    list.sort((a, b) => b.presentCount - a.presentCount || a.studentName.localeCompare(b.studentName));

    let rank = 0;
    let lastCount = null;
    let position = 0;
    list.forEach((row) => {
      position += 1;
      if (lastCount === null || row.presentCount !== lastCount) {
        rank = position;
        lastCount = row.presentCount;
      }
      row.rank = rank;
    });

    rows.value = list;
  } catch (e) {
    console.error(e);
    errorMessage.value = (e && e.message) || 'Failed to load leaderboard.';
  } finally {
    loading.value = false;
  }
};

onMounted(loadLeaderboard);
</script>

