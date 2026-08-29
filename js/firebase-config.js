// ============================================================
// FIREBASE CONFIGURATION
// Physics Test Series
// Firebase Project: superadmin-2c2f1
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
        "AIzaSyDiT409aEWfaxgqleQRmUKx5D1dXizI9jY",

    authDomain:
        "superadmin-2c2f1.firebaseapp.com",

    projectId:
        "superadmin-2c2f1",

    storageBucket:
        "superadmin-2c2f1.firebasestorage.app",

    messagingSenderId:
        "202833459334",

    appId:
        "1:202833459334:web:54a9a98be11b0a1074f907",

    measurementId:
        "G-XFK07Q78EL"
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
