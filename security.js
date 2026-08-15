 // Security and Anti-Cheating Script for Exam Portal
let tabSwitchCount = 0;
let copyPasteAttempts = 0;
let totalPenalties = 0;

function showSecurityWarning(message) {
    const banner = document.getElementById("warning-banner");
    const msgSpan = document.getElementById("warning-msg");
    if (banner && msgSpan) {
        msgSpan.innerText = message;
        banner.style.display = "block";
        setTimeout(() => { banner.style.display = "none"; }, 4000);
    }
}

// Block Right-Click Context Menu
document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    showSecurityWarning("Right-click is disabled during the exam.");
});

// Block Copy and Paste Shortcuts
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

// Detect Tab Switching or Minifying Window
document.addEventListener("visibilitychange", function () {
    if (document.hidden && window.isTestSubmitted !== true) {
        tabSwitchCount++;
        if (tabSwitchCount === 1) {
            totalPenalties += 1;
            showSecurityWarning("Warning: Tab switch detected! -1 mark penalty applied. Next switch will auto-submit.");
        } else if (tabSwitchCount >= 2) {
            showSecurityWarning("Multiple tab switches detected! Auto-submitting exam now.");
            if (typeof window.triggerExamSubmit === 'function') {
                window.triggerExamSubmit();
            }
        }
    }
});

// Export penalty count for the scoring engine in nta.html
window.getPenaltiesCount = function() {
    return totalPenalties;
};
