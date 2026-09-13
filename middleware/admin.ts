import { useUserProfile } from '~/composables/useUserProfile';

export default defineNuxtRouteMiddleware(async () => {
  if (!import.meta.client) return;

  const { fetchProfile } = useUserProfile();
  const userProfile = await fetchProfile();

  if (!userProfile) {
    return navigateTo('/login');
  }

  if (userProfile.role !== 'admin') {
    return navigateTo('/');
  }
});
