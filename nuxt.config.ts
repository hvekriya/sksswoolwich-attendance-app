// nuxt.config.ts
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  devtools: { enabled: true }, // Enable Nuxt DevTools

  // Global CSS: https://nuxt.com/docs/api/configuration/nuxt-config#css
  css: [
    '~/assets/main.scss', // Path to your custom Bootstrap SCSS file
    // Optional: Bootstrap Icons if you want to use them
    // 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
  ],

  // Modules: https://nuxt.com/docs/api/configuration/nuxt-config#modules
  modules: [
    // '@nuxtjs/eslint-module', // If you want ESLint integration
  ],

  // Plugins to run before rendering page: https://nuxt.com/docs/api/configuration/nuxt-config#plugins
  plugins: [
    '~/plugins/firebase.client.ts', // Firebase initialization plugin
  ],

  // Runtime config for environment variables (exposed to client-side)
  runtimeConfig: {
    public: {
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID
    }
  },

  // Build configuration (e.g., for transpilation)
  build: {
    transpile: [
      '@popperjs/core', // Essential for Bootstrap 5 JS components
    ],
  },

  // App configuration for head content (similar to Nuxt 2 head)
  app: {
    head: {
      title: 'Attendance App',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { hid: 'description', name: 'description', content: 'Attendance recording app' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css' }
      ],
      script: [
        // Include Bootstrap 5 JavaScript bundle via CDN for client-side components (modals, dropdowns)
        {
          src: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
          integrity: 'sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz',
          crossorigin: 'anonymous',
          body: true // Place script at the end of the body
        }
      ]
    }
  },

  // Vite configuration
  vite: {
    optimizeDeps: {
      include: ['firebase/app', 'firebase/auth', 'firebase/firestore'] // Optimize these for faster development
    }
  }
});