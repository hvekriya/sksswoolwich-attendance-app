<template>
  <div class="container">
        <div v-if="loadingProfile" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        </div>
        <div v-else>
        <h5 class="mb-3">Your Profile Information</h5>
        <form @submit.prevent="updateProfile">
            <div class="mb-3">
            <label for="profileName" class="form-label">Name</label>
            <input type="text" class="form-control" id="profileName" v-model="profileForm.name" required>
            </div>
            <div class="mb-3">
            <label for="profileEmail" class="form-label">Email</label>
            <input type="email" class="form-control" id="profileEmail" :value="auth.currentUser?.email" disabled>
            <small class="form-text text-muted">To change your email, use the "Change Email" section below.</small>
            </div>
            <div class="mb-4">
            <label for="profileRole" class="form-label">Role</label>
            <input type="text" class="form-control" id="profileRole" :value="profileForm.role" disabled>
            <small class="form-text text-muted">Your role cannot be changed here.</small>
            </div>
            <div v-if="profileForm.role === 'teacher' || profileForm.role === 'student'" class="mb-4">
            <label for="profileClass" class="form-label">Assigned Class</label>
            <input type="text" class="form-control" id="profileClass" :value="profileForm.className || 'N/A'" disabled>
            <small class="form-text text-muted">Your class assignment is managed by an administrator.</small>
            </div>

            <button type="submit" class="btn btn-primary" :disabled="profileLoading">
            <span v-if="profileLoading" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            <span v-else>Update Profile</span>
            </button>
            <div v-if="profileMessage" :class="['alert mt-3', profileMessage.type === 'success' ? 'alert-success' : 'alert-danger']">
            {{ profileMessage.text }}
            </div>
        </form>

        <hr class="my-5">

        <h5 class="mb-3">Change Email</h5>
        <form @submit.prevent="changeEmail">
            <div class="mb-3">
            <label for="newEmail" class="form-label">New Email</label>
            <input type="email" class="form-control" id="newEmail" v-model="newEmail" required>
            </div>
            <div class="mb-4">
            <label for="currentPasswordEmail" class="form-label">Current Password (for re-authentication)</label>
            <input type="password" class="form-control" id="currentPasswordEmail" v-model="currentPasswordEmail" required>
            </div>
            <button type="submit" class="btn btn-warning" :disabled="emailLoading">
            <span v-if="emailLoading" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            <span v-else>Change Email</span>
            </button>
            <div v-if="emailMessage" :class="['alert mt-3', emailMessage.type === 'success' ? 'alert-success' : 'alert-danger']">
            {{ emailMessage.text }}
            </div>
        </form>

        <hr class="my-5">

        <h5 class="mb-3">Change Password</h5>
        <form @submit.prevent="changePassword">
            <div class="mb-3">
            <label for="newPassword" class="form-label">New Password</label>
            <input type="password" class="form-control" id="newPassword" v-model="newPassword" required minlength="6">
            </div>
            <div class="mb-3">
            <label for="confirmNewPassword" class="form-label">Confirm New Password</label>
            <input type="password" class="form-control" id="confirmNewPassword" v-model="confirmNewPassword" required>
            </div>
            <div class="mb-4">
            <label for="currentPasswordPassword" class="form-label">Current Password (for re-authentication)</label>
            <input type="password" class="form-control" id="currentPasswordPassword" v-model="currentPasswordPassword" required>
            </div>
            <button type="submit" class="btn btn-warning" :disabled="passwordLoading">
            <span v-if="passwordLoading" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            <span v-else>Change Password</span>
            </button>
            <div v-if="passwordMessage" :class="['alert mt-3', passwordMessage.type === 'success' ? 'alert-success' : 'alert-danger']">
            {{ passwordMessage.text }}
            </div>
        </form>

        <hr class="my-5">

        <h5 class="mb-3">Manage Sign-in Methods</h5>
        <div class="mb-3">
            <p>Currently linked methods:</p>
            <ul class="list-group">
            <li v-for="provider in linkedProviders" :key="provider" class="list-group-item d-flex justify-content-between align-items-center">
                {{ formatProviderName(provider) }}
                <button v-if="linkedProviders.length > 1 || !isEmailPasswordLinked"
                        @click="unlinkProvider(provider)"
                        class="btn btn-sm btn-danger"
                        :disabled="unlinkLoading[provider]">
                <span v-if="unlinkLoading[provider]" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                <span v-else>Unlink</span>
                </button>
                <span v-else class="text-muted">Must have at least one sign-in method</span>
            </li>
            <li v-if="linkedProviders.length === 0" class="list-group-item text-muted">
                No sign-in methods linked. You should link at least one.
            </li>
            </ul>
        </div>

        <div class="mb-4">
            <p>Link new methods:</p>
            <button v-if="!isGoogleLinked" @click="linkGoogle" class="btn btn-outline-primary me-2" :disabled="linkLoading.google">
            <span v-if="linkLoading.google" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            <span v-else><i class="bi bi-google me-2"></i> Link Google</span>
            </button>
            </div>
        <div v-if="linkUnlinkMessage" :class="['alert mt-3', linkUnlinkMessage.type === 'success' ? 'alert-success' : 'alert-danger']">
            {{ linkUnlinkMessage.text }}
        </div>
        </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { getDoc, doc, updateDoc, setDoc } from 'firebase/firestore'; // Added setDoc for potential new student profiles
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  linkWithPopup,
  unlink,
} from 'firebase/auth';

const nuxtApp = useNuxtApp();
const auth = nuxtApp.$auth;
const db = nuxtApp.$db;

// --- Profile Data State ---
const profileForm = ref({
  name: '',
  email: '', // Add email to profileForm for display (though it's disabled)
  role: '',
  classId: null,
  className: '',
  // Add other student-specific fields here if they are part of their profile
  // e.g., gradeLevel: '',
});
const loadingProfile = ref(true);
const profileLoading = ref(false);
const profileMessage = ref(null);

// --- Change Email State ---
const newEmail = ref('');
const currentPasswordEmail = ref('');
const emailLoading = ref(false);
const emailMessage = ref(null);

// --- Change Password State ---
const newPassword = ref('');
const confirmNewPassword = ref('');
const currentPasswordPassword = ref('');
const passwordLoading = ref(false);
const passwordMessage = ref(null);

// --- Link/Unlink Social State ---
const linkedProviders = ref([]);
const linkLoading = ref({ google: false /* add other providers */ });
const unlinkLoading = ref({});
const linkUnlinkMessage = ref(null);

// --- Computed Properties for Provider Management ---
const isEmailPasswordLinked = computed(() =>
  linkedProviders.value.includes('password')
);
const isGoogleLinked = computed(() =>
  linkedProviders.value.includes('google.com')
);

// --- Fetch User Profile on Mount ---
onMounted(async () => {
  if (!auth.currentUser) {
    // Optionally redirect to login or show a message if not logged in
    return;
  }
  await fetchUserProfile();
  updateLinkedProviders();
});

const fetchUserProfile = async () => {
  loadingProfile.value = true;
  profileMessage.value = null;
  try {
    const user = auth.currentUser;
    if (!user) {
      profileMessage.value = { text: 'No user logged in.', type: 'danger' };
      loadingProfile.value = false;
      return;
    }

    // 1. Fetch data from /users/{uid}
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      profileForm.value.email = user.email; // Always use Auth email for display
      profileForm.value.name = userData.name || user.displayName || user.email.split('@')[0]; // Fallback to Auth display name/email
      profileForm.value.role = userData.role || '';

      // 2. If role is 'student', fetch additional data from /students/{studentId}
      if (userData.role === 'student') {
        // Assuming studentId in /users is the same as uid, or stored there
        const studentId = userData.studentId || user.uid;
        const studentDocRef = doc(db, 'students', studentId);
        const studentDoc = await getDoc(studentDocRef);

        if (studentDoc.exists()) {
          const studentData = studentDoc.data();
          profileForm.value.name = studentData.name || profileForm.value.name; // Student's name from /students takes precedence
          profileForm.value.classId = studentData.classId || null;
          // Assign other student-specific fields from studentData here if needed
          // profileForm.value.gradeLevel = studentData.gradeLevel;
        } else {
          // IMPORTANT: If a user is marked as 'student' in /users but no /students doc exists,
          // this indicates an incomplete profile. You might create one here or flag it.
          console.warn(`Student profile for UID ${user.uid} (studentId: ${studentId}) not found in /students. Creating a basic one.`);
          await setDoc(studentDocRef, {
            name: profileForm.value.name,
            classId: profileForm.value.classId, // Default or null
            // Add other default student fields here
          }, { merge: true });
        }
      }
      // 3. If role is 'teacher', their classId might be directly on the /users doc
      else if (userData.role === 'teacher') {
        profileForm.value.classId = userData.classId || null;
      }

      // 4. Fetch class name if classId exists (from either users or students doc)
      if (profileForm.value.classId) {
        const classDocRef = doc(db, 'classes', profileForm.value.classId);
        const classDoc = await getDoc(classDocRef);
        if (classDoc.exists()) {
          profileForm.value.className = classDoc.data().name;
        } else {
          profileForm.value.className = 'Unknown Class';
        }
      }

    } else {
      profileMessage.value = { text: 'User profile not found in /users. Please contact support.', type: 'danger' };
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    profileMessage.value = { text: 'Error loading profile data.', type: 'danger' };
  } finally {
    loadingProfile.value = false;
  }
};

const updateLinkedProviders = () => {
  if (auth.currentUser) {
    linkedProviders.value = auth.currentUser.providerData.map(p => p.providerId);
  }
};

const formatProviderName = (providerId) => {
  switch (providerId) {
    case 'password': return 'Email/Password';
    case 'google.com': return 'Google';
    case 'facebook.com': return 'Facebook';
    case 'github.com': return 'GitHub';
    case 'twitter.com': return 'Twitter';
    case 'apple.com': return 'Apple';
    case 'phone': return 'Phone Number';
    default: return providerId;
  }
};

// --- Profile Update Logic ---
const updateProfile = async () => {
  profileLoading.value = true;
  profileMessage.value = null;
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in.');

    // 1. Update name in /users/{uid} document
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, {
      name: profileForm.value.name,
      // You can add other common editable fields here if stored on /users doc
    });

    // 2. If user is a student, update their /students/{studentId} document as well
    if (profileForm.value.role === 'student') {
        const studentId = profileForm.value.studentId || user.uid; // Assuming studentId is same as uid
        const studentDocRef = doc(db, 'students', studentId);
        await updateDoc(studentDocRef, {
            name: profileForm.value.name,
            // Add other student-specific editable fields here (e.g., profileForm.value.gradeLevel)
        }, { merge: true }); // Use merge to prevent overwriting other student data
    }

    // Also update Firebase Auth profile display name if it should reflect
    await user.updateProfile({ displayName: profileForm.value.name });

    profileMessage.value = { text: 'Profile updated successfully!', type: 'success' };
  } catch (error) {
    console.error('Error updating profile:', error);
    profileMessage.value = { text: 'Failed to update profile: ' + error.message, type: 'danger' };
  } finally {
    profileLoading.value = false;
  }
};

// --- Email Change Logic (remains the same) ---
const changeEmail = async () => {
  emailLoading.value = true;
  emailMessage.value = null;
  try {
    if (!auth.currentUser) throw new Error('No user logged in.');

    // Re-authenticate user first (required for sensitive operations like email change)
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPasswordEmail.value);
    await reauthenticateWithCredential(auth.currentUser, credential);

    await updateEmail(auth.currentUser, newEmail.value);
    emailMessage.value = { text: 'Email updated successfully! Please re-login with your new email.', type: 'success' };
    // Optionally sign out the user here to force re-login
    await auth.signOut();
    useRouter().push('/login'); // Redirect to login page
  } catch (error) {
    console.error('Error changing email:', error);
    let msg = 'Failed to change email. ';
    switch (error.code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        msg += 'Incorrect current password.';
        break;
      case 'auth/user-not-found':
        msg += 'User not found.';
        break;
      case 'auth/invalid-email':
        msg += 'New email is invalid.';
        break;
      case 'auth/email-already-in-use':
        msg += 'This email is already in use by another account.';
        break;
      case 'auth/requires-recent-login':
        msg += 'Please re-login and try again (session expired).';
        break;
      default:
        msg += error.message;
    }
    emailMessage.value = { text: msg, type: 'danger' };
  } finally {
    emailLoading.value = false;
  }
};

// --- Password Change Logic (remains the same) ---
const changePassword = async () => {
  passwordLoading.value = true;
  passwordMessage.value = null;
  try {
    if (!auth.currentUser) throw new Error('No user logged in.');
    if (newPassword.value !== confirmNewPassword.value) {
      throw new Error('New passwords do not match.');
    }
    if (newPassword.value.length < 6) {
      throw new Error('Password should be at least 6 characters.');
    }

    // Re-authenticate user first
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPasswordPassword.value);
    await reauthenticateWithCredential(auth.currentUser, credential);

    await updatePassword(auth.currentUser, newPassword.value);
    passwordMessage.value = { text: 'Password updated successfully!', type: 'success' };
    newPassword.value = '';
    confirmNewPassword.value = '';
    currentPasswordPassword.value = '';
  } catch (error) {
    console.error('Error changing password:', error);
    let msg = 'Failed to change password. ';
    switch (error.code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        msg += 'Incorrect current password.';
        break;
      case 'auth/user-not-found':
        msg += 'User not found.';
        break;
      case 'auth/weak-password':
        msg += 'Password is too weak.';
        break;
      case 'auth/requires-recent-login':
        msg += 'Please re-login and try again (session expired).';
        break;
      default:
        msg += error.message;
    }
    passwordMessage.value = { text: msg, type: 'danger' };
  } finally {
    passwordLoading.value = false;
  }
};

// --- Link Social Account Logic (Google Example - remains the same) ---
const linkGoogle = async () => {
  linkLoading.value.google = true;
  linkUnlinkMessage.value = null;
  try {
    if (!auth.currentUser) throw new Error('No user logged in.');

    const provider = new GoogleAuthProvider();
    await linkWithPopup(auth.currentUser, provider);
    updateLinkedProviders(); // Refresh the list of linked providers
    linkUnlinkMessage.value = { text: 'Google account linked successfully!', type: 'success' };
  } catch (error) {
    console.error('Error linking Google account:', error);
    let msg = 'Failed to link Google account. ';
    switch (error.code) {
      case 'auth/credential-already-in-use':
        msg += 'This Google account is already linked to another user.';
        break;
      case 'auth/provider-already-linked':
        msg += 'Google account is already linked to this user.';
        break;
      case 'auth/popup-closed-by-user':
        msg += 'Google linking popup was closed.';
        break;
      default:
        msg += error.message;
    }
    linkUnlinkMessage.value = { text: msg, type: 'danger' };
  } finally {
    linkLoading.value.google = false;
  }
};

// --- Unlink Social Account Logic (remains the same) ---
const unlinkProvider = async (providerId) => {
  unlinkLoading.value[providerId] = true;
  linkUnlinkMessage.value = null;
  try {
    if (!auth.currentUser) throw new Error('No user logged in.');

    // Ensure user has at least one sign-in method after unlinking
    if (auth.currentUser.providerData.length === 1 && providerId === auth.currentUser.providerData[0].providerId) {
      throw new Error('You must have at least one sign-in method enabled.');
    }

    await unlink(auth.currentUser, providerId);
    updateLinkedProviders(); // Refresh the list
    linkUnlinkMessage.value = { text: `${formatProviderName(providerId)} unlinked successfully!`, type: 'success' };
  } catch (error) {
    console.error(`Error unlinking ${providerId} account:`, error);
    let msg = `Failed to unlink ${formatProviderName(providerId)} account. `;
    switch (error.code) {
      case 'auth/no-such-provider':
        msg += 'Provider not found.';
        break;
      case 'auth/requires-recent-login':
        msg += 'Please re-login and try again (session expired).';
        break;
      case 'auth/credential-already-in-use':
        msg += 'This provider is already in use by another account.';
        break;
      case 'auth/too-many-requests':
        msg += 'Too many requests. Try again later.';
        break;
      default:
        msg += error.message;
    }
    linkUnlinkMessage.value = { text: msg, type: 'danger' };
  } finally {
    unlinkLoading.value[providerId] = false;
  }
};

</script>