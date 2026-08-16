import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyA8XeHrqnYP1FEpwpqUZEdKsVAJGDw2r7o",
  authDomain: "physics-test-series-405c7.firebaseapp.com",
  projectId: "physics-test-series-405c7",
  storageBucket: "physics-test-series-405c7.firebasestorage.app",
  messagingSenderId: "758620061190",
  appId: "1:758620061190:web:dbbc7759c95b5e7d8b8d87",
  measurementId: "G-Z5QVQMZ082"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const analytics = getAnalytics(app);

export { app, auth, db, functions, analytics };