import { auth, db } from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// =========================================
// ADMIN PORTAL
// Firebase Authentication connected
// Authorized Admin verification will be added
// in the next step.
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    // =====================================
    // DOM ELEMENTS
    // =====================================

    const loginScreen =
        document.getElementById("adminLoginScreen");

    const dashboard =
        document.getElementById("adminDashboard");

    const loginForm =
        document.getElementById("adminLoginForm");

    const logoutBtn =
        document.getElementById("logoutBtn");

    const mobileMenuBtn =
        document.getElementById("mobileMenuBtn");

    const sidebar =
        document.getElementById("adminSidebar");

    const navItems =
        document.querySelectorAll(".nav-item");

    const quickActions =
        document.querySelectorAll(".quick-action");

    const sections =
        document.querySelectorAll(".admin-section");

    const pageTitle =
        document.getElementById("pageTitle");

    const adminModal =
        document.getElementById("adminModal");

    const modalCancelBtn =
        document.getElementById("modalCancelBtn");

    const modalConfirmBtn =
        document.getElementById("modalConfirmBtn");

    const modalTitle =
        document.getElementById("modalTitle");

    const modalMessage =
        document.getElementById("modalMessage");


    // =====================================
    // CHECK REQUIRED ELEMENTS
    // =====================================

    if (!loginScreen ||
        !dashboard ||
        !loginForm) {

        console.error(
            "Required Admin Portal elements were not found."
        );

        return;
    }


    // =====================================
    // FIREBASE ADMIN LOGIN
    // =====================================

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const email =
                document
                    .getElementById("adminEmail")
                    .value
                    .trim()
                    .toLowerCase();

            const password =
                document
                    .getElementById("adminPassword")
                    .value;


            // Empty field validation
            if (!email || !password) {

                alert(
                    "Please enter your administrator email and password."
                );

                return;
            }


            try {

                // Firebase Authentication
                const userCredential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );


                const user =
                    userCredential.user;


                console.log(
                    "Administrator authenticated:",
                    user.email
                );


                // Show dashboard
                loginScreen.style.display =
                    "none";

                dashboard.classList.add(
                    "active"
                );


                // Clear password field
                document
                    .getElementById("adminPassword")
                    .value = "";


            } catch (error) {

                console.error(
                    "Admin login error:",
                    error
                );


                let message =
                    "Unable to sign in. Please check your email and password.";


                // Firebase error handling
                if (
                    error.code ===
                    "auth/invalid-credential"
                ) {

                    message =
                        "The email or password is incorrect.";

                }

                else if (
                    error.code ===
                    "auth/invalid-email"
                ) {

                    message =
                        "Please enter a valid administrator email address.";

                }

                else if (
                    error.code ===
                    "auth/too-many-requests"
                ) {

                    message =
                        "Too many unsuccessful login attempts. Please try again later.";

                }

                else if (
                    error.code ===
                    "auth/user-disabled"
                ) {

                    message =
                        "This administrator account has been disabled.";

                }

                else if (
                    error.code ===
                    "auth/network-request-failed"
                ) {

                    message =
                        "Network error. Please check your internet connection and try again.";

                }


                alert(message);

            }

        }
    );


    // =====================================
    // NAVIGATION
    // =====================================

    function openSection(sectionName) {

        sections.forEach(
            section => {

                section.classList.remove(
                    "active"
                );

            }
        );


        navItems.forEach(
            item => {

                item.classList.remove(
                    "active"
                );

            }
        );


        const targetSection =
            document.getElementById(
                `${sectionName}Section`
            );


        const targetNav =
            document.querySelector(
                `[data-section="${sectionName}"]`
            );


        if (targetSection) {

            targetSection.classList.add(
                "active"
            );

        }


        if (targetNav) {

            targetNav.classList.add(
                "active"
            );

        }


        const titles = {

            dashboard:
                "Dashboard",

            examSettings:
                "Exam Settings",

            questions:
                "Question Bank",

            candidates:
                "Candidates",

            monitoring:
                "Live Monitoring",

            violations:
                "Security Violations",

            results:
                "Candidate Results",

            feedback:
                "Candidate Feedback",

            analytics:
                "Performance Analytics",

            admins:
                "Authorized Administrators",

            activity:
                "Activity Logs"

        };


        if (pageTitle) {

            pageTitle.textContent =
                titles[sectionName] ||
                "Dashboard";

        }


        if (sidebar) {

            sidebar.classList.remove(
                "mobile-open"
            );

        }


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }


    navItems.forEach(
        item => {

            item.addEventListener(
                "click",
                () => {

                    const section =
                        item.dataset.section;

                    openSection(section);

                }
            );

        }
    );


    quickActions.forEach(
        item => {

            item.addEventListener(
                "click",
                () => {

                    const section =
                        item.dataset.section;

                    openSection(section);

                }
            );

        }
    );


    // =====================================
    // MOBILE MENU
    // =====================================

    if (mobileMenuBtn && sidebar) {

        mobileMenuBtn.addEventListener(
            "click",
            () => {

                sidebar.classList.toggle(
                    "mobile-open"
                );

            }
        );

    }


    // =====================================
    // FIREBASE LOGOUT
    // =====================================

    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            () => {

                showConfirmation(

                    "Sign Out",

                    "Are you sure you want to sign out of the administrator dashboard?",

                    "🚪",

                    async () => {

                        try {

                            await signOut(auth);


                            dashboard.classList.remove(
                                "active"
                            );


                            loginScreen.style.display =
                                "flex";


                            loginForm.reset();


                            console.log(
                                "Administrator signed out successfully."
                            );


                        } catch (error) {

                            console.error(
                                "Logout error:",
                                error
                            );


                            alert(
                                "Unable to sign out. Please try again."
                            );

                        }

                    }

                );

            }
        );

    }


    // =====================================
    // EXAM CONTROL BUTTONS
    // =====================================

    const startExamBtn =
        document.getElementById(
            "startExamBtn"
        );

    const pauseExamBtn =
        document.getElementById(
            "pauseExamBtn"
        );

    const endExamBtn =
        document.getElementById(
            "endExamBtn"
        );


    // =====================================
    // START EXAM
    // =====================================

    if (startExamBtn) {

        startExamBtn.addEventListener(
            "click",
            () => {

                showConfirmation(

                    "Start Examination",

                    "Are you sure you want to start the examination?",

                    "▶️",

                    () => {

                        const largeExamStatus =
                            document.getElementById(
                                "largeExamStatus"
                            );

                        const examStatus =
                            document.getElementById(
                                "examStatus"
                            );

                        const statusDot =
                            document.getElementById(
                                "statusDot"
                            );


                        if (largeExamStatus) {

                            largeExamStatus.textContent =
                                "LIVE";

                        }


                        if (examStatus) {

                            examStatus.textContent =
                                "Exam Live";

                        }


                        if (statusDot) {

                            statusDot.style.background =
                                "#22c55e";

                        }

                    }

                );

            }
        );

    }


    // =====================================
    // PAUSE EXAM
    // =====================================

    if (pauseExamBtn) {

        pauseExamBtn.addEventListener(
            "click",
            () => {

                showConfirmation(

                    "Pause Examination",

                    "Are you sure you want to pause the examination?",

                    "⏸️",

                    () => {

                        const largeExamStatus =
                            document.getElementById(
                                "largeExamStatus"
                            );

                        const examStatus =
                            document.getElementById(
                                "examStatus"
                            );

                        const statusDot =
                            document.getElementById(
                                "statusDot"
                            );


                        if (largeExamStatus) {

                            largeExamStatus.textContent =
                                "PAUSED";

                        }


                        if (examStatus) {

                            examStatus.textContent =
                                "Exam Paused";

                        }


                        if (statusDot) {

                            statusDot.style.background =
                                "#f59e0b";

                        }

                    }

                );

            }
        );

    }


    // =====================================
    // END EXAM
    // =====================================

    if (endExamBtn) {

        endExamBtn.addEventListener(
            "click",
            () => {

                showConfirmation(

                    "End Examination",

                    "Ending the examination may affect all active candidates. Continue?",

                    "⚠️",

                    () => {

                        const largeExamStatus =
                            document.getElementById(
                                "largeExamStatus"
                            );

                        const examStatus =
                            document.getElementById(
                                "examStatus"
                            );

                        const statusDot =
                            document.getElementById(
                                "statusDot"
                            );


                        if (largeExamStatus) {

                            largeExamStatus.textContent =
                                "ENDED";

                        }


                        if (examStatus) {

                            examStatus.textContent =
                                "Exam Ended";

                        }


                        if (statusDot) {

                            statusDot.style.background =
                                "#ef4444";

                        }

                    }

                );

            }
        );

    }


    // =====================================
    // REFRESH DASHBOARD
    // =====================================

    const refreshBtn =
        document.getElementById(
            "refreshDashboard"
        );


    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            () => {

                refreshBtn.textContent =
                    "✓ Updated";


                setTimeout(
                    () => {

                        refreshBtn.textContent =
                            "↻ Refresh";

                    },
                    1200
                );

            }
        );

    }


    // =====================================
    // CONFIRMATION MODAL
    // =====================================

    let confirmationCallback =
        null;


    function showConfirmation(
        title,
        message,
        icon,
        callback
    ) {

        if (!adminModal) {

            if (
                confirm(message)
            ) {

                callback();

            }

            return;
        }


        if (modalTitle) {

            modalTitle.textContent =
                title;

        }


        if (modalMessage) {

            modalMessage.textContent =
                message;

        }


        const modalIcon =
            document.getElementById(
                "modalIcon"
            );


        if (modalIcon) {

            modalIcon.textContent =
                icon;

        }


        confirmationCallback =
            callback;


        adminModal.classList.add(
            "show"
        );

    }


    // =====================================
    // MODAL CANCEL
    // =====================================

    if (modalCancelBtn) {

        modalCancelBtn.addEventListener(
            "click",
            () => {

                adminModal.classList.remove(
                    "show"
                );


                confirmationCallback =
                    null;

            }
        );

    }


    // =====================================
    // MODAL CONFIRM
    // =====================================

    if (modalConfirmBtn) {

        modalConfirmBtn.addEventListener(
            "click",
            async () => {

                if (
                    typeof confirmationCallback ===
                    "function"
                ) {

                    await confirmationCallback();

                }


                adminModal.classList.remove(
                    "show"
                );


                confirmationCallback =
                    null;

            }
        );

    }


    // =====================================
    // CLOSE MODAL ON BACKDROP CLICK
    // =====================================

    if (adminModal) {

        adminModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    adminModal
                ) {

                    adminModal.classList.remove(
                        "show"
                    );


                    confirmationCallback =
                        null;

                }

            }
        );

    }

});
