 // ==========================================
// NTA Exam Portal - Advanced Security & Anti-Cheating Script (Fixed Version)
// ==========================================

let tabSwitchCount = parseInt(localStorage.getItem('exam_security_penalties') || '0');
let isExamSubmitted = false;
let lastBlurTime = 0; // Double trigger prevent karne ke liye

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
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    `;
    banner.innerText = "⚠️ WARNING: Do not switch tabs or leave the exam window! Your activity is monitored.";
    document.body.appendChild(banner);
}

// Show banner temporarily
function showWarningBannerMessage() {
    const banner = document.getElementById("warning-banner");
    if (banner) {
        banner.style.display = "block";
        setTimeout(() => {
            banner.style.display = "none";
        }, 5000);
    }
}

// Handle violation event safely
function handleSecurityViolation() {
    if (isExamSubmitted) return;

    const currentTime = Date.now();
    // 2 seconds ke andar agar dubara blur event trigger ho toh ignore karein (debounce)
    if (currentTime - lastBlurTime < 2000) {
        return;
    }
    lastBlurTime = currentTime;

    tabSwitchCount++;
    localStorage.setItem('exam_security_penalties', tabSwitchCount);

    if (tabSwitchCount === 1) {
        showWarningBannerMessage();
        if (typeof window.showToast === 'function') {
            window.showToast("Warning: Tab switching detected! 1 mark penalty applied.");
        }
    } else if (tabSwitchCount >= 2) {
        if (typeof window.showToast === 'function') {
            window.showToast("Multiple violations detected! Auto-submitting exam.");
        }
        isExamSubmitted = true;
        setTimeout(() => {
            if (typeof window.executeFinalSubmit === 'function') {
                window.executeFinalSubmit();
            } else {
                window.location.reload();
            }
        }, 1500);
    }
}

// Initialize listeners on DOM load
document.addEventListener("DOMContentLoaded", () => {
    createWarningBanner();

    // Reset or initialize storage if not present
    if (!localStorage.getItem('exam_security_penalties')) {
        localStorage.setItem('exam_security_penalties', '0');
    }

    // Listen to visibility changes (Tab switching)
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            handleSecurityViolation();
        }
    });

    // Listen to window blur (clicking outside window / developer tools)
    window.addEventListener("blur", () => {
        handleSecurityViolation();
    });
});
