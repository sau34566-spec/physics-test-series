// ============================================================
// EXAMCONTROL ADMIN PORTAL
// FULL FIREBASE + FIRESTORE ADMIN CONTROL
// ============================================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ============================================================
// FIREBASE CONFIG
// ============================================================

const firebaseConfig = {

    apiKey:
        "AIzaSyA8XeHrqnYP1FEpwpqUZEdKsVAJGDw2r7o",

    authDomain:
        "physics-test-series-405c7.firebaseapp.com",

    projectId:
        "physics-test-series-405c7",

    storageBucket:
        "physics-test-series-405c7.firebasestorage.app",

    messagingSenderId:
        "758620061190",

    appId:
        "1:758620061190:web:dbbc7759c95b5e7d8b8d87",

    measurementId:
        "G-Z5QVQMZ082"

};


// ============================================================
// FIREBASE INITIALIZATION
// ============================================================

const app =
    initializeApp(firebaseConfig);

const auth =
    getAuth(app);

const db =
    getFirestore(app);


// ============================================================
// DOM ELEMENTS
// ============================================================

const loginScreen =
    document.getElementById(
        "adminLoginScreen"
    );

const dashboard =
    document.getElementById(
        "adminDashboard"
    );

const loginForm =
    document.getElementById(
        "adminLoginForm"
    );

const loginBtn =
    document.getElementById(
        "adminLoginBtn"
    );

const loginMessage =
    document.getElementById(
        "adminLoginMessage"
    );

const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );

const mobileMenuBtn =
    document.getElementById(
        "mobileMenuBtn"
    );

const sidebar =
    document.getElementById(
        "adminSidebar"
    );

const navItems =
    document.querySelectorAll(
        ".nav-item"
    );

const quickActions =
    document.querySelectorAll(
        ".quick-action"
    );

const sections =
    document.querySelectorAll(
        ".admin-section"
    );

const pageTitle =
    document.getElementById(
        "pageTitle"
    );

const adminName =
    document.getElementById(
        "adminName"
    );


// ============================================================
// INITIAL STATE
// ============================================================

let currentAdmin = null;

let currentExamSettings = null;

let confirmationCallback = null;


// ============================================================
// LOGIN MESSAGE
// ============================================================

function showLoginMessage(
    message,
    type = "error"
) {

    if (!loginMessage) {
        return;
    }


    loginMessage.textContent =
        message;

    loginMessage.style.display =
        "block";


    if (type === "success") {

        loginMessage.style.background =
            "#ecfdf5";

        loginMessage.style.color =
            "#047857";

        loginMessage.style.border =
            "1px solid #a7f3d0";

    } else {

        loginMessage.style.background =
            "#fef2f2";

        loginMessage.style.color =
            "#b91c1c";

        loginMessage.style.border =
            "1px solid #fecaca";

    }

}


// ============================================================
// HIDE LOGIN MESSAGE
// ============================================================

function hideLoginMessage() {

    if (!loginMessage) {
        return;
    }

    loginMessage.style.display =
        "none";

}


// ============================================================
// SHOW LOGIN
// ============================================================

function showLogin() {

    if (dashboard) {

        dashboard.classList.remove(
            "active"
        );

        dashboard.style.display =
            "none";

    }


    if (loginScreen) {

        loginScreen.style.display =
            "flex";

        loginScreen.classList.add(
            "active"
        );

    }

}


// ============================================================
// SHOW DASHBOARD
// ============================================================

function showDashboard() {

    if (loginScreen) {

        loginScreen.style.display =
            "none";

        loginScreen.classList.remove(
            "active"
        );

    }


    if (dashboard) {

        dashboard.style.display =
            "flex";

        dashboard.classList.add(
            "active"
        );

    }

}


// ============================================================
// ADMIN LOGIN
// ============================================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const email =
                document
                    .getElementById(
                        "adminEmail"
                    )
                    .value
                    .trim()
                    .toLowerCase();


            const password =
                document
                    .getElementById(
                        "adminPassword"
                    )
                    .value;


            if (!email || !password) {

                showLoginMessage(
                    "Please enter your admin email and password."
                );

                return;

            }


            try {

                hideLoginMessage();


                if (loginBtn) {

                    loginBtn.disabled =
                        true;

                    loginBtn.textContent =
                        "Signing in...";

                }


                // ----------------------------------------
                // FIREBASE AUTH
                // ----------------------------------------

                const credential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );


                currentAdmin =
                    credential.user;


                // ----------------------------------------
                // ADMIN AUTHORIZATION
                // ----------------------------------------

                const authorized =
                    await verifyAdmin(
                        currentAdmin
                    );


                if (!authorized) {

                    await signOut(auth);

                    currentAdmin =
                        null;


                    showLoginMessage(
                        "This account is not authorized to access the Admin Panel."
                    );

                    return;

                }


                // ----------------------------------------
                // SUCCESS
                // ----------------------------------------

                if (adminName) {

                    adminName.textContent =
                        currentAdmin.email ||
                        "Administrator";

                }


                showDashboard();


                await loadExamSettings();

                await loadDashboardData();


            } catch (error) {

                console.error(
                    "Admin login error:",
                    error
                );


                showLoginMessage(
                    firebaseAuthErrorMessage(
                        error
                    )
                );


            } finally {

                if (loginBtn) {

                    loginBtn.disabled =
                        false;

                    loginBtn.textContent =
                        "Sign In to Dashboard";

                }

            }

        }
    );

}


// ============================================================
// FIREBASE ERROR MESSAGE
// ============================================================

function firebaseAuthErrorMessage(
    error
) {

    switch (error.code) {

        case "auth/invalid-credential":
            return "Incorrect admin email or password.";

        case "auth/invalid-email":
            return "Please enter a valid admin email address.";

        case "auth/user-not-found":
            return "No administrator account was found.";

        case "auth/wrong-password":
            return "Incorrect administrator password.";

        case "auth/too-many-requests":
            return "Too many login attempts. Please try again later.";

        case "permission-denied":
            return "Firebase permission denied. Please check Firestore Security Rules.";

        default:

            if (
                error.message &&
                error.message
                    .toLowerCase()
                    .includes("permission")
            ) {

                return "Firebase permission denied. Please check Firestore Security Rules.";

            }

            return (
                error.message ||
                "Unable to sign in. Please try again."
            );

    }

}


// ============================================================
// VERIFY ADMIN
// ============================================================

async function verifyAdmin(
    user
) {

    if (!user) {
        return false;
    }


    try {

        // ====================================================
        // METHOD 1
        // admins/{uid}
        // ====================================================

        const adminRef =
            doc(
                db,
                "admins",
                user.uid
            );


        const adminSnapshot =
            await getDoc(
                adminRef
            );


        if (
            adminSnapshot.exists()
        ) {

            const adminData =
                adminSnapshot.data();


            if (
                adminData.active === false
            ) {

                return false;

            }


            if (
                adminData.email &&
                adminData.email
                    .toLowerCase() !==
                user.email
                    .toLowerCase()
            ) {

                return false;

            }


            return true;

        }


        // ====================================================
        // METHOD 2
        // authorizedAdmins/{email}
        // ====================================================

        const emailId =
            user.email
                .toLowerCase();


        const authorizedRef =
            doc(
                db,
                "authorizedAdmins",
                emailId
            );


        const authorizedSnapshot =
            await getDoc(
                authorizedRef
            );


        if (
            authorizedSnapshot.exists()
        ) {

            const data =
                authorizedSnapshot.data();


            if (
                data.active === false
            ) {

                return false;

            }


            return true;

        }


        return false;


    } catch (error) {

        console.error(
            "Admin authorization error:",
            error
        );

        throw error;

    }

}


// ============================================================
// NAVIGATION
// ============================================================

function openSection(
    sectionName
) {

    sections.forEach(
        (section) => {

            section.classList.remove(
                "active"
            );

        }
    );


    navItems.forEach(
        (item) => {

            item.classList.remove(
                "active"
            );

        }
    );


    const targetSection =
        document.getElementById(
            `${sectionName}Section`
        );


    const targetNav =
        document.querySelector(
            `[data-section="${sectionName}"]`
        );


    if (targetSection) {

        targetSection.classList.add(
            "active"
        );

    }


    if (targetNav) {

        targetNav.classList.add(
            "active"
        );

    }


    const titles = {

        dashboard:
            "Dashboard",

        examSettings:
            "Exam Settings",

        questions:
            "Question Bank",

        candidates:
            "Candidates",

        monitoring:
            "Live Monitoring",

        violations:
            "Security Violations",

        results:
            "Candidate Results",

        feedback:
            "Candidate Feedback",

        analytics:
            "Performance Analytics",

        admins:
            "Authorized Administrators",

        activity:
            "Activity Logs"

    };


    if (pageTitle) {

        pageTitle.textContent =
            titles[sectionName] ||
            "Dashboard";

    }


    if (sidebar) {

        sidebar.classList.remove(
            "mobile-open"
        );

    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    // Load settings whenever Exam Settings opens.

    if (
        sectionName ===
        "examSettings"
    ) {

        loadExamSettings();

    }

}


// ============================================================
// SIDEBAR EVENTS
// ============================================================

navItems.forEach(
    (item) => {

        item.addEventListener(
            "click",
            () => {

                openSection(
                    item.dataset.section
                );

            }
        );

    }
);


// ============================================================
// QUICK ACTION EVENTS
// ============================================================

quickActions.forEach(
    (item) => {

        item.addEventListener(
            "click",
            () => {

                openSection(
                    item.dataset.section
                );

            }
        );

    }
);


// ============================================================
// MOBILE MENU
// ============================================================

if (mobileMenuBtn) {

    mobileMenuBtn.addEventListener(
        "click",
        () => {

            if (sidebar) {

                sidebar.classList.toggle(
                    "mobile-open"
                );

            }

        }
    );

}


// ============================================================
// CONFIRMATION MODAL
// ============================================================

const adminModal =
    document.getElementById(
        "adminModal"
    );

const modalCancelBtn =
    document.getElementById(
        "modalCancelBtn"
    );

const modalConfirmBtn =
    document.getElementById(
        "modalConfirmBtn"
    );

const modalTitle =
    document.getElementById(
        "modalTitle"
    );

const modalMessage =
    document.getElementById(
        "modalMessage"
    );

const modalIcon =
    document.getElementById(
        "modalIcon"
    );


function showConfirmation(
    title,
    message,
    icon,
    callback
) {

    if (!adminModal) {
        return;
    }


    if (modalTitle) {

        modalTitle.textContent =
            title;

    }


    if (modalMessage) {

        modalMessage.textContent =
            message;

    }


    if (modalIcon) {

        modalIcon.textContent =
            icon;

    }


    confirmationCallback =
        callback;


    adminModal.classList.add(
        "show"
    );

}


function closeConfirmation() {

    if (adminModal) {

        adminModal.classList.remove(
            "show"
        );

    }

    confirmationCallback =
        null;

}


if (modalCancelBtn) {

    modalCancelBtn.addEventListener(
        "click",
        closeConfirmation
    );

}


if (modalConfirmBtn) {

    modalConfirmBtn.addEventListener(
        "click",
        async () => {

            if (
                typeof confirmationCallback ===
                "function"
            ) {

                await confirmationCallback();

            }

            closeConfirmation();

        }
    );

}


if (adminModal) {

    adminModal.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                adminModal
            ) {

                closeConfirmation();

            }

        }
    );

}


// ============================================================
// LOGOUT
// ============================================================

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        () => {

            showConfirmation(
                "Sign Out",
                "Are you sure you want to sign out of the administrator dashboard?",
                "🚪",
                async () => {

                    try {

                        await signOut(
                            auth
                        );


                        currentAdmin =
                            null;


                        if (loginForm) {

                            loginForm.reset();

                        }


                        showLogin();

                    } catch (error) {

                        console.error(
                            "Logout error:",
                            error
                        );

                    }

                }
            );

        }
    );

}


// ============================================================
// EXAM CONTROL BUTTONS
// ============================================================

const startExamBtn =
    document.getElementById(
        "startExamBtn"
    );

const pauseExamBtn =
    document.getElementById(
        "pauseExamBtn"
    );

const endExamBtn =
    document.getElementById(
        "endExamBtn"
    );


// ============================================================
// START EXAM
// ============================================================

if (startExamBtn) {

    startExamBtn.addEventListener(
        "click",
        () => {

            showConfirmation(
                "Start Examination",
                "Are you sure you want to start the examination?",
                "▶️",
                async () => {

                    await changeExamStatus(
                        "live"
                    );

                }
            );

        }
    );

}


// ============================================================
// PAUSE EXAM
// ============================================================

if (pauseExamBtn) {

    pauseExamBtn.addEventListener(
        "click",
        () => {

            showConfirmation(
                "Pause Examination",
                "Are you sure you want to pause the examination?",
                "⏸️",
                async () => {

                    await changeExamStatus(
                        "paused"
                    );

                }
            );

        }
    );

}


// ============================================================
// END EXAM
// ============================================================

if (endExamBtn) {

    endExamBtn.addEventListener(
        "click",
        () => {

            showConfirmation(
                "End Examination",
                "Ending the examination may affect all active candidates. Continue?",
                "⚠️",
                async () => {

                    await changeExamStatus(
                        "ended"
                    );

                }
            );

        }
    );

}


// ============================================================
// CHANGE EXAM STATUS
// ============================================================

async function changeExamStatus(
    status
) {

    try {

        const settingsRef =
            doc(
                db,
                "examSettings",
                "current"
            );


        await setDoc(
            settingsRef,
            {

                examStatus:
                    status,

                updatedAt:
                    serverTimestamp()

            },
            {
                merge: true
            }
        );


        updateExamStatusUI(
            status
        );


        if (
            currentExamSettings
        ) {

            currentExamSettings.examStatus =
                status;

        }


    } catch (error) {

        console.error(
            "Exam status error:",
            error
        );


        alert(
            "Unable to update exam status. Please check Firestore permissions."
        );

    }

}


// ============================================================
// UPDATE EXAM STATUS UI
// ============================================================

function updateExamStatusUI(
    status
) {

    const largeStatus =
        document.getElementById(
            "largeExamStatus"
        );

    const examStatus =
        document.getElementById(
            "examStatus"
        );

    const statusDot =
        document.getElementById(
            "statusDot"
        );


    const statusMap = {

        draft: {
            label: "DRAFT",
            text: "System Ready",
            color: "#64748b"
        },

        scheduled: {
            label: "SCHEDULED",
            text: "Exam Scheduled",
            color: "#3b82f6"
        },

        live: {
            label: "LIVE",
            text: "Exam Live",
            color: "#22c55e"
        },

        paused: {
            label: "PAUSED",
            text: "Exam Paused",
            color: "#f59e0b"
        },

        ended: {
            label: "ENDED",
            text: "Exam Ended",
            color: "#ef4444"
        }

    };


    const selected =
        statusMap[status] ||
        statusMap.draft;


    if (largeStatus) {

        largeStatus.textContent =
            selected.label;

    }


    if (examStatus) {

        examStatus.textContent =
            selected.text;

    }


    if (statusDot) {

        statusDot.style.background =
            selected.color;

    }

}


// ============================================================
// REFRESH DASHBOARD
// ============================================================

const refreshBtn =
    document.getElementById(
        "refreshDashboard"
    );


if (refreshBtn) {

    refreshBtn.addEventListener(
        "click",
        async () => {

            const originalText =
                "↻ Refresh";


            refreshBtn.disabled =
                true;

            refreshBtn.textContent =
                "Updating...";


            try {

                await loadExamSettings();

                await loadDashboardData();


                refreshBtn.textContent =
                    "✓ Updated";


            } catch (error) {

                console.error(
                    "Refresh error:",
                    error
                );


                refreshBtn.textContent =
                    "⚠ Error";

            }


            setTimeout(
                () => {

                    refreshBtn.disabled =
                        false;

                    refreshBtn.textContent =
                        originalText;

                },
                1200
            );

        }
    );

}


// ============================================================
// EXAM SETTINGS FORM
// ============================================================

const examSettingsForm =
    document.getElementById(
        "examSettingsForm"
    );

const saveExamSettingsBtn =
    document.getElementById(
        "saveExamSettingsBtn"
    );

const resetExamSettingsBtn =
    document.getElementById(
        "resetExamSettingsBtn"
    );


// ============================================================
// READ EXAM SETTINGS FORM
// ============================================================

function readExamSettingsForm() {

    return {

        examTitle:
            valueOf(
                "examTitle"
            ) ||
            "Online Examination",


        totalQuestions:
            numberOf(
                "totalQuestionsSetting",
                100
            ),


        questionsToDisplay:
            numberOf(
                "questionsToDisplay",
                80
            ),


        durationMinutes:
            numberOf(
                "durationMinutes",
                60
            ),


        marksPerQuestion:
            numberOf(
                "marksPerQuestion",
                4
            ),


        negativeMarks:
            numberOf(
                "negativeMarks",
                1
            ),


        examStartTime:
            valueOf(
                "examStartTime"
            ),


        examEndTime:
            valueOf(
                "examEndTime"
            ),


        examStatus:
            valueOf(
                "examStatusSetting"
            ) ||
            "draft",


        questionSource:
            valueOf(
                "questionSource"
            ) ||
            "chapterq.json",


        randomQuestions:
            checkedOf(
                "randomQuestions"
            ),


        randomOptions:
            checkedOf(
                "randomOptions"
            ),


        tabSwitchPenalty:
            numberOf(
                "tabSwitchPenalty",
                1
            ),


        maxTabSwitches:
            numberOf(
                "maxTabSwitches",
                2
            ),


        disableCopy:
            checkedOf(
                "disableCopy"
            ),


        disablePaste:
            checkedOf(
                "disablePaste"
            ),


        disableScreenshot:
            checkedOf(
                "disableScreenshot"
            ),


        disableRefresh:
            checkedOf(
                "disableRefresh"
            ),


        disableFunctionKeys:
            checkedOf(
                "disableFunctionKeys"
            )

    };

}


// ============================================================
// FORM HELPERS
// ============================================================

function valueOf(id) {

    const element =
        document.getElementById(id);

    return element
        ? element.value.trim()
        : "";

}


function numberOf(
    id,
    fallback
) {

    const element =
        document.getElementById(id);

    if (!element) {
        return fallback;
    }


    const number =
        Number(element.value);


    return Number.isFinite(number)
        ? number
        : fallback;

}


function checkedOf(id) {

    const element =
        document.getElementById(id);

    return element
        ? element.checked
        : false;

}


// ============================================================
// SAVE EXAM SETTINGS
// ============================================================

if (examSettingsForm) {

    examSettingsForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const settings =
                readExamSettingsForm();


            // ----------------------------------------
            // VALIDATION
            // ----------------------------------------

            if (
                settings.totalQuestions <
                1
            ) {

                showSettingsMessage(
                    "Total question pool must be at least 1.",
                    "error"
                );

                return;

            }


            if (
                settings.questionsToDisplay <
                1
            ) {

                showSettingsMessage(
                    "Questions displayed must be at least 1.",
                    "error"
                );

                return;

            }


            if (
                settings.questionsToDisplay >
                settings.totalQuestions
            ) {

                showSettingsMessage(
                    "Questions displayed cannot be greater than the total question pool.",
                    "error"
                );

                return;

            }


            if (
                settings.durationMinutes <
                1
            ) {

                showSettingsMessage(
                    "Test duration must be at least 1 minute.",
                    "error"
                );

                return;

            }


            if (
                settings.marksPerQuestion <
                0
            ) {

                showSettingsMessage(
                    "Marks per question cannot be negative.",
                    "error"
                );

                return;

            }


            if (
                settings.negativeMarks <
                0
            ) {

                showSettingsMessage(
                    "Negative marks cannot be negative.",
                    "error"
                );

                return;

            }


            if (
                settings.maxTabSwitches <
                1
            ) {

                showSettingsMessage(
                    "Maximum tab switches must be at least 1.",
                    "error"
                );

                return;

            }


            try {

                if (saveExamSettingsBtn) {

                    saveExamSettingsBtn.disabled =
                        true;

                    saveExamSettingsBtn.textContent =
                        "Saving...";

                }


                const settingsRef =
                    doc(
                        db,
                        "examSettings",
                        "current"
                    );


                await setDoc(
                    settingsRef,
                    {

                        ...settings,

                        updatedAt:
                            serverTimestamp(),

                        updatedBy:
                            currentAdmin
                                ? currentAdmin.uid
                                : null,

                        updatedByEmail:
                            currentAdmin
                                ? currentAdmin.email
                                : null

                    },
                    {
                        merge: true
                    }
                );


                currentExamSettings =
                    settings;


                updateDashboardFromSettings(
                    settings
                );


                updateExamStatusUI(
                    settings.examStatus
                );


                showSettingsMessage(
                    "✓ Examination settings saved successfully.",
                    "success"
                );


            } catch (error) {

                console.error(
                    "Save settings error:",
                    error
                );


                if (
                    error.code ===
                    "permission-denied"
                ) {

                    showSettingsMessage(
                        "Firebase permission denied. Check Firestore Security Rules.",
                        "error"
                    );

                } else {

                    showSettingsMessage(
                        error.message ||
                        "Unable to save settings.",
                        "error"
                    );

                }

            } finally {

                if (saveExamSettingsBtn) {

                    saveExamSettingsBtn.disabled =
                        false;

                    saveExamSettingsBtn.textContent =
                        "💾 Save Settings";

                }

            }

        }
    );

}


// ============================================================
// LOAD EXAM SETTINGS
// ============================================================

async function loadExamSettings() {

    try {

        const settingsRef =
            doc(
                db,
                "examSettings",
                "current"
            );


        const snapshot =
            await getDoc(
                settingsRef
            );


        if (
            !snapshot.exists()
        ) {

            // Use current HTML defaults.

            currentExamSettings =
                readExamSettingsForm();


            updateDashboardFromSettings(
                currentExamSettings
            );


            updateExamStatusUI(
                currentExamSettings.examStatus
            );


            return;

        }


        const settings =
            snapshot.data();


        currentExamSettings =
            settings;


        // ----------------------------------------
        // BASIC
        // ----------------------------------------

        setValue(
            "examTitle",
            settings.examTitle ||
            "Online Examination"
        );


        setValue(
            "totalQuestionsSetting",
            settings.totalQuestions ??
            100
        );


        setValue(
            "questionsToDisplay",
            settings.questionsToDisplay ??
            80
        );


        setValue(
            "durationMinutes",
            settings.durationMinutes ??
            60
        );


        setValue(
            "marksPerQuestion",
            settings.marksPerQuestion ??
            4
        );


        setValue(
            "negativeMarks",
            settings.negativeMarks ??
            1
        );


        // ----------------------------------------
        // SCHEDULE
        // ----------------------------------------

        setValue(
            "examStartTime",
            settings.examStartTime ||
            ""
        );


        setValue(
            "examEndTime",
            settings.examEndTime ||
            ""
        );


        setValue(
            "examStatusSetting",
            settings.examStatus ||
            "draft"
        );


        setValue(
            "questionSource",
            settings.questionSource ||
            "chapterq.json"
        );


        // ----------------------------------------
        // RANDOMIZATION
        // ----------------------------------------

        setChecked(
            "randomQuestions",
            settings.randomQuestions !== false
        );


        setChecked(
            "randomOptions",
            settings.randomOptions !== false
        );


        // ----------------------------------------
        // SECURITY
        // ----------------------------------------

        setValue(
            "tabSwitchPenalty",
            settings.tabSwitchPenalty ??
            1
        );


        setValue(
            "maxTabSwitches",
            settings.maxTabSwitches ??
            2
        );


        setChecked(
            "disableCopy",
            settings.disableCopy !== false
        );


        setChecked(
            "disablePaste",
            settings.disablePaste !== false
        );


        setChecked(
            "disableScreenshot",
            settings.disableScreenshot !== false
        );


        setChecked(
            "disableRefresh",
            settings.disableRefresh !== false
        );


        setChecked(
            "disableFunctionKeys",
            settings.disableFunctionKeys !== false
        );


        // ----------------------------------------
        // DASHBOARD
        // ----------------------------------------

        updateDashboardFromSettings(
            settings
        );


        updateExamStatusUI(
            settings.examStatus ||
            "draft"
        );


    } catch (error) {

        console.error(
            "Load exam settings error:",
            error
        );


        if (
            error.code ===
            "permission-denied"
        ) {

            showSettingsMessage(
                "Firebase permission denied. Check Firestore Security Rules.",
                "error"
            );

        }

    }

}


// ============================================================
// SET VALUE
// ============================================================

function setValue(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {

        element.value =
            value;

    }

}


// ============================================================
// SET CHECKBOX
// ============================================================

function setChecked(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {

        element.checked =
            Boolean(value);

    }

}


// ============================================================
// SETTINGS MESSAGE
// ============================================================

function showSettingsMessage(
    message,
    type
) {

    const element =
        document.getElementById(
            "examSettingsMessage"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        "settings-message " +
        type;


    element.style.display =
        "block";


    setTimeout(
        () => {

            element.style.display =
                "none";

        },
        5000
    );

}


// ============================================================
// RESET SETTINGS
// ============================================================

if (resetExamSettingsBtn) {

    resetExamSettingsBtn.addEventListener(
        "click",
        async () => {

            await loadExamSettings();


            showSettingsMessage(
                "Settings restored from Firestore.",
                "success"
            );

        }
    );

}


// ============================================================
// UPDATE DASHBOARD FROM SETTINGS
// ============================================================

function updateDashboardFromSettings(
    settings
) {

    setText(
        "totalQuestions",
        settings.totalQuestions ??
        100
    );


    setText(
        "displayQuestions",
        settings.questionsToDisplay ??
        80
    );


    setText(
        "dashboardExamTitle",
        settings.examTitle ||
        "Online Examination"
    );


    setText(
        "dashboardDuration",
        `${settings.durationMinutes ?? 60} Minutes`
    );


    setText(
        "dashboardQuestionCount",
        settings.questionsToDisplay ??
        80
    );


    setText(
        "dashboardMarks",
        `+${settings.marksPerQuestion ?? 4}`
    );


    updateExamStatusUI(
        settings.examStatus ||
        "draft"
    );

}


// ============================================================
// TEXT HELPER
// ============================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent =
            value;

    }

}


// ============================================================
// DASHBOARD DATA
// ============================================================

async function loadDashboardData() {

    // These remain 0 until candidate/result
    // collections are implemented.

    setText(
        "totalCandidates",
        0
    );


    setText(
        "completedCandidates",
        0
    );


    setText(
        "activeCandidates",
        0
    );


    setText(
        "totalViolations",
        0
    );

}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            currentAdmin =
                null;

            showLogin();

            return;

        }


        try {

            const authorized =
                await verifyAdmin(
                    user
                );


            if (!authorized) {

                await signOut(
                    auth
                );


                currentAdmin =
                    null;


                showLogin();

                return;

            }


            currentAdmin =
                user;


            if (adminName) {

                adminName.textContent =
                    user.email ||
                    "Administrator";

            }


            showDashboard();


            await loadExamSettings();

            await loadDashboardData();


        } catch (error) {

            console.error(
                "Auth state error:",
                error
            );


            await signOut(
                auth
            );


            currentAdmin =
                null;


            showLogin();


            showLoginMessage(
                "Unable to verify administrator access. Check Firestore Security Rules."
            );

        }

    }
);


// ============================================================
// INITIAL UI
// ============================================================

if (dashboard) {

    dashboard.style.display =
        "none";

}


if (loginScreen) {

    loginScreen.style.display =
        "flex";

}


// ============================================================
// END
// ============================================================

console.log(
    "ExamControl Admin Portal loaded successfully."
);
