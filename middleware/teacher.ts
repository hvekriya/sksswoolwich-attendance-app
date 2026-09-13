import { useUserProfile } from '~/composables/useUserProfile';

export default defineNuxtRouteMiddleware(async () => {
  if (!import.meta.client) return;

  const { fetchProfile } = useUserProfile();
  const userProfile = await fetchProfile();

  if (!userProfile) {
    return navigateTo('/login');
  }

  // Admins may use teacher routes (e.g. testing / covering a class).
  if (userProfile.role !== 'teacher' && userProfile.role !== 'admin') {
    return navigateTo('/');
  }
});
