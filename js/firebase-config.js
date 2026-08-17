import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA8XeHrqnYP1FEpwpqUZEdKsVAJGDw2r7o",
  authDomain: "physics-test-series-405c7.firebaseapp.com",
  projectId: "physics-test-series-405c7",
  storageBucket: "physics-test-series-405c7.firebasestorage.app",
  messagingSenderId: "758620061190",
  appId: "1:758620061190:web:dbbc7759c95b5e7d8b8d87",
  measurementId: "G-Z5QVQMZ082"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Firebase Authentication
const auth = getAuth(app);

// Cloud Firestore
const db = getFirestore(app);


// Export Firebase services
export {
  app,
  auth,
  db
};
