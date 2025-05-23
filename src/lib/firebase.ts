
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAmJn-Kyy-efCeEqvjSZBADRLasPNXkShc",
  authDomain: "aconic-examiner.firebaseapp.com",
  projectId: "aconic-examiner",
  storageBucket: "aconic-examiner.firebasestorage.app",
  messagingSenderId: "836588880993",
  appId: "1:836588880993:web:209d3f7cf414300258d620",
  measurementId: "G-C5GDZT3L32"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp(); // Use existing app if already initialized
}

const authInstance: Auth = getAuth(app);

let analytics: Analytics | undefined;
// Initialize Analytics only on the client side
if (typeof window !== 'undefined') {
  try {
    // Check if measurementId is present before initializing analytics,
    // as it's required for some Firebase projects / newer SDK versions.
    if (firebaseConfig.measurementId) {
      analytics = getAnalytics(app);
    } else {
      console.warn("Firebase Analytics not initialized because measurementId is missing from firebaseConfig.");
    }
  } catch (error) {
    console.warn("Firebase Analytics could not be initialized.", error);
    // Analytics might fail if certain conditions aren't met (e.g., blocked by browser extension)
  }
}

export { app, authInstance as auth, analytics };
