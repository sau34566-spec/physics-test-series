 // security.js - Exam Security & Anti-Cheat Manager

(function() {
    // Admin check for unlimited sessions/bypass
    const studentInfo = JSON.parse(sessionStorage.getItem("student_info")) || {};
    const isAdmin = studentInfo.email === "sauravpandey3221@gmail.com";

    let tabSwitchCount = 0;
    let copyPasteAttempts = 0;
    let penaltiesApplied = 0;

    // Warning Banner Injector
    function ensureWarningBanner() {
        if (!document.getElementById("warning-banner")) {
            const banner = document.createElement("div");
            banner.id = "warning-banner";
            banner.style.cssText = "display:none; background-color:#fee2e2; border:1px solid #ef4444; color:#991b1b; padding:12px; border-radius:8px; margin-bottom:15px; font-weight:600; text-align:center; font-family:sans-serif; z-index:9999; position:relative;";
            banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span id="warning-msg"></span>`;
            
            const container = document.querySelector(".test-container") || document.body;
            container.insertBefore(banner, container.firstChild);
        }
    }

    function showWarning(msg) {
        ensureWarningBanner();
        const banner = document.getElementById("warning-msg");
        if (banner) {
            banner.innerText = msg;
            const bannerBox = document.getElementById("warning-banner");
            bannerBox.style.display = "block";
            setTimeout(() => { bannerBox.style.display = "none"; }, 4000);
        } else {
            alert(msg);
        }
    }

    // Anti-Cheating Protections (Bypassed if user is admin)
    if (!isAdmin) {
        document.addEventListener('contextmenu', e => e.preventDefault());
        
        document.addEventListener('copy', e => { 
            e.preventDefault(); 
            copyPasteAttempts++; 
            showWarning("Copying is prohibited!"); 
        });
        
        document.addEventListener('paste', e => { 
            e.preventDefault(); 
            copyPasteAttempts++; 
            showWarning("Pasting is prohibited!"); 
        });

        document.addEventListener("visibilitychange", function() {
            if (document.hidden && window.isTestSubmitted !== true) {
                tabSwitchCount++;
                if (tabSwitchCount === 1) {
                    penaltiesApplied += 1;
                    showWarning("Tab switch detected! -1 mark penalty applied & a new question has been loaded.");
                    
                    // Trigger a new question or jump/shuffle to another question in test.html
                    if (typeof window.loadNewQuestionOnSwitch === "function") {
                        window.loadNewQuestionOnSwitch();
                    }
                } else if (tabSwitchCount >= 2) {
                    window.isTestSubmitted = true;
                    alert("Multiple tab switches detected! Auto-submitting exam.");
                    if (typeof window.submitExam === "function") {
                        window.submitExam();
                    }
                }
            }
        });
    }

    // Accurate Marks Calculation Helper
    window.calculateExamScore = function(questions, userAnswers) {
        let correctCount = 0;
        
        questions.forEach((q, idx) => {
            const studentAns = userAnswers[idx];
            const correctAns = q.a !== undefined ? q.a : q.answer;

            if (studentAns !== undefined && studentAns !== null && studentAns === correctAns) {
                correctCount++;
            }
        });

        let finalScore = Math.max(0, correctCount - penaltiesApplied);
        return {
            correctCount,
            penaltiesApplied,
            finalScore,
            scoreString: `${finalScore}/${questions.length}`,
            tabSwitches: tabSwitchCount,
            copiesAttempted: copyPasteAttempts
        };
    };

    window.getSecurityStats = function() {
        return {
            tabSwitches: tabSwitchCount,
            copiesAttempted: copyPasteAttempts,
            penaltiesApplied: penaltiesApplied
        };
    };
})();
