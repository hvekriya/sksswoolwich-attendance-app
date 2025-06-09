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

/**
 * Cloud Function to create a new class with name and teacherIds.
 * Callable by authenticated admin users.
 * Adds a new document to the 'classes' collection.
 */
exports.createClass = https.onCall(async (request) => {
  // 1. Authentication Check
  if (!request.auth) {
    throw new https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const callerUid = request.auth.uid;

  // 2. Authorization Check: Only admins can create classes
  let callerUserDoc;
  try {
    callerUserDoc = await db.collection("users").doc(callerUid).get();
  } catch (error: any) {
    console.error(
      `Error fetching caller's user document (${callerUid}):`,
      error
    );
    throw new https.HttpsError(
      "internal",
      "Could not verify caller identity."
    );
  }

  if (!callerUserDoc.exists || callerUserDoc.data()?.role !== "admin") {
    throw new https.HttpsError(
      "permission-denied",
      "Only administrators can create classes."
    );
  }

  // 3. Input Data Validation
  interface CreateClassData {
    name: string;
    teacherIds: string[]; // Expect an array of strings
  }

  const { name, teacherIds } = request.data as CreateClassData;

  // Validate 'name'
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new https.HttpsError(
      "invalid-argument",
      "Class name is required and must be a non-empty string."
    );
  }

  // Validate 'teacherIds'
  if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
    throw new https.HttpsError(
      "invalid-argument",
      "At least one teacher ID is required for the class."
    );
  }
  // Ensure all elements in the array are non-empty strings
  if (!teacherIds.every(id => typeof id === "string" && id.trim() !== "")) {
    throw new https.HttpsError(
      "invalid-argument",
      "All teacher IDs must be non-empty strings."
    );
  }

  // Optional: You could add a check here to verify if these teacherIds actually belong to existing teachers in your 'users' collection.
  // This would involve additional Firestore reads within the function.
  // For example:
  // const teachersExist = await Promise.all(teacherIds.map(async (id) => {
  //   const teacherDoc = await db.collection('users').doc(id).get();
  //   return teacherDoc.exists && teacherDoc.data()?.role === 'teacher';
  // }));
  // if (!teachersExist.every(Boolean)) {
  //   throw new https.HttpsError('invalid-argument', 'One or more provided teacher IDs are invalid or do not belong to a teacher.');
  // }


  try {
    // 4. Create new class document in Firestore
    const newClassRef = await db.collection("classes").add({
      name: name.trim(),
      teacherIds: teacherIds.map(id => id.trim()), // Trim IDs as well
      createdAt: FieldValue.serverTimestamp(),
      createdBy: callerUid, // Store who created the class
    });

    console.log(
      `New class '${name}' created with teachers ${teacherIds.join(', ')} by admin ${callerUid}. ID: ${newClassRef.id}`
    );

    // 5. Return success response
    return {
      success: true,
      message: `Class '${name}' created successfully!`,
      classId: newClassRef.id,
    };
  } catch (error: any) {
    console.error("Error creating class:", error);
    throw new https.HttpsError(
      "internal",
      "Failed to create class due to an internal server error.",
      error.message
    );
  }
});