// ============================================================
// EXAMCONTROL ADMIN PORTAL
// Firebase Auth + Firestore
// ============================================================

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase-config.js";


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
let confirmationCallback = null;


function primaryInstituteId() {
    return currentAdminProfile?.instituteIds?.[0] || "";
}


function currentExamId() {
    const instituteId = primaryInstituteId();
    return instituteId ? `${instituteId}_default` : "";
}


function hasPermission(permission) {
    return Array.isArray(currentAdminProfile?.permissions) &&
        currentAdminProfile.permissions.includes(permission);
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
}


function applyPermissionVisibility() {
    const permissionMap = {
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
}


async function loadBatches() {
    const body = $("batchesTableBody");
    const instituteId = primaryInstituteId();

    if (!body || !instituteId || !hasPermission("batch.manage")) return;

    body.innerHTML = '<tr><td colspan="4">Loading batches...</td></tr>';

    try {
        const snapshot = await getDocs(
            query(
                collection(db, "batches"),
                where("instituteId", "==", instituteId)
            )
        );

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
        body.innerHTML = '<tr><td colspan="4">Unable to load batches.</td></tr>';
    }
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

            await addDoc(collection(db, "batches"), {
                instituteId: primaryInstituteId(),
                batchName,
                batchCode,
                className,
                status: "ACTIVE",
                createdBy: currentAdmin.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
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
