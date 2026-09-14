import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const required = (condition, message) => {
  if (!condition) throw new Error(message);
};

const student = read("js/student.js");
const admin = read("js/admin.js");
const superadmin = read("js/superadmin.js");
const gateway = read("js/institute-gateway.js");
const rules = read("firebase/firestore.rules");

required(student.includes("configurationSnapshot"), "Attempt snapshot is missing");
required(student.includes("startPresenceHeartbeat"), "Candidate heartbeat is missing");
required(student.includes("listenForForceSubmit"), "Free-mode force submit listener is missing");
required(student.includes("candidateLockId"), "Cross-device candidate lock is missing");
required(student.includes("questionIds.map"), "Linked question loading is missing");
required(student.indexOf("await loadQuestions()") < student.indexOf("await claimCandidateAttempt()"), "Attempt must be claimed after question validation");
required(admin.includes("syncExamQuestionIds"), "Question-to-exam sync is missing");
required(admin.includes("questionImportFile"), "Question import/export workflow is missing");
required(admin.includes("loadMonitoring"), "Admin live monitoring is missing");
required(admin.includes("loadResults"), "Admin results are missing");
required(superadmin.includes('api("history"'), "Platform configuration version history is missing");
required(superadmin.includes("maintenanceMode"), "Platform maintenance control is missing");
required(!superadmin.includes('collection(db, "candidates"'), "Super Admin must not subscribe to candidates");
required(gateway.includes("candidateLoginDisabled"), "Emergency gateway enforcement is missing");
required(rules.includes("candidateCanReadQuestion"), "Scoped question rule is missing");
required(rules.includes("match /securityPolicies/{policyId}"), "Security policy rules are missing");
required(rules.includes("match /candidateLocks/{lockId}"), "Candidate lock rules are missing");
required(!/password\s*===\s*["']/.test(`${student}${admin}${superadmin}`), "Hard-coded password found");

console.log("Platform smoke checks passed.");
