// ============================================================
// INSTITUTE CODE GATEWAY
// STEP 3
// ============================================================
//
// Purpose:
// 1. Candidate enters Institute Code
// 2. Code is checked against Firestore
// 3. Institute status is checked
// 4. Valid institute is stored as active candidate context
// 5. Existing student login is unlocked
//
// IMPORTANT:
// This gateway is a ROUTING layer.
// It is NOT the final authorization/security layer.
// Firestore Security Rules will be handled in a later step.
// ============================================================


import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

import {
    db
} from "./firebase-config.js";


// ============================================================
// DOM HELPERS
// ============================================================

const $ = (id) => {
    return document.getElementById(id);
};


// ============================================================
// DOM REFERENCES
// ============================================================

const gatewayScreen =
    $("instituteGatewayScreen");

const gatewayForm =
    $("instituteGatewayForm");

const instituteCodeInput =
    $("instituteCode");

const gatewayContinueBtn =
    $("instituteGatewayContinueBtn");

const gatewayMessage =
    $("gatewayMessage");

const gatewayError =
    $("gatewayError");

const institutePreview =
    $("institutePreview");

const institutePreviewName =
    $("institutePreviewName");

const institutePreviewMessage =
    $("institutePreviewMessage");

const loginScreen =
    $("loginScreen");


// ============================================================
// STATE
// ============================================================

let activeInstitute = null;

let gatewayBusy = false;


// ============================================================
// NORMALIZE INSTITUTE CODE
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

    return String(value ?? "")
        .trim();

}


// ============================================================
// SHOW GATEWAY
// ============================================================

function showGateway() {

    if (gatewayScreen) {

        gatewayScreen.classList.add(
            "active"
        );

    }


    if (loginScreen) {

        loginScreen.classList.remove(
            "active"
        );

    }

}


// ============================================================
// SHOW EXISTING CANDIDATE LOGIN
// ============================================================

function showCandidateLogin() {

    if (gatewayScreen) {

        gatewayScreen.classList.remove(
            "active"
        );

    }


    if (loginScreen) {

        loginScreen.classList.add(
            "active"
        );

    }

}


// ============================================================
// CLEAR MESSAGE
// ============================================================

function clearGatewayMessage() {

    if (gatewayMessage) {

        gatewayMessage.textContent =
            "";

        gatewayMessage.className =
            "gateway-message";

    }


    if (gatewayError) {

        gatewayError.textContent =
            "";

        gatewayError.classList.remove(
            "show"
        );

    }


    if (institutePreview) {

        institutePreview.classList.remove(
            "show"
        );

    }

}


// ============================================================
// SHOW ERROR
// ============================================================

function showError(message) {

    if (gatewayMessage) {

        gatewayMessage.textContent =
            message;

        gatewayMessage.className =
            "gateway-message gateway-error-message";

    }


    if (gatewayError) {

        gatewayError.textContent =
            message;

        gatewayError.classList.add(
            "show"
        );

    }

}


// ============================================================
// SHOW SUCCESS PREVIEW
// ============================================================

function showSuccess(institute) {

    if (!institutePreview) {
        return;
    }


    if (institutePreviewName) {

        institutePreviewName.textContent =
            safeText(
                institute.instituteName
            ) || "Institute";

    }


    if (institutePreviewMessage) {

        institutePreviewMessage.textContent =
            "Institute verified successfully.";

    }


    institutePreview.classList.add(
        "show"
    );

}


// ============================================================
// FIND INSTITUTE BY CODE
// ============================================================

async function validateInstitute(code) {

    const institutesRef =
        collection(
            db,
            "institutes"
        );


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


    // --------------------------------------------------------
    // NO MATCH
    // --------------------------------------------------------

    if (snapshot.empty) {

        return {

            valid: false,

            reason:
                "INVALID_CODE"

        };

    }


    // --------------------------------------------------------
    // USE FIRST MATCH
    // --------------------------------------------------------

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
    // STATUS CHECK
    // --------------------------------------------------------

    if (
        institute.status ===
        "INACTIVE"
    ) {

        return {

            valid: false,

            reason:
                "INACTIVE",

            institute

        };

    }


    if (
        institute.status ===
        "SUSPENDED"
    ) {

        return {

            valid: false,

            reason:
                "SUSPENDED",

            institute

        };

    }


    if (
        institute.status ===
        "ARCHIVED"
    ) {

        return {

            valid: false,

            reason:
                "ARCHIVED",

            institute

        };

    }


    if (
        institute.status ===
        "MAINTENANCE"
    ) {

        return {

            valid: false,

            reason:
                "MAINTENANCE",

            institute

        };

    }


    // --------------------------------------------------------
    // VALID
    // --------------------------------------------------------

    return {

        valid: true,

        reason:
            "VALID",

        institute

    };

}


// ============================================================
// HANDLE GATEWAY SUBMIT
// ============================================================

async function handleGatewaySubmit(event) {

    event.preventDefault();


    // --------------------------------------------------------
    // PREVENT DOUBLE CLICK
    // --------------------------------------------------------

    if (gatewayBusy) {

        return;

    }


    // --------------------------------------------------------
    // READ CODE
    // --------------------------------------------------------

    const code =
        normalizeInstituteCode(
            instituteCodeInput?.value
        );


    clearGatewayMessage();


    // --------------------------------------------------------
    // EMPTY CODE
    // --------------------------------------------------------

    if (!code) {

        showError(
            "Please enter your Institute Code."
        );


        instituteCodeInput?.focus();


        return;

    }


    // --------------------------------------------------------
    // BASIC LENGTH CHECK
    // --------------------------------------------------------

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

    gatewayBusy =
        true;


    if (gatewayContinueBtn) {

        gatewayContinueBtn.disabled =
            true;

        gatewayContinueBtn.textContent =
            "Validating...";

    }


    try {

        // ----------------------------------------------------
        // FIRESTORE VALIDATION
        // ----------------------------------------------------

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
            //
            // This is only routing/UI context.
            // It is NOT authorization.
            // ------------------------------------------------

            try {

                sessionStorage.setItem(

                    "activeInstitute",

                    JSON.stringify({

                        instituteId:
                            activeInstitute.instituteId,

                        instituteCode:
                            activeInstitute.instituteCode,

                        instituteName:
                            activeInstitute.instituteName

                    })

                );

            } catch (storageError) {

                console.warn(
                    "Institute session storage unavailable:",
                    storageError
                );

            }


            // ------------------------------------------------
            // GLOBAL CONTEXT
            // ------------------------------------------------

            window.activeInstitute =
                activeInstitute;


            // ------------------------------------------------
            // GATEWAY PASSED
            // ------------------------------------------------

            window.__instituteGatewayPassed =
                true;


            // ------------------------------------------------
            // STOP LOGIN PROTECTION OBSERVER
            // ------------------------------------------------

            if (
                window.__instituteGatewayObserver
            ) {

                window
                    .__instituteGatewayObserver
                    .disconnect();

                window.__instituteGatewayObserver =
                    null;

            }


            // ------------------------------------------------
            // SHOW VERIFIED INSTITUTE
            // ------------------------------------------------

            showSuccess(
                activeInstitute
            );


            // ------------------------------------------------
            // MOVE TO EXISTING LOGIN
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

        gatewayBusy =
            false;


        if (gatewayContinueBtn) {

            gatewayContinueBtn.disabled =
                false;

            gatewayContinueBtn.textContent =
                "Continue";

        }

    }

}


// ============================================================
// INPUT HANDLING
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


                if (gatewayForm) {

                    gatewayForm.requestSubmit();

                }

            }

        }
    );

}


// ============================================================
// FORM HANDLER
// ============================================================

if (gatewayForm) {

    gatewayForm.addEventListener(
        "submit",
        handleGatewaySubmit
    );

}


// ============================================================
// INITIALIZE GATEWAY
// ============================================================

function initializeGateway() {

    // --------------------------------------------------------
    // Gateway is the first candidate entry point.
    // --------------------------------------------------------

    window.__instituteGatewayPassed =
        false;


    // --------------------------------------------------------
    // Show gateway.
    // --------------------------------------------------------

    showGateway();


    // --------------------------------------------------------
    // Protect gateway from existing student.js
    //
    // student.js currently initializes the candidate login.
    // This observer prevents that login from becoming the
    // first visible screen.
    // --------------------------------------------------------

    const protectLoginScreen =
        () => {

            if (
                !window.__instituteGatewayPassed &&
                loginScreen
            ) {

                loginScreen.classList.remove(
                    "active"
                );

            }

        };


    // Run immediately.

    protectLoginScreen();


    // --------------------------------------------------------
    // Watch for student.js changing screen classes.
    // --------------------------------------------------------

    const observer =
        new MutationObserver(
            protectLoginScreen
        );


    observer.observe(
        document.body,
        {

            subtree: true,

            attributes: true,

            attributeFilter: [
                "class"
            ]

        }
    );


    window.__instituteGatewayObserver =
        observer;


    // --------------------------------------------------------
    // Focus input.
    // --------------------------------------------------------

    if (instituteCodeInput) {

        instituteCodeInput.focus();

    }


    console.log(
        "Institute Code Gateway initialized."
    );

}


// ============================================================
// DOM READY
// ============================================================

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
