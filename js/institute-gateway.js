// ============================================================
// INSTITUTE CODE GATEWAY
// STEP 4 - STABLE FIRESTORE VERSION
// ============================================================

import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc
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
// CLEAR GATEWAY MESSAGES
// ============================================================

function clearGatewayMessage() {

    if (gatewayMessage) {

        gatewayMessage.textContent = "";

        gatewayMessage.className =
            "gateway-message";

    }


    if (gatewayError) {

        gatewayError.textContent = "";

        gatewayError.classList.remove("show");

    }


    if (institutePreview) {

        institutePreview.classList.remove("show");

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

        gatewayError.classList.add("show");

    }

}


// ============================================================
// SHOW SUCCESS
// ============================================================

function showInstituteSuccess(institute) {

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


    institutePreview.classList.add("show");

}


// ============================================================
// FIND ACTIVE INSTITUTE
// ============================================================

async function findInstitute(instituteCode) {

    const institutesRef =
        collection(
            db,
            "institutes"
        );


    /*
     * IMPORTANT:
     *
     * Firestore Rules allow public reads only when:
     *
     * resource.data.status == "ACTIVE"
     *
     * Therefore the query MUST also request:
     *
     * status == "ACTIVE"
     *
     * Otherwise Firestore cannot authorize the query
     * as a whole.
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


    // ========================================================
    // NO MATCH
    // ========================================================

    if (snapshot.empty) {

        return {

            valid: false,

            reason:
                "INVALID_CODE"

        };

    }


    // ========================================================
    // GET FIRST MATCH
    // ========================================================

    const instituteDoc =
        snapshot.docs[0];

    const data =
        instituteDoc.data();


    const institute = {

        ...data,

        // The Firestore document ID is the canonical tenant identifier.
        // Older records stored the public institute code in data.instituteId,
        // which prevented Candidate queries from matching Admin-created exams.
        instituteId:
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
            ).toUpperCase()

    };


    // ========================================================
    // FINAL SAFETY CHECK
    // ========================================================

    if (
        institute.status !==
        "ACTIVE"
    ) {

        return {

            valid: false,

            reason:
                "INACTIVE",

            institute

        };

    }


    // ========================================================
    // VALID
    // ========================================================

    return {

        valid: true,

        reason:
            "VALID",

        institute

    };

}


// ============================================================
// SAVE ACTIVE INSTITUTE
// ============================================================

function saveInstituteSession(institute) {

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


async function applyPublishedPortalConfig(institute) {
    try {
        const snapshot = await getDoc(
            doc(db, "portalConfigs", institute.instituteId)
        );
        if (!snapshot.exists() || snapshot.data().status !== "PUBLISHED") return;

        const content = snapshot.data().content || {};
        const title = content.pageTitle || institute.instituteName || "Online Examination";
        const subtitle = content.subtitle || "Secure Student Examination Portal";

        document.title = title;
        document.querySelectorAll(".gateway-brand h1, #loginScreen .brand h1")
            .forEach(element => { element.textContent = title; });
        document.querySelectorAll("#loginScreen .brand p")
            .forEach(element => { element.textContent = subtitle; });

        const loginButton = $("loginBtn");
        if (loginButton && content.buttonText) loginButton.textContent = content.buttonText;

        if (content.accentColor) {
            document.documentElement.style.setProperty("--primary-color", content.accentColor);
            document.documentElement.style.setProperty("--accent-color", content.accentColor);
        }
        if (content.backgroundUrl) {
            document.querySelectorAll(".background-overlay, .gateway-background")
                .forEach(element => {
                    element.style.backgroundImage = `url("${String(content.backgroundUrl).replaceAll('"', '')}")`;
                });
        }
    } catch (error) {
        console.warn("Published portal configuration unavailable:", error);
    }
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


    clearGatewayMessage();


    // --------------------------------------------------------
    // GET CODE
    // --------------------------------------------------------

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

        const emergencySnapshot = await getDoc(
            doc(db, "globalSettings", "emergency")
        );

        if (emergencySnapshot.exists()) {
            const emergency = emergencySnapshot.data();
            if (emergency.maintenanceMode) {
                showGatewayError(
                    emergency.maintenanceReason ||
                    "The examination portal is temporarily under maintenance."
                );
                return;
            }
            if (emergency.candidateLoginDisabled) {
                showGatewayError(
                    emergency.candidateLoginDisabledReason ||
                    "Candidate login is temporarily disabled."
                );
                return;
            }
        }

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
        // SUCCESS
        // ----------------------------------------------------

        if (
            result.valid &&
            result.institute
        ) {

            await applyPublishedPortalConfig(
                result.institute
            );

            saveInstituteSession(
                result.institute
            );


            showInstituteSuccess(
                result.institute
            );


            // ------------------------------------------------
            // Move to Candidate Login
            // ------------------------------------------------

            setTimeout(
                () => {

                    showCandidateLogin();

                },
                700
            );

        }


    } catch (error) {

        console.error(
            "Institute Gateway Error:",
            error
        );


        /*
         * Keep the real error in browser console.
         * Student gets a simple message.
         */

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
// FORM SUBMIT
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
//
// IMPORTANT:
//
// No MutationObserver is used.
//
// The previous version continuously observed class changes
// and then changed those same classes again. That caused
// an infinite loop and "Page Unresponsive".
//
// This version does NOT use MutationObserver.
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
    // Show Gateway
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
// DEBUG HELPER
// ============================================================

window.getActiveInstitute =
    function () {

        return activeInstitute;

    };
