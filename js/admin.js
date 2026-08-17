// ============================================================
// EXAMCONTROL ADMIN PORTAL
// Firebase Auth + Firestore
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
    apiKey: "AIzaSyA8XeHrqnYP1FEpwpqUZEdKsVAJGDw2r7o",
    authDomain: "physics-test-series-405c7.firebaseapp.com",
    projectId: "physics-test-series-405c7",
    storageBucket: "physics-test-series-405c7.firebasestorage.app",
    messagingSenderId: "758620061190",
    appId: "1:758620061190:web:dbbc7759c95b5e7d8b8d87",
    measurementId: "G-Z5QVQMZ082"
};


// ============================================================
// INITIALIZE FIREBASE
// ============================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// ============================================================
// DOM
// ============================================================

const $ = (id) => document.getElementById(id);

const loginScreen = $("adminLoginScreen");
const dashboard = $("adminDashboard");

const loginForm = $("adminLoginForm");
const loginBtn = $("adminLoginBtn");
const loginMessage = $("adminLoginMessage");

const logoutBtn = $("logoutBtn");
const mobileMenuBtn = $("mobileMenuBtn");
const sidebar = $("adminSidebar");

const pageTitle = $("pageTitle");
const adminName = $("adminName");

const navItems = document.querySelectorAll(".nav-item");
const quickActions = document.querySelectorAll(".quick-action");
const sections = document.querySelectorAll(".admin-section");

const adminModal = $("adminModal");
const modalTitle = $("modalTitle");
const modalMessage = $("modalMessage");
const modalIcon = $("modalIcon");
const modalCancelBtn = $("modalCancelBtn");
const modalConfirmBtn = $("modalConfirmBtn");

const refreshBtn = $("refreshDashboard");

const startExamBtn = $("startExamBtn");
const pauseExamBtn = $("pauseExamBtn");
const endExamBtn = $("endExamBtn");

const examSettingsForm = $("examSettingsForm");
const saveExamSettingsBtn = $("saveExamSettingsBtn");
const resetExamSettingsBtn = $("resetExamSettingsBtn");


// ============================================================
// STATE
// ============================================================

let currentAdmin = null;
let currentExamSettings = null;
let confirmationCallback = null;


// ============================================================
// LOGIN MESSAGE
// ============================================================

function showLoginMessage(message, type = "error") {

    if (!loginMessage) return;

    loginMessage.textContent = message;
    loginMessage.style.display = "block";

    if (type === "success") {

        loginMessage.style.background = "#ecfdf5";
        loginMessage.style.color = "#047857";
        loginMessage.style.border = "1px solid #a7f3d0";

    } else {

        loginMessage.style.background = "#fef2f2";
        loginMessage.style.color = "#b91c1c";
        loginMessage.style.border = "1px solid #fecaca";
    }
}


function hideLoginMessage() {

    if (loginMessage) {
        loginMessage.style.display = "none";
    }
}


// ============================================================
// LOGIN / DASHBOARD
// ============================================================

function showLogin() {

    if (dashboard) {
        dashboard.style.display = "none";
        dashboard.classList.remove("active");
    }

    if (loginScreen) {
        loginScreen.style.display = "flex";
        loginScreen.classList.add("active");
    }
}


function showDashboard() {

    if (loginScreen) {
        loginScreen.style.display = "none";
        loginScreen.classList.remove("active");
    }

    if (dashboard) {
        dashboard.style.display = "flex";
        dashboard.classList.add("active");
    }
}


// ============================================================
// FIREBASE AUTH ERROR
// ============================================================

function authError(error) {

    switch (error?.code) {

        case "auth/invalid-credential":
            return "Incorrect admin email or password.";

        case "auth/invalid-email":
            return "Please enter a valid email address.";

        case "auth/user-not-found":
            return "Administrator account not found.";

        case "auth/wrong-password":
            return "Incorrect administrator password.";

        case "auth/too-many-requests":
            return "Too many attempts. Please try again later.";

        case "auth/network-request-failed":
            return "Network error. Check your internet connection.";

        default:
            return error?.message || "Unable to sign in.";
    }
}


// ============================================================
// VERIFY ADMIN
// ============================================================

async function verifyAdmin(user) {

    if (!user) return false;

    const email = (user.email || "").toLowerCase();

    // --------------------------------------------------------
    // METHOD 1
    // admins/{uid}
    // --------------------------------------------------------

    const adminRef = doc(
        db,
        "admins",
        user.uid
    );

    const adminSnapshot = await getDoc(adminRef);

    if (adminSnapshot.exists()) {

        const data = adminSnapshot.data();

        if (data.active === false) {
            return false;
        }

        if (
            data.email &&
            data.email.toLowerCase() !== email
        ) {
            return false;
        }

        return true;
    }


    // --------------------------------------------------------
    // METHOD 2
    // authorizedAdmins/{email}
    // --------------------------------------------------------

    if (!email) return false;

    const authorizedRef = doc(
        db,
        "authorizedAdmins",
        email
    );

    const authorizedSnapshot =
        await getDoc(authorizedRef);

    if (authorizedSnapshot.exists()) {

        const data =
            authorizedSnapshot.data();

        return data.active !== false;
    }

    return false;
}


// ============================================================
// LOGIN
// ============================================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const email =
                $("adminEmail")?.value
                    ?.trim()
                    .toLowerCase();

            const password =
                $("adminPassword")?.value || "";

            if (!email || !password) {

                showLoginMessage(
                    "Please enter your email and password."
                );

                return;
            }

            try {

                hideLoginMessage();

                if (loginBtn) {
                    loginBtn.disabled = true;
                    loginBtn.textContent = "Signing in...";
                }

                const credential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );

                const authorized =
                    await verifyAdmin(
                        credential.user
                    );

                if (!authorized) {

                    await signOut(auth);

                    currentAdmin = null;

                    showLoginMessage(
                        "This account is not authorized to access the Admin Panel."
                    );

                    return;
                }

                currentAdmin =
                    credential.user;

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
                    authError(error)
                );

            } finally {

                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.textContent =
                        "Sign In to Dashboard";
                }
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
                "Are you sure you want to sign out?",
                "🚪",
                async () => {

                    await signOut(auth);

                    currentAdmin = null;
                    currentExamSettings = null;

                    if (loginForm) {
                        loginForm.reset();
                    }

                    showLogin();
                }
            );
        }
    );
}


// ============================================================
// NAVIGATION
// ============================================================

function openSection(sectionName) {

    sections.forEach(
        section =>
            section.classList.remove("active")
    );

    navItems.forEach(
        item =>
            item.classList.remove("active")
    );

    const section =
        $(`${sectionName}Section`);

    const nav =
        document.querySelector(
            `[data-section="${sectionName}"]`
        );

    if (section) {
        section.classList.add("active");
    }

    if (nav) {
        nav.classList.add("active");
    }

    const titles = {

        dashboard: "Dashboard",
        examSettings: "Exam Settings",
        questions: "Question Bank",
        candidates: "Candidates",
        monitoring: "Live Monitoring",
        violations: "Security Violations",
        results: "Candidate Results",
        feedback: "Candidate Feedback",
        analytics: "Performance Analytics",
        admins: "Authorized Administrators",
        activity: "Activity Logs"
    };

    if (pageTitle) {
        pageTitle.textContent =
            titles[sectionName] || "Dashboard";
    }

    if (sidebar) {
        sidebar.classList.remove("mobile-open");
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (sectionName === "examSettings") {
        loadExamSettings();
    }
}


navItems.forEach(item => {

    item.addEventListener(
        "click",
        () => {
            openSection(
                item.dataset.section
            );
        }
    );

});


quickActions.forEach(item => {

    item.addEventListener(
        "click",
        () => {
            openSection(
                item.dataset.section
            );
        }
    );

});


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

function showConfirmation(
    title,
    message,
    icon,
    callback
) {

    if (!adminModal) return;

    if (modalTitle)
        modalTitle.textContent = title;

    if (modalMessage)
        modalMessage.textContent = message;

    if (modalIcon)
        modalIcon.textContent = icon;

    confirmationCallback = callback;

    adminModal.classList.add("show");
}


function closeConfirmation() {

    if (adminModal) {
        adminModal.classList.remove("show");
    }

    confirmationCallback = null;
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

            const callback =
                confirmationCallback;

            closeConfirmation();

            if (typeof callback === "function") {

                try {
                    await callback();
                } catch (error) {
                    console.error(
                        "Confirmation action error:",
                        error
                    );
                }
            }
        }
    );
}


if (adminModal) {

    adminModal.addEventListener(
        "click",
        event => {

            if (event.target === adminModal) {
                closeConfirmation();
            }
        }
    );
}


// ============================================================
// EXAM STATUS
// ============================================================

function updateExamStatusUI(status) {

    const map = {

        draft: {
            label: "DRAFT",
            text: "System Ready"
        },

        scheduled: {
            label: "SCHEDULED",
            text: "Exam Scheduled"
        },

        live: {
            label: "LIVE",
            text: "Exam Live"
        },

        paused: {
            label: "PAUSED",
            text: "Exam Paused"
        },

        ended: {
            label: "ENDED",
            text: "Exam Ended"
        }
    };

    const selected =
        map[status] || map.draft;

    setText(
        "largeExamStatus",
        selected.label
    );

    setText(
        "examStatus",
        selected.text
    );
}


async function changeExamStatus(status) {

    if (!currentAdmin) {
        alert("Please login first.");
        return;
    }

    try {

        const ref = doc(
            db,
            "examSettings",
            "current"
        );

        await setDoc(
            ref,
            {
                examStatus: status,
                updatedAt: serverTimestamp(),
                updatedBy: currentAdmin.uid
            },
            {
                merge: true
            }
        );

        if (!currentExamSettings) {
            currentExamSettings = {};
        }

        currentExamSettings.examStatus =
            status;

        updateExamStatusUI(status);

    } catch (error) {

        console.error(
            "Exam status error:",
            error
        );

        alert(
            "Unable to update exam status. Check Firestore Security Rules."
        );
    }
}


if (startExamBtn) {

    startExamBtn.addEventListener(
        "click",
        () => {

            showConfirmation(
                "Start Examination",
                "Are you sure you want to start the examination?",
                "▶️",
                () => changeExamStatus("live")
            );
        }
    );
}


if (pauseExamBtn) {

    pauseExamBtn.addEventListener(
        "click",
        () => {

            showConfirmation(
                "Pause Examination",
                "Are you sure you want to pause the examination?",
                "⏸️",
                () => changeExamStatus("paused")
            );
        }
    );
}


if (endExamBtn) {

    endExamBtn.addEventListener(
        "click",
        () => {

            showConfirmation(
                "End Examination",
                "Ending the examination may affect active candidates. Continue?",
                "⚠️",
                () => changeExamStatus("ended")
            );
        }
    );
}


// ============================================================
// FORM HELPERS
// ============================================================

function valueOf(id, fallback = "") {

    const element = $(id);

    if (!element) return fallback;

    return element.value.trim();
}


function numberOf(id, fallback) {

    const element = $(id);

    if (!element) return fallback;

    const value =
        Number(element.value);

    return Number.isFinite(value)
        ? value
        : fallback;
}


function checkedOf(id, fallback = false) {

    const element = $(id);

    return element
        ? Boolean(element.checked)
        : fallback;
}


function setValue(id, value) {

    const element = $(id);

    if (element) {
        element.value = value;
    }
}


function setChecked(id, value) {

    const element = $(id);

    if (element) {
        element.checked = Boolean(value);
    }
}


function setText(id, value) {

    const element = $(id);

    if (element) {
        element.textContent = value;
    }
}


// ============================================================
// EXAM SETTINGS
// ============================================================

function readExamSettings() {

    return {

        examTitle:
            valueOf(
                "examTitle",
                "Online Examination"
            ),

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
            valueOf("examStartTime"),

        examEndTime:
            valueOf("examEndTime"),

        examStatus:
            valueOf(
                "examStatusSetting",
                "draft"
            ),

        questionSource:
            valueOf(
                "questionSource",
                "chapterq.json"
            ),

        randomQuestions:
            checkedOf(
                "randomQuestions",
                true
            ),

        randomOptions:
            checkedOf(
                "randomOptions",
                true
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
                "disableCopy",
                true
            ),

        disablePaste:
            checkedOf(
                "disablePaste",
                true
            ),

        disableScreenshot:
            checkedOf(
                "disableScreenshot",
                true
            ),

        disableRefresh:
            checkedOf(
                "disableRefresh",
                true
            ),

        disableFunctionKeys:
            checkedOf(
                "disableFunctionKeys",
                true
            )
    };
}


function applyExamSettings(settings) {

    setValue(
        "examTitle",
        settings.examTitle ||
        "Online Examination"
    );

    setValue(
        "totalQuestionsSetting",
        settings.totalQuestions ?? 100
    );

    setValue(
        "questionsToDisplay",
        settings.questionsToDisplay ?? 80
    );

    setValue(
        "durationMinutes",
        settings.durationMinutes ?? 60
    );

    setValue(
        "marksPerQuestion",
        settings.marksPerQuestion ?? 4
    );

    setValue(
        "negativeMarks",
        settings.negativeMarks ?? 1
    );

    setValue(
        "examStartTime",
        settings.examStartTime || ""
    );

    setValue(
        "examEndTime",
        settings.examEndTime || ""
    );

    setValue(
        "examStatusSetting",
        settings.examStatus || "draft"
    );

    setValue(
        "questionSource",
        settings.questionSource ||
        "chapterq.json"
    );

    setChecked(
        "randomQuestions",
        settings.randomQuestions !== false
    );

    setChecked(
        "randomOptions",
        settings.randomOptions !== false
    );

    setValue(
        "tabSwitchPenalty",
        settings.tabSwitchPenalty ?? 1
    );

    setValue(
        "maxTabSwitches",
        settings.maxTabSwitches ?? 2
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
}


async function loadExamSettings() {

    try {

        const ref = doc(
            db,
            "examSettings",
            "current"
        );

        const snapshot =
            await getDoc(ref);

        if (!snapshot.exists()) {

            currentExamSettings =
                readExamSettings();

            updateDashboard(
                currentExamSettings
            );

            return;
        }

        currentExamSettings =
            snapshot.data();

        applyExamSettings(
            currentExamSettings
        );

        updateDashboard(
            currentExamSettings
        );

    } catch (error) {

        console.error(
            "Load settings error:",
            error
        );

        showSettingsMessage(
            "Unable to load settings: " +
            error.message,
            "error"
        );
    }
}


if (examSettingsForm) {

    examSettingsForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const settings =
                readExamSettings();

            if (settings.totalQuestions < 1) {
                showSettingsMessage(
                    "Total questions must be at least 1.",
                    "error"
                );
                return;
            }

            if (
                settings.questionsToDisplay < 1 ||
                settings.questionsToDisplay >
                settings.totalQuestions
            ) {
                showSettingsMessage(
                    "Displayed questions must be between 1 and total questions.",
                    "error"
                );
                return;
            }

            if (settings.durationMinutes < 1) {
                showSettingsMessage(
                    "Duration must be at least 1 minute.",
                    "error"
                );
                return;
            }

            if (settings.maxTabSwitches < 1) {
                showSettingsMessage(
                    "Maximum tab switches must be at least 1.",
                    "error"
                );
                return;
            }

            try {

                if (saveExamSettingsBtn) {
                    saveExamSettingsBtn.disabled = true;
                    saveExamSettingsBtn.textContent =
                        "Saving...";
                }

                await setDoc(
                    doc(
                        db,
                        "examSettings",
                        "current"
                    ),
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

                updateDashboard(settings);

                showSettingsMessage(
                    "✓ Settings saved successfully.",
                    "success"
                );

            } catch (error) {

                console.error(
                    "Save settings error:",
                    error
                );

                showSettingsMessage(
                    "Unable to save settings: " +
                    error.message,
                    "error"
                );

            } finally {

                if (saveExamSettingsBtn) {
                    saveExamSettingsBtn.disabled = false;
                    saveExamSettingsBtn.textContent =
                        "💾 Save Settings";
                }
            }
        }
    );
}


if (resetExamSettingsBtn) {

    resetExamSettingsBtn.addEventListener(
        "click",
        async () => {

            await loadExamSettings();

            showSettingsMessage(
                "Settings restored.",
                "success"
            );
        }
    );
}


// ============================================================
// DASHBOARD
// ============================================================

function updateDashboard(settings) {

    setText(
        "totalQuestions",
        settings.totalQuestions ?? 100
    );

    setText(
        "displayQuestions",
        settings.questionsToDisplay ?? 80
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
        settings.questionsToDisplay ?? 80
    );

    setText(
        "dashboardMarks",
        `+${settings.marksPerQuestion ?? 4}`
    );

    updateExamStatusUI(
        settings.examStatus || "draft"
    );
}


async function loadDashboardData() {

    setText("totalCandidates", 0);
    setText("completedCandidates", 0);
    setText("activeCandidates", 0);
    setText("totalViolations", 0);
}


if (refreshBtn) {

    refreshBtn.addEventListener(
        "click",
        async () => {

            refreshBtn.disabled = true;
            refreshBtn.textContent =
                "Updating...";

            try {

                await loadExamSettings();
                await loadDashboardData();

                refreshBtn.textContent =
                    "✓ Updated";

            } catch (error) {

                console.error(error);

                refreshBtn.textContent =
                    "⚠ Error";
            }

            setTimeout(
                () => {

                    refreshBtn.disabled = false;
                    refreshBtn.textContent =
                        "↻ Refresh";

                },
                1200
            );
        }
    );
}


// ============================================================
// SETTINGS MESSAGE
// ============================================================

function showSettingsMessage(
    message,
    type = "success"
) {

    const element =
        $("examSettingsMessage");

    if (!element) return;

    element.textContent = message;

    element.className =
        `settings-message ${type}`;

    element.style.display = "block";

    setTimeout(
        () => {
            element.style.display = "none";
        },
        5000
    );
}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            currentAdmin = null;
            showLogin();
            return;
        }

        try {

            const authorized =
                await verifyAdmin(user);

            if (!authorized) {

                await signOut(auth);

                currentAdmin = null;

                showLogin();

                showLoginMessage(
                    "This account is not authorized for the Admin Panel."
                );

                return;
            }

            currentAdmin = user;

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

            await signOut(auth);

            currentAdmin = null;

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

showLogin();

console.log(
    "ExamControl Admin Portal loaded."
);
