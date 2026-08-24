/* =========================================================
   SUPER ADMIN MODULE
   Multi-Institute Examination Platform
   Firebase Authentication + Firestore
   ========================================================= */

import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    onSnapshot,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const CONFIG = {
    collections: {
        users: "users",
        institutes: "institutes",
        admins: "admins",
        exams: "exams",
        batches: "batches",
        questions: "questions",
        questionBanks: "questionBanks",
        candidates: "candidates",
        attempts: "attempts",
        results: "results",
        feedback: "feedback",
        securityEvents: "securityEvents",
        auditLogs: "auditLogs",
        portalConfigs: "portalConfigs",
        globalSettings: "globalSettings",
        notifications: "notifications",
        presence: "presence"
    },

    presenceTimeoutMs: 120000
};


/* =========================================================
   APPLICATION STATE
   ========================================================= */

const state = {
    currentUser: null,
    superAdminProfile: null,

    institutes: [],
    admins: [],
    exams: [],
    batches: [],
    questions: [],
    candidates: [],
    results: [],
    feedback: [],
    securityEvents: [],
    auditLogs: [],
    notifications: [],
    presence: [],

    selectedInstituteId: null,
    selectedExamId: null,
    selectedBatchId: null,

    currentModalAction: null,

    unsubscribe: [],

    loading: false
};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    try {
        const date =
            value?.toDate
                ? value.toDate()
                : new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleString();
    } catch {
        return "—";
    }
}

function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
}


/* =========================================================
   UI HELPERS
   ========================================================= */

function toast(title, message, type = "info") {
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

    console.log(`[${type}] ${title}: ${message}`);
}

function showApplication() {
    if (
        window.SuperAdminUI &&
        typeof window.SuperAdminUI.showApplication === "function"
    ) {
        window.SuperAdminUI.showApplication();
    }
}

function showLogin() {
    if (
        window.SuperAdminUI &&
        typeof window.SuperAdminUI.showLogin === "function"
    ) {
        window.SuperAdminUI.showLogin();
    }
}

function setProfile(profile = {}) {
    if (
        window.SuperAdminUI &&
        typeof window.SuperAdminUI.setAdminProfile === "function"
    ) {
        window.SuperAdminUI.setAdminProfile({
            name:
                profile.name ||
                profile.displayName ||
                "Super Administrator",

            email:
                profile.email ||
                state.currentUser?.email ||
                "Authorized account"
        });
    }
}


/* =========================================================
   FIRESTORE HELPERS
   ========================================================= */

function collectionRef(name) {
    return collection(
        db,
        CONFIG.collections[name] || name
    );
}

function documentRef(name, id) {
    return doc(
        db,
        CONFIG.collections[name] || name,
        id
    );
}

async function getCollection(name) {
    const snapshot =
        await getDocs(collectionRef(name));

    return snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));
}

async function createDocument(name, data) {
    const ref = await addDoc(
        collectionRef(name),
        {
            ...data,
            createdAt:
                data.createdAt || serverTimestamp(),
            updatedAt:
                serverTimestamp()
        }
    );

    return ref.id;
}

async function updateDocument(name, id, data) {
    await updateDoc(
        documentRef(name, id),
        {
            ...data,
            updatedAt: serverTimestamp()
        }
    );
}

async function removeDocument(name, id) {
    await deleteDoc(
        documentRef(name, id)
    );
}


/* =========================================================
   AUDIT LOGGING
   ========================================================= */

async function createAuditLog({
    action,
    entityType,
    entityId = null,
    instituteId = null,
    oldValue = null,
    newValue = null,
    reason = null
}) {
    if (!state.currentUser) {
        return;
    }

    try {
        await createDocument(
            "auditLogs",
            {
                actorId: state.currentUser.uid,

                actorRole:
                    state.superAdminProfile?.role ||
                    "super_admin",

                action,

                entityType,

                entityId,

                instituteId,

                oldValue,

                newValue,

                reason,

                timestamp:
                    serverTimestamp()
            }
        );
    } catch (error) {
        console.error(
            "Audit log failed:",
            error
        );
    }
}


/* =========================================================
   SUPER ADMIN AUTHORIZATION
   ========================================================= */

async function loadUserProfile(uid) {
    const userRef =
        documentRef("users", uid);

    const snapshot =
        await getDoc(userRef);

    if (snapshot.exists()) {
        return {
            id: snapshot.id,
            ...snapshot.data()
        };
    }

    return null;
}

async function verifySuperAdmin(user) {
    if (!user) {
        return false;
    }

    const profile =
        await loadUserProfile(user.uid);

    if (!profile) {
        return false;
    }

    const role =
        normalize(profile.role);

    const status =
        normalize(profile.status || "active");

    const allowed =
        role === "super_admin" ||
        role === "superadmin" ||
        role === "super-admin";

    const active =
        status === "active" ||
        status === "approved" ||
        status === "";

    if (!allowed || !active) {
        return false;
    }

    state.superAdminProfile =
        profile;

    return true;
}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

async function login({
    email,
    password
}) {
    if (!email || !password) {
        toast(
            "Login required",
            "Enter your email and password.",
            "warning"
        );
        return;
    }

    try {
        setLoading(true);

        const credential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        const authorized =
            await verifySuperAdmin(
                credential.user
            );

        if (!authorized) {
            await signOut(auth);

            toast(
                "Access denied",
                "This account is not authorized as a Super Admin.",
                "error"
            );

            return;
        }

        state.currentUser =
            credential.user;

        setProfile(
            state.superAdminProfile
        );

        showApplication();

        await refresh();

        toast(
            "Welcome",
            "Super Admin authentication successful.",
            "success"
        );

        await createAuditLog({
            action: "LOGIN",
            entityType: "AUTH",
            entityId: credential.user.uid
        });

    } catch (error) {
        console.error(
            "Super Admin login error:",
            error
        );

        toast(
            "Login failed",
            getAuthErrorMessage(error),
            "error"
        );

    } finally {
        setLoading(false);
    }
}

async function logout() {
    try {
        if (state.currentUser) {
            await createAuditLog({
                action: "LOGOUT",
                entityType: "AUTH",
                entityId:
                    state.currentUser.uid
            });
        }

        cleanupListeners();

        await signOut(auth);

        state.currentUser = null;
        state.superAdminProfile = null;

        showLogin();

    } catch (error) {
        console.error(
            "Logout error:",
            error
        );

        toast(
            "Logout failed",
            error.message,
            "error"
        );
    }
}

async function resetPassword(email) {
    if (!email) {
        toast(
            "Email required",
            "Enter your registered email address.",
            "warning"
        );
        return;
    }

    try {
        await sendPasswordResetEmail(
            auth,
            email
        );

        toast(
            "Password reset",
            "Password reset email has been sent.",
            "success"
        );

    } catch (error) {
        toast(
            "Reset failed",
            getAuthErrorMessage(error),
            "error"
        );
    }
}

function getAuthErrorMessage(error) {
    const code =
        error?.code || "";

    const messages = {
        "auth/invalid-credential":
            "Invalid email or password.",

        "auth/invalid-login-credentials":
            "Invalid email or password.",

        "auth/user-not-found":
            "No account was found for this email.",

        "auth/wrong-password":
            "Invalid email or password.",

        "auth/too-many-requests":
            "Too many attempts. Please try again later.",

        "auth/network-request-failed":
            "Network error. Check your internet connection."
    };

    return (
        messages[code] ||
        error?.message ||
        "Authentication failed."
    );
}


/* =========================================================
   INSTITUTES
   ========================================================= */

async function loadInstitutes() {
    try {
        state.institutes =
            await getCollection("institutes");

        renderInstitutes();
        updateDashboardStats();

        return state.institutes;

    } catch (error) {
        console.error(
            "Institute loading error:",
            error
        );

        toast(
            "Institutes",
            "Unable to load institute data.",
            "error"
        );

        return [];
    }
}

function renderInstitutes() {
    const body =
        $("institutesTableBody");

    if (!body) {
        return;
    }

    const search =
        normalize(
            $("instituteSearch")?.value
        );

    const status =
        normalize(
            $("instituteStatusFilter")?.value
        );

    const filtered =
        state.institutes.filter(item => {

            const matchesSearch =
                !search ||
                normalize(item.name)
                    .includes(search) ||
                normalize(item.code)
                    .includes(search) ||
                normalize(item.email)
                    .includes(search);

            const matchesStatus =
                !status ||
                status === "all" ||
                normalize(item.status) === status;

            return (
                matchesSearch &&
                matchesStatus
            );
        });

    if (!filtered.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fa-solid fa-building-columns"></i>
                        <h4>No institutes found</h4>
                        <p>Create an institute to get started.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        filtered.map(item => `
            <tr>
                <td>
                    <strong>
                        ${escapeHtml(item.name)}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(item.code || "—")}
                </td>

                <td>
                    ${escapeHtml(item.email || "—")}
                </td>

                <td>
                    ${escapeHtml(
                        item.phone ||
                        item.contact ||
                        "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.status ||
                        "active"
                    )}
                </td>

                <td>
                    ${formatDate(
                        item.createdAt
                    )}
                </td>

                <td>
                    <button
                        class="btn btn-sm"
                        data-action="edit-institute"
                        data-id="${item.id}"
                    >
                        Edit
                    </button>

                    <button
                        class="btn btn-sm btn-danger"
                        data-action="delete-institute"
                        data-id="${item.id}"
                    >
                        Delete
                    </button>
                </td>
            </tr>
        `).join("");
}

async function createInstitute(data) {
    const name =
        String(data.name || "").trim();

    const code =
        String(data.code || "").trim();

    if (!name || !code) {
        toast(
            "Validation",
            "Institute name and code are required.",
            "warning"
        );
        return;
    }

    const duplicate =
        state.institutes.some(
            item =>
                normalize(item.code) ===
                normalize(code)
        );

    if (duplicate) {
        toast(
            "Duplicate code",
            "This institute code already exists.",
            "warning"
        );
        return;
    }

    try {
        const id =
            await createDocument(
                "institutes",
                {
                    name,
                    code,
                    email:
                        data.email || "",
                    phone:
                        data.phone || "",
                    address:
                        data.address || "",
                    status:
                        data.status ||
                        "active",
                    createdBy:
                        state.currentUser.uid
                }
            );

        await createAuditLog({
            action: "CREATE_INSTITUTE",
            entityType: "INSTITUTE",
            entityId: id,
            newValue: {
                name,
                code
            }
        });

        await loadInstitutes();

        toast(
            "Institute created",
            `${name} has been created successfully.`,
            "success"
        );

    } catch (error) {
        console.error(error);

        toast(
            "Create failed",
            error.message,
            "error"
        );
    }
}

async function deleteInstitute(id) {
    const institute =
        state.institutes.find(
            item => item.id === id
        );

    if (!institute) {
        return;
    }

    if (
        !confirm(
            `Delete institute "${institute.name}"?`
        )
    ) {
        return;
    }

    try {
        await removeDocument(
            "institutes",
            id
        );

        await createAuditLog({
            action: "DELETE_INSTITUTE",
            entityType: "INSTITUTE",
            entityId: id,
            oldValue: institute
        });

        await loadInstitutes();

        toast(
            "Institute deleted",
            "Institute record deleted.",
            "success"
        );

    } catch (error) {
        toast(
            "Delete failed",
            error.message,
            "error"
        );
    }
}


/* =========================================================
   ADMINS
   ========================================================= */

async function loadAdmins() {
    try {
        state.admins =
            await getCollection("admins");

        renderAdmins();
        updateDashboardStats();

        return state.admins;

    } catch (error) {
        console.error(error);

        toast(
            "Admins",
            "Unable to load administrator data.",
            "error"
        );

        return [];
    }
}

function renderAdmins() {
    const body =
        $("adminsTableBody");

    if (!body) {
        return;
    }

    const search =
        normalize(
            $("adminSearch")?.value
        );

    const role =
        normalize(
            $("adminRoleFilter")?.value
        );

    const status =
        normalize(
            $("adminStatusFilter")?.value
        );

    const filtered =
        state.admins.filter(item => {

            const matchesSearch =
                !search ||
                normalize(item.name)
                    .includes(search) ||
                normalize(item.email)
                    .includes(search);

            const matchesRole =
                !role ||
                role === "all" ||
                normalize(item.role) === role;

            const matchesStatus =
                !status ||
                status === "all" ||
                normalize(item.status) === status;

            return (
                matchesSearch &&
                matchesRole &&
                matchesStatus
            );
        });

    if (!filtered.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fa-solid fa-user-shield"></i>
                        <h4>No administrator data</h4>
                        <p>No matching administrators were found.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        filtered.map(item => `
            <tr>
                <td>
                    <strong>
                        ${escapeHtml(
                            item.name || "Unnamed"
                        )}
                    </strong>
                    <small>
                        ${escapeHtml(
                            item.email || ""
                        )}
                    </small>
                </td>

                <td>
                    ${escapeHtml(
                        item.role || "admin"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.instituteId ||
                        "Multiple / Global"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.scope ||
                        "Assigned"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.status ||
                        "ACTIVE"
                    )}
                </td>

                <td>
                    ${formatDate(
                        item.lastActive
                    )}
                </td>

                <td>
                    <button
                        class="btn btn-sm"
                        data-action="edit-admin"
                        data-id="${item.id}"
                    >
                        Edit
                    </button>

                    <button
                        class="btn btn-sm btn-warning"
                        data-action="suspend-admin"
                        data-id="${item.id}"
                    >
                        Suspend
                    </button>
                </td>
            </tr>
        `).join("");
}

async function createAdmin(data) {
    const name =
        String(data.name || "").trim();

    const email =
        String(data.email || "").trim();

    const role =
        data.role || "admin";

    if (!name || !email) {
        toast(
            "Validation",
            "Administrator name and email are required.",
            "warning"
        );
        return;
    }

    const duplicate =
        state.admins.some(
            item =>
                normalize(item.email) ===
                normalize(email)
        );

    if (duplicate) {
        toast(
            "Duplicate",
            "An administrator with this email already exists.",
            "warning"
        );
        return;
    }

    try {
        /*
         * IMPORTANT:
         * Creating an Authentication account with a password
         * must NOT be done by storing that password in Firestore.
         *
         * This record represents the authorization/profile.
         * Actual Firebase Auth user creation should be performed
         * by a trusted backend/Admin SDK or approved invitation flow.
         */

        const id =
            await createDocument(
                "admins",
                {
                    name,
                    email,
                    role,
                    status: "ACTIVE",

                    permissions:
                        data.permissions ||
                        {},

                    instituteIds:
                        data.instituteIds ||
                        [],

                    examIds:
                        data.examIds ||
                        [],

                    batchIds:
                        data.batchIds ||
                        [],

                    createdBy:
                        state.currentUser.uid
                }
            );

        await createAuditLog({
            action: "CREATE_ADMIN",
            entityType: "ADMIN",
            entityId: id,
            newValue: {
                name,
                email,
                role
            }
        });

        await loadAdmins();

        toast(
            "Administrator created",
            "Admin profile created. Complete Firebase Authentication invitation separately.",
            "success"
        );

    } catch (error) {
        console.error(error);

        toast(
            "Create failed",
            error.message,
            "error"
        );
    }
}

async function suspendAdmin(
    id,
    reason = "Administrative action",
    until = null
) {
    const admin =
        state.admins.find(
            item => item.id === id
        );

    if (!admin) {
        return;
    }

    try {
        await updateDocument(
            "admins",
            id,
            {
                status: "SUSPENDED",
                suspensionReason: reason,
                suspensionUntil: until
            }
        );

        await createAuditLog({
            action: "SUSPEND_ADMIN",
            entityType: "ADMIN",
            entityId: id,
            oldValue: {
                status: admin.status
            },
            newValue: {
                status: "SUSPENDED",
                suspensionUntil: until
            },
            reason
        });

        await loadAdmins();

        toast(
            "Admin suspended",
            `${admin.name || admin.email} has been suspended.`,
            "success"
        );

    } catch (error) {
        toast(
            "Suspension failed",
            error.message,
            "error"
        );
    }
}

async function revokeAdmin(id) {
    const admin =
        state.admins.find(
            item => item.id === id
        );

    if (!admin) {
        return;
    }

    if (
        !confirm(
            `Permanently revoke ${admin.email}?`
        )
    ) {
        return;
    }

    try {
        await updateDocument(
            "admins",
            id,
            {
                status: "REVOKED",
                revokedAt:
                    serverTimestamp(),
                revokedBy:
                    state.currentUser.uid
            }
        );

        await createAuditLog({
            action: "REVOKE_ADMIN",
            entityType: "ADMIN",
            entityId: id,
            oldValue: {
                status: admin.status
            },
            newValue: {
                status: "REVOKED"
            }
        });

        await loadAdmins();

        toast(
            "Admin revoked",
            "Administrator access has been revoked.",
            "success"
        );

    } catch (error) {
        toast(
            "Revoke failed",
            error.message,
            "error"
        );
    }
}


/* =========================================================
   EXAMS
   ========================================================= */

async function loadExams() {
    try {
        state.exams =
            await getCollection("exams");

        renderExams();
        updateDashboardStats();

        return state.exams;

    } catch (error) {
        console.error(error);

        toast(
            "Exams",
            "Unable to load examination data.",
            "error"
        );

        return [];
    }
}

function renderExams() {
    const body =
        $("examsTableBody");

    if (!body) {
        return;
    }

    if (!state.exams.length) {
        body.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <i class="fa-solid fa-file-circle-question"></i>
                        <h4>No examinations</h4>
                        <p>Create an examination to continue.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        state.exams.map(item => `
            <tr>
                <td>
                    <strong>
                        ${escapeHtml(
                            item.name || "Unnamed Exam"
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(
                        item.instituteId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.duration ||
                        item.durationMinutes ||
                        "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.status || "draft"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.questionCount ??
                        item.displayQuestionCount ??
                        "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.totalMarks ?? "—"
                    )}
                </td>

                <td>
                    ${formatDate(
                        item.createdAt
                    )}
                </td>

                <td>
                    <button
                        class="btn btn-sm"
                        data-action="edit-exam"
                        data-id="${item.id}"
                    >
                        Edit
                    </button>

                    <button
                        class="btn btn-sm btn-danger"
                        data-action="delete-exam"
                        data-id="${item.id}"
                    >
                        Delete
                    </button>
                </td>
            </tr>
        `).join("");
}

async function createExam(data) {
    const name =
        String(data.name || "").trim();

    const duration =
        Number(
            data.duration ||
            data.durationMinutes ||
            60
        );

    if (!name || duration <= 0) {
        toast(
            "Validation",
            "Exam name and valid duration are required.",
            "warning"
        );
        return;
    }

    try {
        const id =
            await createDocument(
                "exams",
                {
                    name,

                    durationMinutes:
                        duration,

                    duration,

                    instituteId:
                        data.instituteId ||
                        state.selectedInstituteId ||
                        null,

                    status:
                        data.status ||
                        "draft",

                    displayQuestionCount:
                        Number(
                            data.displayQuestionCount ||
                            0
                        ),

                    questionPoolIds:
                        data.questionPoolIds ||
                        [],

                    randomizeQuestions:
                        Boolean(
                            data.randomizeQuestions
                        ),

                    randomizeOptions:
                        Boolean(
                            data.randomizeOptions
                        ),

                    marksPerQuestion:
                        Number(
                            data.marksPerQuestion ||
                            1
                        ),

                    negativeMarks:
                        Number(
                            data.negativeMarks ||
                            0
                        ),

                    security:
                        data.security ||
                        {},

                    createdBy:
                        state.currentUser.uid
                }
            );

        await createAuditLog({
            action: "CREATE_EXAM",
            entityType: "EXAM",
            entityId: id,
            instituteId:
                data.instituteId ||
                state.selectedInstituteId,
            newValue: {
                name,
                duration
            }
        });

        await loadExams();

        toast(
            "Exam created",
            `${name} has been created as a draft.`,
            "success"
        );

    } catch (error) {
        toast(
            "Create failed",
            error.message,
            "error"
        );
    }
}


/* =========================================================
   BATCHES
   ========================================================= */

async function loadBatches() {
    try {
        state.batches =
            await getCollection("batches");

        renderBatches();

        return state.batches;

    } catch (error) {
        console.error(error);

        toast(
            "Batches",
            "Unable to load batch data.",
            "error"
        );

        return [];
    }
}

function renderBatches() {
    const body =
        $("batchesTableBody");

    if (!body) {
        return;
    }

    if (!state.batches.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fa-solid fa-users-rectangle"></i>
                        <h4>No batches found</h4>
                        <p>Create a batch for an examination.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        state.batches.map(item => `
            <tr>
                <td>
                    <strong>
                        ${escapeHtml(
                            item.name || "Unnamed"
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(
                        item.code || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.class ||
                        item.course ||
                        "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.instituteId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.examId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.status || "active"
                    )}
                </td>

                <td>
                    <button
                        class="btn btn-sm"
                        data-action="edit-batch"
                        data-id="${item.id}"
                    >
                        Edit
                    </button>
                </td>
            </tr>
        `).join("");
}

async function createBatch(data) {
    const name =
        String(data.name || "").trim();

    const code =
        String(data.code || "").trim();

    if (!name || !code) {
        toast(
            "Validation",
            "Batch name and code are required.",
            "warning"
        );
        return;
    }

    try {
        const id =
            await createDocument(
                "batches",
                {
                    name,
                    code,

                    class:
                        data.class ||
                        data.course ||
                        "",

                    instituteId:
                        data.instituteId ||
                        state.selectedInstituteId ||
                        null,

                    examId:
                        data.examId ||
                        state.selectedExamId ||
                        null,

                    status:
                        data.status ||
                        "active",

                    createdBy:
                        state.currentUser.uid
                }
            );

        await createAuditLog({
            action: "CREATE_BATCH",
            entityType: "BATCH",
            entityId: id,
            instituteId:
                data.instituteId ||
                state.selectedInstituteId,
            newValue: {
                name,
                code
            }
        });

        await loadBatches();

        toast(
            "Batch created",
            `${name} has been created.`,
            "success"
        );

    } catch (error) {
        toast(
            "Create failed",
            error.message,
            "error"
        );
    }
}


/* =========================================================
   QUESTIONS
   ========================================================= */

async function loadQuestions() {
    try {
        state.questions =
            await getCollection("questions");

        renderQuestions();

        return state.questions;

    } catch (error) {
        console.error(error);

        toast(
            "Questions",
            "Unable to load question bank.",
            "error"
        );

        return [];
    }
}

function renderQuestions() {
    const body =
        $("questionsTableBody");

    if (!body) {
        return;
    }

    if (!state.questions.length) {
        body.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <i class="fa-solid fa-circle-question"></i>
                        <h4>No questions found</h4>
                        <p>Add or import questions into the question bank.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        state.questions.map(item => `
            <tr>
                <td>
                    ${escapeHtml(
                        item.questionId ||
                        item.id
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.subject || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.chapter || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.topic || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.difficulty || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.marks ?? 1
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.status || "draft"
                    )}
                </td>

                <td>
                    <button
                        class="btn btn-sm"
                        data-action="edit-question"
                        data-id="${item.id}"
                    >
                        Edit
                    </button>

                    <button
                        class="btn btn-sm btn-danger"
                        data-action="delete-question"
                        data-id="${item.id}"
                    >
                        Delete
                    </button>
                </td>
            </tr>
        `).join("");
}

function validateQuestion(question) {
    const errors = [];

    if (
        !String(
            question.questionText ||
            question.question ||
            ""
        ).trim()
    ) {
        errors.push(
            "Question text is required."
        );
    }

    if (!question.subject) {
        errors.push(
            "Subject is required."
        );
    }

    if (
        !question.correctAnswer &&
        question.correctAnswer !== 0
    ) {
        errors.push(
            "Correct answer is required."
        );
    }

    return errors;
}

async function createQuestion(data) {
    const question = {
        instituteId:
            data.instituteId ||
            state.selectedInstituteId ||
            null,

        questionText:
            data.questionText ||
            data.question ||
            "",

        subject:
            data.subject ||
            "",

        chapter:
            data.chapter ||
            "",

        topic:
            data.topic ||
            "",

        difficulty:
            data.difficulty ||
            "medium",

        optionA:
            data.optionA ||
            "",

        optionB:
            data.optionB ||
            "",

        optionC:
            data.optionC ||
            "",

        optionD:
            data.optionD ||
            "",

        correctAnswer:
            data.correctAnswer,

        explanation:
            data.explanation ||
            "",

        marks:
            Number(
                data.marks ?? 1
            ),

        negativeMarks:
            Number(
                data.negativeMarks ?? 0
            ),

        tags:
            Array.isArray(data.tags)
                ? data.tags
                : [],

        status:
            data.status ||
            "draft",

        createdBy:
            state.currentUser.uid
    };

    const errors =
        validateQuestion(question);

    if (errors.length) {
        toast(
            "Question validation",
            errors.join(" "),
            "warning"
        );
        return;
    }

    try {
        const id =
            await createDocument(
                "questions",
                question
            );

        await createAuditLog({
            action: "CREATE_QUESTION",
            entityType: "QUESTION",
            entityId: id,
            instituteId:
                question.instituteId
        });

        await loadQuestions();

        toast(
            "Question added",
            "Question was added to the question bank.",
            "success"
        );

    } catch (error) {
        toast(
            "Question save failed",
            error.message,
            "error"
        );
    }
}

async function deleteQuestion(id) {
    const question =
        state.questions.find(
            item => item.id === id
        );

    if (!question) {
        return;
    }

    if (
        !confirm(
            "Delete this question?"
        )
    ) {
        return;
    }

    try {
        await removeDocument(
            "questions",
            id
        );

        await createAuditLog({
            action: "DELETE_QUESTION",
            entityType: "QUESTION",
            entityId: id,
            instituteId:
                question.instituteId,
            oldValue: question
        });

        await loadQuestions();

        toast(
            "Question deleted",
            "Question removed successfully.",
            "success"
        );

    } catch (error) {
        toast(
            "Delete failed",
            error.message,
            "error"
        );
    }
}


/* =========================================================
   RESULTS
   ========================================================= */

async function loadResults() {
    try {
        state.results =
            await getCollection("results");

        renderResults();
        updateDashboardStats();

        return state.results;

    } catch (error) {
        console.error(error);

        toast(
            "Results",
            "Unable to load results.",
            "error"
        );

        return [];
    }
}

function renderResults() {
    const body =
        $("resultsTableBody");

    if (!body) {
        return;
    }

    if (!state.results.length) {
        body.innerHTML = `
            <tr>
                <td colspan="10">
                    <div class="empty-state">
                        <i class="fa-solid fa-chart-column"></i>
                        <h4>No results available</h4>
                        <p>Candidate results will appear here.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        state.results.map(item => `
            <tr>
                <td>
                    ${escapeHtml(
                        item.rank ?? "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.candidateName ||
                        item.name ||
                        "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.email || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.examName ||
                        item.examId ||
                        "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.batchId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.score ?? "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.totalMarks ?? "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.securityStatus ||
                        "CLEAN"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.submissionStatus ||
                        "SUBMITTED"
                    )}
                </td>

                <td>
                    ${formatDate(
                        item.submittedAt
                    )}
                </td>
            </tr>
        `).join("");
}


/* =========================================================
   CANDIDATES
   ========================================================= */

async function loadCandidates() {
    try {
        state.candidates =
            await getCollection("candidates");

        renderCandidates();

        return state.candidates;

    } catch (error) {
        console.error(error);

        toast(
            "Candidates",
            "Unable to load candidate data.",
            "error"
        );

        return [];
    }
}

function renderCandidates() {
    const body =
        $("candidatesTableBody");

    if (!body) {
        return;
    }

    if (!state.candidates.length) {
        body.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <i class="fa-solid fa-user-graduate"></i>
                        <h4>No candidates found</h4>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        state.candidates.map(item => `
            <tr>
                <td>
                    ${escapeHtml(
                        item.name || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.email || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.instituteId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.examId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.batchId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.status || "active"
                    )}
                </td>

                <td>
                    ${formatDate(
                        item.lastActive
                    )}
                </td>

                <td>
                    <button
                        class="btn btn-sm"
                        data-action="view-candidate"
                        data-id="${item.id}"
                    >
                        View
                    </button>
                </td>
            </tr>
        `).join("");
}


/* =========================================================
   SECURITY EVENTS
   ========================================================= */

async function loadSecurityEvents() {
    try {
        state.securityEvents =
            await getCollection(
                "securityEvents"
            );

        renderSecurityEvents();

        return state.securityEvents;

    } catch (error) {
        console.error(error);

        toast(
            "Security",
            "Unable to load security events.",
            "error"
        );

        return [];
    }
}

function renderSecurityEvents() {
    const body =
        $("securityTableBody");

    if (!body) {
        return;
    }

    if (!state.securityEvents.length) {
        body.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <i class="fa-solid fa-shield-halved"></i>
                        <h4>No security events</h4>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        state.securityEvents.map(item => `
            <tr>
                <td>
                    ${escapeHtml(
                        item.candidateName ||
                        item.candidateId ||
                        "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.eventType ||
                        item.type ||
                        "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.examId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.instituteId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.count ?? 1
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.penalty ?? 0
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.status ||
                        "REVIEW"
                    )}
                </td>

                <td>
                    ${formatDate(
                        item.timestamp ||
                        item.createdAt
                    )}
                </td>
            </tr>
        `).join("");
}


/* =========================================================
   AUDIT LOGS
   ========================================================= */

async function loadAuditLogs() {
    try {
        state.auditLogs =
            await getCollection(
                "auditLogs"
            );

        renderAuditLogs();

        return state.auditLogs;

    } catch (error) {
        console.error(error);

        toast(
            "Audit logs",
            "Unable to load audit logs.",
            "error"
        );

        return [];
    }
}

function renderAuditLogs() {
    const body =
        $("auditLogsTableBody");

    if (!body) {
        return;
    }

    if (!state.auditLogs.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <h4>No audit records</h4>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const logs =
        [...state.auditLogs]
            .sort(
                (a, b) =>
                    timestampValue(b.timestamp) -
                    timestampValue(a.timestamp)
            )
            .slice(0, 200);

    body.innerHTML =
        logs.map(item => `
            <tr>
                <td>
                    ${formatDate(
                        item.timestamp ||
                        item.createdAt
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.actorId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.actorRole || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.action || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.entityType || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.entityId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.instituteId || "Global"
                    )}
                </td>
            </tr>
        `).join("");
}

function timestampValue(value) {
    if (!value) {
        return 0;
    }

    try {
        const date =
            value?.toDate
                ? value.toDate()
                : new Date(value);

        return date.getTime();
    } catch {
        return 0;
    }
}


/* =========================================================
   PRESENCE
   ========================================================= */

async function loadPresence() {
    try {
        state.presence =
            await getCollection(
                "presence"
            );

        renderPresence();

        updateDashboardStats();

        return state.presence;

    } catch (error) {
        console.error(error);

        return [];
    }
}

function isCurrentlyActive(item) {
    const lastActive =
        timestampValue(
            item.lastActive ||
            item.updatedAt
        );

    return (
        lastActive > 0 &&
        Date.now() - lastActive <
            CONFIG.presenceTimeoutMs
    );
}

function renderPresence() {
    const body =
        $("presenceTableBody");

    if (!body) {
        return;
    }

    const active =
        state.presence.filter(
            isCurrentlyActive
        );

    if (!active.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fa-solid fa-user-clock"></i>
                        <h4>No active sessions</h4>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        active.map(item => `
            <tr>
                <td>
                    ${escapeHtml(
                        item.name ||
                        item.email ||
                        "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.role || "candidate"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.instituteId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.examId || "—"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.batchId || "—"
                    )}
                </td>

                <td>
                    ${formatDate(
                        item.lastActive
                    )}
                </td>

                <td>
                    <span class="badge badge-success">
                        ACTIVE
                    </span>
                </td>
            </tr>
        `).join("");
}


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

async function loadNotifications() {
    try {
        state.notifications =
            await getCollection(
                "notifications"
            );

        renderNotifications();

        return state.notifications;

    } catch (error) {
        console.error(error);
        return [];
    }
}

function renderNotifications() {
    const body =
        $("notificationsTableBody");

    if (!body) {
        return;
    }

    if (!state.notifications.length) {
        body.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <i class="fa-solid fa-bell"></i>
                        <h4>No notifications</h4>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        state.notifications.map(item => `
            <tr>
                <td>
                    ${escapeHtml(
                        item.title || "Notification"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.message || ""
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.scope || "global"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.status || "active"
                    )}
                </td>

                <td>
                    ${formatDate(
                        item.createdAt
                    )}
                </td>
            </tr>
        `).join("");
}


/* =========================================================
   GLOBAL SETTINGS
   ========================================================= */

async function getGlobalSettings() {
    const ref =
        documentRef(
            "globalSettings",
            "default"
        );

    const snapshot =
        await getDoc(ref);

    if (!snapshot.exists()) {
        return {};
    }

    return snapshot.data();
}

async function saveGlobalSettings(settings) {
    try {
        const ref =
            documentRef(
                "globalSettings",
                "default"
            );

        const oldSnapshot =
            await getDoc(ref);

        const oldValue =
            oldSnapshot.exists()
                ? oldSnapshot.data()
                : null;

        await setDoc(
            ref,
            {
                ...settings,
                updatedBy:
                    state.currentUser.uid,
                updatedAt:
                    serverTimestamp()
            },
            {
                merge: true
            }
        );

        await createAuditLog({
            action:
                "UPDATE_GLOBAL_SETTINGS",
            entityType:
                "GLOBAL_SETTINGS",
            entityId:
                "default",
            oldValue,
            newValue:
                settings
        });

        toast(
            "Settings saved",
            "Global settings updated successfully.",
            "success"
        );

    } catch (error) {
        toast(
            "Settings failed",
            error.message,
            "error"
        );
    }
}


/* =========================================================
   PORTAL CONFIGURATION
   ========================================================= */

async function savePortalConfig(
    instituteId,
    config
) {
    if (!instituteId) {
        toast(
            "Institute required",
            "Select an institute first.",
            "warning"
        );
        return;
    }

    try {
        const ref =
            documentRef(
                "portalConfigs",
                instituteId
            );

        const oldSnapshot =
            await getDoc(ref);

        const oldValue =
            oldSnapshot.exists()
                ? oldSnapshot.data()
                : null;

        await setDoc(
            ref,
            {
                instituteId,

                ...config,

                updatedBy:
                    state.currentUser.uid,

                updatedAt:
                    serverTimestamp()
            },
            {
                merge: true
            }
        );

        await createAuditLog({
            action:
                "UPDATE_PORTAL_CONFIG",
            entityType:
                "PORTAL_CONFIG",
            entityId:
                instituteId,
            instituteId,
            oldValue,
            newValue:
                config
        });

        toast(
            "Portal configuration",
            "Configuration saved.",
            "success"
        );

    } catch (error) {
        toast(
            "Save failed",
            error.message,
            "error"
        );
    }
}


/* =========================================================
   EMERGENCY CONTROLS
   ========================================================= */

async function handleEmergencyAction(
    buttonId
) {
    try {
        let action = "";
        let data = {};

        switch (buttonId) {

            case "toggleMaintenanceBtn":
                action =
                    "TOGGLE_MAINTENANCE";
                data = {
                    enabled: true
                };
                break;

            case "pauseExamBtn":
                action =
                    "PAUSE_EXAM";

                if (
                    !state.selectedExamId
                ) {
                    toast(
                        "Exam required",
                        "Select an exam first.",
                        "warning"
                    );
                    return;
                }

                data = {
                    examId:
                        state.selectedExamId
                };
                break;

            case "resumeExamBtn":
                action =
                    "RESUME_EXAM";

                if (
                    !state.selectedExamId
                ) {
                    toast(
                        "Exam required",
                        "Select an exam first.",
                        "warning"
                    );
                    return;
                }

                data = {
                    examId:
                        state.selectedExamId
                };
                break;

            case "forceSubmitBtn":
                action =
                    "FORCE_SUBMIT_EXAM";

                if (
                    !state.selectedExamId
                ) {
                    toast(
                        "Exam required",
                        "Select an exam first.",
                        "warning"
                    );
                    return;
                }

                data = {
                    examId:
                        state.selectedExamId
                };
                break;

            default:
                toast(
                    "Unknown action",
                    "Emergency action is not recognized.",
                    "warning"
                );
                return;
        }

        /*
         * Emergency state is stored in a dedicated
         * globalSettings document so candidate/admin
         * clients can react to it.
         *
         * Final authorization MUST also be enforced
         * by Firestore security rules / trusted backend.
         */

        await setDoc(
            documentRef(
                "globalSettings",
                "emergency"
            ),
            {
                action,
                ...data,
                changedBy:
                    state.currentUser.uid,
                changedAt:
                    serverTimestamp()
            },
            {
                merge: true
            }
        );

        await createAuditLog({
            action,
            entityType:
                "EMERGENCY_CONTROL",
            entityId:
                data.examId || "global",
            instituteId:
                state.selectedInstituteId,
            newValue:
                data
        });

        toast(
            "Emergency control",
            `${action} has been recorded.`,
            "success"
        );

    } catch (error) {
        console.error(error);

        toast(
            "Emergency action failed",
            error.message,
            "error"
        );
    }
}


/* =========================================================
   MODAL SAVE
   ========================================================= */

async function saveModal() {
    const action =
        state.currentModalAction;

    if (!action) {
        toast(
            "No action",
            "No modal operation is selected.",
            "warning"
        );
        return;
    }

    try {

        switch (action) {

            case "createInstituteBtn":

                await createInstitute({
                    name:
                        $("modalInstituteName")
                            ?.value,

                    code:
                        $("modalInstituteCode")
                            ?.value,

                    status:
                        $("modalInstituteStatus")
                            ?.value
                });

                break;


            case "createAdminBtn":

                await createAdmin({
                    name:
                        $("modalAdminName")
                            ?.value,

                    email:
                        $("modalAdminEmail")
                            ?.value,

                    role:
                        $("modalAdminRole")
                            ?.value
                });

                break;


            case "createExamBtn":

                await createExam({
                    name:
                        $("modalExamName")
                            ?.value,

                    duration:
                        $("modalExamDuration")
                            ?.value,

                    status:
                        $("modalExamStatus")
                            ?.value
                });

                break;


            case "createBatchBtn":

                await createBatch({
                    name:
                        $("modalBatchName")
                            ?.value,

                    code:
                        $("modalBatchCode")
                            ?.value,

                    class:
                        $("modalBatchClass")
                            ?.value
                });

                break;


            case "createQuestionBtn":

                await createQuestion({
                    question:
                        $("modalQuestion")
                            ?.value,

                    subject:
                        $("modalQuestionSubject")
                            ?.value,

                    difficulty:
                        $("modalQuestionDifficulty")
                            ?.value,

                    marks:
                        $("modalQuestionMarks")
                            ?.value,

                    negativeMarks:
                        $("modalQuestionNegative")
                            ?.value
                });

                break;


            default:

                toast(
                    "Unsupported action",
                    "This modal action has not been connected yet.",
                    "warning"
                );
        }

    } catch (error) {
        console.error(
            "Modal save error:",
            error
        );

        toast(
            "Save failed",
            error.message,
            "error"
        );
    }
}


/* =========================================================
   DASHBOARD STATS
   ========================================================= */

function updateDashboardStats() {
    const counters = {

        totalInstitutes:
            state.institutes.length,

        totalAdmins:
            state.admins.length,

        totalExams:
            state.exams.length,

        totalBatches:
            state.batches.length,

        totalQuestions:
            state.questions.length,

        totalCandidates:
            state.candidates.length,

        totalResults:
            state.results.length,

        activeUsers:
            state.presence.filter(
                isCurrentlyActive
            ).length
    };

    Object.entries(counters)
        .forEach(
            ([key, value]) => {

                const element =
                    document.querySelector(
                        `[data-stat="${key}"]`
                    );

                if (element) {
                    element.textContent =
                        value;
                }

                const idElement =
                    $(key);

                if (idElement) {
                    idElement.textContent =
                        value;
                }
            }
        );
}


/* =========================================================
   REAL-TIME LISTENERS
   ========================================================= */

function cleanupListeners() {
    state.unsubscribe.forEach(
        unsubscribe => {
            try {
                unsubscribe();
            } catch {
                // ignore cleanup errors
            }
        }
    );

    state.unsubscribe = [];
}

function startRealtimeListeners() {
    cleanupListeners();

    const targets = [
        {
            name: "institutes",
            callback: snapshot => {
                state.institutes =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );

                renderInstitutes();
                updateDashboardStats();
            }
        },

        {
            name: "admins",
            callback: snapshot => {
                state.admins =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );

                renderAdmins();
                updateDashboardStats();
            }
        },

        {
            name: "exams",
            callback: snapshot => {
                state.exams =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );

                renderExams();
                updateDashboardStats();
            }
        },

        {
            name: "batches",
            callback: snapshot => {
                state.batches =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );

                renderBatches();
            }
        }
    ];

    targets.forEach(
        ({ name, callback }) => {

            try {

                const unsubscribe =
                    onSnapshot(
                        collectionRef(name),
                        callback,
                        error => {
                            console.error(
                                `${name} realtime error:`,
                                error
                            );
                        }
                    );

                state.unsubscribe.push(
                    unsubscribe
                );

            } catch (error) {
                console.error(
                    `Listener error for ${name}:`,
                    error
                );
            }
        }
    );
}


/* =========================================================
   REFRESH
   ========================================================= */

async function refresh() {
    if (!state.currentUser) {
        return;
    }

    try {
        setLoading(true);

        await Promise.all([
            loadInstitutes(),
            loadAdmins(),
            loadExams(),
            loadBatches(),
            loadQuestions(),
            loadCandidates(),
            loadResults(),
            loadSecurityEvents(),
            loadAuditLogs(),
            loadPresence(),
            loadNotifications()
        ]);

        startRealtimeListeners();

    } catch (error) {
        console.error(
            "Super Admin refresh failed:",
            error
        );

        toast(
            "Refresh failed",
            error.message,
            "error"
        );

    } finally {
        setLoading(false);
    }
}


/* =========================================================
   LOADING STATE
   ========================================================= */

function setLoading(value) {
    state.loading = value;

    document.body.classList.toggle(
        "superadmin-loading",
        value
    );

    const buttons =
        document.querySelectorAll(
            "[data-loading-disable]"
        );

    buttons.forEach(
        button => {
            button.disabled = value;
        }
    );
}


/* =========================================================
   TABLE ACTIONS
   ========================================================= */

document.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                "[data-action]"
            );

        if (!button) {
            return;
        }

        const action =
            button.dataset.action;

        const id =
            button.dataset.id;

        try {

            switch (action) {

                case "delete-institute":
                    await deleteInstitute(id);
                    break;

                case "suspend-admin":
                    await suspendAdmin(
                        id,
                        "Suspended from Super Admin panel"
                    );
                    break;

                case "revoke-admin":
                    await revokeAdmin(id);
                    break;

                case "delete-question":
                    await deleteQuestion(id);
                    break;

                case "view-candidate":
                    state.selectedCandidateId =
                        id;

                    toast(
                        "Candidate",
                        "Candidate details selected.",
                        "info"
                    );
                    break;

                default:
                    break;
            }

        } catch (error) {
            console.error(
                "Table action error:",
                error
            );
        }
    }
);


/* =========================================================
   SEARCH / FILTER EVENTS
   ========================================================= */

[
    "instituteSearch",
    "instituteStatusFilter"
].forEach(id => {
    $(id)?.addEventListener(
        "input",
        renderInstitutes
    );

    $(id)?.addEventListener(
        "change",
        renderInstitutes
    );
});

[
    "adminSearch",
    "adminRoleFilter",
    "adminStatusFilter"
].forEach(id => {
    $(id)?.addEventListener(
        "input",
        renderAdmins
    );

    $(id)?.addEventListener(
        "change",
        renderAdmins
    );
});


/* =========================================================
   LOGIN / LOGOUT
   ========================================================= */

window.SuperAdminAuth = {
    login,
    logout,
    resetPassword
};


/* =========================================================
   APPLICATION API
   ========================================================= */

window.SuperAdminApp = {

    refresh,

    saveModal,

    handleEmergencyAction,

    loadInstitutes,

    loadAdmins,

    loadExams,

    loadBatches,

    loadQuestions,

    loadCandidates,

    loadResults,

    loadSecurityEvents,

    loadAuditLogs,

    loadPresence,

    loadNotifications,

    createInstitute,

    createAdmin,

    createExam,

    createBatch,

    createQuestion,

    deleteInstitute,

    deleteQuestion,

    suspendAdmin,

    revokeAdmin,

    saveGlobalSettings,

    savePortalConfig,

    getGlobalSettings,

    createAuditLog,

    state
};


/* =========================================================
   CONNECT MODAL ACTIONS FROM index.html
   ========================================================= */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest("button");

        if (!button) {
            return;
        }

        const modalActions = [
            "createInstituteBtn",
            "createAdminBtn",
            "createExamBtn",
            "createBatchBtn",
            "createQuestionBtn"
        ];

        if (
            modalActions.includes(
                button.id
            )
        ) {
            state.currentModalAction =
                button.id;
        }
    }
);


/* =========================================================
   AUTH STATE INITIALIZATION
   ========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {
            state.currentUser = null;
            state.superAdminProfile = null;

            cleanupListeners();

            showLogin();

            return;
        }

        try {

            const authorized =
                await verifySuperAdmin(user);

            if (!authorized) {

                await signOut(auth);

                toast(
                    "Access denied",
                    "Your account does not have Super Admin authorization.",
                    "error"
                );

                showLogin();

                return;
            }

            state.currentUser =
                user;

            setProfile(
                state.superAdminProfile
            );

            showApplication();

            await refresh();

        } catch (error) {

            console.error(
                "Auth initialization error:",
                error
            );

            await signOut(auth);

            showLogin();

            toast(
                "Authorization error",
                "Unable to verify Super Admin access.",
                "error"
            );
        }
    }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

console.info(
    "SuperAdmin module initialized."
);
