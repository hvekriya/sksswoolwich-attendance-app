import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

export const CLASS_ATTENDANCE_SKIPS = 'class_attendance_skips';

export function dateKeyFromDate(d: Date): string {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().split('T')[0];
}

export function skipDocId(classId: string, dateKey: string): string {
  return `${classId}_${dateKey}`;
}

export async function fetchSkipForClassDay(
  db: Firestore,
  classId: string,
  dayAtMidnight: Date
): Promise<{ skipReason: string } | null> {
  const dateKey = dateKeyFromDate(dayAtMidnight);
  const ref = doc(db, CLASS_ATTENDANCE_SKIPS, skipDocId(classId, dateKey));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return { skipReason: (data.skipReason as string) || 'holiday' };
}

export async function deleteAttendanceDocsForClassDay(
  db: Firestore,
  classId: string,
  startOfDay: Date,
  endOfDay: Date
): Promise<void> {
  const q = query(
    collection(db, 'attendance'),
    where('classId', '==', classId),
    where('date', '>=', Timestamp.fromDate(startOfDay)),
    where('date', '<=', Timestamp.fromDate(endOfDay))
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export async function setSkipForClassDay(
  db: Firestore,
  classId: string,
  dateKey: string,
  normalizedDate: Timestamp,
  skipReason: 'holiday' | 'no_class',
  recordedBy: string
): Promise<void> {
  const ref = doc(db, CLASS_ATTENDANCE_SKIPS, skipDocId(classId, dateKey));
  await setDoc(ref, {
    classId,
    date: normalizedDate,
    skipReason,
    recordedBy,
    recordedAt: Timestamp.now(),
  });
}

export async function deleteSkipForClassDay(
  db: Firestore,
  classId: string,
  dateKey: string
): Promise<void> {
  const ref = doc(db, CLASS_ATTENDANCE_SKIPS, skipDocId(classId, dateKey));
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await deleteDoc(ref);
  }
}
