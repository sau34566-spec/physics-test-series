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
required(student.includes("questionIds.map"), "Linked question loading is missing");
required(admin.includes("syncExamQuestionIds"), "Question-to-exam sync is missing");
required(admin.includes("loadMonitoring"), "Admin live monitoring is missing");
required(admin.includes("loadResults"), "Admin results are missing");
required(superadmin.includes("securityPolicyVersions"), "Security versioning is missing");
required(gateway.includes("candidateLoginDisabled"), "Emergency gateway enforcement is missing");
required(rules.includes("candidateCanReadQuestion"), "Scoped question rule is missing");
required(rules.includes("match /securityPolicies/{policyId}"), "Security policy rules are missing");
required(!/password\s*===\s*["']/.test(`${student}${admin}${superadmin}`), "Hard-coded password found");

console.log("Platform smoke checks passed.");
