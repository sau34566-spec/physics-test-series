import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export class ExamSecurityMonitor {
  constructor(attemptId, examId, studentId, instituteId, violationLimit = 3, onAutoSubmitCallback) {
    this.attemptId = attemptId;
    this.examId = examId;
    this.studentId = studentId;
    this.instituteId = instituteId;
    this.violationLimit = violationLimit;
    this.violationCount = 0;
    this.onAutoSubmit = onAutoSubmitCallback;
    this.isMonitoring = false;
  }

  start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // 1. Tab Switch / Window Blur Detection
    document.addEventListener("visibilitychange", this.handleVisibility);
    window.addEventListener("blur", this.handleBlur);

    // 2. Clipboard Controls
    document.addEventListener("copy", (e) => this.recordViolation("COPY_ATTEMPT", e));
    document.addEventListener("paste", (e) => this.recordViolation("PASTE_ATTEMPT", e));
    document.addEventListener("cut", (e) => this.recordViolation("CUT_ATTEMPT", e));
    document.addEventListener("contextmenu", (e) => this.recordViolation("CONTEXT_MENU", e));

    // 3. Key Combo Blocking
    document.addEventListener("keydown", this.handleKeydown);

    // 4. Fullscreen Exit
    document.addEventListener("fullscreenchange", this.handleFullscreen);
  }

  handleVisibility = () => {
    if (document.hidden) {
      this.recordViolation("TAB_SWITCH");
    }
  };

  handleBlur = () => {
    this.recordViolation("WINDOW_BLUR");
  };

  handleKeydown = (e) => {
    const forbiddenKeys = ['F12', 'PrintScreen'];
    const forbiddenCombos = (e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'u', 'i', 'j', 'p', 's', 'a'].includes(e.key.toLowerCase());

    if (forbiddenKeys.includes(e.key) || forbiddenCombos) {
      e.preventDefault();
      this.recordViolation(e.key === 'F12' ? "DEVTOOLS_SHORTCUT" : "FORBIDDEN_KEY");
    }
  };

  handleFullscreen = () => {
    if (!document.fullscreenElement) {
      this.recordViolation("FULLSCREEN_EXIT");
    }
  };

  async recordViolation(eventType, eventObj = null) {
    if (eventObj) eventObj.preventDefault();
    if (!this.isMonitoring) return;

    this.violationCount++;
    console.warn(`[SECURITY VIOLATION ${this.violationCount}] ${eventType}`);

    try {
      await addDoc(collection(db, "securityEvents"), {
        attemptId: this.attemptId,
        examId: this.examId,
        studentId: this.studentId,
        instituteId: this.instituteId,
        eventType,
        timestamp: serverTimestamp(),
        violationCount: this.violationCount
      });
    } catch (err) {
      console.error("Failed to log security telemetry:", err);
    }

    if (this.violationCount >= this.violationLimit) {
      alert("Maximum security violations exceeded. Submitting exam automatically.");
      this.stop();
      if (this.onAutoSubmit) this.onAutoSubmit();
    } else {
      alert(`Warning ${this.violationCount}/${this.violationLimit}: Proctored exam violation detected (${eventType}).`);
    }
  }

  stop() {
    this.isMonitoring = false;
    document.removeEventListener("visibilitychange", this.handleVisibility);
    window.removeEventListener("blur", this.handleBlur);
    document.removeEventListener("fullscreenchange", this.handleFullscreen);
  }
}