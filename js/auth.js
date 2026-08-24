/* =========================================================
   AUTHENTICATION MODULE
   Super Admin / Admin Authentication
   Firebase Authentication + Firestore
   ========================================================= */

import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";


/* =========================================================
   CONFIG
   ========================================================= */

const AUTH_CONFIG = {
    usersCollection: "users",
    adminsCollection: "admins",

    allowedSuperAdminRoles: [
        "super_admin",
        "superadmin",
        "super-admin"
    ],

    activeStatuses: [
        "active",
        "approved",
        ""
    ],

    blockedStatuses: [
        "suspended",
        "revoked",
        "disabled",
        "blocked",
        "inactive"
    ]
};


/* =========================================================
   STATE
   ========================================================= */

const AuthState = {
    initialized: false,
    loading: false,

    user: null,
    profile: null,

    role: null,
    status: null,

    authorized: false,

    lastError: null
};


/* =========================================================
   HELPERS
   ========================================================= */

function normalize(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase();
}

function $(id) {
    return document.getElementById(id);
}

function showToast(
    title,
    message,
    type = "info"
) {
    if (
        window.showToast &&
        typeof window.showToast === "function"
    ) {
        window.showToast(
            title,
            message,
            type
        );
        return;
    }

    if (
        window.SuperAdminUI &&
        typeof window.SuperAdminUI.showToast === "function"
    ) {
        window.SuperAdminUI.showToast(
            title,
            message,
            type
        );
        return;
    }

    console.log(
        `[${type}] ${title}: ${message}`
    );
}

function showLoginScreen() {
    const loginScreen =
        $("loginScreen");

    const appShell =
        $("appShell");

    if (loginScreen) {
        loginScreen.style.display =
            "flex";
    }

    if (appShell) {
        appShell.classList.remove(
            "active"
        );

        appShell.style.display =
            "none";
    }

    if (
        window.SuperAdminUI &&
        typeof window.SuperAdminUI.showLogin ===
            "function"
    ) {
        window.SuperAdminUI.showLogin();
    }
}

function showApplicationScreen() {
    const loginScreen =
        $("loginScreen");

    const appShell =
        $("appShell");

    if (loginScreen) {
        loginScreen.style.display =
            "none";
    }

    if (appShell) {
        appShell.style.display =
            "flex";

        appShell.classList.add(
            "active"
        );
    }

    if (
        window.SuperAdminUI &&
        typeof window.SuperAdminUI.showApplication ===
            "function"
    ) {
        window.SuperAdminUI.showApplication();
    }
}


/* =========================================================
   PROFILE LOADING
   ========================================================= */

async function getUserProfile(
    uid
) {
    if (!uid) {
        return null;
    }

    /*
     * Primary profile:
     * users/{uid}
     */

    try {
        const userRef =
            doc(
                db,
                AUTH_CONFIG.usersCollection,
                uid
            );

        const snapshot =
            await getDoc(userRef);

        if (snapshot.exists()) {
            return {
                id: snapshot.id,
                source: "users",
                ...snapshot.data()
            };
        }
    } catch (error) {
        console.warn(
            "users profile lookup failed:",
            error
        );
    }


    /*
     * Fallback:
     * admins/{uid}
     */

    try {
        const adminRef =
            doc(
                db,
                AUTH_CONFIG.adminsCollection,
                uid
            );

        const snapshot =
            await getDoc(adminRef);

        if (snapshot.exists()) {
            return {
                id: snapshot.id,
                source: "admins",
                ...snapshot.data()
            };
        }
    } catch (error) {
        console.warn(
            "admins profile lookup failed:",
            error
        );
    }


    return null;
}


/* =========================================================
   ROLE CHECK
   ========================================================= */

function isSuperAdminRole(
    role
) {
    return AUTH_CONFIG
        .allowedSuperAdminRoles
        .includes(
            normalize(role)
        );
}


/* =========================================================
   STATUS CHECK
   ========================================================= */

function isAccountBlocked(
    status
) {
    const normalized =
        normalize(status);

    return AUTH_CONFIG
        .blockedStatuses
        .includes(
            normalized
        );
}

function isAccountActive(
    status
) {
    const normalized =
        normalize(status);

    if (
        isAccountBlocked(
            normalized
        )
    ) {
        return false;
    }

    return (
        AUTH_CONFIG
            .activeStatuses
            .includes(
                normalized
            ) ||
        normalized === ""
    );
}


/* =========================================================
   SUPER ADMIN AUTHORIZATION
   ========================================================= */

async function authorizeSuperAdmin(
    firebaseUser
) {
    if (!firebaseUser) {
        return {
            authorized: false,
            reason: "NO_USER",
            profile: null
        };
    }


    /*
     * Firebase email verification
     *
     * We don't automatically reject every account here
     * because the existing project may use a controlled
     * admin creation flow.
     *
     * If email verification is required by your final
     * Firestore rules, that requirement must also be
     * enforced there.
     */


    const profile =
        await getUserProfile(
            firebaseUser.uid
        );

    if (!profile) {
        return {
            authorized: false,
            reason: "PROFILE_NOT_FOUND",
            profile: null
        };
    }


    const role =
        normalize(
            profile.role
        );

    const status =
        normalize(
            profile.status ||
            "active"
        );


    if (
        !isSuperAdminRole(
            role
        )
    ) {
        return {
            authorized: false,
            reason: "ROLE_NOT_ALLOWED",
            profile
        };
    }


    if (
        !isAccountActive(
            status
        )
    ) {
        return {
            authorized: false,
            reason:
                `ACCOUNT_${status.toUpperCase()}`,
            profile
        };
    }


    /*
     * Optional suspension expiry check.
     */

    if (
        profile.suspensionUntil
    ) {
        const suspensionUntil =
            profile.suspensionUntil?.toDate
                ? profile.suspensionUntil.toDate()
                : new Date(
                    profile.suspensionUntil
                );

        if (
            !Number.isNaN(
                suspensionUntil.getTime()
            ) &&
            suspensionUntil.getTime() >
                Date.now()
        ) {
            return {
                authorized: false,
                reason:
                    "TEMPORARILY_SUSPENDED",
                profile
            };
        }
    }


    return {
        authorized: true,
        reason: "AUTHORIZED",
        profile: {
            ...profile,
            uid:
                firebaseUser.uid,
            email:
                firebaseUser.email ||
                profile.email ||
                "",
            role,
            status
        }
    };
}


/* =========================================================
   LOGIN
   ========================================================= */

async function login({
    email,
    password
}) {
    email =
        String(
            email || ""
        ).trim();

    password =
        String(
            password || ""
        );


    if (!email) {
        showToast(
            "Email required",
            "Enter your Super Admin email address.",
            "warning"
        );

        return false;
    }


    if (!password) {
        showToast(
            "Password required",
            "Enter your password.",
            "warning"
        );

        return false;
    }


    if (AuthState.loading) {
        return false;
    }


    try {

        AuthState.loading = true;
        AuthState.lastError = null;


        setLoginLoading(
            true
        );


        const credential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const firebaseUser =
            credential.user;


        const authorization =
            await authorizeSuperAdmin(
                firebaseUser
            );


        if (
            !authorization.authorized
        ) {

            await signOut(
                auth
            );


            AuthState.user = null;
            AuthState.profile = null;
            AuthState.authorized =
                false;


            handleAuthorizationFailure(
                authorization.reason
            );


            return false;
        }


        AuthState.user =
            firebaseUser;

        AuthState.profile =
            authorization.profile;

        AuthState.role =
            authorization.profile.role;

        AuthState.status =
            authorization.profile.status;

        AuthState.authorized =
            true;


        /*
         * Update last login metadata.
         *
         * This is informational only.
         * Firestore rules must still control authorization.
         */

        try {

            await setDoc(
                doc(
                    db,
                    AUTH_CONFIG.usersCollection,
                    firebaseUser.uid
                ),
                {
                    lastLoginAt:
                        serverTimestamp(),

                    lastLoginEmail:
                        firebaseUser.email || "",

                    lastLoginRole:
                        authorization
                            .profile
                            .role
                },
                {
                    merge: true
                }
            );

        } catch (error) {

            /*
             * Don't fail a successful login only
             * because telemetry could not be written.
             */

            console.warn(
                "Login metadata update failed:",
                error
            );
        }


        updateProfileUI(
            authorization.profile
        );


        showApplicationScreen();


        showToast(
            "Login successful",
            "Welcome to the Super Admin Dashboard.",
            "success"
        );


        /*
         * Let superadmin.js refresh all dashboard data.
         */

        if (
            window.SuperAdminApp &&
            typeof window.SuperAdminApp.refresh ===
                "function"
        ) {
            await window.SuperAdminApp.refresh();
        }


        return true;


    } catch (error) {

        console.error(
            "Authentication error:",
            error
        );


        AuthState.lastError =
            error;


        showToast(
            "Login failed",
            getAuthErrorMessage(
                error
            ),
            "danger"
        );


        return false;


    } finally {

        AuthState.loading =
            false;

        setLoginLoading(
            false
        );
    }
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

    try {

        AuthState.loading =
            true;


        /*
         * superadmin.js may have its own audit
         * handling. We don't create a second audit
         * here to avoid duplicate records.
         */

        if (
            window.SuperAdminApp &&
            typeof window.SuperAdminApp.cleanupListeners ===
                "function"
        ) {
            try {
                window.SuperAdminApp.cleanupListeners();
            } catch {
                // ignore cleanup failure
            }
        }


        await signOut(
            auth
        );


        resetAuthState();


        showLoginScreen();


        showToast(
            "Logged out",
            "Your Super Admin session has ended.",
            "success"
        );


    } catch (error) {

        console.error(
            "Logout error:",
            error
        );


        showToast(
            "Logout failed",
            error.message ||
                "Unable to sign out.",
            "danger"
        );


    } finally {

        AuthState.loading =
            false;
    }
}


/* =========================================================
   PASSWORD RESET
   ========================================================= */

async function resetPassword(
    email
) {
    email =
        String(
            email || ""
        ).trim();


    if (!email) {
        showToast(
            "Email required",
            "Enter your registered email.",
            "warning"
        );

        return false;
    }


    try {

        await sendPasswordResetEmail(
            auth,
            email
        );


        showToast(
            "Reset email sent",
            "Check your email for password reset instructions.",
            "success"
        );


        return true;


    } catch (error) {

        console.error(
            "Password reset error:",
            error
        );


        showToast(
            "Reset failed",
            getAuthErrorMessage(
                error
            ),
            "danger"
        );


        return false;
    }
}


/* =========================================================
   SESSION CHECK
   ========================================================= */

async function checkSession(
    firebaseUser
) {

    if (!firebaseUser) {

        resetAuthState();

        showLoginScreen();

        return false;
    }


    try {

        const authorization =
            await authorizeSuperAdmin(
                firebaseUser
            );


        if (
            !authorization.authorized
        ) {

            await signOut(
                auth
            );


            resetAuthState();


            handleAuthorizationFailure(
                authorization.reason
            );


            return false;
        }


        AuthState.user =
            firebaseUser;

        AuthState.profile =
            authorization.profile;

        AuthState.role =
            authorization.profile.role;

        AuthState.status =
            authorization.profile.status;

        AuthState.authorized =
            true;


        updateProfileUI(
            authorization.profile
        );


        showApplicationScreen();


        /*
         * Refresh dashboard after restored session.
         */

        if (
            window.SuperAdminApp &&
            typeof window.SuperAdminApp.refresh ===
                "function"
        ) {
            await window.SuperAdminApp.refresh();
        }


        return true;


    } catch (error) {

        console.error(
            "Session verification failed:",
            error
        );


        await signOut(
            auth
        );


        resetAuthState();

        showLoginScreen();


        showToast(
            "Session verification failed",
            "Please sign in again.",
            "danger"
        );


        return false;
    }
}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

function initializeAuthListener() {

    if (
        AuthState.initialized
    ) {
        return;
    }


    AuthState.initialized =
        true;


    onAuthStateChanged(
        auth,
        async firebaseUser => {

            /*
             * Prevent duplicate processing while
             * login() is already handling the same user.
             */

            if (
                firebaseUser &&
                AuthState.authorized &&
                AuthState.user?.uid ===
                    firebaseUser.uid
            ) {
                return;
            }


            await checkSession(
                firebaseUser
            );
        }
    );
}


/* =========================================================
   PERSISTENCE
   ========================================================= */

async function initializePersistence() {

    try {

        await setPersistence(
            auth,
            browserLocalPersistence
        );

    } catch (error) {

        /*
         * Persistence failure should not prevent
         * Firebase Auth from functioning.
         */

        console.warn(
            "Auth persistence could not be configured:",
            error
        );
    }
}


/* =========================================================
   UI
   ========================================================= */

function setLoginLoading(
    loading
) {

    const form =
        $("superAdminLoginForm");

    if (!form) {
        return;
    }


    const submitButton =
        form.querySelector(
            'button[type="submit"]'
        );


    if (!submitButton) {
        return;
    }


    if (
        !submitButton.dataset.originalText
    ) {
        submitButton.dataset.originalText =
            submitButton.innerHTML;
    }


    submitButton.disabled =
        loading;


    submitButton.innerHTML =
        loading
            ? `
                <i class="fa-solid fa-spinner fa-spin"></i>
                Signing in...
              `
            : submitButton
                .dataset
                .originalText;
}


function updateProfileUI(
    profile
) {

    if (!profile) {
        return;
    }


    const name =
        profile.name ||
        profile.displayName ||
        "Super Administrator";


    const email =
        profile.email ||
        AuthState.user?.email ||
        "";


    /*
     * Existing UI helper.
     */

    if (
        window.SuperAdminUI &&
        typeof window.SuperAdminUI.setAdminProfile ===
            "function"
    ) {

        window.SuperAdminUI.setAdminProfile({
            name,
            email
        });
    }


    /*
     * Common profile elements.
     */

    const possibleNameIds = [
        "adminName",
        "profileName",
        "userName",
        "currentAdminName"
    ];


    const possibleEmailIds = [
        "adminEmailDisplay",
        "profileEmail",
        "userEmail",
        "currentAdminEmail"
    ];


    possibleNameIds.forEach(
        id => {

            const element =
                $(id);

            if (element) {
                element.textContent =
                    name;
            }
        }
    );


    possibleEmailIds.forEach(
        id => {

            const element =
                $(id);

            if (element) {
                element.textContent =
                    email;
            }
        }
    );
}


/* =========================================================
   AUTH FAILURE
   ========================================================= */

function handleAuthorizationFailure(
    reason
) {

    let title =
        "Access denied";

    let message =
        "This account is not authorized to access the Super Admin panel.";


    switch (reason) {

        case "NO_USER":
            title =
                "Login required";

            message =
                "Please sign in to continue.";
            break;


        case "PROFILE_NOT_FOUND":
            title =
                "Profile not found";

            message =
                "Your Firebase account does not have a matching administrator profile.";
            break;


        case "ROLE_NOT_ALLOWED":
            title =
                "Insufficient permissions";

            message =
                "This account is not assigned the Super Admin role.";
            break;


        case "ACCOUNT_SUSPENDED":
            title =
                "Account suspended";

            message =
                "This Super Admin account has been suspended.";
            break;


        case "ACCOUNT_REVOKED":
            title =
                "Access revoked";

            message =
                "Super Admin access has been revoked for this account.";
            break;


        case "ACCOUNT_DISABLED":
            title =
                "Account disabled";

            message =
                "This account has been disabled.";
            break;


        case "ACCOUNT_BLOCKED":
            title =
                "Account blocked";

            message =
                "This account has been blocked.";
            break;


        case "ACCOUNT_INACTIVE":
            title =
                "Account inactive";

            message =
                "This Super Admin account is currently inactive.";
            break;


        case "TEMPORARILY_SUSPENDED":
            title =
                "Temporarily suspended";

            message =
                "This account is temporarily suspended.";
            break;
    }


    showLoginScreen();


    showToast(
        title,
        message,
        "danger"
    );
}


/* =========================================================
   ERROR MESSAGES
   ========================================================= */

function getAuthErrorMessage(
    error
) {

    const code =
        error?.code || "";


    const messages = {

        "auth/invalid-credential":
            "Invalid email or password.",

        "auth/invalid-login-credentials":
            "Invalid email or password.",

        "auth/user-not-found":
            "No Firebase account was found for this email.",

        "auth/wrong-password":
            "Invalid email or password.",

        "auth/invalid-email":
            "Please enter a valid email address.",

        "auth/user-disabled":
            "This Firebase account has been disabled.",

        "auth/too-many-requests":
            "Too many login attempts. Please try again later.",

        "auth/network-request-failed":
            "Network error. Check your internet connection.",

        "auth/email-already-in-use":
            "This email is already registered.",

        "auth/weak-password":
            "The password does not meet Firebase requirements.",

        "auth/requires-recent-login":
            "Please sign in again before performing this action."
    };


    return (
        messages[code] ||
        error?.message ||
        "Authentication failed."
    );
}


/* =========================================================
   RESET STATE
   ========================================================= */

function resetAuthState() {

    AuthState.user =
        null;

    AuthState.profile =
        null;

    AuthState.role =
        null;

    AuthState.status =
        null;

    AuthState.authorized =
        false;

    AuthState.lastError =
        null;
}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.SuperAdminAuth = {

    login,

    logout,

    resetPassword,

    checkSession,

    authorizeSuperAdmin,

    getUserProfile,

    isSuperAdminRole,

    isAccountActive,

    getState: () => ({
        ...AuthState
    })
};


/* =========================================================
   INITIALIZE
   ========================================================= */

(async function initializeAuthentication() {

    try {

        await initializePersistence();

        initializeAuthListener();

    } catch (error) {

        console.error(
            "Authentication initialization failed:",
            error
        );

        showLoginScreen();

        showToast(
            "Authentication error",
            "Unable to initialize Firebase Authentication.",
            "danger"
        );
    }

})();
