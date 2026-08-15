 // ==========================================
// NTA Exam Portal - Advanced Security & Anti-Cheating Script
// ==========================================

let tabSwitchCount = 0;
let totalPenalties = 0;
let isExamSubmitted = false;

// Create and inject warning banner dynamically if not present
function createWarningBanner() {
    if (document.getElementById("warning-banner")) return;

    const banner = document.createElement("div");
    banner.id = "warning-banner";
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        background-color: #ef4444;
        color: white;
        text-align: center;
        padding: 10px;
        font-weight: 600;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        z-index: 99999;
        display: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    banner.innerText = "⚠️ WARNING: Tab switching or leaving the test window is strictly prohibited!";
    document.body.prepend(banner);
}

function showSecurityWarning(msg) {
    let banner = document.getElementById("warning-banner");
    if (banner) {
        banner.innerText = msg;
        banner.style.display = "block";
        setTimeout(() => {
            banner.style.display = "none";
        }, 4000);
    }
}

// Security Event Listeners Setup
document.addEventListener("DOMContentLoaded", () => {
    createWarningBanner();

    // 1. Disable Right Click Context Menu
    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showSecurityWarning("⚠️ Right-click is disabled during the assessment.");
    });

    // 2. Disable Keyboard Shortcuts (F12, Inspect, Copy, Paste, Cut, Refresh, PrintScreen)
    document.addEventListener("keydown", (e) => {
        if (
            e.key === "F12" ||
            (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
            (e.ctrlKey && e.key === "U") ||
            (e.ctrlKey && (e.key === "c" || e.key === "v" || e.key === "x" || e.key === "a" || e.key === "s" || e.key === "r")) ||
            e.key === "PrintScreen"
        ) {
            e.preventDefault();
            showSecurityWarning("⚠️ This shortcut or key combination is disabled during the exam.");
            return false;
        }
    });

    // 3. Disable Copy, Cut, Paste Actions via Mouse/Clipboard
    document.addEventListener("copy", (e) => { e.preventDefault(); });
    document.addEventListener("paste", (e) => { e.preventDefault(); });
    document.addEventListener("cut", (e) => { e.preventDefault(); });

    // 4. Tab Switch & Background Blur Detection Logic
    document.addEventListener("visibilitychange", () => {
        if (document.hidden && !isExamSubmitted) {
            handleTabSwitchViolation();
        }
    });

    window.addEventListener("blur", () => {
        if (!isExamSubmitted) {
            handleTabSwitchViolation();
        }
    });
});

function handleTabSwitchViolation() {
    // Check if logged-in user is admin, if yes, skip penalties and auto-submit
    let currentUserEmail = localStorage.getItem('current_test_user_email') || "";
    let savedAdminEmail = localStorage.getItem('persistent_admin_email');
    if (localStorage.getItem('is_admin_logged_in') === 'true' && currentUserEmail.trim().toLowerCase() === savedAdminEmail) {
        return; // Admin bypasses security restrictions during testing
    }

    tabSwitchCount++;

    if (tabSwitchCount === 1) {
        totalPenalties += 1;
        localStorage.setItem('exam_security_penalties', totalPenalties);
        showSecurityWarning("⚠️ Warning 1/2: Tab switch detected! -1 Mark penalty applied.");
    } else if (tabSwitchCount >= 2) {
        isExamSubmitted = true;
        showSecurityWarning("🚨 Maximum tab switches reached! Auto-submitting test now.");
        
        setTimeout(() => {
            if (typeof executeFinalSubmit === "function") {
                executeFinalSubmit();
            } else {
                localStorage.setItem('portal_session_locked', 'true');
                window.location.reload();
            }
        }, 1500);
    }
}

// 5. Email Domain Validation Check Function (@gmail.com requirement + Not Found message)
window.validateStudentEmailInput = function(emailInput) {
    if (!emailInput || !emailInput.includes("@")) {
        alert("Your email not found");
        return false;
    }
    
    const emailTrimmed = emailInput.trim().toLowerCase();
    
    // Check if it ends with @gmail.com or contains a valid domain structure
    const parts = emailTrimmed.split("@");
    if (parts.length !== 2 || !parts[1].includes(".") || !emailTrimmed.endsWith("@gmail.com")) {
        alert("Your email not found");
        return false;
    }

    // Check if admin is logging in with persistent admin email (bypass one-attempt limit)
    let savedAdmin = localStorage.getItem('persistent_admin_email');
    let isAdmin = localStorage.getItem('is_admin_logged_in') === 'true' && emailTrimmed === savedAdmin;

    if (!isAdmin) {
        // Check for One Email - One Attempt restriction
        let submittedEmails = JSON.parse(localStorage.getItem('submitted_exam_emails') || '[]');
        if (submittedEmails.includes(emailTrimmed)) {
            alert("This email has already been used to submit an exam. Only one attempt per email is allowed.");
            return false;
        }
    }

    return true;
};

// Record used email upon final submission
window.recordEmailAttempt = function(emailInput) {
    if(!emailInput) return;
    let emailTrimmed = emailInput.trim().toLowerCase();
    let submittedEmails = JSON.parse(localStorage.getItem('submitted_exam_emails') || '[]');
    if(!submittedEmails.includes(emailTrimmed)) {
        submittedEmails.push(emailTrimmed);
        localStorage.setItem('submitted_exam_emails', JSON.stringify(submittedEmails));
    }
};
