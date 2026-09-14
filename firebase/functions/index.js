"use strict";
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue, FieldPath} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
const {createHash, randomUUID} = require("node:crypto");
const S = require("./schema");
initializeApp();
const db = getFirestore(), auth = getAuth();
const stamp = () => FieldValue.serverTimestamp();
const fail = (code, message) => { throw new HttpsError(code, message); };
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const ref = (collection, id) => db.collection(collection).doc(id);
const object = x => x && typeof x === "object" && !Array.isArray(x);
const key = x => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const upper = x => String(x || "").trim().toUpperCase();
const canonical = p => ["super_admin", "superadmin", "super-admin"].includes(String(p?.role || "").toLowerCase()) && upper(p?.status) === "ACTIVE";
async function authorize(uid, tx) {
  if (!uid) fail("unauthenticated", "Sign in to continue.");
  const read = r => tx ? tx.get(r) : r.get();
  const [a, p] = await Promise.all([read(ref("superAdminAccess", uid)), read(ref("admins", uid))]);
  if (!a.exists || a.data().active !== true || !p.exists || !canonical(p.data()))
    fail("permission-denied", "An active Super Admin profile and authorization record are required.");
  return p.data();
}
function audit(tx, uid, action, id, before, after, requestId) {
  tx.create(db.collection("platformAudit").doc(), {
    timestamp: stamp(), actorUid: uid, action, targetId: id, before: before || null, after: after || null,
    requestId, scope: "platform"
  });
}
async function registry(tx) {
  const snap = await (tx ? tx.get(ref("platformSettings", "registry")) : ref("platformSettings", "registry").get());
  const data = snap.data() || {};
  return {templates: data.templates || S.TEMPLATES, types: data.types || S.TYPES, presets: data.presets || S.PRESETS};
}
function validate(config, reg) {
  const report = S.validate(config, reg.templates, reg.types);
  if (report.errors.length) fail("invalid-argument", report.errors.join("\n"));
  return report;
}
const READS = new Set(["overview", "listInstitutes", "listAdmins", "getInstitute", "history", "audit", "catalog", "settings", "validate"]);
async function readAction(action, p) {
  if (action === "catalog") return registry();
  if (action === "settings") return (await ref("platformSettings", "general").get()).data() || {platformName: "Bookesh", maintenanceMode: false, version: 0};
  if (action === "validate") { const r = await registry(); return S.validate(p.config, r.templates, r.types); }
  if (action === "overview") {
    const counts = {};
    counts.totalInstitutes = (await db.collection("institutes").count().get()).data().count;
    for (const status of ["ACTIVE", "SUSPENDED", "PENDING", "INACTIVE", "ARCHIVED"])
      counts[status] = (await db.collection("institutes").where("status", "==", status).count().get()).data().count;
    counts.activeAdmins = (await db.collection("admins").where("role", "==", "ADMIN").where("status", "==", "ACTIVE").count().get()).data().count;
    counts.disabledAdmins = (await db.collection("admins").where("role", "==", "ADMIN").where("status", "in", ["DISABLED", "SUSPENDED"]).count().get()).data().count;
    return {counts, checkedAt: new Date().toISOString(), backend: "Available", note: "Counts use canonical uppercase lifecycle states; migrate legacy states before relying on totals."};
  }
  if (action === "getInstitute" || action === "history") {
    if (!key(p.id)) fail("invalid-argument", "Invalid institute ID.");
    const root = ref("institutes", p.id);
    if (action === "history") return {items: (await root.collection("versions").orderBy("version", "desc").limit(50).get()).docs.map(d => ({id: d.id, ...d.data()}))};
    const [i, d] = await Promise.all([root.get(), root.collection("drafts").doc("current").get()]);
    if (!i.exists) fail("not-found", "Institute not found.");
    return {institute: {id: i.id, ...i.data()}, draft: d.data() || null};
  }
  if (action === "audit") {
    let q = db.collection("platformAudit").orderBy("timestamp", "desc").orderBy(FieldPath.documentId()).limit(50);
    if (p.cursor) { const d = await ref("platformAudit", p.cursor).get(); if (d.exists) q = q.startAfter(d); }
    const docs = (await q.get()).docs;
    return {items: docs.map(d => ({id: d.id, ...d.data()})), cursor: docs.length === 50 ? docs.at(-1).id : null};
  }
  const admins = action === "listAdmins";
  let q = db.collection(admins ? "admins" : "institutes").orderBy(FieldPath.documentId());
  // Filters are evaluated server-side. Cursor scans remain bounded and continuation is explicit.
  if (p.cursor && key(p.cursor)) q = q.startAfter(p.cursor);
  const docs = (await q.limit(200).get()).docs;
  const search = String(p.search || "").trim().toLowerCase();
  let items = docs.map(d => ({id: d.id, ...d.data()})).filter(d =>
    (!admins || ["ADMIN", "INSTITUTE_ADMIN"].includes(upper(d.role))) &&
    (!p.status || upper(d.status) === p.status) &&
    (!search || [d.instituteName, d.instituteCode, d.name, d.email, ...(d.adminEmails || [])].some(v => String(v || "").toLowerCase().includes(search)))
  );
  return {items, cursor: docs.length === 200 ? docs.at(-1).id : null, scanned: docs.length};
}
async function mutate(uid, action, p, requestId) {
  if (!key(requestId)) fail("invalid-argument", "A request ID is required.");
  const requestRef = ref("platformRequests", uid + "_" + requestId), digest = hash({action, p});
  const newId = randomUUID();
  return db.runTransaction(async tx => {
    await authorize(uid, tx);
    const prior = await tx.get(requestRef);
    if (prior.exists) {
      if (prior.data().digest !== digest) fail("already-exists", "Request ID was used for different data.");
      return prior.data().result;
    }
    const rateRef = ref("platformRateLimits", uid), rate = (await tx.get(rateRef)).data() || {};
    const minute = Math.floor(Date.now() / 60000), count = rate.minute === minute ? (rate.count || 0) : 0;
    if (count >= 40) fail("resource-exhausted", "Too many changes. Try again in a minute.");
    const finish = result => {
      tx.set(rateRef, {minute, count: count + 1});
      tx.create(requestRef, {digest, result, actorUid: uid, createdAt: stamp()});
      return result;
    };
    if (action === "saveSettings") {
      const r = ref("platformSettings", "general"), old = (await tx.get(r)).data() || {version: 0};
      if (p.expectedVersion !== old.version) fail("aborted", "Platform settings version conflict.");
      if (typeof p.platformName !== "string" || p.platformName.length < 2 || p.platformName.length > 100 || typeof p.maintenanceMode !== "boolean")
        fail("invalid-argument", "Invalid platform settings.");
      const next = {platformName: p.platformName, maintenanceMode: p.maintenanceMode, version: old.version + 1, updatedAt: stamp(), updatedBy: uid};
      tx.set(r, next); tx.set(ref("globalSettings", "emergency"), {maintenanceMode: p.maintenanceMode}, {merge: true});
      audit(tx, uid, "PLATFORM_SETTINGS_CHANGED", "general", old, next, requestId);
      return finish({version: next.version});
    }
    if (action === "saveRegistry") {
      const old = await registry(tx), next = p.registry;
      if (!object(next) || !Array.isArray(next.templates) || !Array.isArray(next.types) || !Array.isArray(next.presets)) fail("invalid-argument", "Invalid registry.");
      // Existing renderer identities are immutable. New versions may select supported layouts only.
      const identities = new Set();
      for (const t of next.templates) {
        const identity = t.templateId + ":" + t.version;
        if (!S.TEMPLATES.some(b => b.templateId === t.templateId) || !Number.isInteger(t.version) || t.version < 1 ||
          identities.has(identity) || !["ACTIVE", "DEPRECATED", "DISABLED"].includes(t.status) ||
          !Array.isArray(t.supportedInstituteTypes) || !t.supportedInstituteTypes.length ||
          t.supportedInstituteTypes.some(x => !next.types.includes(x))) fail("invalid-argument", "Invalid template version.");
        identities.add(identity);
      }
      if (old.templates.some(t => !identities.has(t.templateId + ":" + t.version))) fail("failed-precondition", "Historical template versions cannot be removed.");
      if (next.types.length > 30 || next.types.some(t => !/^[A-Z][A-Z0-9_]{1,39}$/.test(t))) fail("invalid-argument", "Invalid institute types.");
      for (const preset of next.presets) if (!key(preset.id) || !Number.isInteger(preset.version) || !object(preset.settings) || Object.entries(preset.settings).some(([k,v]) => !S.SECURITY.includes(k) || typeof v !== "boolean"))
        fail("invalid-argument", "Invalid security preset.");
      if (hash(old) !== p.expectedHash) fail("aborted", "Registry version conflict. Reload first.");
      tx.set(ref("platformSettings", "registry"), next);
      audit(tx, uid, "REGISTRY_CHANGED", "registry", old, next, requestId);
      return finish({saved: true});
    }
    if (action === "createInstitute" || action === "cloneInstitute") {
      const counterRef = ref("platformSettings", "instituteCounter"), counter = (await tx.get(counterRef)).data()?.value || 0;
      let config = p.config;
      if (action === "cloneInstitute") {
        if (!key(p.sourceId)) fail("invalid-argument", "Invalid source ID.");
        const source = await tx.get(ref("institutes", p.sourceId));
        if (!source.exists || !source.data().config) fail("failed-precondition", "Publish a configuration before cloning.");
        config = {...source.data().config, instituteName: p.name, instituteCode: p.code || "", branding: {...source.data().config.branding, logoUrl: ""}};
      }
      if (!object(config)) fail("invalid-argument", "Configuration is required.");
      config = {...config, instituteCode: upper(config.instituteCode) || "ACC" + String(counter + 1).padStart(3, "0")};
      if (!/^[A-Z0-9][A-Z0-9_-]{2,23}$/.test(config.instituteCode)) fail("invalid-argument", "Invalid institute code.");
      let allocatedCounter = counter + 1;
      let codeRef = ref("instituteCodes", config.instituteCode), code = await tx.get(codeRef);
      let legacy = await tx.get(db.collection("institutes").where("instituteCode", "==", config.instituteCode).limit(1));
      const automatic = !upper(action === "cloneInstitute" ? p.code : p.config.instituteCode);
      for (let attempt = 0; automatic && (code.exists || !legacy.empty) && attempt < 100; attempt++) {
        allocatedCounter++;
        config.instituteCode = "ACC" + String(allocatedCounter).padStart(3, "0");
        codeRef = ref("instituteCodes", config.instituteCode); code = await tx.get(codeRef);
        legacy = await tx.get(db.collection("institutes").where("instituteCode", "==", config.instituteCode).limit(1));
      }
      if (code.exists || !legacy.empty) fail("already-exists", "Institute code already exists. Choose another code.");
      const reg = await registry(tx), report = S.validate(config, reg.templates, reg.types);
      const data = {instituteName: config.instituteName || "Untitled institute", instituteCode: config.instituteCode, instituteType: config.instituteType,
        status: "PENDING", platformSchema: 2, configurationVersion: 0, revision: 1, adminCount: 0, adminEmails: [],
        configurationStatus: "DRAFT", createdAt: stamp(), updatedAt: stamp(), createdBy: uid, updatedBy: uid};
      const root = ref("institutes", newId);
      tx.create(root, data);
      tx.create(root.collection("drafts").doc("current"), {config, revision: 1, baseVersion: 0, validation: report, updatedBy: uid, updatedAt: stamp()});
      tx.create(codeRef, {instituteId: newId});
      tx.set(counterRef, {value: allocatedCounter});
      audit(tx, uid, action === "cloneInstitute" ? "INSTITUTE_CLONED" : "INSTITUTE_CREATED", newId, null, data, requestId);
      return finish({id: newId, code: config.instituteCode, revision: 1, status: "PENDING"});
    }
    if (!key(p.id)) fail("invalid-argument", "Invalid institute ID.");
    const root = ref("institutes", p.id), snap = await tx.get(root);
    if (!snap.exists) fail("not-found", "Institute not found.");
    const old = snap.data();
    if (action === "saveDraft") {
      if (p.expectedRevision !== (old.revision || 0)) fail("aborted", "Configuration version conflict. Reload and compare your draft.");
      if (!object(p.config) || JSON.stringify(p.config).length > 150000) fail("invalid-argument", "Invalid draft.");
      if (p.config.instituteCode !== old.instituteCode) fail("failed-precondition", "Institute code is fixed after creation.");
      const reg = await registry(tx), report = S.validate(p.config, reg.templates, reg.types);
      const revision = (old.revision || 0) + 1;
      tx.set(root.collection("drafts").doc("current"), {config: p.config, revision, baseVersion: old.configurationVersion || 0, validation: report, updatedAt: stamp(), updatedBy: uid});
      tx.update(root, {revision, updatedAt: stamp(), updatedBy: uid});
      audit(tx, uid, "DRAFT_SAVED", p.id, {revision: old.revision || 0}, {revision}, requestId);
      return finish({revision, validation: report});
    }
    if (action === "publish" || action === "rollback") {
      if (p.expectedVersion !== (old.configurationVersion || 0) || p.expectedRevision !== (old.revision || 0)) fail("aborted", "Configuration version conflict.");
      const source = action === "rollback" ? root.collection("versions").doc(String(p.version)) : root.collection("drafts").doc("current");
      const draft = await tx.get(source);
      if (!draft.exists) fail("not-found", "Configuration version not found.");
      const config = draft.data().config, reg = await registry(tx), report = validate(config, reg);
      if ((old.adminCount || 0) > config.maxAdmins) fail("failed-precondition", "Configured admin limit is below the number of reserved administrator slots.");
      const version = (old.configurationVersion || 0) + 1;
      tx.create(root.collection("versions").doc(String(version)), {config, version, validation: report, createdAt: stamp(), createdBy: uid, restoredFrom: action === "rollback" ? p.version : null});
      tx.update(root, {config, platformSchema: 2, instituteName: config.instituteName, instituteType: config.instituteType, configurationVersion: version,
        configurationStatus: "PUBLISHED", configurationHealth: report.status, updatedAt: stamp(), updatedBy: uid});
      tx.set(ref("publicInstitutes", p.id), {config: publicConfig(config), configurationVersion: version, status: old.status, instituteId: p.id, updatedAt: stamp()});
      // Compatibility policy projection for the existing exam engine.
      tx.set(ref("securityPolicies", p.id), {instituteId: p.id, status: "PUBLISHED", version,
        settings: {tabSwitch: {enabled: config.security.tabSwitch, penaltyMarks: config.penalty.marks}, copyPaste: {enabled: config.security.copyPaste},
          refresh: {enabled: config.security.refresh}, keyboard: {enabled: config.security.keyboard}, fullscreen: {enabled: config.security.fullscreen},
          maxViolations: config.penalty.maximum, action: "warning"}, updatedAt: stamp()});
      audit(tx, uid, action === "rollback" ? "CONFIGURATION_ROLLED_BACK" : "CONFIGURATION_PUBLISHED", p.id, {version: old.configurationVersion || 0}, {version}, requestId);
      return finish({version, validation: report});
    }
    if (action === "setStatus") {
      const status = upper(p.status);
      if (!["PENDING", "ACTIVE", "SUSPENDED", "INACTIVE", "ARCHIVED"].includes(status)) fail("invalid-argument", "Invalid lifecycle status.");
      if (p.expectedStatus !== old.status) fail("aborted", "Institute status changed. Reload first.");
      if (old.status === "ARCHIVED" && status !== "PENDING") fail("failed-precondition", "Restore archived institutes to PENDING before activation.");
      if (status === "ACTIVE") {
        validate(old.config, await registry(tx));
        const activeAdmins = await tx.get(db.collection("admins").where("instituteId","==",p.id).where("role","==","ADMIN").where("status","==","ACTIVE").limit(1));
        if (!old.configurationVersion || activeAdmins.empty) fail("failed-precondition", "Publish valid configuration and create an active Institute Admin before activation.");
      }
      tx.update(root, {status, updatedAt: stamp(), updatedBy: uid});
      tx.set(ref("publicInstitutes", p.id), {status}, {merge: true});
      audit(tx, uid, "INSTITUTE_STATUS_CHANGED", p.id, {status: old.status}, {status}, requestId);
      return finish({status});
    }
    fail("invalid-argument", "Unsupported operation.");
  });
}
function publicConfig(c) {
  const {contactEmail, contactPhone, address, city, state, country, website, plan, maxAdmins, ...safe} = c;
  delete safe.instituteCode;
  return safe;
}
async function provision(uid, p, requestId) {
  if (!key(requestId) || !key(p.instituteId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email || "") || !String(p.name || "").trim()) fail("invalid-argument", "Name, email and institute are required.");
  const email = p.email.trim().toLowerCase(), digest = hash({...p, email});
  const opRef = ref("adminProvisioning", uid + "_" + requestId), adminUid = "ia_" + hash(uid + "_" + requestId).slice(0,40);
  await db.runTransaction(async tx => {
    await authorize(uid, tx);
    const [op, inst, lock] = await Promise.all([tx.get(opRef), tx.get(ref("institutes", p.instituteId)), tx.get(ref("adminEmails", hash(email)))]);
    if (op.exists) { if (op.data().digest !== digest) fail("already-exists", "Request ID conflict."); return; }
    if (!inst.exists || inst.data().status === "ARCHIVED") fail("failed-precondition", "Institute is unavailable.");
    if (lock.exists) fail("already-exists", "Email is already assigned or pending provisioning.");
    const count = inst.data().adminCount || 0, max = inst.data().config?.maxAdmins || 3;
    if (count >= max) fail("resource-exhausted", "Institute admin limit reached.");
    tx.create(opRef, {digest, adminUid, email, instituteId: p.instituteId, status: "PENDING", name: p.name, phone: p.phone || "", actorUid: uid, requestId, createdAt: stamp()});
    tx.create(ref("adminEmails", hash(email)), {adminUid, instituteId: p.instituteId});
    tx.update(ref("institutes", p.instituteId), {adminCount: count + 1});
    audit(tx, uid, "ADMIN_PROVISIONING_STARTED", adminUid, null, {email, instituteId: p.instituteId}, requestId);
  });
  const existing = (await opRef.get()).data();
  if (existing.status === "COMPLETE") return {uid: adminUid, email, status: "ACTIVE"};
  try {
    try { await auth.createUser({uid: adminUid, email, displayName: p.name.trim(), disabled: false}); }
    catch (e) { if (e.code !== "auth/uid-already-exists") throw e; const u = await auth.getUser(adminUid); if (u.email !== email) throw e; }
    await db.runTransaction(async tx => {
      await authorize(uid, tx);
      const [op, inst] = await Promise.all([tx.get(opRef), tx.get(ref("institutes", p.instituteId))]);
      if (op.data().status === "COMPLETE") return;
      if (!inst.exists || inst.data().status === "ARCHIVED") fail("failed-precondition", "Institute is archived.");
      tx.set(ref("admins", adminUid), {uid: adminUid, name: p.name.trim(), email, phone: String(p.phone || ""),
        instituteId: p.instituteId, instituteIds: [p.instituteId], role: "ADMIN", status: "ACTIVE",
        permissionMode: "EXAM_MANAGER", permissions: ["dashboard.view","exam.view","exam.create","exam.edit","exam.control","batch.manage","question.view","question.create","question.edit","question.delete","candidate.view","candidate.manage","result.view","result.export","feedback.view","security.view"],
        createdAt: stamp(), createdBy: uid, updatedAt: stamp()});
      tx.update(ref("institutes", p.instituteId), {adminEmails: FieldValue.arrayUnion(email)});
      tx.update(opRef, {status: "COMPLETE", updatedAt: stamp()});
      audit(tx, uid, "ADMIN_CREATED", adminUid, null, {email, instituteId: p.instituteId}, requestId);
    });
    return {uid: adminUid, email, status: "ACTIVE"};
  } catch (e) {
    await opRef.set({status: "RETRY_REQUIRED", errorCode: String(e.code || "unknown"), updatedAt: stamp()}, {merge: true});
    fail("failed-precondition", "Admin provisioning needs retry with the same request. " + (e.code === "auth/email-already-exists" ? "The email already exists in Authentication; use a different email or reconcile the existing account." : "No administrator access is granted until the profile is complete."));
  }
}
async function adminStatus(uid, p, requestId) {
  if (!key(p.uid) || !key(requestId) || !["ACTIVE","DISABLED","SUSPENDED"].includes(p.status)) fail("invalid-argument", "Invalid administrator change.");
  const opRef=ref("platformRequests",uid+"_"+requestId), digest=hash({action:"adminStatus",p});
  await db.runTransaction(async tx => {
    await authorize(uid, tx);
    const [a,op]=await Promise.all([tx.get(ref("admins",p.uid)),tx.get(opRef)]);
    if(op.exists){if(op.data().digest!==digest)fail("already-exists","Request ID conflict.");return;}
    if (!a.exists || upper(a.data().role) !== "ADMIN") fail("permission-denied", "Only Institute Admin accounts can be changed here.");
    tx.update(a.ref, {status: p.status, updatedAt: stamp(), updatedBy: uid});
    tx.create(opRef,{digest,status:"PENDING",createdAt:stamp()});
    audit(tx, uid, "ADMIN_STATUS_CHANGED", p.uid, {status: a.data().status}, {status: p.status}, requestId);
  });
  await auth.updateUser(p.uid, {disabled: p.status !== "ACTIVE"});
  if (p.status !== "ACTIVE") await auth.revokeRefreshTokens(p.uid);
  await opRef.set({status:"COMPLETE",result:{status:p.status}}, {merge:true});
  return {status: p.status};
}
exports.platformAdmin = onCall({region: "asia-south1", maxInstances: 10, timeoutSeconds: 60}, async request => {
  const uid = request.auth?.uid;
  await authorize(uid);
  const {action, payload = {}, requestId} = request.data || {};
  if (!object(payload)) fail("invalid-argument", "Invalid payload.");
  if (READS.has(action)) return readAction(action, payload);
  if (action === "createAdmin") return provision(uid, payload, requestId);
  if (action === "adminStatus") return adminStatus(uid, payload, requestId);
  return mutate(uid, action, payload, requestId);
});
exports.resolveInstitute = onCall({region: "asia-south1", maxInstances: 10}, async request => {
  if (!request.auth) fail("unauthenticated", "Candidate session is required.");
  const code = upper(request.data?.code);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,23}$/.test(code)) fail("invalid-argument", "Invalid Institute Code.");
  const rateRef = ref("gatewayRateLimits", request.auth.uid);
  await db.runTransaction(async tx => {
    const r = (await tx.get(rateRef)).data() || {}, minute = Math.floor(Date.now()/60000);
    const count = r.minute === minute ? r.count : 0;
    if (count >= 15) fail("resource-exhausted", "Too many code checks. Try again in a minute.");
    tx.set(rateRef, {minute, count: count + 1});
  });
  const emergency = (await ref("globalSettings", "emergency").get()).data() || {};
  if (emergency.maintenanceMode || emergency.candidateLoginDisabled) fail("unavailable", "The examination portal is temporarily unavailable.");
  const mapping = await ref("instituteCodes", code).get();
  let institute;
  if (mapping.exists) institute = await ref("institutes", mapping.data().instituteId).get();
  else {
    const legacy = await db.collection("institutes").where("instituteCode", "==", code).limit(2).get();
    if (legacy.size > 1) fail("failed-precondition", "Institute code configuration conflict.");
    institute = legacy.docs[0];
  }
  if (!institute?.exists) fail("not-found", "Invalid Institute Code.");
  const data = institute.data();
  if (upper(data.status) !== "ACTIVE") fail("failed-precondition", "Institute " + String(data.status || "inactive").toLowerCase() + ".");
  if (data.platformSchema === 2 && !data.config) fail("failed-precondition", "Configuration Missing.");
  const result = {instituteId: institute.id, instituteName: data.instituteName, status: "ACTIVE",
    configurationVersion: data.configurationVersion || 0, config: data.config ? publicConfig(data.config) : null};
  await ref("instituteSessions", request.auth.uid).set({instituteId: institute.id, resolvedAt: stamp()});
  return result;
});

exports.registerCandidate = onCall({region:"asia-south1",maxInstances:10}, async request => {
  const uid=request.auth?.uid;if(!uid)fail("unauthenticated","Candidate session required.");
  const {name,email,fields={},examId}=request.data||{};
  if(typeof name!=="string"||name.trim().length<2||name.length>160||typeof email!=="string"||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!key(examId)||!object(fields))
    fail("invalid-argument","Invalid candidate details.");
  return db.runTransaction(async tx=>{
    const session=await tx.get(ref("instituteSessions",uid));
    if(!session.exists)fail("permission-denied","Verify the institute code first.");
    const instituteId=session.data().instituteId;
    const [inst,exam,old]=await Promise.all([tx.get(ref("institutes",instituteId)),tx.get(ref("exams",examId)),tx.get(ref("candidates",uid))]);
    if(!inst.exists||upper(inst.data().status)!=="ACTIVE")fail("failed-precondition","Institute is not active.");
    if(!exam.exists||exam.data().instituteId!==instituteId||exam.data().status!=="LIVE")fail("permission-denied","Examination is not available for this institute.");
    const definitions=inst.data().config?.studentFields||S.DEFAULTS?.studentFields||S.defaults().studentFields;
    if(Object.keys(fields).some(k=>!definitions.some(f=>f.name===k)))fail("invalid-argument","Unsupported candidate field.");
    for(const field of definitions){
      const v=field.name==="name"?name:field.name==="email"?email:fields[field.name]??"";
      if(typeof v!=="string"||v.length>1000)fail("invalid-argument","Invalid "+field.label);
      if(field.required&&!v.trim())fail("invalid-argument",field.label+" is required.");
      if(v&&field.type==="select"&&!field.options.includes(v))fail("invalid-argument","Invalid "+field.label);
      if(v&&field.type==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))fail("invalid-argument","Invalid email.");
      if(v&&field.type==="number"&&!Number.isFinite(Number(v)))fail("invalid-argument","Invalid number.");
      if(v&&field.type==="date"&&!/^\d{4}-\d{2}-\d{2}$/.test(v))fail("invalid-argument","Invalid date.");
      if(v&&field.type==="tel"&&!/^[+0-9() -]{6,25}$/.test(v))fail("invalid-argument","Invalid phone.");
    }
    if(old.exists&&old.data().examId===examId&&["active","submitted","completed","auto_submitted","disqualified"].includes(old.data().status))
      fail("already-exists","This candidate has already attempted the examination.");
    tx.set(ref("candidates",uid),{ownerUid:uid,instituteId,examId,name:name.trim(),email:email.trim().toLowerCase(),customFields:fields,
      status:"verified",loginTime:stamp(),updatedAt:stamp()});
    return {verified:true};
  });
});
