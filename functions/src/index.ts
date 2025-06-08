// functions/src/index.ts (Cloud Functions V2 syntax with TypeScript)
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore"; // Import FieldValue
import { getAuth } from "firebase-admin/auth";

// Import V2 functions specific modules
import { https, setGlobalOptions } from "firebase-functions/v2"; // Combined import

// Initialize Firebase Admin SDK
initializeApp();

const db = getFirestore();
const auth = getAuth();

// Set global options for all functions in this file
setGlobalOptions({
  region: "europe-west3", // Your desired region
});

/**
 * Cloud Function to add a new teacher.
 * This function is callable by authenticated clients (e.g., your admin).
 * It creates a Firebase Auth user and a corresponding Firestore user document.
 */
exports.addTeacher = https.onCall(async (request) => {
  // 1. Authentication and Authorization Check
  if (!request.auth) {
    throw new https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // Get the UID of the caller (the admin)
  const callerUid = request.auth.uid;

  // Retrieve the caller's role from Firestore to ensure they are an admin
  let callerUserDoc;
  try {
    callerUserDoc = await db.collection("users").doc(callerUid).get();
  } catch (error: any) { // Explicitly typing error as 'any' or 'unknown' when catching
    console.error(
      `Error fetching caller's user document (${callerUid}):`,
      error
    );
    throw new https.HttpsError(
      "internal",
      "Could not verify caller identity."
    );
  }

  if (!callerUserDoc.exists || callerUserDoc.data()?.role !== "admin") { // Using optional chaining for data()
    throw new https.HttpsError(
      "permission-denied",
      "Only administrators can add teachers."
    );
  }

  // 2. Input Data Validation
  // Define an interface for clearer type checking of incoming data
  interface AddTeacherData {
    email: string;
    password?: string; // Password can be optional if you auto-generate, but currently required
    name: string;
    classId: string;
  }

  const { email, password, name, classId } = request.data as AddTeacherData; // Type assertion for incoming data

  if (!email || !password || !name || !classId) {
    throw new https.HttpsError(
      "invalid-argument",
      "Missing one or more required fields (email, password, name, classId)."
    );
  }
  if (
    typeof email !== "string" ||
    !email.includes("@") ||
    password.length < 6
  ) {
    throw new https.HttpsError(
      "invalid-argument",
      "Invalid email format or password too short (min 6 characters)."
    );
  }
  if (typeof name !== "string" || typeof classId !== "string") {
    throw new https.HttpsError(
      "invalid-argument",
      "Name and classId must be strings."
    );
  }

  try {
    // 3. Create user in Firebase Authentication
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: name,
    });

    const newUserId = userRecord.uid;

    // 4. Create user profile in Firestore
    await db.collection("users").doc(newUserId).set({
      email: email,
      name: name,
      role: "teacher", // Assign the teacher role
      classId: classId,
      createdAt: FieldValue.serverTimestamp(), // Use FieldValue from firebase-admin/firestore
      addedBy: callerUid, // Optionally store who added this teacher
    });

    console.log(
      `Teacher ${name} (${email}) added successfully by admin ${callerUid}.`
    );

    // 5. Return success response
    return {
      success: true,
      message: `Teacher ${name} added successfully with ID: ${newUserId}`,
    };
  } catch (error: any) { // Explicitly typing error as 'any'
    // 6. Handle errors
    console.error("Error creating teacher:", error);

    if (error.code === "auth/email-already-in-use") {
      throw new https.HttpsError(
        "already-exists",
        "The email address is already in use by another account.",
        error.message
      );
    }
    // General error fallback
    throw new https.HttpsError(
      "internal",
      "Failed to add teacher due to an internal server error.",
      error.message
    );
  }
});