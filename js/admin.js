 // ============================================================
// ADMIN PORTAL - COMPLETE ADMIN.JS
// ============================================================

import { auth, db } from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ============================================================
// DOM ELEMENTS
// ============================================================

const adminLoginScreen =
    document.getElementById("adminLoginScreen");

const adminDashboard =
    document.getElementById("adminDashboard");

const adminLoginForm =
    document.getElementById("adminLoginForm");

const adminEmail =
    document.getElementById("adminEmail");

const adminPassword =
    document.getElementById("adminPassword");

const adminLoginBtn =
    document.getElementById("adminLoginBtn");

const adminLoginMessage =
    document.getElementById("adminLoginMessage");

const logoutBtn =
    document.getElementById("logoutBtn");

const adminName =
    document.getElementById("adminName");

const adminPageTitle =
    document.getElementById("adminPageTitle");


// ============================================================
// SCREEN CONTROL
// ============================================================

function showLoginScreen() {

    if (adminLoginScreen) {

        adminLoginScreen.classList.add("active");
        adminLoginScreen.style.display = "block";

    }

    if (adminDashboard) {

        adminDashboard.classList.remove("active");
        adminDashboard.style.display = "none";

    }

}


function showDashboard() {

    if (adminLoginScreen) {

        adminLoginScreen.classList.remove("active");
        adminLoginScreen.style.display = "none";

    }

    if (adminDashboard) {

        adminDashboard.classList.add("active");
        adminDashboard.style.display = "flex";

    }

}


// ============================================================
// LOGIN MESSAGE
// ============================================================

function showLoginMessage(
    message,
    type = "error"
) {

    if (!adminLoginMessage) return;

    adminLoginMessage.textContent = message;

    adminLoginMessage.style.display = "block";

    adminLoginMessage.className =
        "admin-login-message " + type;

}


// ============================================================
// EXAM SETTINGS MESSAGE
// ============================================================

function showExamSettingsMessage(
    message,
    type = "success"
) {

    const messageElement =
        document.getElementById(
            "examSettingsMessage"
        );

    if (!messageElement) return;

    messageElement.textContent = message;

    messageElement.style.display = "block";

    messageElement.className =
        "settings-message " + type;

}


// ============================================================
// CHECK AUTHORIZED ADMIN
// ============================================================

async function checkAuthorizedAdmin(user) {

    if (!user) {

        return null;

    }


    try {

        const adminRef =
            doc(
                db,
                "admins",
                user.uid
            );


        const adminSnapshot =
            await getDoc(adminRef);


        if (!adminSnapshot.exists()) {

            console.error(
                "Admin document does not exist."
            );

            return null;

        }


        const adminData =
            adminSnapshot.data();


        // --------------------------------------------
        // ACTIVE CHECK
        // --------------------------------------------

        if (
            adminData.active !== true
        ) {

            console.error(
                "Admin account is inactive."
            );

            return null;

        }


        // --------------------------------------------
        // EMAIL CHECK
        // --------------------------------------------

        if (
            adminData.email &&
            user.email &&
            adminData.email.toLowerCase() !==
            user.email.toLowerCase()
        ) {

            console.error(
                "Admin email does not match."
            );

            return null;

        }


        return adminData;

    } catch (error) {

        console.error(
            "Admin authorization error:",
            error
        );

        throw error;

    }

}


// ============================================================
// DISPLAY ADMIN INFORMATION
// ============================================================

function displayAdminInformation(
    adminData,
    user
) {

    if (!adminName) return;


    if (
        adminData &&
        adminData.name
    ) {

        adminName.textContent =
            adminData.name;

        return;

    }


    if (
        user &&
        user.email
    ) {

        adminName.textContent =
            user.email;

        return;

    }


    adminName.textContent =
        "Administrator";

}


// ============================================================
// ADMIN LOGIN
// ============================================================

if (adminLoginForm) {

    adminLoginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const email =
                adminEmail
                    ? adminEmail.value.trim().toLowerCase()
                    : "";

            const password =
                adminPassword
                    ? adminPassword.value
                    : "";


            // ----------------------------------------
            // VALIDATION
            // ----------------------------------------

            if (!email) {

                showLoginMessage(
                    "Please enter your administrator email."
                );

                return;

            }


            if (!password) {

                showLoginMessage(
                    "Please enter your administrator password."
                );

                return;

            }


            try {

                if (adminLoginBtn) {

                    adminLoginBtn.disabled = true;

                    adminLoginBtn.textContent =
                        "Signing in...";

                }


                if (adminLoginMessage) {

                    adminLoginMessage.style.display =
                        "none";

                }


                // ----------------------------------------
                // FIREBASE AUTHENTICATION
                // ----------------------------------------

                const credential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );


                const user =
                    credential.user;


                console.log(
                    "Firebase login successful:",
                    user.email
                );


                // ----------------------------------------
                // AUTHORIZED ADMIN CHECK
                // ----------------------------------------

                const adminData =
                    await checkAuthorizedAdmin(
                        user
                    );


                if (!adminData) {

                    await signOut(auth);


                    showLoginMessage(
                        "This account is not authorized to access the Admin Panel."
                    );


                    return;

                }


                // ----------------------------------------
                // LOGIN SUCCESS
                // ----------------------------------------

                displayAdminInformation(
                    adminData,
                    user
                );


                showDashboard();


                // Load Firestore settings
                await loadExamSettings();


            } catch (error) {

                console.error(
                    "Admin login error:",
                    error
                );


                let message =
                    "Unable to sign in. Please try again.";


                switch (error.code) {

                    case "auth/invalid-credential":

                        message =
                            "Incorrect email or password.";

                        break;


                    case "auth/user-not-found":

                        message =
                            "No administrator account was found with this email.";

                        break;


                    case "auth/wrong-password":

                        message =
                            "Incorrect administrator password.";

                        break;


                    case "auth/invalid-email":

                        message =
                            "Please enter a valid email address.";

                        break;


                    case "auth/too-many-requests":

                        message =
                            "Too many login attempts. Please try again later.";

                        break;


                    case "permission-denied":

                        message =
                            "Firebase permission denied. Please check Firestore Security Rules.";

                        break;


                    default:

                        if (
                            error.message &&
                            error.message.toLowerCase()
                                .includes("permission")
                        ) {

                            message =
                                "Firebase permission denied. Please check Firestore Security Rules.";

                        }

                        break;

                }


                showLoginMessage(
                    message
                );


            } finally {

                if (adminLoginBtn) {

                    adminLoginBtn.disabled = false;

                    adminLoginBtn.textContent =
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
        async function () {

            try {

                await signOut(auth);

                showLoginScreen();


                if (adminEmail) {

                    adminEmail.value = "";

                }


                if (adminPassword) {

                    adminPassword.value = "";

                }


                console.log(
                    "Admin logged out."
                );


            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

            }

        }
    );

}


// ============================================================
// SIDEBAR NAVIGATION
// ============================================================

const navigationItems =
    document.querySelectorAll(
        ".admin-nav-item"
    );


const adminSections =
    document.querySelectorAll(
        ".admin-section"
    );


navigationItems.forEach(
    function (navItem) {

        navItem.addEventListener(
            "click",
            function () {

                const sectionId =
                    navItem.dataset.section;


                if (!sectionId) return;


                // ----------------------------------------
                // REMOVE ACTIVE FROM ALL NAV ITEMS
                // ----------------------------------------

                navigationItems.forEach(
                    function (item) {

                        item.classList.remove(
                            "active"
                        );

                    }
                );


                // ----------------------------------------
                // ADD ACTIVE TO CURRENT NAV ITEM
                // ----------------------------------------

                navItem.classList.add(
                    "active"
                );


                // ----------------------------------------
                // HIDE ALL SECTIONS
                // ----------------------------------------

                adminSections.forEach(
                    function (section) {

                        section.classList.remove(
                            "active"
                        );

                        section.style.display =
                            "none";

                    }
                );


                // ----------------------------------------
                // SHOW SELECTED SECTION
                // ----------------------------------------

                const selectedSection =
                    document.getElementById(
                        sectionId
                    );


                if (selectedSection) {

                    selectedSection.classList.add(
                        "active"
                    );

                    selectedSection.style.display =
                        "block";

                }


                // ----------------------------------------
                // PAGE TITLE
                // ----------------------------------------

                updatePageTitle(
                    sectionId
                );


                // ----------------------------------------
                // LOAD SETTINGS WHEN OPENING
                // ----------------------------------------

                if (
                    sectionId ===
                    "examSettingsSection"
                ) {

                    loadExamSettings();

                }

            }
        );

    }
);


// ============================================================
// PAGE TITLE
// ============================================================

function updatePageTitle(
    sectionId
) {

    if (!adminPageTitle) return;


    const titles = {

        dashboardSection:
            "Dashboard",

        examSettingsSection:
            "Exam Settings",

        questionManagerSection:
            "Question Manager",

        studentsSection:
            "Students",

        resultsSection:
            "Results",

        feedbackSection:
            "Feedback",

        securitySection:
            "Security Logs",

        authorizedAdminsSection:
            "Authorized Administrators"

    };


    adminPageTitle.textContent =
        titles[sectionId] ||
        "Dashboard";

}


// ============================================================
// EXAM SETTINGS - GET FORM DATA
// ============================================================

function getExamSettingsFromForm() {

    return {

        examTitle:
            document.getElementById(
                "examTitle"
            )?.value.trim() ||
            "Online Examination",


        totalQuestions:
            Number(
                document.getElementById(
                    "totalQuestions"
                )?.value || 0
            ),


        questionsToDisplay:
            Number(
                document.getElementById(
                    "questionsToDisplay"
                )?.value || 0
            ),


        durationMinutes:
            Number(
                document.getElementById(
                    "durationMinutes"
                )?.value || 0
            ),


        marksPerQuestion:
            Number(
                document.getElementById(
                    "marksPerQuestion"
                )?.value || 0
            ),


        negativeMarks:
            Number(
                document.getElementById(
                    "negativeMarks"
                )?.value || 0
            ),


        examStartTime:
            document.getElementById(
                "examStartTime"
            )?.value || "",


        examEndTime:
            document.getElementById(
                "examEndTime"
            )?.value || "",


        examStatus:
            document.getElementById(
                "examStatusSetting"
            )?.value ||
            "draft",


        questionSource:
            document.getElementById(
                "questionSource"
            )?.value ||
            "chapterq.json",


        randomQuestions:
            document.getElementById(
                "randomQuestions"
            )?.checked ||
            false,


        randomOptions:
            document.getElementById(
                "randomOptions"
            )?.checked ||
            false,


        tabSwitchPenalty:
            Number(
                document.getElementById(
                    "tabSwitchPenalty"
                )?.value || 0
            ),


        maxTabSwitches:
            Number(
                document.getElementById(
                    "maxTabSwitches"
                )?.value || 2
            ),


        disableCopy:
            document.getElementById(
                "disableCopy"
            )?.checked ||
            false,


        disablePaste:
            document.getElementById(
                "disablePaste"
            )?.checked ||
            false,


        disableScreenshot:
            document.getElementById(
                "disableScreenshot"
            )?.checked ||
            false,


        disableRefresh:
            document.getElementById(
                "disableRefresh"
            )?.checked ||
            false,


        disableFunctionKeys:
            document.getElementById(
                "disableFunctionKeys"
            )?.checked ||
            false,


        updatedAt:
            new Date().toISOString()

    };

}


// ============================================================
// EXAM SETTINGS - LOAD FROM FIRESTORE
// ============================================================

async function loadExamSettings() {

    try {

        const settingsRef =
            doc(
                db,
                "examSettings",
                "current"
            );


        const settingsSnapshot =
            await getDoc(
                settingsRef
            );


        // ----------------------------------------
        // DOCUMENT DOES NOT EXIST
        // ----------------------------------------

        if (
            !settingsSnapshot.exists()
        ) {

            console.log(
                "No examSettings/current document found."
            );


            // Keep HTML defaults.

            return;

        }


        const settings =
            settingsSnapshot.data();


        console.log(
            "Exam settings loaded:",
            settings
        );


        // ----------------------------------------
        // BASIC SETTINGS
        // ----------------------------------------

        setInputValue(
            "examTitle",
            settings.examTitle ||
            "Physics Test Series"
        );


        setInputValue(
            "totalQuestions",
            settings.totalQuestions ??
            100
        );


        setInputValue(
            "questionsToDisplay",
            settings.questionsToDisplay ??
            80
        );


        setInputValue(
            "durationMinutes",
            settings.durationMinutes ??
            60
        );


        setInputValue(
            "marksPerQuestion",
            settings.marksPerQuestion ??
            4
        );


        setInputValue(
            "negativeMarks",
            settings.negativeMarks ??
            1
        );


        // ----------------------------------------
        // TIMING
        // ----------------------------------------

        setInputValue(
            "examStartTime",
            settings.examStartTime ||
            ""
        );


        setInputValue(
            "examEndTime",
            settings.examEndTime ||
            ""
        );


        setInputValue(
            "examStatusSetting",
            settings.examStatus ||
            "draft"
        );


        // ----------------------------------------
        // QUESTION SETTINGS
        // ----------------------------------------

        setInputValue(
            "questionSource",
            settings.questionSource ||
            "chapterq.json"
        );


        setCheckboxValue(
            "randomQuestions",
            settings.randomQuestions !== false
        );


        setCheckboxValue(
            "randomOptions",
            settings.randomOptions !== false
        );


        // ----------------------------------------
        // SECURITY
        // ----------------------------------------

        setInputValue(
            "tabSwitchPenalty",
            settings.tabSwitchPenalty ??
            1
        );


        setInputValue(
            "maxTabSwitches",
            settings.maxTabSwitches ??
            2
        );


        setCheckboxValue(
            "disableCopy",
            settings.disableCopy !== false
        );


        setCheckboxValue(
            "disablePaste",
            settings.disablePaste !== false
        );


        setCheckboxValue(
            "disableScreenshot",
            settings.disableScreenshot !== false
        );


        setCheckboxValue(
            "disableRefresh",
            settings.disableRefresh !== false
        );


        setCheckboxValue(
            "disableFunctionKeys",
            settings.disableFunctionKeys !== false
        );


        // ----------------------------------------
        // UPDATE DASHBOARD
        // ----------------------------------------

        updateDashboardValues(
            settings
        );


    } catch (error) {

        console.error(
            "Error loading exam settings:",
            error
        );


        if (
            error.code ===
            "permission-denied"
        ) {

            showExamSettingsMessage(
                "Firebase permission denied. Check Firestore Rules.",
                "error"
            );

        }

    }

}


// ============================================================
// INPUT VALUE HELPER
// ============================================================

function setInputValue(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.value =
            value;

    }

}


// ============================================================
// CHECKBOX HELPER
// ============================================================

function setCheckboxValue(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.checked =
            Boolean(value);

    }

}


// ============================================================
// UPDATE DASHBOARD VALUES
// ============================================================

function updateDashboardValues(
    settings
) {

    setText(
        "dashboardExamTitle",
        settings.examTitle ||
        "Physics Test Series"
    );


    setText(
        "dashboardQuestionCount",
        settings.questionsToDisplay ??
        80
    );


    setText(
        "dashboardDuration",
        `${settings.durationMinutes ?? 60} Minutes`
    );


    setText(
        "dashboardExamDuration",
        settings.durationMinutes ??
        60
    );


    setText(
        "dashboardMarks",
        `+${settings.marksPerQuestion ?? 4}`
    );


    setText(
        "dashboardNegativeMarks",
        settings.negativeMarks ??
        1
    );


    setText(
        "totalQuestions",
        settings.totalQuestions ??
        100
    );


    setText(
        "displayQuestions",
        settings.questionsToDisplay ??
        80
    );


    const statusElement =
        document.getElementById(
            "dashboardExamStatus"
        );


    if (statusElement) {

        const status =
            settings.examStatus ||
            "draft";


        statusElement.textContent =
            status.toUpperCase();

    }

}


// ============================================================
// TEXT HELPER
// ============================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value;

    }

}


// ============================================================
// EXAM SETTINGS - SAVE
// ============================================================

const examSettingsForm =
    document.getElementById(
        "examSettingsForm"
    );


const saveExamSettingsBtn =
    document.getElementById(
        "saveExamSettingsBtn"
    );


if (examSettingsForm) {

    examSettingsForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            try {

                const settings =
                    getExamSettingsFromForm();


                // ----------------------------------------
                // VALIDATION
                // ----------------------------------------

                if (
                    settings.totalQuestions <= 0
                ) {

                    showExamSettingsMessage(
                        "Total question pool must be greater than 0.",
                        "error"
                    );

                    return;

                }


                if (
                    settings.questionsToDisplay <= 0
                ) {

                    showExamSettingsMessage(
                        "Questions shown must be greater than 0.",
                        "error"
                    );

                    return;

                }


                if (
                    settings.questionsToDisplay >
                    settings.totalQuestions
                ) {

                    showExamSettingsMessage(
                        "Questions shown cannot be greater than the total question pool.",
                        "error"
                    );

                    return;

                }


                if (
                    settings.durationMinutes <= 0
                ) {

                    showExamSettingsMessage(
                        "Test duration must be greater than 0.",
                        "error"
                    );

                    return;

                }


                if (
                    settings.marksPerQuestion < 0
                ) {

                    showExamSettingsMessage(
                        "Marks per question cannot be negative.",
                        "error"
                    );

                    return;

                }


                if (
                    settings.negativeMarks < 0
                ) {

                    showExamSettingsMessage(
                        "Negative marks cannot be less than 0.",
                        "error"
                    );

                    return;

                }


                // ----------------------------------------
                // BUTTON
                // ----------------------------------------

                if (saveExamSettingsBtn) {

                    saveExamSettingsBtn.disabled =
                        true;

                    saveExamSettingsBtn.textContent =
                        "Saving...";

                }


                // ----------------------------------------
                // FIRESTORE
                // ----------------------------------------

                const settingsRef =
                    doc(
                        db,
                        "examSettings",
                        "current"
                    );


                await setDoc(
                    settingsRef,
                    settings,
                    {
                        merge: true
                    }
                );


                console.log(
                    "Exam settings saved successfully:",
                    settings
                );


                // ----------------------------------------
                // UPDATE DASHBOARD
                // ----------------------------------------

                updateDashboardValues(
                    settings
                );


                showExamSettingsMessage(
                    "✓ Examination settings saved successfully.",
                    "success"
                );


            } catch (error) {

                console.error(
                    "Error saving exam settings:",
                    error
                );


                if (
                    error.code ===
                    "permission-denied"
                ) {

                    showExamSettingsMessage(
                        "Firebase permission denied. Please check Firestore Security Rules.",
                        "error"
                    );

                } else {

                    showExamSettingsMessage(
                        "Unable to save examination settings. Please try again.",
                        "error"
                    );

                }

            } finally {

                if (saveExamSettingsBtn) {

                    saveExamSettingsBtn.disabled =
                        false;

                    saveExamSettingsBtn.textContent =
                        "💾 Save Examination Settings";

                }

            }

        }
    );

}


// ============================================================
// RESET BUTTON
// ============================================================

const resetExamSettingsBtn =
    document.getElementById(
        "resetExamSettingsBtn"
    );


if (resetExamSettingsBtn) {

    resetExamSettingsBtn.addEventListener(
        "click",
        async function () {

            try {

                await loadExamSettings();


                showExamSettingsMessage(
                    "Settings restored from Firebase.",
                    "success"
                );


            } catch (error) {

                console.error(
                    "Reset error:",
                    error
                );

            }

        }
    );

}


// ============================================================
// AUTH STATE LISTENER
// ============================================================

onAuthStateChanged(
    auth,
    async function (user) {

        // ----------------------------------------
        // NO USER
        // ----------------------------------------

        if (!user) {

            showLoginScreen();

            return;

        }


        // ----------------------------------------
        // USER EXISTS
        // ----------------------------------------

        try {

            console.log(
                "Existing Firebase session:",
                user.email
            );


            const adminData =
                await checkAuthorizedAdmin(
                    user
                );


            if (!adminData) {

                await signOut(auth);

                showLoginScreen();

                return;

            }


            // ----------------------------------------
            // AUTHORIZED
            // ----------------------------------------

            displayAdminInformation(
                adminData,
                user
            );


            showDashboard();


            await loadExamSettings();


        } catch (error) {

            console.error(
                "Authentication state error:",
                error
            );


            await signOut(auth);

            showLoginScreen();

        }

    }
);


// ============================================================
// INITIAL PAGE SETUP
// ============================================================

function initializeAdminPortal() {

    // Hide dashboard initially.
    // Auth listener will show it after authorization.

    if (adminDashboard) {

        adminDashboard.style.display =
            "none";

    }


    if (adminLoginScreen) {

        adminLoginScreen.style.display =
            "block";

    }


    // Hide all sections except dashboard
    // until navigation is used.

    adminSections.forEach(
        function (section) {

            if (
                section.id ===
                "dashboardSection"
            ) {

                section.classList.add(
                    "active"
                );

                section.style.display =
                    "block";

            } else {

                section.classList.remove(
                    "active"
                );

                section.style.display =
                    "none";

            }

        }
    );

}


// ============================================================
// START
// ============================================================

initializeAdminPortal();

console.log(
    "Admin Portal initialized successfully."
);
