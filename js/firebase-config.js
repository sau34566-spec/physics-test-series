/* =========================================================
   FIREBASE CONFIGURATION
   File: /js/firebase-config.js

   IMPORTANT:
   Replace the placeholder values below with the Firebase
   configuration from:

   Firebase Console
   → Project Settings
   → Your apps
   → Web app
   → Firebase SDK snippet
   ========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
   ========================================================= */

const firebaseConfig = {

    apiKey:
        "YOUR_FIREBASE_API_KEY",

    authDomain:
        "YOUR_PROJECT_ID.firebaseapp.com",

    projectId:
        "YOUR_PROJECT_ID",

    storageBucket:
        "YOUR_PROJECT_ID.firebasestorage.app",

    messagingSenderId:
        "YOUR_MESSAGING_SENDER_ID",

    appId:
        "YOUR_FIREBASE_APP_ID"

};


/* =========================================================
   INITIALIZE FIREBASE
   ========================================================= */

const app =
    initializeApp(
        firebaseConfig
    );


/* =========================================================
   FIREBASE AUTH
   ========================================================= */

const auth =
    getAuth(
        app
    );


/* =========================================================
   FIRESTORE
   ========================================================= */

const db =
    getFirestore(
        app
    );


/* =========================================================
   EXPORT
   ========================================================= */

export {
    app,
    auth,
    db
};
