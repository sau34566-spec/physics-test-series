// Candidate authentication intentionally uses a named Firebase app.
// This keeps an anonymous candidate session separate from Admin/Super Admin
// sessions on the same GitHub Pages origin.

import {
    initializeApp,
    getApp,
    getApps
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    firebaseConfig
} from "./firebase-config.js";

const CANDIDATE_APP_NAME = "candidate-portal";

const candidateApp =
    getApps().some(app => app.name === CANDIDATE_APP_NAME)
        ? getApp(CANDIDATE_APP_NAME)
        : initializeApp(firebaseConfig, CANDIDATE_APP_NAME);

const candidateAuth = getAuth(candidateApp);
const candidateDb = getFirestore(candidateApp);

async function ensureCandidateSession() {
    if (candidateAuth.currentUser) {
        return candidateAuth.currentUser;
    }

    const credential = await signInAnonymously(candidateAuth);
    return credential.user;
}

export {
    candidateApp,
    candidateAuth,
    candidateDb,
    ensureCandidateSession
};
