/* =========================================================
   PHYSICS TEST SERIES
   SUPER ADMIN APPLICATION
   ---------------------------------------------------------
   File: /js/superadmin.js

   Architecture:
   - Firebase Authentication
   - Firestore
   - Multi Institute
   - Multi Exam
   - Multi Batch
   - Admin Management
   - Permission Management
   - Portal Configuration
   - Draft / Publish
   - Audit Logs
   - Security Events
   - Live Presence
   - Emergency Controls
   - Global Settings
   - Real-time Dashboard

   Firebase project:
   superadmin-2c2f1

   IMPORTANT:
   This file does NOT store passwords in Firestore.
   Authentication must remain Firebase Authentication based.
   ========================================================= */

import {
    db
} from "./firebase-config.js";

import {
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const COLLECTIONS = {

    users: "users",

    admins: "admins",

    institutes: "institutes",

    exams: "exams",

    batches: "batches",

    candidates: "candidates",

    questions: "questions",

    questionBanks: "questionBanks",

    attempts: "attempts",

    results: "results",

    feedback: "feedback",

    securityEvents: "securityEvents",

    auditLogs: "auditLogs",

    portalConfigs: "portalConfigs",

    globalSettings: "globalSettings",

    notifications: "notifications",

    presence: "presence"

};


/* =========================================================
   EXAM STATUS
   ========================================================= */

const EXAM_STATUS = {

    DRAFT: "DRAFT",

    SCHEDULED: "SCHEDULED",

    LIVE: "LIVE",

    PAUSED: "PAUSED",

    COMPLETED: "COMPLETED",

    ARCHIVED: "ARCHIVED"

};


/* =========================================================
   ADMIN STATUS
   ========================================================= */

const ADMIN_STATUS = {

    ACTIVE: "ACTIVE",

    SUSPENDED: "SUSPENDED",

    EXPIRED: "EXPIRED",

    REVOKED: "REVOKED"

};


/* =========================================================
   PERMISSIONS
   ========================================================= */

const PERMISSIONS = [

    "dashboard.view",

    "institute.view",
    "institute.manage",

    "admin.view",
    "admin.manage",

    "exam.view",
    "exam.create",
    "exam.edit",
    "exam.delete",
    "exam.publish",
    "exam.control",

    "batch.view",
    "batch.manage",

    "question.view",
    "question.create",
    "question.edit",
    "question.delete",

    "candidate.view",
    "candidate.manage",

    "result.view",
    "result.export",

    "security.view",

    "feedback.view",

    "portal.view",
    "portal.edit",

    "branding.manage",

    "instruction.manage",

    "notification.manage",

    "emergency.manage",

    "settings.manage",

    "audit.view"

];


/* =========================================================
   APP STATE
   ========================================================= */

const state = {

    initialized: false,

    authorized: false,

    user: null,

    profile: null,

    activeInstituteId: null,

    activeExamId: null,

    activeBatchId: null,

    institutes: [],

    admins: [],

    exams: [],

    batches: [],

    candidates: [],

    questions: [],

    results: [],

    feedback: [],

    securityEvents: [],

    auditLogs: [],

    notifications: [],

    presence: [],

    dashboardStats: {

        totalInstitutes: 0,

        totalAdmins: 0,

        activeAdmins: 0,

        suspendedAdmins: 0,

        totalExams: 0,

        liveExams: 0,

        scheduledExams: 0,

        completedExams: 0,

        totalCandidates: 0,

        activeCandidates: 0,

        totalSubmissions: 0,

        averageScore: 0,

        securityFlags: 0,

        averageRating: 0

    },

    listeners: [],

    loading: false

};


/* =========================================================
   GENERIC HELPERS
   ========================================================= */

function getElement(id) {

    return document.getElementById(id);

}


function normalize(value) {

    return String(
        value ?? ""
    )
        .trim();

}


function normalizeLower(value) {

    return normalize(value)
        .toLowerCase();

}


function nowMillis() {

    return Date.now();

}


function isObject(value) {

    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );

}


function cleanObject(object) {

    if (!isObject(object)) {

        return object;

    }

    const output = {};

    Object.entries(object)
        .forEach(
            ([key, value]) => {

                if (
                    value !== undefined
                ) {

                    output[key] =
                        value;

                }

            }
        );

    return output;

}


/* =========================================================
   AUTHORIZATION
   ========================================================= */

function requireSuperAdmin() {

    const auth =
        window.SuperAdminAuth;

    if (!auth) {

        throw new Error(
            "SuperAdminAuth is not initialized."
        );

    }


    const authState =
        auth.getState();


    if (
        !authState ||
        !authState.authorized ||
        !authState.user ||
        !authState.profile
    ) {

        throw new Error(
            "Super Admin authorization required."
        );

    }


    const role =
        normalizeLower(
            authState.profile.role
        );


    if (
        ![
            "super_admin",
            "superadmin",
            "super-admin"
        ].includes(role)
    ) {

        throw new Error(
            "Super Admin permission required."
        );

    }


    return authState;

}


/* =========================================================
   TOAST
   ========================================================= */

function toast(
    title,
    message,
    type = "info"
) {

    if (
        window.SuperAdminUI &&
        typeof window.SuperAdminUI.showToast ===
        "function"
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


/* =========================================================
   AUDIT LOG
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

    const auth =
        requireSuperAdmin();


    const payload = {

        actorId:
            auth.user.uid,

        actorRole:
            "SUPER_ADMIN",

        actorEmail:
            auth.user.email || "",

        action,

        entityType,

        entityId,

        instituteId,

        oldValue,

        newValue,

        reason,

        timestamp:
            serverTimestamp()

    };


    try {

        await addDoc(
            collection(
                db,
                COLLECTIONS.auditLogs
            ),
            cleanObject(payload)
        );

    } catch (error) {

        /*
         * Audit failures are intentionally logged.
         *
         * For production, critical actions should preferably
         * use a trusted backend/Cloud Function so an audit
         * record cannot be bypassed.
         */

        console.error(
            "Audit log failed:",
            error
        );

    }

}


/* =========================================================
   GENERIC COLLECTION HELPERS
   ========================================================= */

async function getCollection(
    collectionName,
    constraints = []
) {

    requireSuperAdmin();


    const reference =
        collection(
            db,
            collectionName
        );


    const q =
        constraints.length
            ? query(
                reference,
                ...constraints
            )
            : reference;


    const snapshot =
        await getDocs(q);


    return snapshot.docs.map(
        item => ({

            id:
                item.id,

            ...item.data()

        })
    );

}


async function getDocument(
    collectionName,
    id
) {

    requireSuperAdmin();


    const reference =
        doc(
            db,
            collectionName,
            id
        );


    const snapshot =
        await getDoc(
            reference
        );


    if (
        !snapshot.exists()
    ) {

        return null;

    }


    return {

        id:
            snapshot.id,

        ...snapshot.data()

    };

}


/* =========================================================
   INSTITUTE MANAGEMENT
   ========================================================= */

async function loadInstitutes() {

    const data =
        await getCollection(
            COLLECTIONS.institutes
        );


    state.institutes =
        data;


    if (
        !state.activeInstituteId &&
        data.length
    ) {

        state.activeInstituteId =
            data[0].id;

    }


    renderInstituteSelector();

    return data;

}


async function createInstitute(data) {

    requireSuperAdmin();


    const instituteName =
        normalize(
            data.instituteName ||
            data.name
        );


    const instituteCode =
        normalize(
            data.instituteCode ||
            data.instituteId
        )
            .toUpperCase()
            .replace(/\s+/g, "");


    if (!instituteName) {

        throw new Error(
            "Institute name is required."
        );

    }


    if (!instituteCode) {

        throw new Error(
            "Institute code is required."
        );

    }


    const duplicateCodeQuery =
        query(
            collection(
                db,
                COLLECTIONS.institutes
            ),
            where(
                "instituteCode",
                "==",
                instituteCode
            ),
            limit(1)
        );


    const duplicateCodeSnapshot =
        await getDocs(
            duplicateCodeQuery
        );


    if (!duplicateCodeSnapshot.empty) {

        throw new Error(
            "This Institute Code is already in use."
        );

    }


    const institute = {

        instituteId:
            instituteCode,

        instituteCode,

        instituteName,

        name:
            instituteName,

        address:
            normalize(
                data.address
            ),

        email:
            normalizeLower(
                data.email
            ),

        phone:
            normalize(
                data.phone
            ),

        logoUrl:
            data.logoUrl || "",

        status:
            String(
                data.status ||
                "ACTIVE"
            ).toUpperCase(),

        branding:
            data.branding ||
            {},

        createdBy:
            state.user?.uid ||
            null,

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    const reference =
        await addDoc(
            collection(
                db,
                COLLECTIONS.institutes
            ),
            institute
        );


    await createAuditLog({

        action:
            "INSTITUTE_CREATED",

        entityType:
            "institute",

        entityId:
            reference.id,

        instituteId:
            reference.id,

        newValue:
            institute

    });


    await loadInstitutes();


    toast(
        "Institute created",
        "Institute has been created successfully.",
        "success"
    );


    return reference.id;

}


async function updateInstitute(
    instituteId,
    changes
) {

    requireSuperAdmin();


    const existing =
        await getDocument(
            COLLECTIONS.institutes,
            instituteId
        );


    if (!existing) {

        throw new Error(
            "Institute not found."
        );

    }


    const updateData =
        cleanObject({

            ...changes,

            updatedAt:
                serverTimestamp()

        });


    await updateDoc(
        doc(
            db,
            COLLECTIONS.institutes,
            instituteId
        ),
        updateData
    );


    await createAuditLog({

        action:
            "INSTITUTE_UPDATED",

        entityType:
            "institute",

        entityId:
            instituteId,

        instituteId,

        oldValue:
            existing,

        newValue:
            changes

    });


    await loadInstitutes();


    return true;

}


async function setInstituteStatus(
    instituteId,
    status
) {

    return updateInstitute(
        instituteId,
        {
            status
        }
    );

}


async function archiveInstitute(
    instituteId
) {

    return updateInstitute(
        instituteId,
        {
            status:
                "ARCHIVED"
        }
    );

}


/* =========================================================
   ADMIN MANAGEMENT
   ========================================================= */

async function loadAdmins() {

    const data =
        await getCollection(
            COLLECTIONS.admins
        );


    state.admins =
        data;


    renderAdminList();


    return data;

}


/*
 * IMPORTANT:
 *
 * Admin Authentication account creation should be done
 * through a trusted backend / Cloud Function.
 *
 * This function creates/updates the Firestore profile only.
 * It intentionally does NOT store a password.
 */

async function saveAdminProfile(
    adminId,
    data
) {

    requireSuperAdmin();


    const profile = cleanObject({

        name:
            normalize(
                data.name
            ),

        email:
            normalizeLower(
                data.email
            ),

        role:
            data.role ||
            "ADMIN",

        status:
            data.status ||
            ADMIN_STATUS.ACTIVE,

        instituteIds:
            Array.isArray(
                data.instituteIds
            )
                ? data.instituteIds
                : [],

        examIds:
            Array.isArray(
                data.examIds
            )
                ? data.examIds
                : [],

        batchIds:
            Array.isArray(
                data.batchIds
            )
                ? data.batchIds
                : [],

        permissions:
            Array.isArray(
                data.permissions
            )
                ? data.permissions
                : [],

        permissionMode:
            data.permissionMode ||
            "MANUAL",

        suspensionUntil:
            data.suspensionUntil ||
            null,

        updatedAt:
            serverTimestamp()

    });


    const reference =
        doc(
            db,
            COLLECTIONS.admins,
            adminId
        );


    const existing =
        await getDoc(
            reference
        );


    await setDoc(
        reference,
        {

            ...profile,

            ...(existing.exists()
                ? {}
                : {
                    createdAt:
                        serverTimestamp()
                })

        },
        {
            merge:
                true
        }
    );


    await createAuditLog({

        action:
            existing.exists()
                ? "ADMIN_UPDATED"
                : "ADMIN_PROFILE_CREATED",

        entityType:
            "admin",

        entityId:
            adminId,

        newValue:
            profile

    });


    await loadAdmins();


    return adminId;

}


async function activateAdmin(
    adminId
) {

    return updateAdminStatus(
        adminId,
        ADMIN_STATUS.ACTIVE
    );

}


async function suspendAdmin(
    adminId,
    suspensionUntil = null,
    reason = ""
) {

    requireSuperAdmin();


    const changes = {

        status:
            ADMIN_STATUS.SUSPENDED,

        suspensionUntil,

        suspensionReason:
            reason || "",

        updatedAt:
            serverTimestamp()

    };


    await updateDoc(
        doc(
            db,
            COLLECTIONS.admins,
            adminId
        ),
        changes
    );


    await createAuditLog({

        action:
            "ADMIN_SUSPENDED",

        entityType:
            "admin",

        entityId:
            adminId,

        oldValue:
            {
                status:
                    "ACTIVE"
            },

        newValue:
            changes,

        reason

    });


    await loadAdmins();

}


async function revokeAdmin(
    adminId,
    reason = ""
) {

    requireSuperAdmin();


    const changes = {

        status:
            ADMIN_STATUS.REVOKED,

        suspensionUntil:
            null,

        updatedAt:
            serverTimestamp()

    };


    await updateDoc(
        doc(
            db,
            COLLECTIONS.admins,
            adminId
        ),
        changes
    );


    await createAuditLog({

        action:
            "ADMIN_REVOKED",

        entityType:
            "admin",

        entityId:
            adminId,

        newValue:
            changes,

        reason

    });


    await loadAdmins();

}


async function updateAdminStatus(
    adminId,
    status
) {

    requireSuperAdmin();


    await updateDoc(
        doc(
            db,
            COLLECTIONS.admins,
            adminId
        ),
        {

            status,

            updatedAt:
                serverTimestamp()

        }
    );


    await createAuditLog({

        action:
            "ADMIN_STATUS_CHANGED",

        entityType:
            "admin",

        entityId:
            adminId,

        newValue:
            {
                status
            }

    });


    await loadAdmins();

}


/* =========================================================
   PERMISSION MANAGEMENT
   ========================================================= */

async function updateAdminPermissions(
    adminId,
    permissions,
    mode = "MANUAL"
) {

    requireSuperAdmin();


    const safePermissions =
        Array.from(
            new Set(
                (permissions || [])
                    .filter(
                        permission =>
                            PERMISSIONS.includes(
                                permission
                            )
                    )
            )
        );


    await updateDoc(
        doc(
            db,
            COLLECTIONS.admins,
            adminId
        ),
        {

            permissions:
                safePermissions,

            permissionMode:
                mode,

            updatedAt:
                serverTimestamp()

        }
    );


    await createAuditLog({

        action:
            "ADMIN_PERMISSIONS_UPDATED",

        entityType:
            "admin",

        entityId:
            adminId,

        newValue:
            {
                permissions:
                    safePermissions,

                mode
            }

    });


    await loadAdmins();

}


/* =========================================================
   PERMISSION TEMPLATE
   ========================================================= */

async function getPermissionTemplate() {

    requireSuperAdmin();


    const reference =
        doc(
            db,
            COLLECTIONS.globalSettings,
            "permissionTemplate"
        );


    const snapshot =
        await getDoc(
            reference
        );


    if (
        !snapshot.exists()
    ) {

        return {

            permissions:
                PERMISSIONS,

            updatedAt:
                null

        };

    }


    return snapshot.data();

}


async function savePermissionTemplate(
    permissions
) {

    requireSuperAdmin();


    const safePermissions =
        Array.from(
            new Set(
                (permissions || [])
                    .filter(
                        item =>
                            PERMISSIONS.includes(
                                item
                            )
                    )
            )
        );


    await setDoc(

        doc(
            db,
            COLLECTIONS.globalSettings,
            "permissionTemplate"
        ),

        {

            permissions:
                safePermissions,

            updatedAt:
                serverTimestamp(),

            updatedBy:
                state.user.uid

        },

        {
            merge:
                true
        }

    );


    await createAuditLog({

        action:
            "PERMISSION_TEMPLATE_UPDATED",

        entityType:
            "globalSettings",

        entityId:
            "permissionTemplate",

        newValue:
            {
                permissions:
                    safePermissions
            }

    });

}


/* =========================================================
   EXAM MANAGEMENT
   ========================================================= */

async function loadExams(
    instituteId = null
) {

    requireSuperAdmin();


    const activeInstitute =
        instituteId ||
        state.activeInstituteId;


    let data;


    if (activeInstitute) {

        data =
            await getCollection(
                COLLECTIONS.exams,
                [
                    where(
                        "instituteId",
                        "==",
                        activeInstitute
                    )
                ]
            );

    } else {

        data =
            await getCollection(
                COLLECTIONS.exams
            );

    }


    state.exams =
        data;


    renderExamList();


    return data;

}


async function createExam(data) {

    requireSuperAdmin();


    const instituteId =
        data.instituteId ||
        state.activeInstituteId;


    if (!instituteId) {

        throw new Error(
            "Institute is required."
        );

    }


    const exam = {

        examId:
            normalize(
                data.examId
            ) ||
            `EXAM-${Date.now()}`,

        name:
            normalize(
                data.name
            ),

        description:
            normalize(
                data.description
            ),

        instituteId,

        duration:
            Number(
                data.duration || 60
            ),

        startTime:
            data.startTime ||
            null,

        endTime:
            data.endTime ||
            null,

        questionPool:
            data.questionPool ||
            {},

        questionCount:
            Number(
                data.questionCount || 0
            ),

        marksPerQuestion:
            Number(
                data.marksPerQuestion || 1
            ),

        negativeMarking:
            Number(
                data.negativeMarking || 0
            ),

        security:
            data.security ||
            {},

        attemptRules:
            data.attemptRules ||
            {},

        resultConfig:
            data.resultConfig ||
            {},

        feedbackConfig:
            data.feedbackConfig ||
            {},

        status:
            EXAM_STATUS.DRAFT,

        createdBy:
            state.user.uid,

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    const reference =
        await addDoc(
            collection(
                db,
                COLLECTIONS.exams
            ),
            exam
        );


    await createAuditLog({

        action:
            "EXAM_CREATED",

        entityType:
            "exam",

        entityId:
            reference.id,

        instituteId,

        newValue:
            exam

    });


    await loadExams(
        instituteId
    );


    return reference.id;

}


async function updateExam(
    examId,
    changes
) {

    requireSuperAdmin();


    const existing =
        await getDocument(
            COLLECTIONS.exams,
            examId
        );


    if (!existing) {

        throw new Error(
            "Exam not found."
        );

    }


    const safeChanges =
        cleanObject({

            ...changes,

            updatedAt:
                serverTimestamp()

        });


    await updateDoc(
        doc(
            db,
            COLLECTIONS.exams,
            examId
        ),
        safeChanges
    );


    await createAuditLog({

        action:
            "EXAM_UPDATED",

        entityType:
            "exam",

        entityId:
            examId,

        instituteId:
            existing.instituteId,

        oldValue:
            existing,

        newValue:
            changes

    });


    await loadExams(
        existing.instituteId
    );

}


async function publishExam(
    examId
) {

    requireSuperAdmin();


    const existing =
        await getDocument(
            COLLECTIONS.exams,
            examId
        );


    if (!existing) {

        throw new Error(
            "Exam not found."
        );

    }


    if (
        !existing.name ||
        !existing.duration
    ) {

        throw new Error(
            "Exam is incomplete and cannot be published."
        );

    }


    await updateDoc(
        doc(
            db,
            COLLECTIONS.exams,
            examId
        ),
        {

            status:
                EXAM_STATUS.SCHEDULED,

            publishedAt:
                serverTimestamp(),

            publishedBy:
                state.user.uid,

            updatedAt:
                serverTimestamp()

        }
    );


    await createAuditLog({

        action:
            "EXAM_PUBLISHED",

        entityType:
            "exam",

        entityId:
            examId,

        instituteId:
            existing.instituteId

    });


    await loadExams(
        existing.instituteId
    );

}


async function setExamStatus(
    examId,
    status
) {

    requireSuperAdmin();


    const existing =
        await getDocument(
            COLLECTIONS.exams,
            examId
        );


    if (!existing) {

        throw new Error(
            "Exam not found."
        );

    }


    await updateDoc(
        doc(
            db,
            COLLECTIONS.exams,
            examId
        ),
        {

            status,

            updatedAt:
                serverTimestamp()

        }
    );


    await createAuditLog({

        action:
            "EXAM_STATUS_CHANGED",

        entityType:
            "exam",

        entityId:
            examId,

        instituteId:
            existing.instituteId,

        oldValue:
            {
                status:
                    existing.status
            },

        newValue:
            {
                status
            }

    });


    await loadExams(
        existing.instituteId
    );

}


/* =========================================================
   BATCH MANAGEMENT
   ========================================================= */

async function loadBatches(
    instituteId = null
) {

    requireSuperAdmin();


    const selectedInstitute =
        instituteId ||
        state.activeInstituteId;


    let data;


    if (selectedInstitute) {

        data =
            await getCollection(
                COLLECTIONS.batches,
                [
                    where(
                        "instituteId",
                        "==",
                        selectedInstitute
                    )
                ]
            );

    } else {

        data =
            await getCollection(
                COLLECTIONS.batches
            );

    }


    state.batches =
        data;


    renderBatchList();


    return data;

}


async function createBatch(data) {

    requireSuperAdmin();


    const instituteId =
        data.instituteId ||
        state.activeInstituteId;


    if (!instituteId) {

        throw new Error(
            "Institute is required."
        );

    }


    const batch = {

        batchId:
            normalize(
                data.batchId
            ) ||
            `BATCH-${Date.now()}`,

        name:
            normalize(
                data.name
            ),

        category:
            normalize(
                data.category
            ),

        className:
            normalize(
                data.className
            ),

        batchTime:
            normalize(
                data.batchTime
            ),

        instituteId,

        examIds:
            Array.isArray(
                data.examIds
            )
                ? data.examIds
                : [],

        status:
            data.status ||
            "ACTIVE",

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp(),

        createdBy:
            state.user.uid

    };


    const reference =
        await addDoc(
            collection(
                db,
                COLLECTIONS.batches
            ),
            batch
        );


    await createAuditLog({

        action:
            "BATCH_CREATED",

        entityType:
            "batch",

        entityId:
            reference.id,

        instituteId,

        newValue:
            batch

    });


    await loadBatches(
        instituteId
    );


    return reference.id;

}


/* =========================================================
   QUESTION BANK
   ========================================================= */

async function loadQuestions(
    instituteId = null
) {

    requireSuperAdmin();


    const selectedInstitute =
        instituteId ||
        state.activeInstituteId;


    if (!selectedInstitute) {

        state.questions =
            [];

        return [];

    }


    const data =
        await getCollection(
            COLLECTIONS.questions,
            [
                where(
                    "instituteId",
                    "==",
                    selectedInstitute
                )
            ]
        );


    state.questions =
        data;


    renderQuestionList();


    return data;

}


async function createQuestion(data) {

    requireSuperAdmin();


    const instituteId =
        data.instituteId ||
        state.activeInstituteId;


    if (!instituteId) {

        throw new Error(
            "Institute is required."
        );

    }


    const question = {

        instituteId,

        questionBankId:
            data.questionBankId ||
            null,

        subject:
            normalize(
                data.subject
            ),

        chapter:
            normalize(
                data.chapter
            ),

        topic:
            normalize(
                data.topic
            ),

        difficulty:
            normalize(
                data.difficulty
            ),

        question:
            data.question ||
            "",

        options:
            Array.isArray(
                data.options
            )
                ? data.options
                : [],

        correctAnswer:
            data.correctAnswer ??
            null,

        explanation:
            data.explanation ||
            "",

        marks:
            Number(
                data.marks || 1
            ),

        negativeMarking:
            Number(
                data.negativeMarking || 0
            ),

        status:
            data.status ||
            "DRAFT",

        createdBy:
            state.user.uid,

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    const reference =
        await addDoc(
            collection(
                db,
                COLLECTIONS.questions
            ),
            question
        );


    await createAuditLog({

        action:
            "QUESTION_CREATED",

        entityType:
            "question",

        entityId:
            reference.id,

        instituteId,

        newValue:
            question

    });


    return reference.id;

}


/* =========================================================
   PORTAL CONFIGURATION
   ========================================================= */

async function getPortalConfig(
    scopeId
) {

    requireSuperAdmin();


    const reference =
        doc(
            db,
            COLLECTIONS.portalConfigs,
            scopeId
        );


    const snapshot =
        await getDoc(
            reference
        );


    if (
        !snapshot.exists()
    ) {

        return {

            scopeId,

            status:
                "DRAFT",

            version:
                0,

            content: {

                pageTitle:
                    "",

                subtitle:
                    "",

                welcomeMessage:
                    "",

                notice:
                    "",

                instructions:
                    "",

                supportText:
                    "",

                footer:
                    "",

                terms:
                    "",

                warning:
                    "",

                buttonText:
                    "Login",

                fields:
                    []

            }

        };

    }


    return {

        id:
            snapshot.id,

        ...snapshot.data()

    };

}


async function savePortalDraft(
    scopeId,
    config
) {

    requireSuperAdmin();


    const existing =
        await getPortalConfig(
            scopeId
        );


    const nextVersion =
        Number(
            existing.version || 0
        ) + 1;


    const draft = {

        scopeId,

        status:
            "DRAFT",

        version:
            nextVersion,

        content:
            config,

        createdBy:
            state.user.uid,

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    await setDoc(

        doc(
            db,
            COLLECTIONS.portalConfigs,
            scopeId
        ),

        draft,

        {
            merge:
                true
        }

    );


    await createAuditLog({

        action:
            "PORTAL_CONFIG_DRAFT_SAVED",

        entityType:
            "portalConfig",

        entityId:
            scopeId,

        newValue:
            draft

    });


    return nextVersion;

}


async function publishPortalConfig(
    scopeId
) {

    requireSuperAdmin();


    const config =
        await getPortalConfig(
            scopeId
        );


    if (!config) {

        throw new Error(
            "Portal configuration not found."
        );

    }


    await setDoc(

        doc(
            db,
            COLLECTIONS.portalConfigs,
            scopeId
        ),

        {

            status:
                "PUBLISHED",

            publishedBy:
                state.user.uid,

            publishedAt:
                serverTimestamp(),

            updatedAt:
                serverTimestamp()

        },

        {
            merge:
                true
        }

    );


    await createAuditLog({

        action:
            "PORTAL_CONFIG_PUBLISHED",

        entityType:
            "portalConfig",

        entityId:
            scopeId

    });

}


/* =========================================================
   GLOBAL SETTINGS
   ========================================================= */

async function getGlobalSettings() {

    requireSuperAdmin();


    return getDocument(
        COLLECTIONS.globalSettings,
        "default"
    );

}


async function saveGlobalSettings(
    settings
) {

    requireSuperAdmin();


    const existing =
        await getGlobalSettings();


    await setDoc(

        doc(
            db,
            COLLECTIONS.globalSettings,
            "default"
        ),

        {

            ...settings,

            updatedBy:
                state.user.uid,

            updatedAt:
                serverTimestamp(),

            version:
                Number(
                    existing?.version || 0
                ) + 1

        },

        {
            merge:
                true
        }

    );


    await createAuditLog({

        action:
            "GLOBAL_SETTINGS_UPDATED",

        entityType:
            "globalSettings",

        entityId:
            "default",

        oldValue:
            existing,

        newValue:
            settings

    });

}


/* =========================================================
   SECURITY SETTINGS
   ========================================================= */

async function saveSecuritySettings(
    scopeId,
    securitySettings
) {

    requireSuperAdmin();


    const reference =
        doc(
            db,
            COLLECTIONS.globalSettings,
            `security_${scopeId}`
        );


    await setDoc(

        reference,

        {

            scopeId,

            ...securitySettings,

            updatedBy:
                state.user.uid,

            updatedAt:
                serverTimestamp()

        },

        {
            merge:
                true
        }

    );


    await createAuditLog({

        action:
            "SECURITY_SETTINGS_UPDATED",

        entityType:
            "securitySettings",

        entityId:
            scopeId,

        instituteId:
            scopeId,

        newValue:
            securitySettings

    });

}


/* =========================================================
   RESULTS
   ========================================================= */

async function loadResults(
    filters = {}
) {

    requireSuperAdmin();


    const constraints = [];


    if (
        filters.instituteId
    ) {

        constraints.push(
            where(
                "instituteId",
                "==",
                filters.instituteId
            )
        );

    }


    if (
        filters.examId
    ) {

        constraints.push(
            where(
                "examId",
                "==",
                filters.examId
            )
        );

    }


    if (
        filters.batchId
    ) {

        constraints.push(
            where(
                "batchId",
                "==",
                filters.batchId
            )
        );

    }


    const data =
        await getCollection(
            COLLECTIONS.results,
            constraints
        );


    state.results =
        data;


    renderResults();


    return data;

}


/* =========================================================
   FEEDBACK
   ========================================================= */

async function loadFeedback(
    filters = {}
) {

    requireSuperAdmin();


    const constraints = [];


    if (
        filters.instituteId
    ) {

        constraints.push(
            where(
                "instituteId",
                "==",
                filters.instituteId
            )
        );

    }


    if (
        filters.examId
    ) {

        constraints.push(
            where(
                "examId",
                "==",
                filters.examId
            )
        );

    }


    const data =
        await getCollection(
            COLLECTIONS.feedback,
            constraints
        );


    state.feedback =
        data;


    return data;

}


/* =========================================================
   SECURITY EVENTS
   ========================================================= */

async function loadSecurityEvents(
    filters = {}
) {

    requireSuperAdmin();


    const constraints = [];


    if (
        filters.instituteId
    ) {

        constraints.push(
            where(
                "instituteId",
                "==",
                filters.instituteId
            )
        );

    }


    if (
        filters.examId
    ) {

        constraints.push(
            where(
                "examId",
                "==",
                filters.examId
            )
        );

    }


    const data =
        await getCollection(
            COLLECTIONS.securityEvents,
            constraints
        );


    state.securityEvents =
        data;


    return data;

}


/* =========================================================
   AUDIT LOGS
   ========================================================= */

async function loadAuditLogs(
    filters = {}
) {

    requireSuperAdmin();


    const constraints = [

        orderBy(
            "timestamp",
            "desc"
        ),

        limit(
            Number(
                filters.limit || 100
            )
        )

    ];


    const data =
        await getCollection(
            COLLECTIONS.auditLogs,
            constraints
        );


    state.auditLogs =
        data;


    renderAuditLogs();


    return data;

}


/* =========================================================
   PRESENCE / LIVE MONITORING
   ========================================================= */

async function loadPresence() {

    requireSuperAdmin();


    const data =
        await getCollection(
            COLLECTIONS.presence
        );


    const activeThreshold =
        nowMillis() -
        (
            2 * 60 * 1000
        );


    state.presence =
        data.filter(
            item => {

                const lastActive =
                    convertTimestamp(
                        item.lastActive
                    );


                return (
                    lastActive &&
                    lastActive >=
                    activeThreshold
                );

            }
        );


    renderPresence();


    return state.presence;

}


/* =========================================================
   DASHBOARD STATISTICS
   ========================================================= */

async function calculateDashboardStats() {

    requireSuperAdmin();


    const [
        institutes,
        admins,
        exams,
        candidates,
        results,
        securityEvents,
        feedback
    ] = await Promise.all([

        getCollection(
            COLLECTIONS.institutes
        ),

        getCollection(
            COLLECTIONS.admins
        ),

        getCollection(
            COLLECTIONS.exams
        ),

        getCollection(
            COLLECTIONS.candidates
        ),

        getCollection(
            COLLECTIONS.results
        ),

        getCollection(
            COLLECTIONS.securityEvents
        ),

        getCollection(
            COLLECTIONS.feedback
        )

    ]);


    const activeAdmins =
        admins.filter(
            admin =>
                normalizeLower(
                    admin.status
                ) ===
                "active"
        );


    const suspendedAdmins =
        admins.filter(
            admin =>
                normalizeLower(
                    admin.status
                ) ===
                "suspended"
        );


    const liveExams =
        exams.filter(
            exam =>
                exam.status ===
                EXAM_STATUS.LIVE
        );


    const scheduledExams =
        exams.filter(
            exam =>
                exam.status ===
                EXAM_STATUS.SCHEDULED
        );


    const completedExams =
        exams.filter(
            exam =>
                exam.status ===
                EXAM_STATUS.COMPLETED
        );


    const activeCandidates =
        state.presence.filter(
            item =>
                normalizeLower(
                    item.role
                ) ===
                "candidate"
        );


    const scores =
        results
            .map(
                result =>
                    Number(
                        result.score ??
                        result.obtainedMarks ??
                        0
                    )
            )
            .filter(
                Number.isFinite
            );


    const ratings =
        feedback
            .map(
                item =>
                    Number(
                        item.rating
                    )
            )
            .filter(
                rating =>
                    rating >= 1 &&
                    rating <= 5
            );


    const averageScore =
        scores.length
            ? (
                scores.reduce(
                    (
                        total,
                        value
                    ) =>
                        total + value,
                    0
                ) /
                scores.length
            )
            : 0;


    const averageRating =
        ratings.length
            ? (
                ratings.reduce(
                    (
                        total,
                        value
                    ) =>
                        total + value,
                    0
                ) /
                ratings.length
            )
            : 0;


    state.institutes =
        institutes;

    state.admins =
        admins;

    state.exams =
        exams;

    state.candidates =
        candidates;

    state.results =
        results;

    state.securityEvents =
        securityEvents;

    state.feedback =
        feedback;


    state.dashboardStats = {

        totalInstitutes:
            institutes.length,

        totalAdmins:
            admins.length,

        activeAdmins:
            activeAdmins.length,

        suspendedAdmins:
            suspendedAdmins.length,

        totalExams:
            exams.length,

        liveExams:
            liveExams.length,

        scheduledExams:
            scheduledExams.length,

        completedExams:
            completedExams.length,

        totalCandidates:
            candidates.length,

        activeCandidates:
            activeCandidates.length,

        totalSubmissions:
            results.length,

        averageScore:
            Number(
                averageScore.toFixed(2)
            ),

        securityFlags:
            securityEvents.length,

        averageRating:
            Number(
                averageRating.toFixed(2)
            )

    };


    renderDashboardStats();


    return state.dashboardStats;

}


/* =========================================================
   REAL-TIME LISTENERS
   ========================================================= */

function startRealtimeListeners() {

    requireSuperAdmin();


    cleanupListeners();


    /*
     * Institutes
     */

    const instituteListener =
        onSnapshot(

            collection(
                db,
                COLLECTIONS.institutes
            ),

            snapshot => {

                state.institutes =
                    snapshot.docs.map(
                        item => ({
                            id:
                                item.id,

                            ...item.data()
                        })
                    );


                renderInstituteSelector();

                renderInstituteList();

            },

            error => {

                console.error(
                    "Institute listener:",
                    error
                );

            }

        );


    state.listeners.push(
        instituteListener
    );


    /*
     * Admins
     */

    const adminListener =
        onSnapshot(

            collection(
                db,
                COLLECTIONS.admins
            ),

            snapshot => {

                state.admins =
                    snapshot.docs.map(
                        item => ({
                            id:
                                item.id,

                            ...item.data()
                        })
                    );


                renderAdminList();

            },

            error => {

                console.error(
                    "Admin listener:",
                    error
                );

            }

        );


    state.listeners.push(
        adminListener
    );


    /*
     * Exams
     */

    const examListener =
        onSnapshot(

            collection(
                db,
                COLLECTIONS.exams
            ),

            snapshot => {

                state.exams =
                    snapshot.docs.map(
                        item => ({
                            id:
                                item.id,

                            ...item.data()
                        })
                    );


                renderExamList();

                calculateDashboardStats();

            },

            error => {

                console.error(
                    "Exam listener:",
                    error
                );

            }

        );


    state.listeners.push(
        examListener
    );


    /*
     * Presence
     */

    const presenceListener =
        onSnapshot(

            collection(
                db,
                COLLECTIONS.presence
            ),

            snapshot => {

                const cutoff =
                    nowMillis() -
                    (
                        2 * 60 * 1000
                    );


                state.presence =
                    snapshot.docs
                        .map(
                            item => ({
                                id:
                                    item.id,

                                ...item.data()
                            })
                        )
                        .filter(
                            item => {

                                const time =
                                    convertTimestamp(
                                        item.lastActive
                                    );


                                return (
                                    time &&
                                    time >= cutoff
                                );

                            }
                        );


                renderPresence();

                calculateDashboardStats();

            },

            error => {

                /*
                 * Presence collection may not exist yet.
                 * Do not crash dashboard.
                 */

                console.warn(
                    "Presence listener:",
                    error
                );

            }

        );


    state.listeners.push(
        presenceListener
    );


    /*
     * Security Events
     */

    const securityListener =
        onSnapshot(

            collection(
                db,
                COLLECTIONS.securityEvents
            ),

            snapshot => {

                state.securityEvents =
                    snapshot.docs.map(
                        item => ({
                            id:
                                item.id,

                            ...item.data()
                        })
                    );


                calculateDashboardStats();

            },

            error => {

                console.warn(
                    "Security event listener:",
                    error
                );

            }

        );


    state.listeners.push(
        securityListener
    );


    /*
     * Results
     */

    const resultListener =
        onSnapshot(

            collection(
                db,
                COLLECTIONS.results
            ),

            snapshot => {

                state.results =
                    snapshot.docs.map(
                        item => ({
                            id:
                                item.id,

                            ...item.data()
                        })
                    );


                calculateDashboardStats();

            },

            error => {

                console.warn(
                    "Results listener:",
                    error
                );

            }

        );


    state.listeners.push(
        resultListener
    );

}


function cleanupListeners() {

    state.listeners.forEach(
        unsubscribe => {

            try {

                unsubscribe();

            } catch {

                // ignore cleanup error

            }

        }
    );


    state.listeners =
        [];

}


/* =========================================================
   EMERGENCY CONTROLS
   ========================================================= */

async function setMaintenanceMode(
    enabled,
    reason = ""
) {

    requireSuperAdmin();


    const reference =
        doc(
            db,
            COLLECTIONS.globalSettings,
            "emergency"
        );


    await setDoc(

        reference,

        {

            maintenanceMode:
                Boolean(enabled),

            maintenanceReason:
                reason,

            updatedBy:
                state.user.uid,

            updatedAt:
                serverTimestamp()

        },

        {
            merge:
                true
        }

    );


    await createAuditLog({

        action:
            enabled
                ? "MAINTENANCE_ENABLED"
                : "MAINTENANCE_DISABLED",

        entityType:
            "emergency",

        entityId:
            "global",

        reason

    });

}


async function disableCandidateLogin(
    disabled,
    reason = ""
) {

    requireSuperAdmin();


    await setDoc(

        doc(
            db,
            COLLECTIONS.globalSettings,
            "emergency"
        ),

        {

            candidateLoginDisabled:
                Boolean(disabled),

            candidateLoginDisabledReason:
                reason,

            updatedBy:
                state.user.uid,

            updatedAt:
                serverTimestamp()

        },

        {
            merge:
                true
        }

    );


    await createAuditLog({

        action:
            disabled
                ? "CANDIDATE_LOGIN_DISABLED"
                : "CANDIDATE_LOGIN_ENABLED",

        entityType:
            "emergency",

        entityId:
            "candidateLogin",

        reason

    });

}


async function pauseExam(
    examId,
    reason = ""
) {

    requireSuperAdmin();


    await setExamStatus(
        examId,
        EXAM_STATUS.PAUSED
    );


    await createAuditLog({

        action:
            "EMERGENCY_EXAM_PAUSED",

        entityType:
            "exam",

        entityId:
            examId,

        reason

    });

}


async function resumeExam(
    examId,
    reason = ""
) {

    requireSuperAdmin();


    await setExamStatus(
        examId,
        EXAM_STATUS.LIVE
    );


    await createAuditLog({

        action:
            "EMERGENCY_EXAM_RESUMED",

        entityType:
            "exam",

        entityId:
            examId,

        reason

    });

}


/*
 * Force submit is intentionally implemented as a state change
 * request rather than directly rewriting every candidate
 * attempt from the browser.
 *
 * A trusted Cloud Function should process this command.
 */

async function requestForceSubmit(
    examId,
    candidateId = null,
    reason = ""
) {

    requireSuperAdmin();


    const command = {

        type:
            candidateId
                ? "FORCE_SUBMIT_CANDIDATE"
                : "FORCE_SUBMIT_EXAM",

        examId,

        candidateId,

        reason,

        requestedBy:
            state.user.uid,

        status:
            "PENDING",

        createdAt:
            serverTimestamp()

    };


    const reference =
        await addDoc(

            collection(
                db,
                COLLECTIONS.notifications
            ),

            command

        );


    await createAuditLog({

        action:
            command.type,

        entityType:
            "exam",

        entityId:
            examId,

        reason

    });


    return reference.id;

}


/* =========================================================
   SEARCH
   ========================================================= */

async function globalSearch(
    searchTerm
) {

    requireSuperAdmin();


    const term =
        normalizeLower(
            searchTerm
        );


    if (!term) {

        return {

            institutes: [],
            admins: [],
            exams: [],
            batches: [],
            candidates: [],
            results: []

        };

    }


    const [

        institutes,
        admins,
        exams,
        batches,
        candidates,
        results

    ] = await Promise.all([

        getCollection(
            COLLECTIONS.institutes
        ),

        getCollection(
            COLLECTIONS.admins
        ),

        getCollection(
            COLLECTIONS.exams
        ),

        getCollection(
            COLLECTIONS.batches
        ),

        getCollection(
            COLLECTIONS.candidates
        ),

        getCollection(
            COLLECTIONS.results
        )

    ]);


    const match =
        item => {

            const searchable =
                [

                    item.id,

                    item.name,

                    item.email,

                    item.examId,

                    item.instituteId,

                    item.batchId,

                    item.candidateId,

                    item.status

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


            return searchable.includes(
                term
            );

        };


    return {

        institutes:
            institutes.filter(match),

        admins:
            admins.filter(match),

        exams:
            exams.filter(match),

        batches:
            batches.filter(match),

        candidates:
            candidates.filter(match),

        results:
            results.filter(match)

    };

}


/* =========================================================
   RENDER DASHBOARD
   ========================================================= */

function renderDashboardStats() {

    const stats =
        state.dashboardStats;


    const mapping = {

        totalInstitutes:
            stats.totalInstitutes,

        totalAdmins:
            stats.totalAdmins,

        activeAdmins:
            stats.activeAdmins,

        suspendedAdmins:
            stats.suspendedAdmins,

        totalExams:
            stats.totalExams,

        liveExams:
            stats.liveExams,

        scheduledExams:
            stats.scheduledExams,

        completedExams:
            stats.completedExams,

        totalCandidates:
            stats.totalCandidates,

        activeCandidates:
            stats.activeCandidates,

        totalSubmissions:
            stats.totalSubmissions,

        averageScore:
            stats.averageScore,

        securityFlags:
            stats.securityFlags,

        averageRating:
            stats.averageRating

    };


    Object.entries(
        mapping
    ).forEach(
        ([id, value]) => {

            const element =
                getElement(id);


            if (element) {

                element.textContent =
                    value;

            }

        }
    );


    /*
     * Support generic data-stat attributes.
     */

    document
        .querySelectorAll(
            "[data-stat]"
        )
        .forEach(
            element => {

                const key =
                    element.dataset.stat;


                if (
                    Object.prototype
                        .hasOwnProperty
                        .call(
                            stats,
                            key
                        )
                ) {

                    element.textContent =
                        stats[key];

                }

            }
        );

}


/* =========================================================
   RENDER SELECTOR
   ========================================================= */

function renderInstituteSelector() {

    const selector =
        getElement(
            "instituteSelector"
        );


    if (!selector) {

        return;

    }


    const current =
        state.activeInstituteId;


    selector.innerHTML =
        `<option value="">All Institutes</option>`;


    state.institutes
        .forEach(
            institute => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    institute.id;


                option.textContent =
                    institute.name ||
                    institute.instituteId ||
                    institute.id;


                option.selected =
                    institute.id ===
                    current;


                selector.appendChild(
                    option
                );

            }
        );

}


/* =========================================================
   RENDER INSTITUTE LIST
   ========================================================= */

function renderInstituteList() {

    const container =
        getElement(
            "instituteList"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    state.institutes
        .forEach(
            institute => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "data-row";


                row.dataset.id =
                    institute.id;


                row.innerHTML = `

                    <div>
                        <strong>
                            ${escapeHtml(
                                institute.name ||
                                "Unnamed Institute"
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                institute.instituteId ||
                                institute.id
                            )}
                        </small>
                    </div>

                    <span>
                        ${escapeHtml(
                            institute.status ||
                            "ACTIVE"
                        )}
                    </span>

                    <button
                        type="button"
                        data-action="edit-institute"
                        data-id="${escapeAttr(
                            institute.id
                        )}">
                        Edit
                    </button>

                `;


                container.appendChild(
                    row
                );

            }
        );

}


/* =========================================================
   RENDER ADMINS
   ========================================================= */

function renderAdminList() {

    const container =
        getElement(
            "adminsTableBody"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    state.admins
        .forEach(
            admin => {

                const row =
                    document.createElement(
                        "tr"
                    );


                row.innerHTML = `

                    <td>
                        <strong>
                            ${escapeHtml(
                                admin.name ||
                                "Unnamed Admin"
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                admin.email ||
                                ""
                            )}
                        </small>
                    </td>

                    <td>
                        ${escapeHtml(
                            admin.role ||
                            "ADMIN"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            (admin.instituteIds || [])
                                .map(id => {
                                    const institute =
                                        state.institutes.find(
                                            item => item.id === id
                                        );
                                    return institute?.instituteName ||
                                        institute?.name || id;
                                })
                                .join(", ") || "—"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            `${(admin.permissions || []).length} permissions`
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            admin.status ||
                            ADMIN_STATUS.ACTIVE
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            formatTimestamp(
                                admin.lastActiveAt ||
                                admin.updatedAt
                            )
                        )}
                    </td>

                    <td>

                        <button
                            type="button"
                            data-action="activate-admin"
                            data-id="${escapeAttr(
                                admin.id
                            )}">
                            Activate
                        </button>

                        <button
                            type="button"
                            data-action="suspend-admin"
                            data-id="${escapeAttr(
                                admin.id
                            )}">
                            Suspend
                        </button>

                        <button
                            type="button"
                            data-action="revoke-admin"
                            data-id="${escapeAttr(
                                admin.id
                            )}">
                            Revoke
                        </button>

                    </td>

                `;


                container.appendChild(
                    row
                );

            }
        );

}


/* =========================================================
   RENDER EXAMS
   ========================================================= */

function renderExamList() {

    const container =
        getElement(
            "examList"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    state.exams
        .forEach(
            exam => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "data-row";


                row.innerHTML = `

                    <div>

                        <strong>
                            ${escapeHtml(
                                exam.name ||
                                "Unnamed Exam"
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                exam.examId ||
                                exam.id
                            )}
                        </small>

                    </div>

                    <span>
                        ${escapeHtml(
                            exam.status ||
                            EXAM_STATUS.DRAFT
                        )}
                    </span>

                    <div>

                        <button
                            type="button"
                            data-action="publish-exam"
                            data-id="${escapeAttr(
                                exam.id
                            )}">
                            Publish
                        </button>

                        <button
                            type="button"
                            data-action="pause-exam"
                            data-id="${escapeAttr(
                                exam.id
                            )}">
                            Pause
                        </button>

                    </div>

                `;


                container.appendChild(
                    row
                );

            }
        );

}


/* =========================================================
   RENDER BATCHES
   ========================================================= */

function renderBatchList() {

    const container =
        getElement(
            "batchList"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    state.batches
        .forEach(
            batch => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "data-row";


                row.innerHTML = `

                    <div>

                        <strong>
                            ${escapeHtml(
                                batch.name ||
                                "Unnamed Batch"
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                batch.category ||
                                ""
                            )}
                        </small>

                    </div>

                    <span>
                        ${escapeHtml(
                            batch.status ||
                            "ACTIVE"
                        )}
                    </span>

                `;


                container.appendChild(
                    row
                );

            }
        );

}


/* =========================================================
   RENDER QUESTIONS
   ========================================================= */

function renderQuestionList() {

    const container =
        getElement(
            "questionList"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    state.questions
        .slice(
            0,
            100
        )
        .forEach(
            question => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "data-row";


                row.innerHTML = `

                    <div>

                        <strong>
                            ${escapeHtml(
                                question.subject ||
                                "Question"
                            )}
                        </strong>

                        <p>
                            ${escapeHtml(
                                question.question ||
                                ""
                            ).slice(
                                0,
                                180
                            )}
                        </p>

                    </div>

                    <span>
                        ${escapeHtml(
                            question.difficulty ||
                            ""
                        )}
                    </span>

                `;


                container.appendChild(
                    row
                );

            }
        );

}


/* =========================================================
   RENDER RESULTS
   ========================================================= */

function renderResults() {

    const container =
        getElement(
            "resultList"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    state.results
        .slice(
            0,
            100
        )
        .forEach(
            result => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "data-row";


                row.innerHTML = `

                    <div>

                        <strong>
                            ${escapeHtml(
                                result.candidateName ||
                                result.candidateId ||
                                "Candidate"
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                result.examId ||
                                ""
                            )}
                        </small>

                    </div>

                    <strong>
                        ${escapeHtml(
                            String(
                                result.score ??
                                result.obtainedMarks ??
                                0
                            )
                        )}
                    </strong>

                `;


                container.appendChild(
                    row
                );

            }
        );

}


/* =========================================================
   RENDER AUDIT LOGS
   ========================================================= */

function renderAuditLogs() {

    const container =
        getElement(
            "auditLogList"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    state.auditLogs
        .forEach(
            log => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "data-row";


                row.innerHTML = `

                    <div>

                        <strong>
                            ${escapeHtml(
                                log.action ||
                                "ACTION"
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                log.actorEmail ||
                                log.actorId ||
                                ""
                            )}
                        </small>

                    </div>

                    <span>
                        ${formatTimestamp(
                            log.timestamp
                        )}
                    </span>

                `;


                container.appendChild(
                    row
                );

            }
        );

}


/* =========================================================
   RENDER LIVE PRESENCE
   ========================================================= */

function renderPresence() {

    const container =
        getElement(
            "presenceList"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    state.presence
        .forEach(
            item => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "data-row";


                row.innerHTML = `

                    <div>

                        <strong>
                            ${escapeHtml(
                                item.name ||
                                item.email ||
                                item.userId ||
                                "User"
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                item.role ||
                                ""
                            )}
                        </small>

                    </div>

                    <div>

                        <span>
                            ${escapeHtml(
                                item.currentExam ||
                                ""
                            )}
                        </span>

                        <small>
                            ${escapeHtml(
                                item.currentInstitute ||
                                ""
                            )}
                        </small>

                    </div>

                    <span>
                        Active
                    </span>

                `;


                container.appendChild(
                    row
                );

            }
        );

}


/* =========================================================
   EVENT HANDLING
   ========================================================= */

function bindEvents() {

    /*
     * Institute selector
     */

    const instituteSelector =
        getElement(
            "instituteSelector"
        );


    if (instituteSelector) {

        instituteSelector.addEventListener(
            "change",
            async event => {

                state.activeInstituteId =
                    event.target.value ||
                    null;


                await Promise.all([

                    loadExams(
                        state.activeInstituteId
                    ),

                    loadBatches(
                        state.activeInstituteId
                    ),

                    loadQuestions(
                        state.activeInstituteId
                    )

                ]);


                window.dispatchEvent(
                    new CustomEvent(
                        "superadmin:instituteChanged",
                        {
                            detail: {
                                instituteId:
                                    state.activeInstituteId
                            }
                        }
                    )
                );

            }
        );

    }


    /*
     * Generic data-action buttons
     */

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

                switch (
                    action
                ) {

                    case "activate-admin":

                        await activateAdmin(
                            id
                        );

                        break;


                    case "suspend-admin":

                        await suspendAdmin(
                            id,
                            null,
                            "Suspended by Super Admin"
                        );

                        break;


                    case "revoke-admin":

                        if (
                            !confirm(
                                "Are you sure you want to permanently revoke this Admin?"
                            )
                        ) {

                            return;

                        }

                        await revokeAdmin(
                            id,
                            "Revoked by Super Admin"
                        );

                        break;


                    case "publish-exam":

                        await publishExam(
                            id
                        );

                        break;


                    case "pause-exam":

                        await pauseExam(
                            id,
                            "Paused by Super Admin"
                        );

                        break;


                    case "edit-institute":

                        state.activeInstituteId =
                            id;

                        window.dispatchEvent(
                            new CustomEvent(
                                "superadmin:editInstitute",
                                {
                                    detail: {
                                        id
                                    }
                                }
                            )
                        );

                        break;

                }


            } catch (error) {

                console.error(
                    error
                );


                toast(
                    "Operation failed",
                    error.message ||
                    "Unable to complete operation.",
                    "danger"
                );

            }

        }
    );


    /*
     * Logout
     */

    const logoutButton =
        getElement(
            "logoutButton"
        );


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async () => {

                await window
                    .SuperAdminAuth
                    ?.logout();

            }
        );

    }

}


/* =========================================================
   AUTHORIZED EVENT
   ========================================================= */

function bindAuthEvents() {

    window.addEventListener(
        "superadmin:authorized",
        async event => {

            try {

                const detail =
                    event.detail || {};


                state.authorized =
                    true;

                state.user =
                    detail.user ||
                    null;

                state.profile =
                    detail.profile ||
                    null;


                await initializeDashboard();

            } catch (error) {

                console.error(
                    "Dashboard initialization failed:",
                    error
                );


                toast(
                    "Dashboard error",
                    error.message ||
                    "Unable to initialize dashboard.",
                    "danger"
                );

            }

        }
    );


    window.addEventListener(
        "superadmin:logout",
        () => {

            cleanupListeners();


            state.authorized =
                false;

            state.user =
                null;

            state.profile =
                null;

        }
    );

}


/* =========================================================
   INITIALIZE DASHBOARD
   ========================================================= */

async function initializeDashboard() {

    if (
        state.initialized
    ) {

        return;

    }


    requireSuperAdmin();


    state.loading =
        true;


    try {

        const auth =
            window.SuperAdminAuth
                .getState();


        state.user =
            auth.user;

        state.profile =
            auth.profile;


        await loadInstitutes();


        if (
            state.activeInstituteId
        ) {

            await Promise.all([

                loadExams(
                    state.activeInstituteId
                ),

                loadBatches(
                    state.activeInstituteId
                ),

                loadQuestions(
                    state.activeInstituteId
                )

            ]);

        }


        await loadPresence();


        await calculateDashboardStats();


        await loadAuditLogs({
            limit:
                100
        });


        startRealtimeListeners();


        bindEvents();


        state.initialized =
            true;


        window.dispatchEvent(
            new CustomEvent(
                "superadmin:ready",
                {
                    detail: {
                        state
                    }
                }
            )
        );


    } finally {

        state.loading =
            false;

    }

}


/* =========================================================
   TIMESTAMP HELPERS
   ========================================================= */

function convertTimestamp(
    value
) {

    if (!value) {

        return null;

    }


    if (
        typeof value.toMillis ===
        "function"
    ) {

        return value.toMillis();

    }


    if (
        typeof value.toDate ===
        "function"
    ) {

        return value.toDate()
            .getTime();

    }


    if (
        value instanceof Date
    ) {

        return value.getTime();

    }


    if (
        typeof value ===
        "number"
    ) {

        return value;

    }


    const parsed =
        new Date(
            value
        )
        .getTime();


    return Number.isNaN(
        parsed
    )
        ? null
        : parsed;

}


function formatTimestamp(
    value
) {

    const millis =
        convertTimestamp(
            value
        );


    if (!millis) {

        return "—";

    }


    return new Intl.DateTimeFormat(
        undefined,
        {
            dateStyle:
                "medium",

            timeStyle:
                "short"
        }
    )
        .format(
            new Date(
                millis
            )
        );

}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function escapeAttr(
    value
) {

    return escapeHtml(
        value
    );

}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.SuperAdminApp = {

    state,

    collections:
        COLLECTIONS,

    permissions:
        PERMISSIONS,

    examStatus:
        EXAM_STATUS,

    adminStatus:
        ADMIN_STATUS,

    requireSuperAdmin,

    /* Institutes */

    loadInstitutes,

    createInstitute,

    updateInstitute,

    setInstituteStatus,

    archiveInstitute,

    /* Admins */

    loadAdmins,

    saveAdminProfile,

    activateAdmin,

    suspendAdmin,

    revokeAdmin,

    updateAdminStatus,

    updateAdminPermissions,

    getPermissionTemplate,

    savePermissionTemplate,

    /* Exams */

    loadExams,

    createExam,

    updateExam,

    publishExam,

    setExamStatus,

    /* Batches */

    loadBatches,

    createBatch,

    /* Questions */

    loadQuestions,

    createQuestion,

    /* Portal */

    getPortalConfig,

    savePortalDraft,

    publishPortalConfig,

    /* Settings */

    getGlobalSettings,

    saveGlobalSettings,

    saveSecuritySettings,

    /* Analytics */

    loadResults,

    loadFeedback,

    loadSecurityEvents,

    loadAuditLogs,

    loadPresence,

    calculateDashboardStats,

    /* Search */

    globalSearch,

    /* Emergency */

    setMaintenanceMode,

    disableCandidateLogin,

    pauseExam,

    resumeExam,

    requestForceSubmit,

    /* Realtime */

    startRealtimeListeners,

    cleanupListeners

};


/* =========================================================
   STARTUP
   ========================================================= */

bindAuthEvents();


/*
 * If auth.js has already finished authorization before this
 * script loads, initialize immediately.
 */

(async function bootstrap() {

    try {

        if (
            window.SuperAdminAuth
        ) {

            const authState =
                window.SuperAdminAuth
                    .getState();


            if (
                authState &&
                authState.authorized
            ) {

                state.authorized =
                    true;

                state.user =
                    authState.user;

                state.profile =
                    authState.profile;


                await initializeDashboard();

            }

        }

    } catch (error) {

        console.error(
            "Super Admin bootstrap error:",
            error
        );

    }

})();
