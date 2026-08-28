// ============================================================
// INSTITUTE CODE GATEWAY
// STEP 3 - SUPER ADMIN PRO PLATFORM
// ============================================================

import { db } from "./firebase-config.js";

import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// ============================================================
// DOM HELPERS
// ============================================================

const $ = (id) => document.getElementById(id);

const gatewayScreen = $("instituteGatewayScreen");
const gatewayForm = $("instituteGatewayForm");
const instituteCodeInput = $("instituteCode");
const gatewayContinueBtn = $("instituteGatewayContinueBtn");

const gatewayMessage = $("gatewayMessage");
const gatewayError = $("gatewayError");

const institutePreview = $("institutePreview");
const institutePreviewName = $("institutePreviewName");
const institutePreviewMessage = $("institutePreviewMessage");

const loginScreen = $("loginScreen");

// ============================================================
// STATE
// ============================================================

let activeInstitute = null;
let gatewayBusy = false;

// ============================================================
// NORMALIZE CODE
// ============================================================

function normalizeInstituteCode(value) {
    return String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

// ============================================================
// SAFE TEXT
// ============================================================

function safeText(value) {
    return String(value ?? "").trim();
}

// ============================================================
// SCREEN CONTROL
// ============================================================

function showGateway() {

    if (gatewayScreen) {
        gatewayScreen.classList.add("active");
    }

    if (loginScreen) {
        loginScreen.classList.remove("active");
    }
}

function showCandidateLogin() {

    if (gatewayScreen) {
        gatewayScreen.classList.remove("active");
    }

    if (loginScreen) {
        loginScreen.classList.add("active");
    }
}

// ============================================================
// MESSAGE
// ============================================================

function clearGatewayMessage() {

    if (gatewayMessage) {
        gatewayMessage.textContent = "";
        gatewayMessage.className = "gateway-message";
    }

    if (gatewayError) {
        gatewayError.textContent = "";
        gatewayError.classList.remove("show");
    }

    if (institutePreview) {
        institutePreview.classList.remove("show");
    }
}

function showError(message) {

    if (gatewayMessage) {
        gatewayMessage.textContent = message;
        gatewayMessage.className =
            "gateway-message gateway-error-message";
    }

    if (gatewayError) {
        gatewayError.textContent = message;
        gatewayError.classList.add("show");
    }
}

function showSuccess(institute) {

    if (!institutePreview) {
        return;
    }

    if (institutePreviewName) {
        institutePreviewName.textContent =
            safeText(institute.instituteName) ||
            "Institute";
    }

    if (institutePreviewMessage) {
        institutePreviewMessage.textContent =
            "Institute verified successfully.";
    }

    institutePreview.classList.add("show");
}

// ============================================================
// VALIDATE INSTITUTE
// ============================================================

async function validateInstitute(code) {

    const institutesRef =
        collection(db, "institutes");

    const instituteQuery =
        query(
            institutesRef,
            where(
                "instituteCode",
                "==",
                code
            )
        );

    const snapshot =
        await getDocs(
            instituteQuery
        );

    if (snapshot.empty) {
        return {
            valid: false,
            reason: "INVALID_CODE"
        };
    }

    const instituteDoc =
        snapshot.docs[0];

    const instituteData =
        instituteDoc.data();

    const institute = {
        instituteId:
            instituteData.instituteId ||
            instituteDoc.id,

        instituteCode:
            instituteData.instituteCode ||
            code,

        instituteName:
            instituteData.instituteName ||
            "Institute",

        status:
            String(
                instituteData.status ||
                "ACTIVE"
            ).toUpperCase(),

        ...instituteData
    };

    // --------------------------------------------------------
    // CHECK INSTITUTE STATUS
    // --------------------------------------------------------

    if (
        institute.status ===
        "INACTIVE"
    ) {
        return {
            valid: false,
            reason: "INACTIVE",
            institute
        };
    }

    if (
        institute.status ===
        "SUSPENDED"
    ) {
        return {
            valid: false,
            reason: "SUSPENDED",
            institute
        };
    }

    if (
        institute.status ===
        "ARCHIVED"
    ) {
        return {
            valid: false,
            reason: "ARCHIVED",
            institute
        };
    }

    if (
        institute.status ===
        "MAINTENANCE"
    ) {
        return {
            valid: false,
            reason: "MAINTENANCE",
            institute
        };
    }

    return {
        valid: true,
        reason: "VALID",
        institute
    };
}

// ============================================================
// HANDLE VALIDATION
// ============================================================

async function handleGatewaySubmit(event) {

    event.preventDefault();

    if (gatewayBusy) {
        return;
    }

    const code =
        normalizeInstituteCode(
            instituteCodeInput?.value
        );

    clearGatewayMessage();

    // --------------------------------------------------------
    // BASIC VALIDATION
    // --------------------------------------------------------

    if (!code) {

        showError(
            "Please enter your Institute Code."
        );

        instituteCodeInput?.focus();

        return;
    }

    if (code.length < 3) {

        showError(
            "Please enter a valid Institute Code."
        );

        instituteCodeInput?.focus();

        return;
    }

    // --------------------------------------------------------
    // LOADING
    // --------------------------------------------------------

    gatewayBusy = true;

    if (gatewayContinueBtn) {

        gatewayContinueBtn.disabled =
            true;

        gatewayContinueBtn.textContent =
            "Validating...";
    }

    try {

        const result =
            await validateInstitute(
                code
            );

        // ----------------------------------------------------
        // INVALID CODE
        // ----------------------------------------------------

        if (
            !result.valid &&
            result.reason ===
            "INVALID_CODE"
        ) {

            showError(
                "Invalid Institute Code. Please check the code and try again."
            );

            return;
        }

        // ----------------------------------------------------
        // INACTIVE
        // ----------------------------------------------------

        if (
            !result.valid &&
            result.reason ===
            "INACTIVE"
        ) {

            showError(
                "This institute is currently unavailable. Please contact your administrator."
            );

            return;
        }

        // ----------------------------------------------------
        // SUSPENDED
        // ----------------------------------------------------

        if (
            !result.valid &&
            result.reason ===
            "SUSPENDED"
        ) {

            showError(
                "This institute has been suspended. Please contact your administrator."
            );

            return;
        }

        // ----------------------------------------------------
        // ARCHIVED
        // ----------------------------------------------------

        if (
            !result.valid &&
            result.reason ===
            "ARCHIVED"
        ) {

            showError(
                "This institute is no longer available."
            );

            return;
        }

        // ----------------------------------------------------
        // MAINTENANCE
        // ----------------------------------------------------

        if (
            !result.valid &&
            result.reason ===
            "MAINTENANCE"
        ) {

            showError(
                "The examination portal is temporarily under maintenance."
            );

            return;
        }

        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        if (
            result.valid &&
            result.institute
        ) {

            activeInstitute =
                result.institute;

            // ------------------------------------------------
            // SESSION CONTEXT
            // ------------------------------------------------
            // This is only a routing/UI context.
            // It is NOT used as an authorization mechanism.

            try {

                sessionStorage.setItem(
                    "activeInstitute",
                    JSON.stringify(
                        {
                            instituteId:
                                activeInstitute.instituteId,

                            instituteCode:
                                activeInstitute.instituteCode,

                            instituteName:
                                activeInstitute.instituteName
                        }
                    )
                );

            } catch (storageError) {

                console.warn(
                    "Institute session storage unavailable:",
                    storageError
                );
            }

            // ------------------------------------------------
            // GLOBAL UI CONTEXT
            // ------------------------------------------------

            window.activeInstitute =
                activeInstitute;

            // ------------------------------------------------
            // PREVIEW
            // ------------------------------------------------

            showSuccess(
                activeInstitute
            );

            // ------------------------------------------------
            // SMALL TRANSITION
            // ------------------------------------------------

            setTimeout(
                () => {

                    showCandidateLogin();

                },
                500
            );
        }

    } catch (error) {

        console.error(
            "Institute Gateway Error:",
            error
        );

        showError(
            "Unable to verify the Institute Code right now. Please check your internet connection and try again."
        );

    } finally {

        gatewayBusy = false;

        if (gatewayContinueBtn) {

            gatewayContinueBtn.disabled =
                false;

            gatewayContinueBtn.textContent =
                "Continue";
        }
    }
}

// ============================================================
// INPUT FORMAT
// ============================================================

if (instituteCodeInput) {

    instituteCodeInput.addEventListener(
        "input",
        () => {

            const normalized =
                normalizeInstituteCode(
                    instituteCodeInput.value
                );

            instituteCodeInput.value =
                normalized;

            clearGatewayMessage();
        }
    );

    instituteCodeInput.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                gatewayForm?.requestSubmit();
            }
        }
    );
}

// ============================================================
// FORM
// ============================================================

if (gatewayForm) {

    gatewayForm.addEventListener(
        "submit",
        handleGatewaySubmit
    );
}

// ============================================================
// INITIALIZE
// ============================================================

function initializeGateway() {

    showGateway();

    if (instituteCodeInput) {
        instituteCodeInput.focus();
    }

    console.log(
        "Institute Code Gateway initialized."
    );
}

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeGateway
    );

} else {

    initializeGateway();
}
