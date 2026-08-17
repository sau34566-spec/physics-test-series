import { auth, db } from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const adminLoginScreen = document.getElementById("adminLoginScreen");
const adminDashboard = document.getElementById("adminDashboard");

const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminLoginMessage = document.getElementById("adminLoginMessage");


// ===============================
// ADMIN LOGIN
// ===============================

adminLoginBtn.addEventListener("click", async () => {

    const email = adminEmail.value.trim().toLowerCase();
    const password = adminPassword.value;

    if (!email || !password) {
        showLoginMessage("Please enter your email and password.");
        return;
    }

    try {

        adminLoginBtn.disabled = true;
        adminLoginBtn.textContent = "Signing in...";

        // Firebase Authentication
        const userCredential =
            await signInWithEmailAndPassword(auth, email, password);

        const user = userCredential.user;

        // Check authorized admin
        const adminsRef = collection(db, "admins");

        const q = query(
            adminsRef,
            where("email", "==", user.email.toLowerCase())
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {

            await signOut(auth);

            showLoginMessage(
                "This account is not authorized to access the Admin Panel."
            );

            return;
        }

        const adminData = snapshot.docs[0].data();

        if (adminData.active !== true) {

            await signOut(auth);

            showLoginMessage(
                "Your administrator account is currently inactive."
            );

            return;
        }

        // Login successful
        showDashboard();

    } catch (error) {

        console.error("Admin login error:", error);

        showLoginMessage(
            "Invalid email or password. Please try again."
        );

    } finally {

        adminLoginBtn.disabled = false;
        adminLoginBtn.textContent = "Sign In";
    }
});


// ===============================
// SHOW LOGIN MESSAGE
// ===============================

function showLoginMessage(message) {

    if (adminLoginMessage) {
        adminLoginMessage.textContent = message;
        adminLoginMessage.style.display = "block";
    } else {
        alert(message);
    }
}


// ===============================
// SHOW DASHBOARD
// ===============================

function showDashboard() {

    if (adminLoginScreen) {
        adminLoginScreen.classList.remove("active");
    }

    if (adminDashboard) {
        adminDashboard.classList.add("active");
    }
}


// ===============================
// AUTH STATE
// ===============================

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        return;
    }

    try {

        const adminsRef = collection(db, "admins");

        const q = query(
            adminsRef,
            where("email", "==", user.email.toLowerCase())
        );

        const snapshot = await getDocs(q);

        if (
            !snapshot.empty &&
            snapshot.docs[0].data().active === true
        ) {
            showDashboard();
        } else {
            await signOut(auth);
        }

    } catch (error) {

        console.error("Authorization check failed:", error);

        await signOut(auth);
    }
});
