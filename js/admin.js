import { auth, db } from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// =====================================================
// DOM ELEMENTS
// =====================================================

const loginScreen = document.getElementById("adminLoginScreen");
const dashboard = document.getElementById("adminDashboard");

const loginForm = document.getElementById("adminLoginForm");

const emailInput = document.getElementById("adminEmail");
const passwordInput = document.getElementById("adminPassword");

const loginBtn = document.getElementById("adminLoginBtn");
const loginMessage = document.getElementById("adminLoginMessage");

const logoutBtn = document.getElementById("adminLogoutBtn");

const adminName = document.getElementById("adminName");


// =====================================================
// HELPER - SHOW MESSAGE
// =====================================================

function showMessage(message, type = "error") {

    if (!loginMessage) return;

    loginMessage.textContent = message;
    loginMessage.style.display = "block";

    loginMessage.className = "admin-login-message";

    if (type === "success") {
        loginMessage.classList.add("success");
    } else {
        loginMessage.classList.add("error");
    }
}


// =====================================================
// SHOW DASHBOARD
// =====================================================

function showDashboard(adminData = {}) {

    if (loginScreen) {
        loginScreen.style.display = "none";
    }

    if (dashboard) {
        dashboard.classList.add("active");
        dashboard.style.display = "flex";
    }

    if (adminName && adminData.name) {
        adminName.textContent = adminData.name;
    }

}


// =====================================================
// SHOW LOGIN
// =====================================================

function showLogin() {

    if (dashboard) {
        dashboard.classList.remove("active");
        dashboard.style.display = "none";
    }

    if (loginScreen) {
        loginScreen.style.display = "flex";
    }

}


// =====================================================
// CHECK AUTHORIZED ADMIN
// =====================================================

async function checkAuthorizedAdmin(user) {

    if (!user) {
        return null;
    }

    try {

        // Admin document ID = Firebase Authentication UID
        const adminRef = doc(
            db,
            "admins",
            user.uid
        );

        const adminSnapshot = await getDoc(adminRef);


        // Admin document doesn't exist
        if (!adminSnapshot.exists()) {

            console.error(
                "Admin document not found for UID:",
                user.uid
            );

            return null;
        }


        const adminData = adminSnapshot.data();


        // Check active status
        if (adminData.active !== true) {

            console.error(
                "Admin account is inactive."
            );

            return null;
        }


        // Check email
        if (
            adminData.email &&
            adminData.email.toLowerCase() !==
            user.email.toLowerCase()
        ) {

            console.error(
                "Admin email does not match."
            );

            return null;
        }


        return adminData;

    } catch (error) {

        console.error(
            "Admin authorization check failed:",
            error
        );

        throw error;
    }
}


// =====================================================
// ADMIN LOGIN
// =====================================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const email =
                emailInput.value.trim().toLowerCase();

            const password =
                passwordInput.value;


            // Empty fields
            if (!email || !password) {

                showMessage(
                    "Please enter your admin email and password."
                );

                return;
            }


            try {

                // Disable button
                loginBtn.disabled = true;
                loginBtn.textContent = "Signing in...";

                if (loginMessage) {
                    loginMessage.style.display = "none";
                }


                // ==========================================
                // FIREBASE AUTHENTICATION
                // ==========================================

                const credential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );


                const user = credential.user;


                console.log(
                    "Firebase authentication successful:",
                    user.email
                );


                // ==========================================
                // AUTHORIZED ADMIN CHECK
                // ==========================================

                const adminData =
                    await checkAuthorizedAdmin(user);


                if (!adminData) {

                    await signOut(auth);

                    showMessage(
                        "This account is not authorized to access the Admin Panel."
                    );

                    return;
                }


                // ==========================================
                // SUCCESS
                // ==========================================

                console.log(
                    "Authorized admin login successful."
                );


                showDashboard(adminData);


            } catch (error) {

                console.error(
                    "Admin login error:",
                    error
                );


                let message =
                    "Unable to sign in. Please try again.";


                if (
                    error.code ===
                    "auth/invalid-credential"
                ) {

                    message =
                        "Incorrect email or password.";

                } else if (
                    error.code ===
                    "auth/user-not-found"
                ) {

                    message =
                        "No administrator account was found with this email.";

                } else if (
                    error.code ===
                    "auth/wrong-password"
                ) {

                    message =
                        "Incorrect administrator password.";

                } else if (
                    error.code ===
                    "auth/invalid-email"
                ) {

                    message =
                        "Please enter a valid email address.";

                } else if (
                    error.code ===
                    "permission-denied"
                ) {

                    message =
                        "Firebase permission denied. Firestore Security Rules need to be configured.";

                }


                showMessage(message);


            } finally {

                loginBtn.disabled = false;
                loginBtn.textContent =
                    "Sign In to Dashboard";

            }

        }
    );

}


// =====================================================
// LOGOUT
// =====================================================

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async () => {

            try {

                await signOut(auth);

                showLogin();

                if (emailInput) {
                    emailInput.value = "";
                }

                if (passwordInput) {
                    passwordInput.value = "";
                }

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

            }

        }
    );

}


// =====================================================
// AUTH STATE LISTENER
// =====================================================

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            showLogin();

            return;
        }


        try {

            console.log(
                "Existing Firebase session found:",
                user.email
            );


            const adminData =
                await checkAuthorizedAdmin(user);


            if (adminData) {

                showDashboard(adminData);

            } else {

                await signOut(auth);

                showLogin();
            }


        } catch (error) {

            console.error(
                "Session authorization error:",
                error
            );

            await signOut(auth);

            showLogin();
        }

    }
);
