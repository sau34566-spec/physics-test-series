/* =========================================================
   SUPER ADMIN AUTHENTICATION
   File: /js/auth.js

   Firebase Authentication + Firestore authorization

   IMPORTANT:
   Authentication proves WHO the user is.
   Firestore profile proves WHAT ROLE the user has.

   Final security must ALSO be enforced by Firestore Rules.
   ========================================================= */

import {
    auth,
    db
} from "./firebase-config.js";

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
    getDoc
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const AUTH_CONFIG = {

    /*
     * Primary administrator collection.
     */
    adminsCollection: "admins",

    /*
     * Optional fallback collection.
     */
    usersCollection: "users",

    /*
     * Accepted Super Admin role names.
     */
    superAdminRoles: [
        "super_admin",
        "superadmin",
        "super-admin"
    ],

    /*
     * Accepted active states.
     *
     * If status is missing, we allow it temporarily for
     * compatibility with existing records.
     *
     * For final production rules, every admin should have
     * an explicit status: "active".
     */
    activeStatuses: [
        "active",
        "approved",
        ""
    ],

    /*
     * Explicitly blocked states.
     */
    blockedStatuses: [
        "suspended",
        "revoked",
        "disabled",
        "blocked",
        "inactive"
    ]

};


/* =========================================================
   AUTH STATE
   ========================================================= */

const AuthState = {

    initialized: false,

    checkingSession: false,

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

function normalize(
    value
) {

    return String(
        value ?? ""
    )
        .trim()
        .toLowerCase();

}


function getElement(
    id
) {

    return document.getElementById(
        id
    );

}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
    title,
    message,
    type = "info"
) {

    /*
     * Use dashboard UI toast if available.
     */

    if (
        window.SuperAdminUI &&
        typeof window.SuperAdminUI.showToast ===
            "function"
    ) {

        try {

            window.SuperAdminUI.showToast(
                title,
                message,
                type
            );

            return;

        } catch {
            // fallback below
        }
    }


    /*
     * Fallback.
     */

    console.log(
        `[${type}] ${title}: ${message}`
    );

}


/* =========================================================
   LOGIN SCREEN
   ========================================================= */

function showLoginScreen() {

    const loginScreen =
        getElement(
            "loginScreen"
        );

    const appShell =
        getElement(
            "appShell"
        );


    if (loginScreen) {

        loginScreen.style.display =
            "flex";

    }


    if (appShell) {

        appShell.style.display =
            "none";

        appShell.classList.remove(
            "active"
        );

    }

}


/* =========================================================
   APPLICATION SCREEN
   ========================================================= */

function showApplicationScreen() {

    const loginScreen =
        getElement(
            "loginScreen"
        );

    const appShell =
        getElement(
            "appShell"
        );


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

}


/* =========================================================
   PROFILE LOOKUP
   ========================================================= */

async function getAdminProfile(
    uid
) {

    if (!uid) {
        return null;
    }


    /*
     * -----------------------------------------------------
     * FIRST: admins/{uid}
     * -----------------------------------------------------
     */

    try {

        const adminRef =
            doc(
                db,
                AUTH_CONFIG.adminsCollection,
                uid
            );


        const snapshot =
            await getDoc(
                adminRef
            );


        if (
            snapshot.exists()
        ) {

            return {

                uid,

                source:
                    "admins",

                ...snapshot.data()

            };

        }

    } catch (error) {

        /*
         * Do not immediately reject.
         *
         * We can still try the compatibility fallback.
         */

        console.warn(
            "admins profile lookup failed:",
            error
        );

    }


    /*
     * -----------------------------------------------------
     * FALLBACK: users/{uid}
     * -----------------------------------------------------
     */

    try {

        const userRef =
            doc(
                db,
                AUTH_CONFIG.usersCollection,
                uid
            );


        const snapshot =
            await getDoc(
                userRef
            );


        if (
            snapshot.exists()
        ) {

            return {

                uid,

                source:
                    "users",

                ...snapshot.data()

            };

        }

    } catch (error) {

        console.warn(
            "users profile lookup failed:",
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
        .superAdminRoles
        .includes(
            normalize(
                role
            )
        );

}


/* =========================================================
   STATUS CHECK
   ========================================================= */

function isBlockedStatus(
    status
) {

    return AUTH_CONFIG
        .blockedStatuses
        .includes(
            normalize(
                status
            )
        );

}


function isActiveStatus(
    status
) {

    const normalized =
        normalize(
            status
        );


    if (
        isBlockedStatus(
            normalized
        )
    ) {

        return false;

    }


    return AUTH_CONFIG
        .activeStatuses
        .includes(
            normalized
        );

}


/* =========================================================
   SUSPENSION CHECK
   ========================================================= */

function isSuspensionActive(
    profile
) {

    if (
        !profile ||
        !profile.suspensionUntil
    ) {

        return false;

    }


    let suspensionDate;


    try {

        if (
            typeof profile.suspensionUntil
                ?.toDate ===
            "function"
        ) {

            suspensionDate =
                profile.suspensionUntil
                    .toDate();

        } else {

            suspensionDate =
                new Date(
                    profile.suspensionUntil
                );

        }

    } catch {

        return false;

    }


    if (
        Number.isNaN(
            suspensionDate.getTime()
        )
    ) {

        return false;

    }


    return (
        suspensionDate.getTime() >
        Date.now()
    );

}


/* =========================================================
   AUTHORIZE SUPER ADMIN
   ========================================================= */

async function authorizeSuperAdmin(
    firebaseUser
) {

    if (!firebaseUser) {

        return {

            authorized:
                false,

            reason:
                "NO_USER",

            profile:
                null

        };

    }


    const profile =
        await getAdminProfile(
            firebaseUser.uid
        );


    if (!profile) {

        return {

            authorized:
                false,

            reason:
                "PROFILE_NOT_FOUND",

            profile:
                null

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


    /*
     * ROLE
     */

    if (
        !isSuperAdminRole(
            role
        )
    ) {

        return {

            authorized:
                false,

            reason:
                "ROLE_NOT_ALLOWED",

            profile

        };

    }


    /*
     * STATUS
     */

    if (
        !isActiveStatus(
            status
        )
    ) {

        return {

            authorized:
                false,

            reason:
                `ACCOUNT_${status.toUpperCase()}`,

            profile

        };

    }


    /*
     * TEMPORARY SUSPENSION
     */

    if (
        isSuspensionActive(
            profile
        )
    ) {

        return {

            authorized:
                false,

            reason:
                "TEMPORARILY_SUSPENDED",

            profile

        };

    }


    /*
     * FINAL NORMALIZED PROFILE
     */

    const normalizedProfile = {

        ...profile,

        uid:
            firebaseUser.uid,

        email:
            firebaseUser.email ||
            profile.email ||
            "",

        role,

        status

    };


    return {

        authorized:
            true,

        reason:
            "AUTHORIZED",

        profile:
            normalizedProfile

    };

}


/* =========================================================
   LOGIN
   ========================================================= */

async function login(
    credentials
) {

    const email =
        String(
            credentials?.email ||
            ""
        )
        .trim()
        .toLowerCase();


    const password =
        String(
            credentials?.password ||
            ""
        );


    if (!email) {

        showToast(
            "Email required",
            "Enter your Super Admin email.",
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


    if (
        AuthState.loading
    ) {

        return false;

    }


    AuthState.loading =
        true;

    AuthState.lastError =
        null;


    setLoginLoading(
        true
    );


    try {

        /*
         * Firebase Authentication
         */

        const credential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const firebaseUser =
            credential.user;


        /*
         * Firestore authorization
         */

        const authorization =
            await authorizeSuperAdmin(
                firebaseUser
            );


        if (
            !authorization.authorized
        ) {

            /*
             * Authentication succeeded but authorization
             * failed. Immediately terminate session.
             */

            await signOut(
                auth
            );


            resetState();


            handleAuthorizationFailure(
                authorization.reason
            );


            return false;

        }


        /*
         * Save authorized state.
         */

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
         * Update UI.
         */

        updateProfileUI(
            authorization.profile
        );


        showApplicationScreen();


        /*
         * Notify dashboard.
         */

        window.dispatchEvent(
            new CustomEvent(
                "superadmin:authorized",
                {
                    detail: {
                        user:
                            firebaseUser,

                        profile:
                            authorization.profile
                    }
                }
            )
        );


        showToast(
            "Login successful",
            "Super Admin access granted.",
            "success"
        );


        return true;


    } catch (error) {

        console.error(
            "Super Admin login error:",
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

    if (
        AuthState.loading
    ) {

        /*
         * Don't block logout because of a previous
         * operation, but don't create duplicate requests.
         */

    }


    try {

        /*
         * Stop dashboard listeners first.
         */

        if (
            window.SuperAdminApp &&
            typeof window.SuperAdminApp
                .cleanupListeners ===
                "function"
        ) {

            try {

                window.SuperAdminApp
                    .cleanupListeners();

            } catch (error) {

                console.warn(
                    "Dashboard cleanup failed:",
                    error
                );

            }

        }


        await signOut(
            auth
        );


        resetState();


        showLoginScreen();


        window.dispatchEvent(
            new CustomEvent(
                "superadmin:logout"
            )
        );


        showToast(
            "Logged out",
            "Super Admin session ended.",
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

    }

}


/* =========================================================
   PASSWORD RESET
   ========================================================= */

async function resetPassword(
    email
) {

    const normalizedEmail =
        String(
            email || ""
        )
        .trim()
        .toLowerCase();


    if (!normalizedEmail) {

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
            normalizedEmail
        );


        showToast(
            "Reset email sent",
            "Check your email for the password reset link.",
            "success"
        );


        return true;


    } catch (error) {

        console.error(
            "Password reset error:",
            error
        );


        showToast(
            "Password reset failed",
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

    /*
     * No Firebase user.
     */

    if (!firebaseUser) {

        resetState();

        showLoginScreen();

        return false;

    }


    /*
     * Avoid duplicate verification.
     */

    if (
        AuthState.checkingSession
    ) {

        return AuthState.authorized;

    }


    AuthState.checkingSession =
        true;


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


            resetState();


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
         * Tell the dashboard that a session has been
         * restored.
         */

        window.dispatchEvent(
            new CustomEvent(
                "superadmin:authorized",
                {
                    detail: {
                        user:
                            firebaseUser,

                        profile:
                            authorization.profile,

                        restored:
                            true
                    }
                }
            )
        );


        return true;


    } catch (error) {

        console.error(
            "Session verification failed:",
            error
        );


        resetState();


        showLoginScreen();


        showToast(
            "Session verification failed",
            "Please sign in again.",
            "danger"
        );


        return false;


    } finally {

        AuthState.checkingSession =
            false;

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

            await checkSession(
                firebaseUser
            );

        }
    );

}


/* =========================================================
   FIREBASE AUTH PERSISTENCE
   ========================================================= */

async function initializePersistence() {

    try {

        await setPersistence(
            auth,
            browserLocalPersistence
        );

    } catch (error) {

        /*
         * Persistence failure should not prevent login.
         */

        console.warn(
            "Firebase Auth persistence failed:",
            error
        );

    }

}


/* =========================================================
   LOGIN BUTTON STATE
   ========================================================= */

function setLoginLoading(
    loading
) {

    const form =
        getElement(
            "superAdminLoginForm"
        );


    if (!form) {
        return;
    }


    const button =
        form.querySelector(
            'button[type="submit"]'
        );


    if (!button) {
        return;
    }


    if (
        !button.dataset.originalHtml
    ) {

        button.dataset.originalHtml =
            button.innerHTML;

    }


    button.disabled =
        loading;


    button.innerHTML =
        loading

            ? `
                <i class="fa-solid fa-spinner fa-spin"></i>
                Signing in...
              `

            : button.dataset.originalHtml;

}


/* =========================================================
   PROFILE UI
   ========================================================= */

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


    const possibleNameIds = [

        "adminName",

        "profileName",

        "userName",

        "currentAdminName",

        "sidebarAdminName"

    ];


    const possibleEmailIds = [

        "adminEmailDisplay",

        "profileEmail",

        "userEmail",

        "currentAdminEmail",

        "sidebarAdminEmail"

    ];


    possibleNameIds.forEach(
        id => {

            const element =
                getElement(id);

            if (element) {

                element.textContent =
                    name;

            }

        }
    );


    possibleEmailIds.forEach(
        id => {

            const element =
                getElement(id);

            if (element) {

                element.textContent =
                    email;

            }

        }
    );


    /*
     * Avatar initials.
     */

    const avatar =
        getElement(
            "sidebarAvatar"
        );


    if (
        avatar
    ) {

        avatar.textContent =
            getInitials(
                name
            );

    }

}


/* =========================================================
   INITIALS
   ========================================================= */

function getInitials(
    name
) {

    const parts =
        String(
            name || ""
        )
        .trim()
        .split(
            /\s+/
        )
        .filter(Boolean);


    if (!parts.length) {

        return "SA";

    }


    return parts
        .slice(
            0,
            2
        )
        .map(
            part =>
                part.charAt(
                    0
                )
        )
        .join("")
        .toUpperCase();

}


/* =========================================================
   AUTHORIZATION FAILURE
   ========================================================= */

function handleAuthorizationFailure(
    reason
) {

    let title =
        "Access denied";

    let message =
        "This account is not authorized to access the Super Admin dashboard.";


    switch (
        reason
    ) {

        case "NO_USER":

            title =
                "Login required";

            message =
                "Please sign in to continue.";

            break;


        case "PROFILE_NOT_FOUND":

            title =
                "Admin profile not found";

            message =
                "The Firebase account does not have an administrator profile.";

            break;


        case "ROLE_NOT_ALLOWED":

            title =
                "Insufficient permissions";

            message =
                "This account does not have the Super Admin role.";

            break;


        case "ACCOUNT_SUSPENDED":

            title =
                "Account suspended";

            message =
                "This Super Admin account is suspended.";

            break;


        case "ACCOUNT_REVOKED":

            title =
                "Access revoked";

            message =
                "Super Admin access has been revoked.";

            break;


        case "ACCOUNT_DISABLED":

            title =
                "Account disabled";

            message =
                "This administrator account is disabled.";

            break;


        case "ACCOUNT_BLOCKED":

            title =
                "Account blocked";

            message =
                "This administrator account is blocked.";

            break;


        case "ACCOUNT_INACTIVE":

            title =
                "Account inactive";

            message =
                "This administrator account is inactive.";

            break;


        case "TEMPORARILY_SUSPENDED":

            title =
                "Temporarily suspended";

            message =
                "Your Super Admin access is temporarily suspended.";

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
   FIREBASE ERROR MESSAGES
   ========================================================= */

function getAuthErrorMessage(
    error
) {

    const code =
        error?.code ||
        "";


    const messages = {

        "auth/invalid-credential":
            "Invalid email or password.",

        "auth/invalid-login-credentials":
            "Invalid email or password.",

        "auth/user-not-found":
            "No Firebase account exists for this email.",

        "auth/wrong-password":
            "Invalid email or password.",

        "auth/invalid-email":
            "Please enter a valid email address.",

        "auth/user-disabled":
            "This Firebase account has been disabled.",

        "auth/too-many-requests":
            "Too many login attempts. Please try again later.",

        "auth/network-request-failed":
            "Network connection failed. Check your internet.",

        "auth/api-key-not-valid":
            "Firebase API key is invalid. Check firebase-config.js.",

        "auth/operation-not-allowed":
            "Email/password authentication is not enabled in Firebase.",

        "auth/internal-error":
            "Firebase returned an internal authentication error."

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

function resetState() {

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

    getAdminProfile,

    isSuperAdminRole,

    isActiveStatus,

    isBlockedStatus,

    getState() {

        return {
            ...AuthState
        };

    }

};


/* =========================================================
   INITIALIZATION
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
            "Authentication initialization failed",
            error.message ||
                "Unable to initialize Firebase Authentication.",
            "danger"
        );

    }

})();
