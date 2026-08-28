// ============================================================
// FIREBASE CONFIGURATION
// Physics Test Series
// Firebase Project: physics-test-2b91a
// ============================================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ============================================================
// FIREBASE CONFIG
// ============================================================

const firebaseConfig = {

    apiKey:
        "AIzaSyAKbcsJILXKkng3eWv5mt0UwCrFvCoXVH8",

    authDomain:
        "physics-test-2b91a.firebaseapp.com",

    projectId:
        "physics-test-2b91a",

    storageBucket:
        "physics-test-2b91a.firebasestorage.app",

    messagingSenderId:
        "934239266562",

    appId:
        "1:934239266562:web:96cd91f0ce771b208b041b",

    measurementId:
        "G-M14TXE09JR"
};


// ============================================================
// INITIALIZE FIREBASE
// ============================================================

const app =
    initializeApp(
        firebaseConfig
    );


// ============================================================
// FIREBASE AUTHENTICATION
// ============================================================

const auth =
    getAuth(
        app
    );


// ============================================================
// FIRESTORE DATABASE
// ============================================================

const db =
    getFirestore(
        app
    );


// ============================================================
// EXPORT
// ============================================================

export {
    app,
    auth,
    db
};
