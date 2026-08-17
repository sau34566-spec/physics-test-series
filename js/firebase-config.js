import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
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

export { app, auth, db };
