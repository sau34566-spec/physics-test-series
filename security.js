 // ==========================================
// ADVANCED EXAM SECURITY & ANTI-CHEATING SCRIPT
// ==========================================

let tabSwitchCount = 0;
let copyPasteAttempts = 0;

// 1. Right Click, Text Selection, Copy & Paste Block
document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('copy', (e) => {
    e.preventDefault();
    copyPasteAttempts++;
    alert("Warning: Copying test content is strictly prohibited!");
});

document.addEventListener('paste', (e) => {
    e.preventDefault();
    copyPasteAttempts++;
    alert("Warning: Pasting external text is not allowed!");
});

document.addEventListener('cut', (e) => e.preventDefault());

// 2. Refresh & Page Reload Lock (Accidental Exit Protection)
window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = "Warning: Refreshing or leaving the page will auto-submit your test!";
    return e.returnValue;
});

// 3. Tab Switch Detection
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        tabSwitchCount++;
        alert(`SECURITY WARNING #${tabSwitchCount}: You switched tabs or minimized the browser! This violation is logged.`);
    }
});

// 4. Advanced Keyboard Shortcuts & Screenshot Lock
document.addEventListener('keydown', (e) => {
    // Prevent Refresh Keys (F5 & Ctrl+R / Cmd+R)
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.metaKey && e.key === 'r')) {
        e.preventDefault();
        alert("Action Blocked: Page reload is disabled during the exam!");
        return;
    }

    // Prevent PrintScreen (PrtScn Key / Windows + Shift + S)
    if (e.key === 'PrintScreen' || (e.key === 'S' && e.shiftKey && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        alert("Action Blocked: Screenshots are disabled during the test!");
        // Clear Clipboard data if screenshot was attempted
        navigator.clipboard.writeText('');
        return;
    }

    // Prevent Print (Ctrl+P / Cmd+P)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.keyCode === 80)) {
        e.preventDefault();
        alert("Action Blocked: Printing is disabled!");
        return;
    }

    // Block F12 & Developer Tools Shortcuts (Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U)
    if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U'))
    ) {
        e.preventDefault();
        alert("Action Blocked: Developer tools and source code viewing are locked!");
        return;
    }
});

// 5. Screenshot Protection via Clipboard Clearing
window.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen') {
        navigator.clipboard.writeText('');
        alert("Screenshot captured erased for security reasons!");
    }
});

// Global Function to send report to Admin Panel during test submit
window.getSecurityReport = function() {
    return {
        tabSwitches: tabSwitchCount,
        copyAttempts: copyPasteAttempts,
        penaltiesApplied: tabSwitchCount * 1 // 1 mark deduction per tab switch
    };
};
