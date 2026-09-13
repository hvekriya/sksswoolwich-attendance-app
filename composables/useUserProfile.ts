import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { waitForFirebaseAuth } from '~/utils/authHelpers';

export type AppUserProfile = {
  uid: string;
  email: string | null;
  name?: string;
  role: 'admin' | 'teacher' | 'student' | string;
  classId?: string | null;
};

const profile = ref<AppUserProfile | null>(null);
const loading = ref(false);
let inflight: Promise<AppUserProfile | null> | null = null;

/**
 * Cached user profile from Firestore. Avoids repeated users/{uid} reads
 * across middleware, navbar, and pages.
 */
export function useUserProfile() {
  const clearProfile = () => {
    profile.value = null;
    inflight = null;
  };

  const fetchProfile = async (force = false): Promise<AppUserProfile | null> => {
    if (!import.meta.client) return null;
    if (!force && profile.value) return profile.value;
    if (!force && inflight) return inflight;

    inflight = (async () => {
      loading.value = true;
      try {
        const user = (await waitForFirebaseAuth()) as User | null;
        if (!user) {
          profile.value = null;
          return null;
        }

        const nuxtApp = useNuxtApp();
        const db = nuxtApp.$db as any;
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) {
          profile.value = null;
          return null;
        }

        const data = snap.data();
        profile.value = {
          uid: user.uid,
          email: user.email,
          name: data.name,
          role: data.role,
          classId: data.classId ?? null,
        };
        return profile.value;
      } finally {
        loading.value = false;
        inflight = null;
      }
    })();

    return inflight;
  };

  return {
    profile,
    loading,
    fetchProfile,
    clearProfile,
  };
}
