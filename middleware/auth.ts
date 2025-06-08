// middleware/auth.ts
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { waitForFirebaseAuth } from '~/utils/authHelpers'; // Import the new utility

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Ensure this middleware only runs on the client-side where Firebase is initialized
  if (process.client) {
    // STEP 1: Wait for Firebase Auth to initialize its state
    const user = await waitForFirebaseAuth(); // This will pause until Firebase knows the auth state

    // If the user is not logged in
    if (!user) {
      // Allow navigation to login or other public routes without redirecting
      if (to.path !== '/login' && to.path !== '/register' && to.path !== '/admin/create-first-admin') { // Add any other truly public paths here
        console.log('Auth Middleware: No user, redirecting to login from', to.path);
        return navigateTo('/login');
      }
      return; // Allow public route access
    }

    // STEP 2: User is logged in. Now check their role for protected routes.
    // This is crucial for admin/teacher dashboards.
    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userRole = userData.role;

        // Redirect if user tries to access /admin routes without admin role
        if (to.path.startsWith('/admin') && userRole !== 'admin') {
          console.warn(`Auth Middleware: Access Denied! User ${user.email} (role: ${userRole}) attempted to access admin route ${to.path}. Redirecting to /`);
          return navigateTo('/');
        }

        // Redirect if user tries to access /teacher routes without teacher or admin role
        if (to.path.startsWith('/teacher') && userRole !== 'teacher' && userRole !== 'admin') {
          console.warn(`Auth Middleware: Access Denied! User ${user.email} (role: ${userRole}) attempted to access teacher route ${to.path}. Redirecting to /`);
          return navigateTo('/');
        }

        // Add more specific role-based redirects here if needed for other paths
      } else {
        // Authenticated user but no user document in Firestore (e.g., new user, or data missing)
        // You might want to redirect them to a profile setup page or a default page
        console.warn('Auth Middleware: Authenticated user has no Firestore document:', user.uid);
        // Avoid redirecting to login if they are technically logged in, but not fully set up
        if (to.path !== '/login' && to.path !== '/register' && to.path !== '/') { // Don't redirect if already on login/register/home
           return navigateTo('/'); // Or to a dedicated profile completion page
        }
      }
    } catch (error) {
      console.error('Auth Middleware: Error fetching user role from Firestore:', error);
      // In case of error fetching role, redirect to home or login as a safety measure
      return navigateTo('/login');
    }
  }
});