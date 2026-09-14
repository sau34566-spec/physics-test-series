// ============================================================
// EXAMCONTROL ADMIN PORTAL
// Firebase Auth + Firestore
// ============================================================

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    getAuth,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    initializeApp,
    getApp,
    getApps
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    deleteDoc,
    getDocs,
    query,
    where,
    getFirestore,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    firebaseConfig
} from "./firebase-config.js";


const ADMIN_APP_NAME = "institute-admin-portal";

const adminApp = getApps().some(app => app.name === ADMIN_APP_NAME)
    ? getApp(ADMIN_APP_NAME)
    : initializeApp(firebaseConfig, ADMIN_APP_NAME);

const auth = getAuth(adminApp);
const db = getFirestore(adminApp);


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
let currentAdminProfile = null;
let currentInstitute = null;
let currentExamSettings = null;
let currentBatches = [];
let currentExams = [];
let currentQuestions = [];
let editingQuestionId = null;
let questionSearchTerm = "";
let currentResults = [];
let currentFeedback = [];
let confirmationCallback = null;


function primaryInstituteId() {
    return currentAdminProfile?.instituteIds?.[0] || "";
}


function currentExamId() {
    const instituteId = primaryInstituteId();
    return currentExams[0]?.id ||
        (instituteId ? `${instituteId}_default` : "");
}


function hasPermission(permission) {
    if (permission === "result.export" && currentInstitute?.config?.features?.reports === false) return false;
    if (permission === "exam.control" && currentInstitute?.config?.features?.advancedExamControls === false) return false;
    if (
        Array.isArray(currentAdminProfile?.permissions) &&
        currentAdminProfile.permissions.includes(permission)
    ) {
        return true;
    }

    const examManagerPermissions = [
        "dashboard.view", "exam.view", "exam.create", "exam.edit",
        "exam.control", "batch.manage", "question.view", "question.create",
        "question.edit", "question.delete", "candidate.view", "candidate.manage",
        "result.view", "result.export", "feedback.view", "security.view"
    ];

    return currentAdminProfile?.permissionMode === "EXAM_MANAGER" &&
        examManagerPermissions.includes(permission);
}


async function logAdminAction(action, entityType, entityId, newValue = null) {
    if (!currentAdmin || !primaryInstituteId()) return;
    try {
        await addDoc(collection(db, "auditLogs"), {
            adminId: currentAdmin.uid,
            adminEmail: currentAdmin.email || "",
            role: currentAdminProfile?.role || "admin",
            instituteId: primaryInstituteId(),
            action,
            entityType,
            entityId: entityId || "",
            newValue,
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.warn("Admin audit log failed:", error);
    }
}


function requirePermission(permission, message) {
    if (hasPermission(permission)) return true;
    alert(message || "You do not have permission for this action.");
    return false;
}


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

        const status = String(
            data.status ||
            (data.active === false ? "INACTIVE" : "ACTIVE")
        ).toUpperCase();

        const role = String(
            data.role || ""
        ).toUpperCase();

        if (
            data.active === false ||
            status !== "ACTIVE"
        ) {
            return false;
        }

        if (role !== "ADMIN") {
            return false;
        }

        if (
            !Array.isArray(data.instituteIds) ||
            data.instituteIds.length === 0
        ) {
            return false;
        }

        if (
            data.email &&
            data.email.toLowerCase() !== email
        ) {
            return false;
        }

        currentAdminProfile = {
            id: adminSnapshot.id,
            ...data
        };

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

                showDashboard();

                await loadAdminContext();
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
                    currentAdminProfile = null;
                    currentInstitute = null;
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
        exams: "Exam Management",
        examSettings: "Exam Settings",
        batches: "Batches",
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

    if (sectionName === "exams") {
        loadExams();
    }

    if (sectionName === "questions") {
        loadQuestions();
    }

    if (sectionName === "candidates") loadDashboardData();
    if (sectionName === "monitoring") loadMonitoring();
    if (sectionName === "violations") loadViolations();
    if (sectionName === "results") loadResults();
    if (sectionName === "feedback") loadFeedback();
    if (sectionName === "analytics") loadAnalytics();
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

    if (!requirePermission(
        "exam.control",
        "You do not have permission to control exams."
    )) return;

    const instituteId = primaryInstituteId();
    const examId = currentExamId();

    if (!instituteId || !examId) {
        alert("No institute is assigned to this administrator.");
        return;
    }

    try {

        const ref = doc(
            db,
            "exams",
            examId
        );

        await setDoc(
            ref,
            {
                instituteId,
                examStatus: status.toUpperCase(),
                status: status.toUpperCase(),
                updatedAt: serverTimestamp(),
                updatedBy: currentAdmin.uid
            },
            {
                merge: true
            }
        );

        await logAdminAction(
            `EXAM_${status.toUpperCase()}`,
            "exam",
            examId,
            { status: status.toUpperCase() }
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

        const examId = currentExamId();

        if (!examId) {
            throw new Error("No institute is assigned to this administrator.");
        }

        const ref = doc(
            db,
            "exams",
            examId
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

        currentExamSettings.examStatus = String(
            currentExamSettings.examStatus ||
            currentExamSettings.status ||
            "DRAFT"
        ).toLowerCase();

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

            if (!requirePermission(
                "exam.edit",
                "You do not have permission to edit exam settings."
            )) return;

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
                        "exams",
                        currentExamId()
                    ),
                    {
                        ...settings,
                        instituteId:
                            primaryInstituteId(),

                        status:
                            settings.examStatus.toUpperCase(),

                        examStatus:
                            settings.examStatus.toUpperCase(),

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

    const instituteId = primaryInstituteId();

    if (!instituteId) return;

    if (hasPermission("candidate.view")) {
        const candidateSnapshot = await getDocs(
            query(
                collection(db, "candidates"),
                where("instituteId", "==", instituteId)
            )
        );

        let completed = 0;
        let active = 0;

        candidateSnapshot.forEach(item => {
            const status = String(item.data().status || "").toUpperCase();
            if (["COMPLETED", "SUBMITTED"].includes(status)) completed++;
            if (["ACTIVE", "IN_PROGRESS"].includes(status)) active++;
        });

        setText("totalCandidates", candidateSnapshot.size);
        setText("completedCandidates", completed);
        setText("activeCandidates", active);
        renderCandidates(candidateSnapshot);
    }

    if (hasPermission("security.view")) {
        const violationSnapshot = await getDocs(
            query(
                collection(db, "violations"),
                where("instituteId", "==", instituteId)
            )
        );
        setText("totalViolations", violationSnapshot.size);
    } else {
        setText("totalViolations", "—");
    }
}


function renderCandidates(snapshot) {
    const body = $("candidatesTableBody");
    if (!body) return;

    if (snapshot.empty) {
        body.innerHTML = '<tr><td colspan="5">No candidates found for this institute.</td></tr>';
        return;
    }

    body.innerHTML = "";
    snapshot.forEach(item => {
        const data = item.data();
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeHtml(data.name || data.candidateName || "—")}</td>
            <td>${escapeHtml(data.rollNumber || data.registrationNumber || "—")}</td>
            <td>${escapeHtml(data.batchName || data.batchId || "—")}</td>
            <td>${escapeHtml(data.examName || data.examId || "—")}</td>
            <td>${escapeHtml(data.status || "REGISTERED")}</td>
        `;
        body.appendChild(row);
    });
}


async function loadMonitoring() {
    const body = $("monitoringTableBody");
    const instituteId = primaryInstituteId();
    if (!body || !instituteId || !hasPermission("candidate.view")) return;

    try {
        const snapshot = await getDocs(query(
            collection(db, "presence"),
            where("instituteId", "==", instituteId)
        ));
        const now = Date.now();
        const rows = snapshot.docs.map(item => item.data()).filter(data => {
            const last = data.lastActiveAt?.toMillis?.() || 0;
            return data.status === "active" && now - last < 60000;
        });
        body.innerHTML = rows.length ? rows.map(data => `
            <tr><td>${escapeHtml(data.candidateName || data.candidateEmail || "—")}</td>
            <td>${escapeHtml(data.examId || "—")}</td><td>${escapeHtml(`${data.progress || 0}%`)}</td>
            <td>${escapeHtml(data.violations || 0)}</td><td>${escapeHtml(data.riskLevel || "CLEAN")}</td>
            <td>${escapeHtml(formatLocalDateTime(data.lastActiveAt))}</td></tr>`).join("")
            : '<tr><td colspan="6">No active candidates in the last 60 seconds.</td></tr>';
    } catch (error) {
        console.error("Monitoring error:", error);
        body.innerHTML = '<tr><td colspan="6">Unable to load live monitoring.</td></tr>';
    }
}


async function loadViolations() {
    const body = $("violationsTableBody");
    const instituteId = primaryInstituteId();
    if (!body || !instituteId || !hasPermission("security.view")) return;
    try {
        const snapshot = await getDocs(query(
            collection(db, "violations"),
            where("instituteId", "==", instituteId)
        ));
        const rows = snapshot.docs.map(item => item.data()).sort((a, b) =>
            Number(b.timestamp?.seconds || 0) - Number(a.timestamp?.seconds || 0)
        ).slice(0, 100);
        body.innerHTML = rows.length ? rows.map(data => `
            <tr><td>${escapeHtml(data.candidateName || data.candidateEmail || "—")}</td>
            <td>${escapeHtml(data.examId || "—")}</td><td>${escapeHtml(data.eventType || data.violationType || "—")}</td>
            <td>${escapeHtml(data.penaltyApplied || 0)}</td><td>${escapeHtml(data.riskLevel || "—")}</td>
            <td>${escapeHtml(formatLocalDateTime(data.timestamp))}</td></tr>`).join("")
            : '<tr><td colspan="6">No security violations recorded.</td></tr>';
    } catch (error) {
        console.error("Violation load error:", error);
        body.innerHTML = '<tr><td colspan="6">Unable to load security events.</td></tr>';
    }
}


async function loadResults() {
    const body = $("resultsTableBody");
    const instituteId = primaryInstituteId();
    if (!body || !instituteId || !hasPermission("result.view")) return;
    try {
        const snapshot = await getDocs(query(
            collection(db, "results"),
            where("instituteId", "==", instituteId)
        ));
        currentResults = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
            .sort((a, b) => Number(b.finalMarks || 0) - Number(a.finalMarks || 0));
        body.innerHTML = currentResults.length ? currentResults.map((data, index) => `
            <tr><td>${index + 1}</td><td>${escapeHtml(data.candidateName || data.candidateEmail || "—")}</td>
            <td>${escapeHtml(data.examTitle || data.examId || "—")}</td>
            <td>${escapeHtml(`${data.finalMarks ?? 0} / ${data.maxMarks ?? 0}`)}</td>
            <td>${escapeHtml(data.correct || 0)}</td><td>${escapeHtml(data.wrong || 0)}</td>
            <td>${escapeHtml(data.securityPenalty || 0)}</td><td>${escapeHtml(formatLocalDateTime(data.submittedAt))}</td></tr>`).join("")
            : '<tr><td colspan="8">No submitted results found.</td></tr>';
    } catch (error) {
        console.error("Results load error:", error);
        body.innerHTML = '<tr><td colspan="8">Unable to load results.</td></tr>';
    }
}


async function loadFeedback() {
    const body = $("feedbackTableBody");
    const instituteId = primaryInstituteId();
    if (!body || !instituteId || !hasPermission("feedback.view")) return;
    try {
        const snapshot = await getDocs(query(
            collection(db, "feedback"),
            where("instituteId", "==", instituteId)
        ));
        currentFeedback = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        body.innerHTML = currentFeedback.length ? currentFeedback.map(data => `
            <tr><td>${escapeHtml(data.candidateName || data.candidateEmail || "—")}</td>
            <td>${escapeHtml(data.examTitle || data.examId || "—")}</td><td>${escapeHtml(`${data.rating || 0}/5`)}</td>
            <td>${escapeHtml(data.feedback || "—")}</td><td>${escapeHtml(data.doubt || "—")}</td>
            <td>${escapeHtml(formatLocalDateTime(data.submittedAt))}</td></tr>`).join("")
            : '<tr><td colspan="6">No candidate feedback found.</td></tr>';
    } catch (error) {
        console.error("Feedback load error:", error);
        body.innerHTML = '<tr><td colspan="6">Unable to load feedback.</td></tr>';
    }
}


async function loadAnalytics() {
    await Promise.all([loadResults(), loadFeedback(), loadViolations()]);
    const averageScore = currentResults.length
        ? currentResults.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / currentResults.length
        : 0;
    const averageRating = currentFeedback.length
        ? currentFeedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / currentFeedback.length
        : 0;
    setText("analyticsSubmissions", currentResults.length);
    setText("analyticsAverageScore", `${averageScore.toFixed(1)}%`);
    setText("analyticsAverageRating", `${averageRating.toFixed(1)}/5`);
    setText("analyticsSecurityFlags", $("totalViolations")?.textContent || "0");
}


function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
}


$("exportResultsCsvBtn")?.addEventListener("click", () => {
    if (!hasPermission("result.export")) return;
    const lines = [["Rank", "Candidate", "Email", "Exam", "Score", "Max Marks", "Correct", "Wrong", "Penalty"]];
    currentResults.forEach((item, index) => lines.push([
        index + 1, item.candidateName, item.candidateEmail, item.examTitle || item.examId,
        item.finalMarks, item.maxMarks, item.correct, item.wrong, item.securityPenalty
    ]));
    const blob = new Blob([lines.map(row => row.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `results-${primaryInstituteId()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
});


async function loadAdminContext() {
    const instituteId = primaryInstituteId();

    if (!instituteId) {
        throw new Error("No institute is assigned to this administrator.");
    }

    const instituteSnapshot = await getDoc(
        doc(db, "institutes", instituteId)
    );

    if (!instituteSnapshot.exists()) {
        throw new Error("Assigned institute was not found.");
    }

    currentInstitute = {
        id: instituteSnapshot.id,
        ...instituteSnapshot.data()
    };

    const instituteStatus = String(
        currentInstitute.status || "ACTIVE"
    ).toUpperCase();

    if (instituteStatus !== "ACTIVE") {
        throw new Error("This institute is not active.");
    }

    setText(
        "adminName",
        currentAdminProfile?.name || currentAdmin?.email || "Administrator"
    );
    setText(
        "adminInstituteName",
        currentInstitute.instituteName ||
        currentInstitute.name ||
        currentInstitute.instituteCode ||
        "Assigned Institute"
    );

    applyPermissionVisibility();
    await loadBatches();
    await loadExams();
}


function applyPermissionVisibility() {
    const permissionMap = {
        exams: "exam.view",
        examSettings: "exam.view",
        questions: "question.view",
        candidates: "candidate.view",
        monitoring: "candidate.view",
        violations: "security.view",
        results: "result.view",
        feedback: "feedback.view",
        analytics: "result.view",
        batches: "batch.manage"
    };

    document.querySelectorAll("[data-section]").forEach(element => {
        const required = permissionMap[element.dataset.section];
        if (required) element.hidden = !hasPermission(required);
    });

    document.querySelectorAll('[data-section="admins"], [data-section="activity"]')
        .forEach(element => { element.hidden = true; });

    [startExamBtn, pauseExamBtn, endExamBtn].forEach(button => {
        if (button) button.hidden = !hasPermission("exam.control");
    });

    if (saveExamSettingsBtn) {
        saveExamSettingsBtn.hidden = !hasPermission("exam.edit");
    }

    if ($("exportResultsCsvBtn")) {
        $("exportResultsCsvBtn").hidden = !hasPermission("result.export");
    }
}


async function loadBatches() {
    const body = $("batchesTableBody");
    const instituteId = primaryInstituteId();

    if (!instituteId || !(
        hasPermission("batch.manage") ||
        hasPermission("exam.create") ||
        hasPermission("exam.edit")
    )) return;

    if (body) {
        body.innerHTML = '<tr><td colspan="4">Loading batches...</td></tr>';
    }

    try {
        const snapshot = await getDocs(
            query(
                collection(db, "batches"),
                where("instituteId", "==", instituteId)
            )
        );

        currentBatches = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        populateExamBatchOptions();

        if (!body) return;

        if (snapshot.empty) {
            body.innerHTML = '<tr><td colspan="4">No batches created yet.</td></tr>';
            return;
        }

        body.innerHTML = "";
        snapshot.forEach(item => {
            const data = item.data();
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${escapeHtml(data.batchName || "—")}</td>
                <td>${escapeHtml(data.batchCode || "—")}</td>
                <td>${escapeHtml(data.className || "—")}</td>
                <td>${escapeHtml(data.status || "ACTIVE")}</td>
            `;
            body.appendChild(row);
        });
    } catch (error) {
        console.error("Load batches error:", error);
        if (body) {
            body.innerHTML = '<tr><td colspan="4">Unable to load batches.</td></tr>';
        }
    }
}


function populateExamBatchOptions() {
    const select = $("examBatchIds");
    if (!select) return;

    select.innerHTML = "";

    currentBatches.forEach(batch => {
        const option = document.createElement("option");
        option.value = batch.id;
        option.textContent = `${batch.batchName || "Batch"} (${batch.batchCode || batch.id})`;
        select.appendChild(option);
    });
}


async function loadExams() {
    const body = $("examsTableBody");
    const instituteId = primaryInstituteId();

    if (!body || !instituteId || !hasPermission("exam.view")) return;

    body.innerHTML = '<tr><td colspan="7">Loading exams...</td></tr>';

    try {
        const snapshot = await getDocs(
            query(
                collection(db, "exams"),
                where("instituteId", "==", instituteId)
            )
        );

        currentExams = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        currentExams.sort((a, b) =>
            Number(b.createdAt?.seconds || 0) -
            Number(a.createdAt?.seconds || 0)
        );

        populateQuestionExamOptions();
        renderExams();
    } catch (error) {
        console.error("Load exams error:", error);
        body.innerHTML = '<tr><td colspan="7">Unable to load exams.</td></tr>';
    }
}


function renderExams() {
    const body = $("examsTableBody");
    if (!body) return;

    if (!currentExams.length) {
        body.innerHTML = '<tr><td colspan="7">No exams created yet.</td></tr>';
        return;
    }

    body.innerHTML = "";

    currentExams.forEach(exam => {
        const row = document.createElement("tr");
        const status = String(exam.status || exam.examStatus || "DRAFT").toUpperCase();
        const batchNames = (exam.batchIds || []).map(batchId => {
            const batch = currentBatches.find(item => item.id === batchId);
            return batch?.batchName || batchId;
        }).join(", ") || "All batches";

        const statusOptions = ["DRAFT", "SCHEDULED", "LIVE", "PAUSED", "ENDED"]
            .map(value => `<option value="${value}" ${value === status ? "selected" : ""}>${value}</option>`)
            .join("");

        row.innerHTML = `
            <td><strong>${escapeHtml(exam.examTitle || exam.title || "Untitled Exam")}</strong><br><small>${escapeHtml(exam.examCode || "—")}</small></td>
            <td>${escapeHtml(batchNames)}</td>
            <td>${escapeHtml(`${exam.durationMinutes || 0} min`)}</td>
            <td>${escapeHtml(`${exam.marksPerQuestion ?? 0} / -${exam.negativeMarks ?? 0}`)}</td>
            <td>${escapeHtml(formatLocalDateTime(exam.examStartTime || exam.startAt))}</td>
            <td><span class="exam-status-pill status-${status.toLowerCase()}">${escapeHtml(status)}</span></td>
            <td>
                ${hasPermission("exam.control") ? `
                    <div class="exam-status-control">
                        <select class="exam-row-status" data-exam-id="${escapeHtml(exam.id)}">${statusOptions}</select>
                        <button type="button" class="table-action-btn" data-update-exam-status="${escapeHtml(exam.id)}">Update</button>
                    </div>
                ` : "—"}
            </td>
        `;
        body.appendChild(row);
    });
}


function formatLocalDateTime(value) {
    if (!value) return "—";

    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}


const examManagementForm = $("examManagementForm");

if (examManagementForm) {
    examManagementForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (!requirePermission(
            "exam.create",
            "You do not have permission to create exams."
        )) return;

        const examTitle = valueOf("newExamTitle");
        const examCode = valueOf("newExamCode").toUpperCase();
        const durationMinutes = numberOf("newExamDuration", 60);
        const totalQuestions = numberOf("newExamQuestions", 0);
        const marksPerQuestion = numberOf("newExamMarks", 1);
        const negativeMarks = numberOf("newExamNegativeMarks", 0);
        const examStartTime = valueOf("newExamStartTime");
        const examEndTime = valueOf("newExamEndTime");
        const status = valueOf("newExamStatus", "DRAFT").toUpperCase();
        const batchIds = Array.from($("examBatchIds")?.selectedOptions || [])
            .map(option => option.value);

        if (!examTitle || !examCode || durationMinutes < 1 || totalQuestions < 1) {
            showExamMessage("Enter a title, unique code, duration and question count.", "error");
            return;
        }

        if (currentExams.some(exam =>
            String(exam.examCode || "").toUpperCase() === examCode
        )) {
            showExamMessage("This exam code already exists in your institute.", "error");
            return;
        }

        if (examStartTime && examEndTime && new Date(examEndTime) <= new Date(examStartTime)) {
            showExamMessage("Exam end time must be after the start time.", "error");
            return;
        }

        try {
            const createdExam = await addDoc(collection(db, "exams"), {
                instituteId: primaryInstituteId(),
                examTitle,
                examCode,
                batchIds,
                durationMinutes,
                totalQuestions,
                questionsToDisplay: totalQuestions,
                marksPerQuestion,
                negativeMarks,
                examStartTime,
                examEndTime,
                status,
                examStatus: status,
                createdBy: currentAdmin.uid,
                createdByEmail: currentAdmin.email || "",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            await logAdminAction("EXAM_CREATED", "exam", createdExam.id, {
                examTitle,
                examCode,
                status
            });

            examManagementForm.reset();
            showExamMessage("Exam created successfully.", "success");
            await loadExams();
        } catch (error) {
            console.error("Create exam error:", error);
            showExamMessage("Unable to create exam: " + error.message, "error");
        }
    });
}


const examsTableBody = $("examsTableBody");

if (examsTableBody) {
    examsTableBody.addEventListener("click", async event => {
        const button = event.target.closest("[data-update-exam-status]");
        if (!button) return;

        if (!requirePermission(
            "exam.control",
            "You do not have permission to control exams."
        )) return;

        const examId = button.dataset.updateExamStatus;
        const select = Array.from(
            examsTableBody.querySelectorAll(".exam-row-status")
        ).find(element => element.dataset.examId === examId);
        const status = select?.value;

        if (!status) return;

        try {
            button.disabled = true;
            button.textContent = "Updating...";

            await setDoc(doc(db, "exams", examId), {
                instituteId: primaryInstituteId(),
                status,
                examStatus: status,
                updatedBy: currentAdmin.uid,
                updatedAt: serverTimestamp()
            }, { merge: true });

            await logAdminAction(`EXAM_${status}`, "exam", examId, { status });

            showExamMessage(`Exam status changed to ${status}.`, "success");
            await loadExams();
        } catch (error) {
            console.error("Update exam status error:", error);
            showExamMessage("Unable to update status: " + error.message, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Update";
        }
    });
}


function showExamMessage(message, type) {
    const element = $("examManagementMessage");
    if (!element) return;
    element.textContent = message;
    element.className = `settings-message ${type}`;
    element.style.display = "block";
}


function populateQuestionExamOptions() {
    const select = $("questionExamIds");
    if (!select) return;

    select.innerHTML = "";
    currentExams.forEach(exam => {
        const option = document.createElement("option");
        option.value = exam.id;
        option.textContent = `${exam.examTitle || "Exam"} (${exam.examCode || exam.id})`;
        select.appendChild(option);
    });
}


async function loadQuestions() {
    const body = $("questionsTableBody");
    const instituteId = primaryInstituteId();

    if (!body || !instituteId || !hasPermission("question.view")) return;

    body.innerHTML = '<tr><td colspan="8">Loading questions...</td></tr>';

    try {
        const snapshot = await getDocs(
            query(
                collection(db, "questions"),
                where("instituteId", "==", instituteId)
            )
        );

        currentQuestions = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        currentQuestions.sort((a, b) =>
            Number(b.createdAt?.seconds || 0) -
            Number(a.createdAt?.seconds || 0)
        );

        await syncExamQuestionIds();
        renderQuestions();
    } catch (error) {
        console.error("Load questions error:", error);
        body.innerHTML = '<tr><td colspan="8">Unable to load questions.</td></tr>';
    }
}


async function syncExamQuestionIds() {
    if (!hasPermission("question.create")) return;

    await Promise.all(
        currentExams.map(exam => {
            const questionIds = currentQuestions
                .filter(question =>
                    Array.isArray(question.examIds) &&
                    question.examIds.includes(exam.id)
                )
                .map(question => question.id);

            return setDoc(
                doc(db, "exams", exam.id),
                {
                    instituteId: primaryInstituteId(),
                    questionIds,
                    updatedAt: serverTimestamp(),
                    updatedBy: currentAdmin.uid
                },
                { merge: true }
            );
        })
    );
}


function renderQuestions() {
    const body = $("questionsTableBody");
    if (!body) return;

    const visibleQuestions = currentQuestions.filter(question => {
        if (!questionSearchTerm) return true;
        return [question.question, question.subject, question.chapter, question.topic]
            .some(value => String(value || "").toLowerCase().includes(questionSearchTerm));
    });

    if (!visibleQuestions.length) {
        body.innerHTML = '<tr><td colspan="8">No questions created yet.</td></tr>';
        return;
    }

    body.innerHTML = "";

    visibleQuestions.forEach((question, index) => {
        const examNames = (question.examIds || []).map(examId => {
            const exam = currentExams.find(item => item.id === examId);
            return exam?.examTitle || examId;
        }).join(", ") || "Unassigned";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="question-text-cell">${escapeHtml(question.question || "—")}</td>
            <td>${escapeHtml(question.subject || "—")}</td>
            <td>${escapeHtml(examNames)}</td>
            <td>${escapeHtml(question.difficulty || "MODERATE")}</td>
            <td>${escapeHtml(question.correctAnswer || "—")}</td>
            <td>${escapeHtml(question.status || "DRAFT")}</td>
            <td>
                <div class="exam-status-control">
                    ${hasPermission("question.edit") ? `<button type="button" class="table-action-btn" data-edit-question="${escapeHtml(question.id)}">Edit</button>` : ""}
                    ${hasPermission("question.create") ? `<button type="button" class="table-action-btn" data-duplicate-question="${escapeHtml(question.id)}">Duplicate</button>` : ""}
                    ${hasPermission("question.delete") ? `<button type="button" class="table-danger-btn" data-delete-question="${escapeHtml(question.id)}">Delete</button>` : ""}
                </div>
            </td>
        `;
        body.appendChild(row);
    });
}


const questionForm = $("questionForm");

if (questionForm) {
    questionForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (!requirePermission(
            "question.create",
            "You do not have permission to create questions."
        )) return;

        const question = valueOf("questionText");
        const options = ["questionOptionA", "questionOptionB", "questionOptionC", "questionOptionD"]
            .map(id => valueOf(id));
        const correctOptionIndex = numberOf("questionCorrectOption", 0);
        const examIds = Array.from($("questionExamIds")?.selectedOptions || [])
            .map(option => option.value);

        if (!question || options.some(option => !option)) {
            showQuestionMessage("Enter the question and all four options.", "error");
            return;
        }

        if (new Set(options.map(option => option.toLowerCase())).size !== 4) {
            showQuestionMessage("All four options must be different.", "error");
            return;
        }

        if (!examIds.length) {
            showQuestionMessage("Assign the question to at least one exam.", "error");
            return;
        }

        const payload = {
                instituteId: primaryInstituteId(),
                examIds,
                subject: valueOf("questionSubject"),
                chapter: valueOf("questionChapter"),
                topic: valueOf("questionTopic"),
                difficulty: valueOf("questionDifficulty", "MODERATE").toUpperCase(),
                question,
                options,
                correctOptionIndex,
                correctAnswer: options[correctOptionIndex],
                explanation: valueOf("questionExplanation"),
                marks: numberOf("questionMarks", 1),
                negativeMarking: numberOf("questionNegativeMarks", 0),
                status: valueOf("questionStatus", "ACTIVE").toUpperCase(),
                createdBy: currentAdmin.uid,
                updatedAt: serverTimestamp()
            };

        try {
            if (editingQuestionId) {
                if (!requirePermission("question.edit", "You do not have permission to edit questions.")) return;
                await setDoc(doc(db, "questions", editingQuestionId), payload, { merge: true });
                await logAdminAction("QUESTION_EDITED", "question", editingQuestionId, { examIds });
                editingQuestionId = null;
            } else {
                const createdQuestion = await addDoc(collection(db, "questions"), {
                    ...payload,
                    createdAt: serverTimestamp()
                });

                await logAdminAction("QUESTION_ADDED", "question", createdQuestion.id, {
                    examIds,
                    subject: valueOf("questionSubject")
                });
            }

            questionForm.reset();
            showQuestionMessage("Question saved successfully.", "success");
            await loadQuestions();
        } catch (error) {
            console.error("Create question error:", error);
            showQuestionMessage("Unable to create question: " + error.message, "error");
        }
    });
}


const questionsTableBody = $("questionsTableBody");

if (questionsTableBody) {
    questionsTableBody.addEventListener("click", async event => {
        const editButton = event.target.closest("[data-edit-question]");
        const duplicateButton = event.target.closest("[data-duplicate-question]");
        const button = event.target.closest("[data-delete-question]");

        if (editButton || duplicateButton) {
            const id = editButton?.dataset.editQuestion || duplicateButton?.dataset.duplicateQuestion;
            const question = currentQuestions.find(item => item.id === id);
            if (!question) return;
            setValue("questionText", question.question || "");
            ["A", "B", "C", "D"].forEach((letter, index) =>
                setValue(`questionOption${letter}`, question.options?.[index] || "")
            );
            setValue("questionCorrectOption", question.correctOptionIndex ?? 0);
            setValue("questionSubject", question.subject || "");
            setValue("questionChapter", question.chapter || "");
            setValue("questionTopic", question.topic || "");
            setValue("questionDifficulty", question.difficulty || "MODERATE");
            setValue("questionMarks", question.marks ?? 1);
            setValue("questionNegativeMarks", question.negativeMarking ?? 0);
            setValue("questionStatus", question.status || "ACTIVE");
            document.querySelectorAll("#questionExamIds option").forEach(option => {
                option.selected = (question.examIds || []).includes(option.value);
            });
            editingQuestionId = editButton ? id : null;
            document.getElementById("questionForm")?.scrollIntoView({ behavior: "smooth" });
            return;
        }

        if (!button) return;

        if (!requirePermission(
            "question.delete",
            "You do not have permission to delete questions."
        )) return;

        if (!confirm("Delete this question permanently?")) return;

        try {
            button.disabled = true;
            await deleteDoc(doc(db, "questions", button.dataset.deleteQuestion));
            showQuestionMessage("Question deleted.", "success");
            await loadQuestions();
        } catch (error) {
            console.error("Delete question error:", error);
            showQuestionMessage("Unable to delete question: " + error.message, "error");
            button.disabled = false;
        }
    });
}


$("questionSearchInput")?.addEventListener("input", event => {
    questionSearchTerm = String(event.target.value || "").trim().toLowerCase();
    renderQuestions();
});


$("exportQuestionsBtn")?.addEventListener("click", () => {
    if (!hasPermission("question.view")) return;
    const content = currentQuestions.map(({ id, createdAt, updatedAt, ...question }) => question);
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `questions-${primaryInstituteId()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
});


$("importQuestionsBtn")?.addEventListener("click", () => {
    if (hasPermission("question.create")) $("questionImportFile")?.click();
});


$("questionImportFile")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file || !hasPermission("question.create")) return;
    try {
        const parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed) || parsed.length > 500) {
            throw new Error("JSON must contain an array of up to 500 questions.");
        }
        for (const item of parsed) {
            const options = Array.isArray(item.options) ? item.options.slice(0, 4).map(String) : [];
            if (!item.question || options.length !== 4 || !(item.examIds || []).length) continue;
            const correctOptionIndex = Number(item.correctOptionIndex ?? 0);
            await addDoc(collection(db, "questions"), {
                ...item,
                instituteId: primaryInstituteId(),
                options,
                correctOptionIndex,
                correctAnswer: options[correctOptionIndex],
                createdBy: currentAdmin.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        showQuestionMessage("Questions imported successfully.", "success");
        await loadQuestions();
    } catch (error) {
        showQuestionMessage(`Import failed: ${error.message}`, "error");
    } finally {
        event.target.value = "";
    }
});


function showQuestionMessage(message, type) {
    const element = $("questionMessage");
    if (!element) return;
    element.textContent = message;
    element.className = `settings-message ${type}`;
    element.style.display = "block";
}


function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
}


const batchForm = $("batchForm");

if (batchForm) {
    batchForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (!requirePermission(
            "batch.manage",
            "You do not have permission to manage batches."
        )) return;

        const batchName = valueOf("batchName");
        const batchCode = valueOf("batchCode").toUpperCase();
        const className = valueOf("batchClass");

        if (!batchName || !batchCode) {
            showBatchMessage("Enter batch name and batch code.", "error");
            return;
        }

        try {
            const duplicate = await getDocs(
                query(
                    collection(db, "batches"),
                    where("instituteId", "==", primaryInstituteId()),
                    where("batchCode", "==", batchCode)
                )
            );

            if (!duplicate.empty) {
                showBatchMessage("This batch code already exists.", "error");
                return;
            }

            const createdBatch = await addDoc(collection(db, "batches"), {
                instituteId: primaryInstituteId(),
                batchName,
                batchCode,
                className,
                status: "ACTIVE",
                createdBy: currentAdmin.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            await logAdminAction("BATCH_CREATED", "batch", createdBatch.id, {
                batchName,
                batchCode
            });

            batchForm.reset();
            showBatchMessage("Batch created successfully.", "success");
            await loadBatches();
        } catch (error) {
            console.error("Create batch error:", error);
            showBatchMessage("Unable to create batch: " + error.message, "error");
        }
    });
}


function showBatchMessage(message, type) {
    const element = $("batchMessage");
    if (!element) return;
    element.textContent = message;
    element.className = `settings-message ${type}`;
    element.style.display = "block";
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

            showDashboard();

            await loadAdminContext();
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

const passwordResetButton = document.createElement("button");
passwordResetButton.type = "button";
passwordResetButton.className = "secondary-btn";
passwordResetButton.textContent = "Set / Reset Password";
passwordResetButton.onclick = async () => {
    try {
        const email = $("adminEmail")?.value?.trim();
        if (!email) throw new Error("Enter your email first.");
        await sendPasswordResetEmail(auth, email);
        showLoginMessage("Password reset requested. Check your inbox.", "success");
    } catch (error) { showLoginMessage(error.message); }
};
loginForm?.append(passwordResetButton);
