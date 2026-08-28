// ============================================================
// INSTITUTE CODE GATEWAY
// STEP 3 - STABLE VERSION
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

const $ = (id) => document.getElementById(id);


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
// NORMALIZE INSTITUTE CODE
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

function showGateway() {

    if (!gatewayScreen) {
        return;
    }

    gatewayScreen.classList.add("active");

    if (loginScreen) {
        loginScreen.classList.remove("active");
    }

}


// ============================================================
// SHOW CANDIDATE LOGIN
// ============================================================

function showCandidateLogin() {

    if (gatewayScreen) {
        gatewayScreen.classList.remove("active");
    }

    if (loginScreen) {
        loginScreen.classList.add("active");
    }

}


// ============================================================
// CLEAR MESSAGE
// ============================================================

function clearGatewayMessage() {

    if (gatewayMessage) {

        gatewayMessage.textContent = "";

        gatewayMessage.className =
            "gateway-message";

    }


    if (gatewayError) {

        gatewayError.textContent = "";

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
// FIND INSTITUTE IN FIRESTORE
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
    // FIRST MATCH
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
    // STATUS
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


    return {

        valid: false,

        reason:
            "INACTIVE",

        institute

    };

}


// ============================================================
// SAVE INSTITUTE SESSION
// ============================================================

function saveInstituteSession(
    institute
) {

    activeInstitute =
        institute;


    window.activeInstitute =
        institute;


    window.__instituteGatewayPassed =
        true;


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
// SUBMIT INSTITUTE CODE
// ============================================================

async function handleGatewaySubmit(
    event
) {

    event.preventDefault();


    if (gatewayBusy) {
        return;
    }


    clearGatewayMessage();


    const code =
        normalizeInstituteCode(
            instituteCodeInput?.value
        );


    // --------------------------------------------------------
    // EMPTY
    // --------------------------------------------------------

    if (!code) {

        showGatewayError(
            "Please enter your Institute Code."
        );

        if (instituteCodeInput) {
            instituteCodeInput.focus();
        }

        return;

    }


    // --------------------------------------------------------
    // LENGTH
    // --------------------------------------------------------

    if (code.length < 3) {

        showGatewayError(
            "Please enter a valid Institute Code."
        );

        if (instituteCodeInput) {
            instituteCodeInput.focus();
        }

        return;

    }


    gatewayBusy = true;


    if (gatewayContinueBtn) {

        gatewayContinueBtn.disabled =
            true;

        gatewayContinueBtn.textContent =
            "Validating...";

    }


    try {

        // ----------------------------------------------------
        // FIRESTORE
        // ----------------------------------------------------

        const result =
            await findInstitute(
                code
            );


        // ----------------------------------------------------
        // INVALID
        // ----------------------------------------------------

        if (
            !result.valid &&
            result.reason ===
            "INVALID_CODE"
        ) {

            showGatewayError(
                "Invalid Institute Code. Please check the code and try again."
            );

            if (instituteCodeInput) {
                instituteCodeInput.focus();
            }

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
// INPUT
// ============================================================

if (instituteCodeInput) {

    instituteCodeInput.addEventListener(
        "input",
        () => {

            instituteCodeInput.value =
                normalizeInstituteCode(
                    instituteCodeInput.value
                );

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
//
// IMPORTANT:
// No MutationObserver is used here.
//
// student.js runs its own initialization and may initially
// show loginScreen. We simply wait until the page is ready,
// then show the Gateway once.
//
// This avoids the infinite class-change loop that caused
// "Page Unresponsive".
// ============================================================

function initializeGateway() {

    if (!gatewayScreen) {

        console.error(
            "Institute Gateway screen not found."
        );

        return;

    }


    window.__instituteGatewayPassed =
        false;


    // --------------------------------------------------------
    // Show gateway after all modules have initialized.
    // --------------------------------------------------------

    setTimeout(
        () => {

            if (
                !window.__instituteGatewayPassed
            ) {

                showGateway();

            }

        },
        50
    );


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
        150
    );


    console.log(
        "Institute Gateway initialized successfully."
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
        initializeGateway,
        {
            once: true
        }
    );

} else {

    initializeGateway();

}


// ============================================================
// DEBUG
// ============================================================

window.getActiveInstitute =
    function () {

        return activeInstitute;

    };
