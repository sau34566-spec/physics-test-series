 // ==========================================
// NTA Exam Portal - Security & Anti-Cheating Script
// ==========================================

let tabSwitchCount = 0;
let copyPasteAttempts = 0;
let totalPenalties = 0;

// Create and inject the warning banner dynamically if not present
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
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span id="warning-msg">Security Warning!</span>`;
    document.body.prepend(banner);
}

// Show security warning banner with specific message
function showSecurityWarning(message) {
    createWarningBanner();
    const banner = document.getElementById("warning-banner");
    const msgSpan = document.getElementById("warning-msg");
    if (banner && msgSpan) {
        msgSpan.innerText = message;
        banner.style.display = "block";
        setTimeout(() => { 
            banner.style.display = "none"; 
        }, 4000);
    }
}

// Initialize security listeners on window load
window.addEventListener('DOMContentLoaded', () => {
    createWarningBanner();
});

// 1. Block Right-Click Context Menu
document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    showSecurityWarning("Right-click context menu is disabled during the exam.");
});

// 2. Block Copy, Paste, and Cut Actions
document.addEventListener('copy', function (e) {
    e.preventDefault();
    copyPasteAttempts++;
    showSecurityWarning("Copying text is strictly prohibited!");
});

document.addEventListener('paste', function (e) {
    e.preventDefault();
    copyPasteAttempts++;
    showSecurityWarning("Pasting text is strictly prohibited!");
});

document.addEventListener('cut', function (e) {
    e.preventDefault();
    showSecurityWarning("Cutting text is strictly prohibited!");
});

// 3. Detect Tab Switching / Minimizing Browser Window
window.addEventListener('blur', function () {
    tabSwitchCount++;
    totalPenalties++;
    showSecurityWarning(`Warning! Tab switch detected (${tabSwitchCount}). Exam activity is strictly monitored.`);
});

// 4. Prevent Unauthorized Keyboard Shortcuts & Developer Tools
document.addEventListener('keydown', function (e) {
    // Disable F12 Key
    if (e.key === 'F12') {
        e.preventDefault();
        showSecurityWarning("Developer tools (F12) are blocked.");
    }

    // Disable Inspect Element and View Source Combinations (Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        showSecurityWarning("Developer shortcuts are restricted.");
    }

    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        showSecurityWarning("Viewing page source is disabled.");
    }

    // Disable Common Shortcuts like Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A via keyboard
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 'x' || e.key === 'X' || e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        showSecurityWarning("Keyboard shortcuts for copying/selecting text are blocked.");
    }
});

// 5. Fullscreen Enforcement Helper Functions
function enforceFullscreen() {
    if (!document.fullscreenElement) {
        console.log("Candidate moved out of fullscreen mode.");
    }
}

document.addEventListener('fullscreenchange', enforceFullscreen);

// Optional: Auto-request fullscreen on start if required
function requestFullscreenMode() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log("Fullscreen request error: ", err.message);
        });
    }
}
