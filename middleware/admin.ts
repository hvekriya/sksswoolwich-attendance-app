// middleware/admin.ts
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (process.client) {
    const auth = getAuth();
    const user = auth.currentUser;
    const db = getFirestore();

    if (!user) {
      return navigateTo('/login'); // Not logged in
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        return navigateTo('/'); // Not an admin, redirect to home
      }
    } catch (error) {
      console.error('Error fetching user role for admin middleware:', error);
      return navigateTo('/'); // Redirect on error
    }
  }
});