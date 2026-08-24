/* =========================================================
   SUPER ADMIN DASHBOARD CORE
   File: /js/superadmin.js

   Responsibilities:
   - Dashboard initialization
   - View/navigation handling
   - Authentication integration
   - Firestore dashboard configuration
   - Modal data handling
   - Admin profile
   - Refresh orchestration
   - Emergency action routing

   Authentication is handled ONLY by auth.js
   ========================================================= */

import { db } from "./firebase-config.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    collection,
    getDocs,
    query,
    limit
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";


/* =========================================================
   GLOBAL STATE
   ========================================================= */

const state = {

    initialized: false,

    loading: false,

    currentView: "overview",

    currentViewTitle: "Overview",

    currentModal: null,

    examConfig: null,

    stats: {
        institutes: 0,
        admins: 0,
        activeAdmins: 0,
        suspendedAdmins: 0,
        exams: 0,
        liveExams: 0,
        scheduledExams: 0,
        completedExams: 0,
        candidates: 0,
        activeCandidates: 0,
        submissions: 0,
        averageScore: 0,
        securityFlags: 0,
        averageRating: 0
    },

    listeners: [],

    collections: {
        institutes: "institutes",
        users: "users",
        admins: "admins",
        exams: "exams",
        candidates: "candidates",
        results: "results",
        securityEvents: "securityEvents",
        notifications: "notifications",
        activityLogs: "activityLogs"
    }

};


/* =========================================================
   SHORTCUTS
   ========================================================= */

const $ = id =>
    document.getElementById(id);


function normalize(value) {

    return String(value ?? "")
        .trim()
        .toLowerCase();

}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function numberValue(
    value,
    fallback = 0
) {

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;

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
     * Prefer UI implementation if available.
     */

    if (
        window.SuperAdminUI &&
        window.SuperAdminUI !== api &&
        typeof window.SuperAdminUI.showToast ===
            "function"
    ) {

        /*
         * Avoid accidental recursion.
         */

        try {

            const uiToast =
                window.SuperAdminUI.showToast;

            if (
                uiToast !== showToast
            ) {
                uiToast(
                    title,
                    message,
                    type
                );

                return;
            }

        } catch {
            // fallback below
        }

    }


    /*
     * Native lightweight toast.
     */

    let container =
        document.getElementById(
            "superAdminToastContainer"
        );


    if (!container) {

        container =
            document.createElement(
                "div"
            );

        container.id =
            "superAdminToastContainer";

        container.style.position =
            "fixed";

        container.style.right =
            "20px";

        container.style.bottom =
            "20px";

        container.style.zIndex =
            "99999";

        container.style.display =
            "flex";

        container.style.flexDirection =
            "column";

        container.style.gap =
            "10px";

        document.body.appendChild(
            container
        );
    }


    const toast =
        document.createElement(
            "div"
        );

    toast.style.padding =
        "14px 18px";

    toast.style.borderRadius =
        "12px";

    toast.style.background =
        "#111827";

    toast.style.color =
        "#fff";

    toast.style.boxShadow =
        "0 10px 30px rgba(0,0,0,.25)";

    toast.style.minWidth =
        "260px";

    toast.innerHTML = `
        <strong>${escapeHtml(title)}</strong>
        <div style="margin-top:4px;font-size:13px;opacity:.85">
            ${escapeHtml(message)}
        </div>
    `;

    container.appendChild(
        toast
    );


    setTimeout(() => {

        toast.remove();

    }, 3500);

}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(
    message,
    type = "info"
) {

    const possibleIds = [
        "systemStatus",
        "statusText",
        "connectionStatus",
        "lastSync"
    ];


    for (
        const id of possibleIds
    ) {

        const element =
            $(id);

        if (element) {

            element.textContent =
                message;

            element.dataset.status =
                type;

            return;
        }
    }

}


/* =========================================================
   AUTHORIZATION GUARD
   ========================================================= */

function getAuthState() {

    if (
        !window.SuperAdminAuth ||
        typeof window.SuperAdminAuth.getState !==
            "function"
    ) {

        return {
            authorized: false,
            user: null,
            profile: null
        };
    }


    return window.SuperAdminAuth
        .getState();

}


function requireAuthorization() {

    const authState =
        getAuthState();


    if (
        !authState.authorized
    ) {

        showToast(
            "Access denied",
            "Super Admin authorization is required.",
            "danger"
        );

        return false;
    }


    return true;

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function showView(
    view,
    title
) {

    if (
        !requireAuthorization()
    ) {
        return;
    }


    state.currentView =
        view;

    state.currentViewTitle =
        title || view;


    /*
     * Support different naming conventions
     * used by the HTML.
     */

    const allSections =
        document.querySelectorAll(
            "[data-view]"
        );


    allSections.forEach(
        section => {

            section.classList.toggle(
                "active",
                section.dataset.view ===
                    view
            );

        }
    );


    /*
     * Common section IDs.
     */

    document
        .querySelectorAll(
            ".view-section, .dashboard-view, .page-section"
        )
        .forEach(
            section => {

                const sectionView =
                    section.dataset.view ||
                    section.dataset.section ||
                    section.id;

                if (
                    sectionView
                ) {

                    section.classList.toggle(
                        "active",
                        normalize(
                            sectionView
                        ) ===
                            normalize(
                                view
                            )
                    );
                }

            }
        );


    /*
     * Navigation button active state.
     */

    document
        .querySelectorAll(
            "[data-view-target], [data-view]"
        )
        .forEach(
            button => {

                const target =
                    button.dataset.viewTarget ||
                    button.dataset.view;

                if (
                    target
                ) {

                    button.classList.toggle(
                        "active",
                        normalize(
                            target
                        ) ===
                            normalize(
                                view
                            )
                    );
                }

            }
        );


    /*
     * Update page title.
     */

    const pageTitle =
        document.getElementById(
            "pageTitle"
        );


    if (pageTitle) {

        pageTitle.textContent =
            state.currentViewTitle;
    }


    /*
     * Load view-specific data.
     */

    loadViewData(
        view
    );

}


/* =========================================================
   VIEW DATA ROUTER
   ========================================================= */

async function loadViewData(
    view
) {

    if (
        !requireAuthorization()
    ) {
        return;
    }


    try {

        switch (
            normalize(view)
        ) {

            case "overview":
                await loadOverview();
                break;

            case "dashboard":
                await loadOverview();
                break;

            case "exam":
            case "exams":
            case "exam-management":
                await loadExamConfig();
                break;

            case "notifications":
                await loadNotifications();
                break;

            case "admins":
            case "admin-management":
                await loadAdmins();
                break;

            case "institutes":
            case "institute-management":
                await loadInstitutes();
                break;

            case "candidates":
            case "candidate-management":
                await loadCandidates();
                break;

            case "results":
            case "results-analytics":
                await loadResults();
                break;

            case "security":
            case "security-analytics":
                await loadSecurity();
                break;

            default:
                break;
        }

    } catch (error) {

        console.error(
            "View loading error:",
            error
        );

    }

}


/* =========================================================
   OVERVIEW
   ========================================================= */

async function loadOverview() {

    setStatus(
        "Loading dashboard...",
        "busy"
    );


    try {

        /*
         * Lightweight collection counts.
         *
         * This is intentionally modular so later we can
         * replace it with aggregate queries or dedicated
         * analytics documents.
         */

        const stats =
            state.stats;


        await updateCollectionCount(
            "institutes",
            value =>
                stats.institutes = value
        );


        await updateCollectionCount(
            "admins",
            value =>
                stats.admins = value
        );


        await updateCollectionCount(
            "exams",
            value =>
                stats.exams = value
        );


        await updateCollectionCount(
            "candidates",
            value =>
                stats.candidates = value
        );


        await updateCollectionCount(
            "results",
            value =>
                stats.submissions = value
        );


        updateStatsUI();


        setStatus(
            "Dashboard synchronized",
            "ok"
        );


    } catch (error) {

        console.error(
            "Overview error:",
            error
        );


        setStatus(
            "Dashboard synchronization failed",
            "error"
        );

    }

}


async function updateCollectionCount(
    collectionName,
    setter
) {

    try {

        const collectionRef =
            collection(
                db,
                collectionName
            );


        /*
         * Limit protects the dashboard from accidentally
         * downloading an enormous collection.
         */

        const snapshot =
            await getDocs(
                query(
                    collectionRef,
                    limit(1000)
                )
            );


        setter(
            snapshot.size
        );


    } catch (error) {

        console.warn(
            `Unable to count ${collectionName}:`,
            error
        );

        setter(0);

    }

}


/* =========================================================
   STATS UI
   ========================================================= */

function updateStatsUI() {

    const mapping = {

        "totalInstitutes":
            state.stats.institutes,

        "totalAdmins":
            state.stats.admins,

        "activeAdmins":
            state.stats.activeAdmins,

        "suspendedAdmins":
            state.stats.suspendedAdmins,

        "totalExams":
            state.stats.exams,

        "liveExams":
            state.stats.liveExams,

        "scheduledExams":
            state.stats.scheduledExams,

        "completedExams":
            state.stats.completedExams,

        "totalCandidates":
            state.stats.candidates,

        "activeCandidates":
            state.stats.activeCandidates,

        "totalSubmissions":
            state.stats.submissions,

        "averageScore":
            state.stats.averageScore,

        "securityFlags":
            state.stats.securityFlags,

        "averageRating":
            state.stats.averageRating
    };


    Object.entries(
        mapping
    ).forEach(
        ([id, value]) => {

            const element =
                $(id);

            if (element) {

                element.textContent =
                    value;
            }

        }
    );


    /*
     * Also support common dashboard naming.
     */

    const aliases = {

        "stat-institutes":
            state.stats.institutes,

        "stat-admins":
            state.stats.admins,

        "stat-exams":
            state.stats.exams,

        "stat-candidates":
            state.stats.candidates,

        "stat-submissions":
            state.stats.submissions,

        "stat-security":
            state.stats.securityFlags
    };


    Object.entries(
        aliases
    ).forEach(
        ([id, value]) => {

            const element =
                $(id);

            if (element) {
                element.textContent =
                    value;
            }

        }
    );

}


/* =========================================================
   EXAM CONFIGURATION
   ========================================================= */

async function loadExamConfig() {

    const configRef =
        doc(
            db,
            "exam_config",
            "current_test"
        );


    try {

        const snapshot =
            await getDoc(
                configRef
            );


        if (
            !snapshot.exists()
        ) {

            state.examConfig =
                null;

            updateExamStatusUI(
                null
            );

            return null;
        }


        state.examConfig =
            snapshot.data();


        populateExamConfigUI(
            state.examConfig
        );


        updateExamStatusUI(
            state.examConfig
        );


        return state.examConfig;


    } catch (error) {

        console.error(
            "Exam config load error:",
            error
        );


        showToast(
            "Configuration error",
            error.code ||
                error.message,
            "danger"
        );


        return null;
    }

}


function populateExamConfigUI(
    data
) {

    const fieldMap = {

        "config-total-pool":
            data.totalPool,

        "config-student-limit":
            data.studentLimit ??
            data.questionLimit,

        "config-duration":
            data.durationMinutes,

        "config-test-duration":
            data.durationMinutes,

        "config-window-start":
            dateTimeLocalValue(
                data.windowStart
            ),

        "config-window-end":
            dateTimeLocalValue(
                data.windowEnd
            )
    };


    Object.entries(
        fieldMap
    ).forEach(
        ([id, value]) => {

            const element =
                $(id);

            if (
                element &&
                value !== undefined &&
                value !== null
            ) {

                element.value =
                    value;
            }

        }
    );


    /*
     * Upload mode.
     */

    if (
        data.uploadMode
    ) {

        const uploadMode =
            document.querySelector(
                `[data-upload-mode="${data.uploadMode}"]`
            );

        uploadMode?.click();
    }

}


function dateTimeLocalValue(
    value
) {

    if (!value) {
        return "";
    }


    let date;


    if (
        typeof value?.toDate ===
            "function"
    ) {

        date =
            value.toDate();

    } else {

        date =
            new Date(
                value
            );
    }


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }


    const pad =
        n =>
            String(n)
                .padStart(
                    2,
                    "0"
                );


    return (
        `${date.getFullYear()}-` +
        `${pad(date.getMonth() + 1)}-` +
        `${pad(date.getDate())}T` +
        `${pad(date.getHours())}:` +
        `${pad(date.getMinutes())}`
    );

}


function updateExamStatusUI(
    config
) {

    const box =
        $("exam-status-box");


    if (!box) {
        return;
    }


    if (!config) {

        box.innerHTML = `
            <div class="notice">
                No active exam configuration found.
            </div>
        `;

        return;
    }


    const start =
        config.windowStart
            ? new Date(
                config.windowStart
            )
            : null;


    const end =
        config.windowEnd
            ? new Date(
                config.windowEnd
            )
            : null;


    const now =
        Date.now();


    let status =
        "NOT SCHEDULED";


    if (
        start &&
        end &&
        now >= start.getTime() &&
        now <= end.getTime()
    ) {

        status =
            "LIVE";

    } else if (
        start &&
        now < start.getTime()
    ) {

        status =
            "SCHEDULED";

    } else if (
        end &&
        now > end.getTime()
    ) {

        status =
            "ENDED";
    }


    box.innerHTML = `
        <div>
            <strong>Exam Status:</strong>
            ${escapeHtml(status)}
        </div>

        <div style="margin-top:6px">
            <strong>Questions:</strong>
            ${escapeHtml(
                config.studentLimit ??
                config.questionLimit ??
                "—"
            )}
        </div>

        <div style="margin-top:6px">
            <strong>Duration:</strong>
            ${escapeHtml(
                config.durationMinutes ??
                "—"
            )} minutes
        </div>
    `;

}


/* =========================================================
   SAVE EXAM SETTINGS
   ========================================================= */

async function saveExamSettings() {

    if (
        !requireAuthorization()
    ) {
        return false;
    }


    const totalPool =
        numberValue(
            $("config-total-pool")?.value
        );


    const studentLimit =
        numberValue(
            $("config-student-limit")?.value ||
            $("config-question-limit")?.value
        );


    const durationMinutes =
        numberValue(
            $("config-duration")?.value ||
            $("config-test-duration")?.value
        );


    const windowStart =
        $("config-window-start")?.value;


    const windowEnd =
        $("config-window-end")?.value;


    if (
        totalPool < 1 ||
        studentLimit < 1 ||
        durationMinutes < 1
    ) {

        showToast(
            "Invalid configuration",
            "Please enter valid question and duration values.",
            "warning"
        );

        return false;
    }


    if (
        studentLimit >
        totalPool
    ) {

        showToast(
            "Invalid configuration",
            "Student question limit cannot exceed total question pool.",
            "warning"
        );

        return false;
    }


    const start =
        new Date(
            windowStart
        );


    const end =
        new Date(
            windowEnd
        );


    if (
        Number.isNaN(
            start.getTime()
        ) ||
        Number.isNaN(
            end.getTime()
        ) ||
        end <= start
    ) {

        showToast(
            "Invalid exam window",
            "Exam end time must be later than start time.",
            "warning"
        );

        return false;
    }


    const uploadMode =
        getUploadMode();


    try {

        const configRef =
            doc(
                db,
                "exam_config",
                "current_test"
            );


        await setDoc(
            configRef,
            {

                totalPool,

                studentLimit,

                questionLimit:
                    studentLimit,

                durationMinutes,

                windowStart:
                    start.getTime(),

                windowEnd:
                    end.getTime(),

                uploadMode,

                updatedAt:
                    serverTimestamp(),

                updatedBy:
                    getAuthState()
                        .user?.uid ||
                    null

            },
            {
                merge: true
            }
        );


        await loadExamConfig();


        await writeActivityLog(
            "exam_config_updated",
            "exam_config",
            "current_test",
            {
                totalPool,
                studentLimit,
                durationMinutes
            }
        );


        showToast(
            "Saved",
            "Exam configuration saved successfully.",
            "success"
        );


        return true;


    } catch (error) {

        console.error(
            "Exam settings save error:",
            error
        );


        showToast(
            "Save failed",
            error.code ||
                error.message,
            "danger"
        );


        return false;
    }

}


function getUploadMode() {

    const selected =
        document.querySelector(
            "[data-upload-mode].active"
        );


    if (
        selected
    ) {

        return (
            selected.dataset.uploadMode ||
            "form"
        );
    }


    const checked =
        document.querySelector(
            'input[name="uploadMode"]:checked'
        );


    return (
        checked?.value ||
        "form"
    );

}


/* =========================================================
   ADMINS
   ========================================================= */

async function loadAdmins() {

    const body =
        $("adminsTableBody");


    if (!body) {
        return;
    }


    body.innerHTML = `
        <tr>
            <td colspan="7">
                Loading administrators...
            </td>
        </tr>
    `;


    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        "admins"
                    ),
                    limit(500)
                )
            );


        const rows =
            snapshot.docs.map(
                item => ({
                    id:
                        item.id,
                    ...item.data()
                })
            );


        const active =
            rows.filter(
                admin =>
                    normalize(
                        admin.status
                    ) ===
                    "active"
            ).length;


        const suspended =
            rows.filter(
                admin =>
                    [
                        "suspended",
                        "blocked",
                        "revoked"
                    ].includes(
                        normalize(
                            admin.status
                        )
                    )
            ).length;


        state.stats.admins =
            rows.length;

        state.stats.activeAdmins =
            active;

        state.stats.suspendedAdmins =
            suspended;


        updateStatsUI();


        if (
            !rows.length
        ) {

            body.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            No administrator records found.
                        </div>
                    </td>
                </tr>
            `;

            return;
        }


        body.innerHTML =
            rows.map(
                admin => {

                    const status =
                        admin.status ||
                        "active";


                    return `
                        <tr>

                            <td>
                                ${escapeHtml(
                                    admin.name ||
                                    admin.displayName ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    admin.email ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    admin.role ||
                                    "admin"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    admin.instituteName ||
                                    admin.instituteId ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    admin.scope ||
                                    "Assigned"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    status
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    formatDate(
                                        admin.lastActive ||
                                        admin.lastLoginAt
                                    )
                                )}
                            </td>

                        </tr>
                    `;

                }
            ).join("");


    } catch (error) {

        console.error(
            "Admin load error:",
            error
        );


        body.innerHTML = `
            <tr>
                <td colspan="7">
                    Unable to load administrator data.
                </td>
            </tr>
        `;

    }

}


/* =========================================================
   INSTITUTES
   ========================================================= */

async function loadInstitutes() {

    const body =
        $("institutesTableBody");


    if (!body) {
        return;
    }


    body.innerHTML = `
        <tr>
            <td colspan="8">
                Loading institutes...
            </td>
        </tr>
    `;


    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        "institutes"
                    ),
                    limit(500)
                )
            );


        if (
            !snapshot.size
        ) {

            body.innerHTML = `
                <tr>
                    <td colspan="8">
                        No institutes found.
                    </td>
                </tr>
            `;

            return;
        }


        body.innerHTML =
            snapshot.docs
                .map(
                    item => {

                        const institute =
                            item.data();


                        return `
                            <tr>

                                <td>
                                    ${escapeHtml(
                                        institute.instituteId ||
                                        item.id
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        institute.name ||
                                        institute.instituteName ||
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        institute.status ||
                                        "active"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        institute.address ||
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        institute.contact ||
                                        institute.phone ||
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        institute.assignedAdmins ??
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        institute.exams ??
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        formatDate(
                                            institute.updatedAt
                                        )
                                    )}
                                </td>

                            </tr>
                        `;

                    }
                )
                .join("");


    } catch (error) {

        console.error(
            "Institute load error:",
            error
        );


        body.innerHTML = `
            <tr>
                <td colspan="8">
                    Unable to load institutes.
                </td>
            </tr>
        `;

    }

}


/* =========================================================
   CANDIDATES
   ========================================================= */

async function loadCandidates() {

    const body =
        $("candidatesTableBody");


    if (!body) {
        return;
    }


    body.innerHTML = `
        <tr>
            <td colspan="8">
                Loading candidates...
            </td>
        </tr>
    `;


    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        "candidates"
                    ),
                    limit(500)
                )
            );


        if (
            !snapshot.size
        ) {

            body.innerHTML = `
                <tr>
                    <td colspan="8">
                        No candidate records found.
                    </td>
                </tr>
            `;

            return;
        }


        body.innerHTML =
            snapshot.docs
                .map(
                    item => {

                        const candidate =
                            item.data();


                        return `
                            <tr>

                                <td>
                                    ${escapeHtml(
                                        candidate.candidateId ||
                                        item.id
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        candidate.name ||
                                        candidate.candidateName ||
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        candidate.email ||
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        candidate.instituteId ||
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        candidate.examId ||
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        candidate.batch ||
                                        candidate.batchCategory ||
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        candidate.status ||
                                        "active"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        formatDate(
                                            candidate.lastActive
                                        )
                                    )}
                                </td>

                            </tr>
                        `;

                    }
                )
                .join("");


    } catch (error) {

        console.error(
            "Candidate load error:",
            error
        );


        body.innerHTML = `
            <tr>
                <td colspan="8">
                    Unable to load candidates.
                </td>
            </tr>
        `;

    }

}


/* =========================================================
   RESULTS
   ========================================================= */

async function loadResults() {

    const body =
        $("resultsTableBody") ||
        $("leaderboardBody");


    if (!body) {
        return;
    }


    body.innerHTML = `
        <tr>
            <td colspan="8">
                Loading results...
            </td>
        </tr>
    `;


    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        "results"
                    ),
                    limit(500)
                )
            );


        state.stats.submissions =
            snapshot.size;


        updateStatsUI();


        if (
            !snapshot.size
        ) {

            body.innerHTML = `
                <tr>
                    <td colspan="8">
                        No results found.
                    </td>
                </tr>
            `;

            return;
        }


        body.innerHTML =
            snapshot.docs
                .map(
                    item => {

                        const result =
                            item.data();


                        return `
                            <tr>

                                <td>
                                    ${escapeHtml(
                                        result.name ||
                                        result.candidateName ||
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        result.email ||
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        result.examName ||
                                        result.examId ||
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        result.score ??
                                        "0"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        result.correct ??
                                        result.correctCount ??
                                        0
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        result.wrong ??
                                        result.wrongCount ??
                                        0
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        result.status ||
                                        result.submissionStatus ||
                                        "submitted"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        formatDate(
                                            result.submittedAt ||
                                            result.timestamp
                                        )
                                    )}
                                </td>

                            </tr>
                        `;

                    }
                )
                .join("");


    } catch (error) {

        console.error(
            "Result load error:",
            error
        );


        body.innerHTML = `
            <tr>
                <td colspan="8">
                    Unable to load results.
                </td>
            </tr>
        `;

    }

}


/* =========================================================
   SECURITY
   ========================================================= */

async function loadSecurity() {

    const body =
        $("securityTableBody") ||
        $("security-body");


    if (!body) {
        return;
    }


    body.innerHTML = `
        <tr>
            <td colspan="8">
                Loading security events...
            </td>
        </tr>
    `;


    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        "securityEvents"
                    ),
                    limit(500)
                )
            );


        const events =
            snapshot.docs.map(
                item => ({
                    id:
                        item.id,
                    ...item.data()
                })
            );


        state.stats.securityFlags =
            events.length;


        updateStatsUI();


        if (
            !events.length
        ) {

            body.innerHTML = `
                <tr>
                    <td colspan="8">
                        No security events found.
                    </td>
                </tr>
            `;

            return;
        }


        body.innerHTML =
            events.map(
                event => {

                    return `
                        <tr>

                            <td>
                                ${escapeHtml(
                                    event.candidateName ||
                                    event.candidateId ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    event.eventType ||
                                    event.type ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    event.examId ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    event.tabSwitches ??
                                    0
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    event.copyAttempts ??
                                    0
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    event.penalty ??
                                    event.penaltyMarks ??
                                    0
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    event.status ||
                                    "REVIEW"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    formatDate(
                                        event.timestamp
                                    )
                                )}
                            </td>

                        </tr>
                    `;

                }
            ).join("");


    } catch (error) {

        console.error(
            "Security load error:",
            error
        );


        body.innerHTML = `
            <tr>
                <td colspan="8">
                    Unable to load security events.
                </td>
            </tr>
        `;

    }

}


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

async function loadNotifications() {

    const body =
        $("notificationsTableBody") ||
        $("notificationList");


    if (!body) {
        return;
    }


    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        "notifications"
                    ),
                    limit(100)
                )
            );


        if (
            !snapshot.size
        ) {

            body.innerHTML = `
                <div class="empty-state">
                    No notifications.
                </div>
            `;

            return;
        }


        body.innerHTML =
            snapshot.docs
                .map(
                    item => {

                        const notification =
                            item.data();


                        return `
                            <div class="notification-item">

                                <strong>
                                    ${escapeHtml(
                                        notification.title ||
                                        "Notification"
                                    )}
                                </strong>

                                <div>
                                    ${escapeHtml(
                                        notification.message ||
                                        ""
                                    )}
                                </div>

                                <small>
                                    ${escapeHtml(
                                        formatDate(
                                            notification.createdAt
                                        )
                                    )}
                                </small>

                            </div>
                        `;

                    }
                )
                .join("");


    } catch (error) {

        console.error(
            "Notification load error:",
            error
        );

    }

}


/* =========================================================
   MODAL
   ========================================================= */

function openModal(
    title,
    bodyHtml,
    options = {}
) {

    const modal =
        $("genericModal");


    const modalTitle =
        $("modalTitle");


    const modalBody =
        $("modalBody");


    if (
        !modal ||
        !modalTitle ||
        !modalBody
    ) {

        showToast(
            title,
            "Modal container is missing from the page.",
            "warning"
        );

        return;
    }


    state.currentModal =
        options;


    modalTitle.textContent =
        title;


    modalBody.innerHTML =
        bodyHtml;


    modal.classList.add(
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


function closeModal() {

    const modal =
        $("genericModal");


    const body =
        $("modalBody");


    modal?.classList.remove(
        "active"
    );


    modal?.setAttribute(
        "aria-hidden",
        "true"
    );


    if (body) {
        body.innerHTML =
            "";
    }


    state.currentModal =
        null;

}


/* =========================================================
   MODAL SAVE ROUTER
   ========================================================= */

async function saveModal() {

    if (
        !requireAuthorization()
    ) {
        return;
    }


    const modal =
        state.currentModal;


    if (!modal) {

        showToast(
            "Nothing to save",
            "No active modal operation.",
            "warning"
        );

        return;
    }


    /*
     * Future module-specific handlers can be
     * plugged in here without modifying the UI.
     */

    try {

        switch (
            normalize(
                modal.type
            )
        ) {

            case "institute":
                await saveInstituteFromModal();
                break;

            case "admin":
                await saveAdminFromModal();
                break;

            case "exam":
                await saveExamFromModal();
                break;

            case "question":
                await saveQuestionFromModal();
                break;

            default:

                showToast(
                    "Module pending",
                    "This operation will be connected to its dedicated module.",
                    "info"
                );

                break;
        }


    } catch (error) {

        console.error(
            "Modal save error:",
            error
        );


        showToast(
            "Save failed",
            error.code ||
                error.message,
            "danger"
        );

    }

}


/* =========================================================
   MODAL PLACEHOLDERS
   ========================================================= */

async function saveInstituteFromModal() {

    /*
     * Institute Management module will own
     * final validation and scoped writes.
     */

    showToast(
        "Institute module",
        "Institute save logic is ready to be connected to the dedicated module.",
        "info"
    );

}


async function saveAdminFromModal() {

    showToast(
        "Admin module",
        "Admin creation/editing will be handled by the permission module.",
        "info"
    );

}


async function saveExamFromModal() {

    showToast(
        "Exam module",
        "Exam creation/editing will be handled by the Exam Management module.",
        "info"
    );

}


async function saveQuestionFromModal() {

    showToast(
        "Question Bank",
        "Question creation/editing will be handled by the Question Bank module.",
        "info"
    );

}


/* =========================================================
   EMERGENCY ACTIONS
   ========================================================= */

async function handleEmergencyAction(
    action
) {

    if (
        !requireAuthorization()
    ) {
        return false;
    }


    /*
     * High-risk operations must NEVER silently execute.
     * UI already confirms the action.
     *
     * Final server-side / Firestore authorization must
     * also be enforced by Security Rules / trusted backend.
     */

    try {

        switch (
            action
        ) {

            case "toggleMaintenanceBtn":

                await setGlobalSetting(
                    "maintenanceMode",
                    true
                );

                break;


            case "pauseExamBtn":

                await setExamControl(
                    "paused"
                );

                break;


            case "resumeExamBtn":

                await setExamControl(
                    "live"
                );

                break;


            case "forceSubmitBtn":

                /*
                 * Do not perform a broad client-side
                 * force submission without a secure backend.
                 */

                showToast(
                    "Secure action required",
                    "Force submission must be processed by the trusted backend.",
                    "warning"
                );

                return false;


            default:

                showToast(
                    "Unknown action",
                    "The requested emergency action is not recognized.",
                    "warning"
                );

                return false;
        }


        return true;


    } catch (error) {

        console.error(
            "Emergency action error:",
            error
        );


        showToast(
            "Emergency action failed",
            error.code ||
                error.message,
            "danger"
        );


        return false;
    }

}


/* =========================================================
   GLOBAL SETTINGS
   ========================================================= */

async function setGlobalSetting(
    key,
    value
) {

    await setDoc(
        doc(
            db,
            "global_settings",
            "system"
        ),
        {
            [key]:
                value,

            updatedAt:
                serverTimestamp(),

            updatedBy:
                getAuthState()
                    .user?.uid ||
                null
        },
        {
            merge: true
        }
    );


    await writeActivityLog(
        `global_setting_${key}`,
        "global_settings",
        "system",
        {
            value
        }
    );


    showToast(
        "Updated",
        `${key} has been updated.`,
        "success"
    );

}


async function setExamControl(
    status
) {

    await setDoc(
        doc(
            db,
            "exam_control",
            "current"
        ),
        {

            status,

            updatedAt:
                serverTimestamp(),

            updatedBy:
                getAuthState()
                    .user?.uid ||
                null

        },
        {
            merge: true
        }
    );


    await writeActivityLog(
        `exam_${status}`,
        "exam_control",
        "current",
        {
            status
        }
    );


    showToast(
        "Exam control updated",
        `Exam status changed to ${status}.`,
        "success"
    );

}


/* =========================================================
   ACTIVITY LOG
   ========================================================= */

async function writeActivityLog(
    action,
    entity,
    entityId,
    details = {}
) {

    /*
     * This is intentionally isolated.
     *
     * Firestore Rules should restrict who can create
     * or modify activity logs.
     */

    try {

        const authState =
            getAuthState();


        if (
            !authState.authorized ||
            !authState.user
        ) {
            return;
        }


        const logId =
            `${Date.now()}_${authState.user.uid}`;


        await setDoc(
            doc(
                db,
                "activityLogs",
                logId
            ),
            {

                adminId:
                    authState.user.uid,

                adminEmail:
                    authState.user.email ||
                    "",

                adminRole:
                    authState.role ||
                    authState.profile?.role ||
                    "super_admin",

                instituteId:
                    details.instituteId ||
                    null,

                action,

                entity,

                entityId,

                details,

                timestamp:
                    serverTimestamp()

            }
        );

    } catch (error) {

        /*
         * Logging failure must not break normal UI,
         * but should be visible in console.
         */

        console.warn(
            "Activity log failed:",
            error
        );

    }

}


/* =========================================================
   REFRESH
   ========================================================= */

async function refresh() {

    if (
        !requireAuthorization()
    ) {
        return false;
    }


    if (
        state.loading
    ) {
        return false;
    }


    state.loading =
        true;


    try {

        setStatus(
            "Synchronizing dashboard...",
            "busy"
        );


        await loadOverview();


        /*
         * Refresh currently visible section.
         */

        await loadViewData(
            state.currentView
        );


        const sync =
            $("last-sync");


        if (sync) {

            sync.textContent =
                "Last sync: " +
                new Date()
                    .toLocaleTimeString(
                        "en-IN"
                    );
        }


        return true;


    } catch (error) {

        console.error(
            "Dashboard refresh failed:",
            error
        );


        setStatus(
            "Refresh failed",
            "error"
        );


        return false;


    } finally {

        state.loading =
            false;
    }

}


/* =========================================================
   CLEANUP
   ========================================================= */

function cleanupListeners() {

    state.listeners
        .forEach(
            unsubscribe => {

                try {

                    if (
                        typeof unsubscribe ===
                            "function"
                    ) {
                        unsubscribe();
                    }

                } catch (error) {

                    console.warn(
                        "Listener cleanup error:",
                        error
                    );
                }

            }
        );


    state.listeners =
        [];

}


/* =========================================================
   PROFILE
   ========================================================= */

function updateProfile() {

    const authState =
        getAuthState();


    if (
        !authState.profile
    ) {
        return;
    }


    const profile =
        authState.profile;


    const name =
        profile.name ||
        profile.displayName ||
        "Super Administrator";


    const email =
        profile.email ||
        authState.user?.email ||
        "";


    const nameElement =
        $("sidebarAdminName");


    const emailElement =
        $("sidebarAdminEmail");


    const avatar =
        $("sidebarAvatar");


    if (nameElement) {

        nameElement.textContent =
            name;
    }


    if (emailElement) {

        emailElement.textContent =
            email;
    }


    if (avatar) {

        avatar.textContent =
            name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(
                    part =>
                        part[0]
                )
                .join("")
                .toUpperCase() ||
            "SA";
    }

}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(
    value
) {

    if (!value) {
        return "—";
    }


    let date;


    if (
        typeof value?.toDate ===
            "function"
    ) {

        date =
            value.toDate();

    } else {

        date =
            new Date(
                value
            );
    }


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }


    return date.toLocaleString(
        "en-IN",
        {
            dateStyle:
                "medium",
            timeStyle:
                "short"
        }
    );

}


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

function bindNavigation() {

    document
        .querySelectorAll(
            "[data-view-target]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();


                        showView(
                            button.dataset.viewTarget,
                            button.dataset.title ||
                                button.textContent.trim()
                        );

                    }
                );

            }
        );


    /*
     * Alternative:
     * buttons can simply use data-view.
     */

    document
        .querySelectorAll(
            "[data-dashboard-view]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();


                        showView(
                            button.dataset.dashboardView,
                            button.dataset.title ||
                                button.textContent.trim()
                        );

                    }
                );

            }
        );

}


function bindCoreButtons() {

    $("refreshBtn")
        ?.addEventListener(
            "click",
            () => refresh()
        );


    $("notificationBtn")
        ?.addEventListener(
            "click",
            () =>
                showView(
                    "notifications",
                    "Notifications"
                )
        );


    $("modalCloseBtn")
        ?.addEventListener(
            "click",
            closeModal
        );


    $("modalCancelBtn")
        ?.addEventListener(
            "click",
            closeModal
        );


    $("modalSaveBtn")
        ?.addEventListener(
            "click",
            saveModal
        );


    $("genericModal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("genericModal")
                ) {

                    closeModal();
                }

            }
        );


    $("save-config-btn")
        ?.addEventListener(
            "click",
            saveExamSettings
        );

}


/* =========================================================
   AUTH EVENT BRIDGE
   ========================================================= */

function bindAuthEvents() {

    /*
     * IMPORTANT:
     *
     * No Firebase onAuthStateChanged() here.
     *
     * auth.js is the single owner of authentication.
     */


    /*
     * Listen for custom event if auth.js / future versions
     * emit it.
     */

    window.addEventListener(
        "superadmin:authorized",
        async event => {

            console.log(
                "Super Admin authorized",
                event.detail || {}
            );


            updateProfile();


            await refresh();

        }
    );


    window.addEventListener(
        "superadmin:logout",
        () => {

            cleanupListeners();

        }
    );

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initialize() {

    if (
        state.initialized
    ) {
        return;
    }


    state.initialized =
        true;


    bindNavigation();

    bindCoreButtons();

    bindAuthEvents();


    /*
     * Do not force login here.
     *
     * auth.js decides whether the Firebase session
     * is authorized.
     */

    const authState =
        getAuthState();


    if (
        authState.authorized
    ) {

        updateProfile();

        await refresh();

    }

}


/* =========================================================
   PUBLIC API
   ========================================================= */

const api = {

    initialize,

    refresh,

    showView,

    openModal,

    closeModal,

    saveModal,

    saveExamSettings,

    handleEmergencyAction,

    loadExamConfig,

    loadOverview,

    loadAdmins,

    loadInstitutes,

    loadCandidates,

    loadResults,

    loadSecurity,

    loadNotifications,

    updateProfile,

    cleanupListeners,

    getState() {

        return {
            ...state
        };

    },

    getAuthState

};


/* =========================================================
   GLOBAL EXPOSURE
   ========================================================= */

window.SuperAdminApp =
    api;


/* =========================================================
   INITIALIZE AFTER DOM
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initialize,
        {
            once: true
        }
    );

} else {

    initialize();

}
