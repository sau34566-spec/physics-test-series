// ============================================================
// INSTITUTE CODE GATEWAY
// STEP 3 - FIXED VERSION
// ============================================================
//
// Purpose:
// 1. Institute Code screen is ALWAYS the first screen.
// 2. Student.js cannot replace it with login screen.
// 3. Candidate can type normally in Institute Code box.
// 4. Code is checked from Firestore.
// 5. ACTIVE institute allows candidate login.
// ============================================================


import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    db
} from "./firebase-config.js";


// ============================================================
// DOM HELPER
// ============================================================

const $ = (id) =>
    document.getElementById(id);


// ============================================================
// DOM REFERENCES
// ============================================================

const gatewayScreen =
    $("instituteGatewayScreen");

const loginScreen =
    $("loginScreen");

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


// ============================================================
// STATE
// ============================================================

let gatewayBusy = false;

let activeInstitute = null;


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
// SHOW GATEWAY
// ============================================================

function forceGatewayScreen() {

    if (!gatewayScreen) {
        return;
    }


    // Remove active from every screen first.
    document
        .querySelectorAll(".screen")
        .forEach((screen) => {

            screen.classList.remove(
                "active"
            );

        });


    // Gateway must be active.
    gatewayScreen.classList.add(
        "active"
    );

}


// ============================================================
// SHOW CANDIDATE LOGIN
// ============================================================

function showCandidateLogin() {

    if (gatewayScreen) {

        gatewayScreen.classList.remove(
            "active"
        );

    }


    if (loginScreen) {

        document
            .querySelectorAll(".screen")
            .forEach((screen) => {

                screen.classList.remove(
                    "active"
                );

            });


        loginScreen.classList.add(
            "active"
        );

    }

}


// ============================================================
// CLEAR MESSAGES
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

function showGatewayError(message) {

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
// SHOW SUCCESS
// ============================================================

function showInstituteSuccess(
    institute
) {

    if (!institutePreview) {
        return;
    }


    if (institutePreviewName) {

        institutePreviewName.textContent =
            institute.instituteName ||
            "Institute";

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
// FIND INSTITUTE
// ============================================================

async function findInstitute(
    instituteCode
) {

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
                instituteCode
            )
        );


    const snapshot =
        await getDocs(
            instituteQuery
        );


    // --------------------------------------------------------
    // CODE NOT FOUND
    // --------------------------------------------------------

    if (snapshot.empty) {

        return {

            valid: false,

            reason:
                "INVALID_CODE"

        };

    }


    // --------------------------------------------------------
    // GET FIRST DOCUMENT
    // --------------------------------------------------------

    const instituteDoc =
        snapshot.docs[0];

    const data =
        instituteDoc.data();


    const institute = {

        instituteId:
            data.instituteId ||
            instituteDoc.id,

        instituteCode:
            data.instituteCode ||
            instituteCode,

        instituteName:
            data.instituteName ||
            "Institute",

        status:
            String(
                data.status ||
                "ACTIVE"
            ).toUpperCase(),

        ...data

    };


    // --------------------------------------------------------
    // STATUS CHECK
    // --------------------------------------------------------

    if (
        institute.status ===
        "ACTIVE"
    ) {

        return {

            valid: true,

            reason:
                "VALID",

            institute

        };

    }


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
        "MAINTENANCE"
    ) {

        return {

            valid: false,

            reason:
                "MAINTENANCE",

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


    // Unknown status
    return {

        valid: false,

        reason:
            "INACTIVE",

        institute

    };

}


// ============================================================
// SAVE ACTIVE INSTITUTE
// ============================================================

function saveInstituteSession(
    institute
) {

    activeInstitute =
        institute;


    // Global application context.
    window.activeInstitute =
        institute;


    window.__instituteGatewayPassed =
        true;


    // Session storage.
    try {

        sessionStorage.setItem(

            "activeInstitute",

            JSON.stringify({

                instituteId:
                    institute.instituteId,

                instituteCode:
                    institute.instituteCode,

                instituteName:
                    institute.instituteName,

                status:
                    institute.status

            })

        );

    } catch (error) {

        console.warn(
            "Session storage unavailable:",
            error
        );

    }

}


// ============================================================
// HANDLE GATEWAY SUBMIT
// ============================================================

async function handleGatewaySubmit(
    event
) {

    event.preventDefault();


    // Prevent double click.
    if (gatewayBusy) {
        return;
    }


    clearGatewayMessage();


    const code =
        normalizeInstituteCode(
            instituteCodeInput?.value
        );


    // --------------------------------------------------------
    // EMPTY CODE
    // --------------------------------------------------------

    if (!code) {

        showGatewayError(
            "Please enter your Institute Code."
        );


        instituteCodeInput?.focus();


        return;

    }


    // --------------------------------------------------------
    // MINIMUM LENGTH
    // --------------------------------------------------------

    if (code.length < 3) {

        showGatewayError(
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
        // FIRESTORE CHECK
        // ----------------------------------------------------

        const result =
            await findInstitute(
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

            showGatewayError(
                "Invalid Institute Code. Please check the code and try again."
            );


            instituteCodeInput?.focus();


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

            showGatewayError(
                "This institute is currently inactive."
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

            showGatewayError(
                "This institute has been suspended. Please contact the administrator."
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

            showGatewayError(
                "The examination portal is currently under maintenance."
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

            showGatewayError(
                "This institute is no longer available."
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

            saveInstituteSession(
                result.institute
            );


            showInstituteSuccess(
                result.institute
            );


            // ------------------------------------------------
            // Give UI a moment to show success.
            // ------------------------------------------------

            setTimeout(
                () => {

                    showCandidateLogin();

                },
                600
            );

        }

    } catch (error) {

        console.error(
            "Institute Gateway Error:",
            error
        );


        showGatewayError(
            "Unable to verify the Institute Code. Please check your internet connection and try again."
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

            const value =
                normalizeInstituteCode(
                    instituteCodeInput.value
                );


            instituteCodeInput.value =
                value;


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
// FORM SUBMIT
// ============================================================

if (gatewayForm) {

    gatewayForm.addEventListener(
        "submit",
        handleGatewaySubmit
    );

}


// ============================================================
// PROTECT GATEWAY FROM STUDENT.JS
// ============================================================
//
// student.js has its own initialization:
// showScreen(loginScreen)
//
// Therefore we continuously make sure that the Gateway
// remains the first screen until a valid Institute Code
// has been verified.
// ============================================================

function startGatewayProtection() {

    if (!gatewayScreen) {

        console.error(
            "Institute Gateway screen not found."
        );

        return;

    }


    // Initial state.
    window.__instituteGatewayPassed =
        false;


    // Force Gateway immediately.
    forceGatewayScreen();


    // --------------------------------------------------------
    // Mutation observer
    // --------------------------------------------------------

    const observer =
        new MutationObserver(
            () => {

                // If institute is NOT verified,
                // Gateway must remain active.

                if (
                    !window.__instituteGatewayPassed
                ) {

                    // Remove active from login.
                    if (loginScreen) {

                        loginScreen.classList.remove(
                            "active"
                        );

                    }


                    // Make Gateway active.
                    gatewayScreen.classList.add(
                        "active"
                    );

                }

            }
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


    // Save observer globally.
    window.__instituteGatewayObserver =
        observer;


    // --------------------------------------------------------
    // Focus input
    // --------------------------------------------------------

    setTimeout(
        () => {

            if (
                instituteCodeInput &&
                !window.__instituteGatewayPassed
            ) {

                instituteCodeInput.focus();

            }

        },
        100
    );


    console.log(
        "Institute Gateway protection initialized."
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
        startGatewayProtection,
        {
            once: true
        }
    );

} else {

    startGatewayProtection();

}


// ============================================================
// DEBUG HELP
// ============================================================

window.getActiveInstitute =
    function () {

        return activeInstitute;

    };
