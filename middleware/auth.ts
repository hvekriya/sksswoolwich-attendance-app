import { useUserProfile } from '~/composables/useUserProfile';

export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return;

  const { fetchProfile, clearProfile } = useUserProfile();
  const userProfile = await fetchProfile();

  if (!userProfile) {
    clearProfile();
    if (to.path !== '/login' && to.path !== '/register' && to.path !== '/admin/create-first-admin') {
      return navigateTo('/login');
    }
    return;
  }

  if (to.path.startsWith('/admin') && userProfile.role !== 'admin') {
    return navigateTo('/');
  }

  if (
    to.path.startsWith('/teacher') &&
    userProfile.role !== 'teacher' &&
    userProfile.role !== 'admin'
  ) {
    return navigateTo('/');
  }
});
