// plugins/firebase.client.ts (ensure you have this)
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// Don't forget getFunctions here for type purposes if you'll use it globally
import { getFunctions } from 'firebase/functions'; // <--- Add this import

export default defineNuxtPlugin(nuxtApp => {
  const config = useRuntimeConfig();

  const firebaseConfig = {
    apiKey: config.public.firebaseApiKey,
    authDomain: config.public.firebaseAuthDomain,
    projectId: config.public.firebaseProjectId,
    storageBucket: config.public.firebaseStorageBucket,
    messagingSenderId: config.public.firebaseMessagingSenderId,
    appId: config.public.firebaseAppId
  };

  console.log('Firebase Client Config (from plugin):', firebaseConfig);

  if (!globalThis.__firebaseAppInstance) {
    globalThis.__firebaseAppInstance = initializeApp(firebaseConfig);
  }
  const app = globalThis.__firebaseAppInstance; // Get the app instance

  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const functions = getFunctions(app, 'europe-west3'); // Initialize functions here as well

  nuxtApp.provide('auth', auth);
  nuxtApp.provide('db', db);
  nuxtApp.provide('storage', storage);
  nuxtApp.provide('firebaseApp', app); // <--- Make sure you provide the app instance!
  nuxtApp.provide('functions', functions); // <--- Optionally provide functions as well
});

// Augment the NuxtApp interface for TypeScript
declare module '#app' {
  interface NuxtApp {
    $auth: ReturnType<typeof getAuth>;
    $db: ReturnType<typeof getFirestore>;
    $storage: ReturnType<typeof getStorage>;
    $firebaseApp: ReturnType<typeof initializeApp>; // <--- Add this
    $functions: ReturnType<typeof getFunctions>; // <--- Add this
  }
}

declare global {
  var __firebaseAppInstance: ReturnType<typeof initializeApp> | undefined;
}