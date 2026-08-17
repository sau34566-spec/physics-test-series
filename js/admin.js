// =========================================
// ADMIN PORTAL - STEP 5
// Temporary frontend logic
// Firebase Authentication will be connected later.
// =========================================

document.addEventListener("DOMContentLoaded", () => {

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
    // TEMPORARY LOGIN
    // =====================================

    loginForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            const email =
                document
                    .getElementById("adminEmail")
                    .value
                    .trim();

            const password =
                document
                    .getElementById("adminPassword")
                    .value;


            if (!email || !password) {

                alert(
                    "Please enter your admin email and password."
                );

                return;
            }


            /*
             * Temporary frontend login.
             *
             * Firebase Authentication and
             * authorized-admin verification
             * will be added later.
             */

            loginScreen.style.display = "none";

            dashboard.classList.add("active");

        }
    );


    // =====================================
    // NAVIGATION
    // =====================================

    function openSection(sectionName) {

        sections.forEach(section => {

            section.classList.remove("active");

        });


        navItems.forEach(item => {

            item.classList.remove("active");

        });


        const targetSection =
            document.getElementById(
                `${sectionName}Section`
            );


        const targetNav =
            document.querySelector(
                `[data-section="${sectionName}"]`
            );


        if (targetSection) {

            targetSection.classList.add("active");

        }


        if (targetNav) {

            targetNav.classList.add("active");

        }


        const titles = {

            dashboard: "Dashboard",

            examSettings: "Exam Settings",

            questions: "Question Bank",

            candidates: "Candidates",

            monitoring: "Live Monitoring",

            violations: "Security Violations",

            results: "Candidate Results",

            feedback: "Candidate Feedback",

            analytics: "Performance Analytics",

            admins: "Authorized Administrators",

            activity: "Activity Logs"

        };


        pageTitle.textContent =
            titles[sectionName] ||
            "Dashboard";


        sidebar.classList.remove(
            "mobile-open"
        );


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }


    navItems.forEach(item => {

        item.addEventListener(
            "click",
            () => {

                const section =
                    item.dataset.section;

                openSection(section);

            }
        );

    });


    quickActions.forEach(item => {

        item.addEventListener(
            "click",
            () => {

                const section =
                    item.dataset.section;

                openSection(section);

            }
        );

    });


    // =====================================
    // MOBILE MENU
    // =====================================

    mobileMenuBtn.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "mobile-open"
            );

        }
    );


    // =====================================
    // LOGOUT
    // =====================================

    logoutBtn.addEventListener(
        "click",
        () => {

            showConfirmation(
                "Sign Out",
                "Are you sure you want to sign out of the administrator dashboard?",
                "🚪",
                () => {

                    dashboard.classList.remove(
                        "active"
                    );

                    loginScreen.style.display =
                        "flex";

                    loginForm.reset();

                }
            );

        }
    );


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


    startExamBtn.addEventListener(
        "click",
        () => {

            showConfirmation(
                "Start Examination",
                "Are you sure you want to start the examination?",
                "▶️",
                () => {

                    document.getElementById(
                        "largeExamStatus"
                    ).textContent = "LIVE";

                    document.getElementById(
                        "examStatus"
                    ).textContent = "Exam Live";

                    document.getElementById(
                        "statusDot"
                    ).style.background =
                        "#22c55e";

                }
            );

        }
    );


    pauseExamBtn.addEventListener(
        "click",
        () => {

            showConfirmation(
                "Pause Examination",
                "Are you sure you want to pause the examination?",
                "⏸️",
                () => {

                    document.getElementById(
                        "largeExamStatus"
                    ).textContent = "PAUSED";

                    document.getElementById(
                        "examStatus"
                    ).textContent = "Exam Paused";

                    document.getElementById(
                        "statusDot"
                    ).style.background =
                        "#f59e0b";

                }
            );

        }
    );


    endExamBtn.addEventListener(
        "click",
        () => {

            showConfirmation(
                "End Examination",
                "Ending the examination may affect all active candidates. Continue?",
                "⚠️",
                () => {

                    document.getElementById(
                        "largeExamStatus"
                    ).textContent = "ENDED";

                    document.getElementById(
                        "examStatus"
                    ).textContent = "Exam Ended";

                    document.getElementById(
                        "statusDot"
                    ).style.background =
                        "#ef4444";

                }
            );

        }
    );


    // =====================================
    // REFRESH
    // =====================================

    const refreshBtn =
        document.getElementById(
            "refreshDashboard"
        );


    refreshBtn.addEventListener(
        "click",
        () => {

            refreshBtn.textContent =
                "✓ Updated";

            setTimeout(() => {

                refreshBtn.textContent =
                    "↻ Refresh";

            }, 1200);

        }
    );


    // =====================================
    // CONFIRMATION MODAL
    // =====================================

    let confirmationCallback = null;


    function showConfirmation(
        title,
        message,
        icon,
        callback
    ) {

        modalTitle.textContent =
            title;

        modalMessage.textContent =
            message;

        document.getElementById(
            "modalIcon"
        ).textContent = icon;


        confirmationCallback =
            callback;


        adminModal.classList.add(
            "show"
        );

    }


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


    modalConfirmBtn.addEventListener(
        "click",
        () => {

            if (
                typeof confirmationCallback ===
                "function"
            ) {

                confirmationCallback();

            }


            adminModal.classList.remove(
                "show"
            );

            confirmationCallback =
                null;

        }
    );


    adminModal.addEventListener(
        "click",
        event => {

            if (
                event.target === adminModal
            ) {

                adminModal.classList.remove(
                    "show"
                );

                confirmationCallback =
                    null;

            }

        }
    );

});
