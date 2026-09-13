// nuxt.config.ts
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  // Client-only SPA (Firebase Auth/Firestore); hosted on Netlify as a static PWA.
  ssr: false,

  devtools: { enabled: true }, // Enable Nuxt DevTools

  // Global CSS: https://nuxt.com/docs/api/configuration/nuxt-config#css
  css: [
    '~/assets/main.scss', // Path to your custom Bootstrap SCSS file
    // Optional: Bootstrap Icons if you want to use them
    // 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
  ],

  // Modules: https://nuxt.com/docs/api/configuration/nuxt-config#modules
  modules: [
    '@vite-pwa/nuxt'
  ],

  pwa: {
    registerType: 'autoUpdate',
    includeAssets: ['calendar-app-icon-main.png', 'calendar-app-icon-white.png'],
    manifest: {
      name: 'SKSS Attendance',
      short_name: 'SKSS Attend',
      description: 'Attendance management for SKSS Woolwich classes',
      theme_color: '#8b184c',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      icons: [
        {
          src: 'calendar-app-icon-main.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'calendar-app-icon-main.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: 'calendar-app-icon-main.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    // Workbox configuration for service worker (similar to before)
    workbox: {
      // Only used in production builds; must match a precached URL (see navigateFallbackDenylist).
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/__nuxt/, /^\/_nuxt/, /^\/api\//],
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      // Cache static assets only — never Firestore API responses (stale attendance risk).
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-gstatic-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: ({ url }) => url.origin === 'https://www.gstatic.com',
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'gstatic-cache',
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 60 * 60 * 24 * 7,
            },
          },
        },
      ],
    },
    // client options
    client: {
      installPrompt: true, // Show install prompt for PWA
      // you don't need to include this: only for testing purposes
      // if you need to test in development, set it to false
      // when you build, it will be set to true
      // if you want to test it, npm run dev will not show the prompt
      // use npm run generate && npm run start to test
    },
    devOptions: {
      // Avoid workbox "non-precached-url" errors during `npm run dev` (no production precache manifest).
      enabled: false,
      suppressWarnings: true,
    }
  },

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
        { rel: 'icon', type: 'image/x-icon', href: '/calendar-app-icon-main.png' },
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
    },
    css: {
      preprocessorOptions: {
        scss: {
          // This line is often needed if you use Sass maps or functions,
          // but might not be strictly necessary just for variable overrides.
          // If you encounter errors like "Undefined variable: "$primary"",
          // it means Bootstrap's variables weren't correctly loaded before its components.
          // The @import order in main.scss is key.
          additionalData: `
            @import "~/assets/scss/custom_variables.scss";
          `,
        },
      },
    }
  }
});