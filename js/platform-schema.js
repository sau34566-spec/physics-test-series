"use strict";
// Shared with the browser by /js/platform-schema.js. No executable template input.
const TYPES = ["SCHOOL", "COMPETITIVE"];
const FEATURES = ["cbt", "advancedSecurity", "customFields", "customInstructions", "branding", "palette", "performance", "reports", "advancedExamControls"];
const SECURITY = ["tabSwitch", "copyPaste", "screenshot", "refresh", "keyboard", "fullscreen", "overlay", "dnd", "focusLock", "devtools"];
const TEMPLATES = ["login-clean", "login-split", "login-minimal", "login-card", "instructions-clean", "instructions-cards", "instructions-compact", "exam-normal", "exam-cbt"].map(templateId => ({
  templateId, templateName: templateId.replaceAll("-", " "), templateType: templateId.split("-")[0],
  version: 1, status: "ACTIVE", supportedInstituteTypes: TYPES, supportedFeatures: FEATURES,
  preview: {layout: templateId}, createdAt: "2026-09-14", updatedAt: "2026-09-14"
}));
const PRESETS = [
  {id: "standard", version: 1, name: "Standard", settings: {tabSwitch: true, copyPaste: true, refresh: true}},
  {id: "high", version: 1, name: "High Security", settings: {tabSwitch: true, copyPaste: true, refresh: true, keyboard: true, fullscreen: true}},
  {id: "maximum", version: 1, name: "Maximum Security", settings: {tabSwitch: true, copyPaste: true, refresh: true, keyboard: true, fullscreen: true, focusLock: true}}
];
const DEFAULTS = {
  schemaVersion: 2, instituteName: "", instituteCode: "", instituteType: "SCHOOL",
  contactEmail: "", contactPhone: "", address: "", city: "", state: "", country: "India",
  website: "", supportContact: "", branding: {logoUrl: "", color: "#2563eb"},
  loginTemplate: "login-clean", loginTemplateVersion: 1,
  instructionTemplate: "instructions-clean", instructionTemplateVersion: 1,
  examTemplate: "exam-normal", examTemplateVersion: 1, examMode: "NORMAL",
  studentFields: [
    {name: "name", label: "Name", type: "text", required: true, visible: true, placeholder: "", defaultValue: "", helpText: ""},
    {name: "email", label: "Email", type: "email", required: true, visible: true, placeholder: "", defaultValue: "", helpText: ""}
  ],
  instructions: [{type: "paragraph", heading: "General Instructions", text: "Read each question carefully. Submit your test before time expires."},
    {type: "warning", heading: "Security Instructions", text: "Enable DND before starting. Keep the examination page open."},
    {type: "declaration", heading: "Declaration", text: "I have read and understood the instructions."}],
  security: Object.fromEntries(SECURITY.map(k => [k, ["tabSwitch", "copyPaste", "refresh"].includes(k)])),
  securityPreset: {id: "standard", version: 1}, penalty: {marks: 1, maximum: 2},
  features: Object.fromEntries(FEATURES.map(k => [k, !["cbt", "palette"].includes(k)])),
  plan: "Standard", maxAdmins: 3
};
function defaults() { return JSON.parse(JSON.stringify(DEFAULTS)); }
function validate(c, registry = TEMPLATES, types = TYPES) {
  const errors = [], warnings = [];
  const check = (ok, text) => { if (!ok) errors.push(text); };
  if (!c || typeof c !== "object" || Array.isArray(c)) return {status: "INVALID", errors: ["Configuration must be an object."], warnings};
  if (!Array.isArray(c.studentFields) || !Array.isArray(c.instructions) || !c.features || !c.security || !c.branding || !c.penalty)
    return {status:"INVALID",errors:["Configuration sections are missing or malformed."],warnings};
  if (c.studentFields.some(f => !f || typeof f !== "object") || c.instructions.some(s => !s || typeof s !== "object"))
    return {status:"INVALID",errors:["Invalid field or instruction entry."],warnings};
  check(JSON.stringify(c).length <= 150000, "Configuration is too large.");
  check(Object.keys(c).every(k => Object.hasOwn(DEFAULTS, k)), "Unsupported configuration property.");
  check(c.schemaVersion === 2, "Unsupported schema version.");
  check(typeof c.instituteName === "string" && c.instituteName.trim().length >= 2 && c.instituteName.length <= 160, "Institute name must contain 2–160 characters.");
  check(/^[A-Z0-9][A-Z0-9_-]{2,23}$/.test(c.instituteCode || ""), "Institute code must contain 3–24 uppercase letters, numbers, hyphens or underscores.");
  check(types.includes(c.instituteType), "Unsupported institute type.");
  check(["NORMAL", "CBT"].includes(c.examMode), "Invalid exam mode.");
  for (const k of ["login", "instruction", "exam"]) {
    const id = c[k + "Template"], version = c[k + "TemplateVersion"];
    const t = registry.find(x => x.templateId === id && x.version === version);
    check(!!t && t.status !== "DISABLED" && t.supportedInstituteTypes.includes(c.instituteType), "Unsupported " + k + " template/version.");
    if (t?.status === "DEPRECATED") warnings.push(id + " is deprecated; existing pinned versions remain supported.");
  }
  check(c.examTemplate === (c.examMode === "CBT" ? "exam-cbt" : "exam-normal"), "Exam template must match exam mode.");
  if (c.examMode === "CBT") check(c.features?.cbt === true, "Enable CBT availability for CBT mode.");
  if (c.features?.palette) check(c.examMode === "CBT", "Question palette requires CBT mode.");
  for (const k of FEATURES) check(typeof c.features?.[k] === "boolean", "Invalid feature: " + k);
  for (const k of SECURITY) check(typeof c.security?.[k] === "boolean", "Invalid security option: " + k);
  if (c.security?.focusLock && !c.security?.fullscreen) errors.push("Focus Lock requires fullscreen.");
  for (const k of ["overlay", "dnd", "devtools", "screenshot"]) if (c.security?.[k])
    warnings.push(k + ": browser support is limited; this setting cannot guarantee detection or prevention.");
  if (!c.features?.advancedSecurity && ["fullscreen", "focusLock", "keyboard", "devtools", "overlay"].some(k => c.security?.[k]))
    errors.push("Selected security options require Advanced Security availability.");
  check(Number.isFinite(c.penalty?.marks) && c.penalty.marks >= 0 && c.penalty.marks <= 100, "Penalty marks must be 0–100.");
  check(Number.isInteger(c.penalty?.maximum) && c.penalty.maximum >= 0 && c.penalty.maximum <= 100, "Violation threshold must be 0–100 (0 disables auto-submit).");
  const fields = Array.isArray(c.studentFields) ? c.studentFields : [];
  check(fields.length >= 2 && fields.length <= 30, "Provide 2–30 student fields.");
  const names = new Set();
  for (const f of fields) {
    check(/^[a-z][a-zA-Z0-9_]{0,39}$/.test(f.name || "") && !["__proto__", "constructor", "prototype"].includes(f.name), "Invalid field identifier.");
    check(!names.has(f.name), "Duplicate field identifier: " + f.name); names.add(f.name);
    check(typeof f.label === "string" && f.label.length > 0 && f.label.length <= 100, "Invalid field label.");
    check(["text", "number", "email", "tel", "select", "date", "textarea"].includes(f.type), "Invalid field type.");
    check(typeof f.required === "boolean" && typeof f.visible === "boolean", "Field visibility and requirement must be explicit.");
    check(!f.required || f.visible, "Required fields must be visible.");
    if (f.type === "select") check(Array.isArray(f.options) && f.options.length > 0 && f.options.length <= 100 && f.options.every(o => typeof o === "string" && o.length > 0 && o.length <= 100), "Dropdown options are invalid.");
    for (const k of ["placeholder", "defaultValue", "helpText"]) check(typeof (f[k] ?? "") === "string" && (f[k] || "").length <= 300, "Invalid field " + k);
  }
  for (const [name, type] of [["name", "text"], ["email", "email"]])
    check(fields.some(f => f.name === name && f.type === type && f.required && f.visible), name + " is required for the existing candidate identity flow.");
  if (fields.length > 2) check(c.features?.customFields === true, "Custom fields availability is disabled.");
  check(Array.isArray(c.instructions) && c.instructions.length > 0 && c.instructions.length <= 30, "Provide 1–30 instruction sections.");
  for (const s of c.instructions || []) {
    check(["heading", "paragraph", "bullets", "numbered", "warning", "declaration"].includes(s.type), "Unsupported instruction component.");
    check(typeof s.heading === "string" && s.heading.length <= 160 && typeof s.text === "string" && s.text.trim().length > 0 && s.text.length <= 5000, "Instruction sections must contain valid text.");
  }
  check(c.instructions?.some(s => s.type === "declaration"), "A declaration section is required.");
  check(/^#[0-9a-f]{6}$/i.test(c.branding?.color || ""), "Invalid branding color.");
  for (const url of [c.branding?.logoUrl, c.website]) check(!url || (typeof url === "string" && /^https:\/\/[^\s]+$/.test(url) && url.length < 2000), "Assets and website must use HTTPS.");
  for (const k of ["contactEmail", "contactPhone", "address", "city", "state", "country", "supportContact"])
    check(typeof c[k] === "string" && c[k].length <= 500, "Invalid basic information: " + k);
  check(!c.contactEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contactEmail), "Invalid contact email.");
  check(["Basic", "Standard", "Professional", "Enterprise"].includes(c.plan), "Invalid plan.");
  check(Number.isInteger(c.maxAdmins) && c.maxAdmins >= 1 && c.maxAdmins <= 100, "Admin limit must be 1–100.");
  return {status: errors.length ? "INVALID" : warnings.length ? "WARNING" : "VALID", errors, warnings};
}
const api = {TYPES, FEATURES, SECURITY, TEMPLATES, PRESETS, defaults, validate};
if (typeof module !== "undefined") module.exports = api;
else globalThis.PlatformSchema = api;
