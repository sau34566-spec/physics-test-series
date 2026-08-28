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
// SHOW LOGIN
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
// ERROR
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
// SUCCESS PREVIEW
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
// FIND ACTIVE INSTITUTE
// ============================================================

async function findInstitute(
    instituteCode
) {

    const institutesRef =
        collection(
            db,
            "institutes"
        );


    /*
     * IMPORTANT:
     *
     * We query ONLY ACTIVE institutes.
     *
     * This matches the Firestore Security Rule:
     *
     * resource.data.status == "ACTIVE"
     *
     * Therefore Firestore can safely authorize this query.
     */

    const instituteQuery =
        query(

            institutesRef,

            where(
                "instituteCode",
                "==",
                instituteCode
            ),

            where(
                "status",
                "==",
                "ACTIVE"
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


    return {

        valid: true,

        reason:
            "VALID",

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
// HANDLE SUBMIT
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


    gatewayBusy = true;


    if (gatewayContinueBtn) {

        gatewayContinueBtn.disabled =
            true;

        gatewayContinueBtn.textContent =
            "Validating...";

    }


    try {

        const result =
            await findInstitute(
                code
            );


        // ----------------------------------------------------
        // INVALID
        // ----------------------------------------------------

        if (
            !result.valid
        ) {

            showGatewayError(
                "Invalid Institute Code. Please check the code and try again."
            );

            instituteCodeInput?.focus();

            return;

        }


        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

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
// INPUT HANDLING
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

                gatewayForm?.requestSubmit();

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
// INITIALIZE
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
