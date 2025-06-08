// utils/authHelpers.ts
import { getAuth, onAuthStateChanged } from 'firebase/auth';

/**
 * Returns a Promise that resolves with the current Firebase User object
 * once the authentication state has been initialized.
 * This is crucial for middleware to wait for Firebase to load its state.
 */
export function waitForFirebaseAuth() {
  const auth = getAuth(); // Get the auth instance

  return new Promise((resolve) => {
    // onAuthStateChanged immediately calls the callback with the current user state
    // (or null if not logged in) after Firebase has initialized.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Resolve the promise with the user object
      resolve(user);
      // Immediately unsubscribe after the first call to avoid memory leaks
      unsubscribe();
    });
  });
}