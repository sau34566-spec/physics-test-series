 // ==========================================
// ADVANCED EXAM SECURITY & ANTI-CHEATING SCRIPT
// ==========================================

let tabSwitchCount = 0;
let copyPasteAttempts = 0;
let penaltiesApplied = 0;

// Helper to trigger custom modal alerts safely from security script
function triggerCustomModal(title, message, callback) {
    if (typeof window.showCustomAlert === 'function') {
        window.showCustomAlert(title, message, callback);
    } else {
        alert(message); // Fallback
        if (callback) callback();
    }
}

// 1. Single Attempt Per Email Validation Check
window.verifySingleAttempt = function(studentEmail) {
    if (!studentEmail) return true;
    const submittedEmails = JSON.parse(localStorage.getItem("submitted_exam_emails")) || [];
    if (submittedEmails.includes(studentEmail)) {
        triggerCustomModal("Access Denied", "Is email address se pehle hi test diya ja chuka hai. Ek email se keval ek hi baar test dena allowed hai!", () => {
            document.body.innerHTML = `
                <div style="display:flex; justify-content:center; align-items:center; height:100vh; background:#f8fafc; font-family:sans-serif; text-align:center; padding:20px;">
                    <div style="background:white; padding:40px; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.1); max-width:500px;">
                        <h2 style="color:#dc2626; margin-bottom:15px;">Test Already Submitted!</h2>
                        <p style="color:#475569; font-size:16px; line-height:1.5;">Is email address se pehle hi exam submit kiya ja chuka hai.</p>
                    </div>
                </div>
            `;
        });
        return false;
    }
    return true;
};

// 2. Mark Email as Submitted upon Exam Finish/Submit
window.markEmailAsSubmitted = function(studentEmail) {
    if (!studentEmail) return;
    let submittedEmails = JSON.parse(localStorage.getItem("submitted_exam_emails")) || [];
    if (!submittedEmails.includes(studentEmail)) {
        submittedEmails.push(studentEmail);
        localStorage.setItem("submitted_exam_emails", JSON.stringify(submittedEmails));
    }
};

// 3. Right Click, Text Selection, Copy & Paste Block
document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('copy', (e) => {
    e.preventDefault();
    copyPasteAttempts++;
    triggerCustomModal("Security Warning", "Copying test content is strictly prohibited!");
});

document.addEventListener('paste', (e) => {
    e.preventDefault();
    copyPasteAttempts++;
    triggerCustomModal("Security Warning", "Pasting external text is not allowed!");
});

document.addEventListener('cut', (e) => e.preventDefault());

// 4. Refresh & Page Reload Complete Lock (Without Confirmation Pop-up)
window.addEventListener('beforeunload', (e) => {
    // Agar test submit ho chuka hai tab reload allow karein, warna block karein
    if (!window.isTestSubmitted) {
        e.preventDefault();
        e.returnValue = ""; 
    }
});

// 5. Tab Switch Detection (Updated: -1 mark + Question Change + Auto Submit on 2nd switch)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        tabSwitchCount++;
        
        if (tabSwitchCount === 1) {
            penaltiesApplied += 1;
            
            // `-1` mark penalty lagane ke sath question bhi change/skip karne ka function call
            if (typeof window.applyTabSwitchPenalty === 'function') {
                window.applyTabSwitchPenalty(); 
            } else if (typeof window.nextQuestion === 'function') {
                window.nextQuestion(); // Fallback to next question
            }

            triggerCustomModal("Security Warning #1", "Aapne tab switch ya minimize kiya hai! Aapke test score se 1 mark (-1) deduct kar liya gaya hai aur agla question load kar diya gaya hai. Dobara tab switch karne par test automatically submit ho jayega.");
            
        } else if (tabSwitchCount >= 2) {
            triggerCustomModal("Security Warning #2", "Aapne fir se tab switch kiya hai! Rule todne ke karan aapka test ab automatically submit kiya ja raha hai.", () => {
                if (typeof window.submitExam === 'function') {
                    window.submitExam();
                } else {
                    location.reload();
                }
            });
        }
    }
});

// 6. Advanced Keyboard Shortcuts & Full F1 to F12 Key Disable
document.addEventListener('keydown', (e) => {
    if (e.key.startsWith('F') && !isNaN(e.key.substring(1))) {
        e.preventDefault();
        triggerCustomModal("Action Blocked", `Key (${e.key}) is disabled during the exam!`);
        return;
    }

    if ((e.ctrlKey && e.key === 'r') || (e.metaKey && e.key === 'r') || e.key === 'F5') {
        e.preventDefault();
        triggerCustomModal("Action Blocked", "Page reload is completely locked during the exam!");
        return;
    }

    if (e.key === 'PrintScreen' || (e.key === 'S' && e.shiftKey && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        triggerCustomModal("Action Blocked", "Screenshots are disabled during the test!");
        navigator.clipboard.writeText('');
        return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.keyCode === 80)) {
        e.preventDefault();
        triggerCustomModal("Action Blocked", "Printing is disabled!");
        return;
    }

    if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U'))
    ) {
        e.preventDefault();
        triggerCustomModal("Action Blocked", "Developer tools and source code viewing are locked!");
        return;
    }
});

// 7. Screenshot Protection via Clipboard Clearing
window.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen') {
        navigator.clipboard.writeText('');
        triggerCustomModal("Security Notice", "Screenshot clipboard cleared for security reasons!");
    }
});

window.getSecurityReport = function() {
    return {
        tabSwitches: tabSwitchCount,
        copiesAttempted: copyPasteAttempts,
        penaltiesApplied: penaltiesApplied
    };
};
