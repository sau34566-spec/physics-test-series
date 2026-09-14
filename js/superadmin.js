// Platform-only console. No student, exam, question or result subscriptions.
import {getStorage, ref, uploadBytes, getDownloadURL} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import {auth, app} from "./firebase-config.js";
import {onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, setPersistence, browserSessionPersistence}
  from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {getFunctions, httpsCallable} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";
const S = globalThis.PlatformSchema, endpoint = httpsCallable(getFunctions(app, "asia-south1"), "platformAdmin");
const $ = id => document.getElementById(id);
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = x => JSON.parse(JSON.stringify(x));
let page = "Dashboard", catalog = {templates:S.TEMPLATES,types:S.TYPES,presets:S.PRESETS}, current = null, draft = null, step = 0, busy = false, generation = 0;
let listState = {items:[],cursor:null}, search = "", filter = "", settings = null;
const pending = new Map();
function notice(message) { $("notice").textContent = message; clearTimeout(notice.timer); notice.timer = setTimeout(() => $("notice").textContent = "", 15000); }
function message(e) {
  if (String(e.code).includes("not-found") && !e.message?.includes("Institute"))
    return "Platform backend is not available. Deploy the Firebase Functions before using this console.";
  return e.message || "Operation failed. Please retry.";
}
async function api(action, payload = {}) {
  const read = ["overview","listInstitutes","listAdmins","getInstitute","history","audit","catalog","settings","validate"].includes(action);
  const signature = JSON.stringify({action,payload});
  if (!pending.has(signature)) pending.set(signature, crypto.randomUUID());
  try {
    const result = (await endpoint({action,payload,requestId:pending.get(signature)})).data;
    pending.delete(signature); return result;
  } catch(e) { if (read) pending.delete(signature); throw e; }
}
async function run(fn) {
  if (busy) return;
  busy = true; document.querySelectorAll("button").forEach(b => b.disabled = true);
  try { await fn(); } catch(e) { notice(message(e)); }
  finally { busy = false; document.querySelectorAll("button").forEach(b => b.disabled = false); }
}
const badge = value => '<span class="badge '+esc(value)+'">'+esc(value || "UNKNOWN")+'</span>';
const field = (label, path, value, type="text") => '<label>'+esc(label)+'<input data-path="'+esc(path)+'" type="'+type+'" value="'+esc(value)+'"></label>';
const select = (label,path,value,options) => '<label>'+esc(label)+'<select data-path="'+esc(path)+'">'+options.map(v => '<option '+(v===value?"selected":"")+'>'+esc(v)+'</option>').join("")+'</select></label>';
const check = (label,path,value) => '<label class="check"><input data-path="'+esc(path)+'" type="checkbox" '+(value?"checked":"")+'>'+esc(label)+'</label>';
const nav = ["Dashboard","Institutes","Institute Admins","Templates","Security Presets","Platform Settings","Institute Health","Audit Logs","My Account"];
$("nav").innerHTML = nav.map(n => '<button data-page="'+n+'">'+n+'</button>').join("");
$("nav").onclick = e => { if(e.target.dataset.page) run(() => navigate(e.target.dataset.page)); };
$("menu").onclick = () => $("sidebar").classList.toggle("open");
$("logout").onclick = () => run(() => signOut(auth));
$("createTop").onclick = () => run(() => newInstitute());
$("loginForm").onsubmit = e => { e.preventDefault(); run(async () => {
  $("loginError").textContent = "";
  try { await setPersistence(auth,browserSessionPersistence); await signInWithEmailAndPassword(auth,$("email").value,$("password").value); }
  catch(e) { $("loginError").textContent = message(e); }
}); };
$("resetPassword").onclick = () => run(async () => { await sendPasswordResetEmail(auth,$("email").value); notice("If this account can receive a reset email, check its inbox."); });
$("closePreview").onclick = () => $("preview").close();
onAuthStateChanged(auth, async user => {
  generation++;
  if (!user) { $("appShell").hidden=true; $("loginScreen").hidden=false; $("loginScreen").style.display="grid"; $("content").replaceChildren(); return; }
  try {
    // The callable checks both the live authorization record and canonical profile.
    catalog = await api("catalog");
    $("loginScreen").style.display="none"; $("appShell").hidden=false;
    await navigate("Dashboard");
  } catch(e) { $("loginError").textContent=message(e); $("appShell").hidden=true; $("loginScreen").style.display="grid"; }
});
async function navigate(name) {
  page=name; generation++; current=null; draft=null;
  $("pageTitle").textContent=name; $("sidebar").classList.remove("open");
  document.querySelectorAll("[data-page]").forEach(b => b.classList.toggle("active", b.dataset.page===name));
  $("content").innerHTML='<div class="panel">Loading…</div>';
  try {
    if(name==="Dashboard") {
      const d=await api("overview");
      const cards=[["Total Institutes",d.counts.totalInstitutes],...["ACTIVE","SUSPENDED","PENDING","INACTIVE","ARCHIVED"].map(k=>[k,d.counts[k]]),["Active Institute Admins",d.counts.activeAdmins],["Disabled / Suspended Admins",d.counts.disabledAdmins]];
      $("content").innerHTML='<div class="cards">'+cards.map(([k,v])=>'<div class="panel"><div class="muted">'+k+'</div><div class="metric">'+v+'</div></div>').join("")+'</div><div class="panel"><h2>Platform status</h2><p>Administration backend: '+esc(d.backend)+'</p><p class="muted">Checked '+esc(d.checkedAt)+'. Student portal health requires separate end-to-end testing.</p><button data-action="recent">Recent administrative actions</button></div>';
    } else if(["Institutes","Institute Admins","Institute Health"].includes(name)) {
      search="";filter="";listState={items:[],cursor:null}; await loadList(false);
    } else if(name==="Audit Logs") { listState={items:[],cursor:null}; await auditPage(false); }
    else if(["Templates","Security Presets"].includes(name)) await registryPage();
    else if(name==="Platform Settings") {
      settings=await api("settings");
      $("content").innerHTML='<div class="panel"><h2>Platform defaults</h2><p>These settings do not rewrite existing institute configurations.</p><div class="grid">'+field("Platform name","platformName",settings.platformName)+check("Maintenance mode: block new portal entry","maintenanceMode",settings.maintenanceMode)+'</div><div class="actions"><button data-action="saveSettings">Save platform settings</button></div><p class="muted">Version '+settings.version+'</p></div>';
    } else $("content").innerHTML='<div class="panel"><h2>My account</h2><p>'+esc(auth.currentUser.email)+'</p><p>Role: Super Admin</p><button data-action="password">Send password reset email</button></div>';
  } catch(e) { $("content").innerHTML='<div class="panel"><h2>Unable to load</h2><p class="error">'+esc(message(e))+'</p><button data-action="retry">Retry</button></div>'; }
}
async function loadList(more) {
  const isAdmin=page==="Institute Admins";
  const response=await api(isAdmin?"listAdmins":"listInstitutes",{search,status:filter,cursor:more?listState.cursor:null});
  listState={items:more?[...listState.items,...response.items]:response.items,cursor:response.cursor};
  const rows=listState.items.map(i=>'<tr><td>'+esc(isAdmin?i.name:i.instituteName)+'<div class="muted">'+esc(isAdmin?i.email:i.instituteCode)+'</div></td><td>'+badge(i.status)+'</td><td>'+esc(isAdmin?i.instituteId||i.instituteIds?.join(","):i.configurationVersion||0)+'</td><td>'+ (isAdmin?
    ["ACTIVE","DISABLED","SUSPENDED"].map(s=>'<button class="secondary" data-admin="'+esc(i.id)+'" data-status="'+s+'">'+s+'</button>').join(""):
    '<div>'+badge(i.configurationHealth || (i.platformSchema===2?"INCOMPLETE":"LEGACY"))+'</div><button data-open="'+esc(i.id)+'">Configure</button><button class="secondary" data-history="'+esc(i.id)+'">History</button>')+'</td></tr>').join("");
  $("content").innerHTML='<div class="panel"><div class="toolbar"><input id="search" placeholder="Search name, code or admin email" value="'+esc(search)+'"><select id="filter"><option value="">All statuses</option>'+["ACTIVE","DISABLED","SUSPENDED","PENDING","INACTIVE","ARCHIVED"].map(s=>'<option '+(filter===s?"selected":"")+'>'+s+'</option>').join("")+'</select><button data-action="search">Search</button>'+(isAdmin?'<button data-action="newAdmin">Create Institute Admin</button>':"")+'</div><div class="tablewrap"><table><thead><tr><th>'+(isAdmin?"Administrator":"Institute")+'</th><th>Status</th><th>'+(isAdmin?"Institute ID":"Published version")+'</th><th>Actions / configuration health</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+(!rows?'<p>No matching records in this page.</p>':"")+(listState.cursor?'<button data-action="more">Load next records</button>':"")+'<p class="muted">Search is applied to backend records in pages of 200. Load next records to continue searching.</p></div>';
}
async function newInstitute() {
  current=null;draft=S.defaults(); step=0;page="Create Institute";$("pageTitle").textContent=page;renderWizard();
}
async function openInstitute(id) {
  const data=await api("getInstitute",{id}); current=data.institute;
  draft=clone(data.draft?.config || current.config || {...S.defaults(),instituteName:current.instituteName||"",instituteCode:current.instituteCode||""});
  step=0;$("pageTitle").textContent=current.instituteName;renderWizard();
}
const steps=["Basic Information","Institute Type","Login Template","Student Fields","Instruction Template","Instruction Editor","Exam Mode","Security","Features","Review & Create"];
function templateChoices(type,prop) {
  return '<div class="grid">'+catalog.templates.filter(t=>t.templateType===type&&t.status==="ACTIVE"&&t.supportedInstituteTypes.includes(draft.instituteType)).map(t=>'<div class="template '+(draft[prop]===t.templateId&&draft[prop+"Version"]===t.version?"selected":"")+'"><div class="swatch"></div><strong>'+esc(t.templateName)+'</strong><p>Version '+t.version+'</p><button data-template="'+esc(t.templateId)+'" data-version="'+t.version+'" data-prop="'+prop+'">Select</button><button class="secondary" data-preview="'+type+'" data-template-preview="'+esc(t.templateId)+'">Preview</button></div>').join("")+'</div>';
}
function renderWizard() {
  let body="";
  if(step===0) body='<div class="grid">'+field("Institute name","instituteName",draft.instituteName)+field("Institute code (blank generates a unique code)","instituteCode",draft.instituteCode)+["contactEmail","contactPhone","address","city","state","country","website","supportContact"].map(k=>field(k.replace(/([A-Z])/g," $1"),k,draft[k])).join("")+field("Logo HTTPS URL","branding.logoUrl",draft.branding.logoUrl)+(current?'<label>Upload logo (PNG / JPEG / WebP, under 2 MB)<input id="logoUpload" type="file" accept="image/png,image/jpeg,image/webp"></label>':"")+field("Brand color","branding.color",draft.branding.color,"color")+'</div>'+(current?'<p class="muted">Institute ID: '+esc(current.id)+' · Code is fixed after creation.</p>':"");
  if(step===1) body=select("Institute type","instituteType",draft.instituteType,catalog.types)+'<p>School defaults to Normal mode; Competitive defaults to CBT. New configured institute types can use either supported mode.</p>';
  if(step===2) body=templateChoices("login","loginTemplate");
  if(step===3) body=draft.studentFields.map((v,i)=>'<div class="item"><div class="grid">'+field("Stable field name","studentFields."+i+".name",v.name)+field("Label","studentFields."+i+".label",v.label)+select("Type","studentFields."+i+".type",v.type,["text","number","email","tel","select","date","textarea"])+field("Placeholder","studentFields."+i+".placeholder",v.placeholder)+field("Default value","studentFields."+i+".defaultValue",v.defaultValue)+field("Help text","studentFields."+i+".helpText",v.helpText)+check("Required","studentFields."+i+".required",v.required)+check("Visible","studentFields."+i+".visible",v.visible)+(v.type==="select"?field("Options (comma separated)","studentFields."+i+".options",(v.options||[]).join(", ")):"")+'</div><div class="actions"><button class="secondary" data-move="studentFields" data-index="'+i+'" data-direction="-1">Move up</button><button class="secondary" data-move="studentFields" data-index="'+i+'" data-direction="1">Move down</button>'+(i>1?'<button class="danger" data-remove="studentFields" data-index="'+i+'">Delete</button>':"")+'</div></div>').join("")+'<button data-add="studentFields">+ Add Field</button><p class="muted">Name and Email remain required for the existing candidate identity flow. Phone numbers should use Phone, not Number.</p>';
  if(step===4) body=templateChoices("instructions","instructionTemplate");
  if(step===5) body=draft.instructions.map((v,i)=>'<div class="item"><div class="grid">'+select("Section type","instructions."+i+".type",v.type,["heading","paragraph","bullets","numbered","warning","declaration"])+field("Heading","instructions."+i+".heading",v.heading)+'</div><label>Content (one list item per line)<textarea data-path="instructions.'+i+'.text">'+esc(v.text)+'</textarea></label><div class="actions"><button class="secondary" data-move="instructions" data-index="'+i+'" data-direction="-1">Move up</button><button class="secondary" data-move="instructions" data-index="'+i+'" data-direction="1">Move down</button><button class="danger" data-remove="instructions" data-index="'+i+'">Delete</button></div></div>').join("")+'<button data-add="instructions">+ Add Section</button>';
  if(step===6) body=select("Exam interface","examMode",draft.examMode,["NORMAL","CBT"])+'<p>Institute Admin manages individual exams. This console controls the available interface only.</p><button data-preview="exam">Preview Exam Mode</button>';
  if(step===7) body='<label>Security preset<select id="preset"><option value="">Custom</option>'+catalog.presets.map((p,i)=>'<option value="'+i+'">'+esc(p.name)+' v'+p.version+'</option>').join("")+'</select></label><div class="grid">'+S.SECURITY.map(k=>check(k,"security."+k,draft.security[k])).join("")+field("Penalty marks","penalty.marks",draft.penalty.marks,"number")+field("Auto-submit after violations (0 = off)","penalty.maximum",draft.penalty.maximum,"number")+'</div><p>Browser controls are best effort. DND is manual. Overlay, screenshots and DevTools cannot be reliably blocked or detected. Multi-finger gestures do not incur penalties.</p>';
  if(step===8) body='<div class="grid">'+S.FEATURES.map(k=>check(k,"features."+k,draft.features[k])).join("")+select("Plan label","plan",draft.plan,["Basic","Standard","Professional","Enterprise"])+field("Maximum Institute Admins","maxAdmins",draft.maxAdmins,"number")+'</div><p>Feature availability is separate from individual exam settings. No payment or billing is enabled.</p>';
  if(step===9) { const report=S.validate(draft,catalog.templates,catalog.types); body='<h2>Review configuration</h2>'+badge(report.status)+'<ul>'+[...report.errors,...report.warnings].map(s=>'<li>'+esc(s)+'</li>').join("")+'</ul><pre>'+esc(JSON.stringify(draft,null,2))+'</pre>'; }
  $("content").innerHTML='<div class="steps">'+steps.map((s,i)=>'<button class="'+(step===i?"current":"")+'" data-step="'+i+'">'+(i+1)+'. '+s+'</button>').join("")+'</div><div class="panel"><h2>'+steps[step]+'</h2>'+body+'</div><div class="panel"><div class="actions"><button class="secondary" data-action="previous">Previous</button><button data-action="next">Next</button><button class="secondary" data-action="saveDraft">'+(current?"Save Draft":"Create Institute / Save Draft")+'</button><button class="secondary" data-action="validate">Validate Configuration</button><button class="secondary" data-preview="login">Preview Student Portal</button><button class="secondary" data-preview="instructions">Preview Instructions</button></div>'+(current?'<p>'+badge(current.status)+' · Published v'+(current.configurationVersion||0)+' · Draft revision '+(current.revision||0)+'</p><div class="actions"><button data-action="publish">Publish Configuration</button><button class="secondary" data-action="newAdmin">Create Institute Admin</button><button class="secondary" data-action="history">Configuration History</button><button class="secondary" data-action="clone">Clone Configuration</button>'+["ACTIVE","SUSPENDED","INACTIVE","ARCHIVED",...(current.status==="ARCHIVED"?["PENDING"]:[])].map(s=>'<button class="'+(s==="ARCHIVED"?"danger":"secondary")+'" data-status-change="'+s+'">'+(s==="ACTIVE"?"Activate":s==="PENDING"?"Restore to Pending":s)+'</button>').join("")+'</div><p class="muted">Student portal: <a href="../index.html" target="_blank" rel="noopener">Open</a> · Institute Admin: <a href="../admin/index.html" target="_blank" rel="noopener">Open</a></p>':"")+'</div>';
}
function collect() {
  if(!draft)return;
  document.querySelectorAll("[data-path]").forEach(el=>{
    const keys=el.dataset.path.split("."), last=keys.pop();let obj=draft;
    for(const k of keys)obj=obj[k];
    obj[last]=el.type==="checkbox"?el.checked:el.type==="number"?Number(el.value):last==="options"?el.value.split(",").map(s=>s.trim()).filter(Boolean):el.value;
  });
  draft.instituteCode=draft.instituteCode.trim().toUpperCase();
  draft.examTemplate=draft.examMode==="CBT"?"exam-cbt":"exam-normal";
}
async function saveDraft() {
  collect();
  if(!current) {
    const created=await api("createInstitute",{config:draft});await openInstitute(created.id);notice("Institute created as Pending. Code: "+created.code+". Continue configuration before activation.");return;
  }
  const r=await api("saveDraft",{id:current.id,config:draft,expectedRevision:current.revision||0});
  current.revision=r.revision;notice("Draft saved. You can continue later.");renderWizard();
}
function preview(type,override) {
  collect();const host=$("previewContent");host.replaceChildren();
  const box=document.createElement("div");box.className="preview-page "+(override || (type==="login"?draft.loginTemplate:type==="instructions"?draft.instructionTemplate:draft.examTemplate));
  box.style.borderColor=draft.branding.color;
  if(draft.branding.logoUrl && /^https:\/\//.test(draft.branding.logoUrl)){const img=document.createElement("img");img.src=draft.branding.logoUrl;img.alt="Institute logo";box.append(img);}
  const title=document.createElement("h1");title.textContent=draft.instituteName||"Institute preview";box.append(title);
  if(type==="login") for(const f of draft.studentFields.filter(f=>f.visible)) {
    const label=document.createElement("label");label.textContent=f.label+(f.required?" *":"");let input=document.createElement(f.type==="select"?"select":f.type==="textarea"?"textarea":"input");
    if(f.type==="select")for(const o of f.options||[]){const option=document.createElement("option");option.textContent=o;input.append(option);}
    else input.type=f.type;
    input.placeholder=f.placeholder||"";input.value=f.defaultValue||"";input.disabled=true;label.append(input);box.append(label);
  }
  else if(type==="instructions")for(const s of draft.instructions){const section=document.createElement("section"),h=document.createElement("h3");h.textContent=s.heading;section.append(h);const text=document.createElement("p");text.textContent=s.text;text.style.whiteSpace="pre-line";section.append(text);box.append(section);}
  else {const p=document.createElement("p");p.textContent=draft.examMode+" exam layout preview";box.append(p);if(draft.examMode==="CBT"){const palette=document.createElement("div");palette.className="palette";for(let i=1;i<=8;i++){const n=document.createElement("span");n.textContent=i;n.className=i<3?"answered":i===4?"review":"";palette.append(n);}box.append(palette);}const sample=document.createElement("p");sample.textContent="Sample question · Answer options · Previous / Save & Next";box.append(sample);}
  host.append(box);$("preview").showModal();
}
async function history(id) {
  const data=await api("getInstitute",{id}), versions=await api("history",{id});current=data.institute;
  $("content").innerHTML='<div class="panel"><h2>Configuration history · '+esc(current.instituteName)+'</h2><p>Restoring a published version creates a new version. History remains intact.</p>'+versions.items.map(v=>'<div class="item"><strong>Version '+v.version+'</strong> <button class="secondary" data-restore="'+v.version+'">Restore as new version</button><details><summary>Compare with current configuration</summary><pre>'+esc(JSON.stringify(diff(current.config||{},v.config||{}),null,2))+'</pre></details></div>').join("")+(!versions.items.length?'<p>No published versions yet.</p>':"")+'<button data-open="'+esc(id)+'">Back to configuration</button></div>';
}
function diff(a,b,path="") {
  const changes=[];
  for(const k of new Set([...Object.keys(a),...Object.keys(b)])) {
    const p=path?path+"."+k:k;
    if(JSON.stringify(a[k])!==JSON.stringify(b[k]))changes.push({field:p,current:a[k]??null,restore:b[k]??null});
  }return changes;
}
async function auditPage(more) {
  const d=await api("audit",{cursor:more?listState.cursor:null});
  listState={items:more?[...listState.items,...d.items]:d.items,cursor:d.cursor};
  $("content").innerHTML='<div class="panel"><h2>Administrative actions</h2><p>Server-generated platform audit records. Student data is excluded.</p>'+listState.items.map(i=>'<details class="item"><summary>'+esc(i.action)+' · '+esc(i.targetId)+'</summary><pre>'+esc(JSON.stringify(i,null,2))+'</pre></details>').join("")+(!listState.items.length?'<p>No platform audit records yet.</p>':"")+(listState.cursor?'<button data-action="moreAudit">Load older actions</button>':"")+'</div>';
}
async function adminForm() {
  const data=await api("listInstitutes",{});const chosen=current?.id;
  $("content").innerHTML='<div class="panel"><h2>Create Institute Admin</h2><p>The backend creates the Firebase account and assigned institute profile. No Super Admin account can be created here.</p><div class="grid"><label>Name<input id="adminName"></label><label>Email<input id="adminEmail" type="email"></label><label>Phone<input id="adminPhone" type="tel"></label><label>Institute<select id="adminInstitute">'+data.items.map(i=>'<option value="'+esc(i.id)+'" '+(i.id===chosen?"selected":"")+'>'+esc(i.instituteName)+' ('+esc(i.instituteCode)+')</option>').join("")+'</select></label></div><div class="actions"><button data-action="createAdmin">Create Admin</button></div><p class="muted">For institutes beyond the first 200, open that institute’s configuration first.</p></div>';
  if(chosen && !data.items.some(i=>i.id===chosen)) {const o=document.createElement("option");o.value=chosen;o.textContent=current.instituteName;o.selected=true;$("adminInstitute").append(o);}
}
async function registryPage() {
  catalog=await api("catalog");
  const templates=page==="Templates";
  $("content").innerHTML='<div class="panel"><h2>'+(templates?"Template registry":"Security preset registry")+'</h2><p>Versions are explicit. Institutes keep their published configuration until migration. Existing renderer layouts support new versions; new renderer components require development.</p><div class="grid">'+(templates?catalog.templates.map(t=>'<div class="item"><strong>'+esc(t.templateName)+' v'+t.version+'</strong><p>'+badge(t.status)+'</p><button data-template-status="'+esc(t.templateId)+'" data-version="'+t.version+'">Change availability</button><button class="secondary" data-template-version="'+esc(t.templateId)+'" data-version="'+t.version+'">Create next version</button></div>'):catalog.presets.map(p=>'<div class="item"><strong>'+esc(p.name)+' v'+p.version+'</strong><pre>'+esc(JSON.stringify(p.settings,null,2))+'</pre></div>')).join("")+'</div><button data-action="addType">Add Institute Type</button></div>';
}
async function digest(value) {return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value))))).map(b=>b.toString(16).padStart(2,"0")).join("");}
async function saveRegistry(next) {await api("saveRegistry",{registry:next,expectedHash:await digest(catalog)});await registryPage();notice("Registry updated. Published institutes retain their configuration.");}
$("content").addEventListener("change",e=>{
  if(!draft)return;
  if(e.target.id==="logoUpload"){
    const file=e.target.files?.[0];if(!file)return;
    run(async()=>{collect();if(file.size>=2*1024*1024||!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Choose a PNG, JPEG or WebP image under 2 MB.");
      const asset=ref(getStorage(app),"institutes/"+current.id+"/branding/"+crypto.randomUUID());
      await uploadBytes(asset,file,{contentType:file.type});draft.branding.logoUrl=await getDownloadURL(asset);renderWizard();notice("Logo uploaded. Save and publish the draft to apply it.");});return;
  }
  if(e.target.id==="preset" && e.target.value!==""){collect();const p=catalog.presets[Number(e.target.value)];draft.security=Object.fromEntries(S.SECURITY.map(k=>[k,!!p.settings[k]]));draft.securityPreset={id:p.id,version:p.version};renderWizard();}
  else if(e.target.dataset.path==="instituteType"){collect();draft.examMode=draft.instituteType==="COMPETITIVE"?"CBT":"NORMAL";draft.features.cbt=draft.examMode==="CBT";draft.features.palette=draft.examMode==="CBT";renderWizard();}
  else if(e.target.dataset.path?.endsWith(".type")){collect();renderWizard();}
});
$("content").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  run(async()=>{
    if(b.dataset.page)return navigate(b.dataset.page);
    if(b.dataset.open)return openInstitute(b.dataset.open);
    if(b.dataset.history)return history(b.dataset.history);
    if(b.dataset.preview)return preview(b.dataset.preview,b.dataset.templatePreview);
    if(b.dataset.template){collect();draft[b.dataset.prop]=b.dataset.template;draft[b.dataset.prop+"Version"]=Number(b.dataset.version);renderWizard();return;}
    if(b.dataset.step!==undefined){collect();step=Number(b.dataset.step);renderWizard();return;}
    if(b.dataset.add){collect();draft[b.dataset.add].push(b.dataset.add==="studentFields"?{name:"field"+draft.studentFields.length,label:"New Field",type:"text",required:false,visible:true,placeholder:"",defaultValue:"",helpText:""}:{type:"paragraph",heading:"New section",text:""});renderWizard();return;}
    if(b.dataset.remove){collect();draft[b.dataset.remove].splice(Number(b.dataset.index),1);renderWizard();return;}
    if(b.dataset.move){collect();const a=draft[b.dataset.move],i=Number(b.dataset.index),j=i+Number(b.dataset.direction);if(j>=0&&j<a.length)[a[i],a[j]]=[a[j],a[i]];renderWizard();return;}
    if(b.dataset.statusChange){if(!confirm("Change institute status to "+b.dataset.statusChange+"? New access will follow this status."))return;await api("setStatus",{id:current.id,status:b.dataset.statusChange,expectedStatus:current.status});await openInstitute(current.id);notice("Institute status updated.");return;}
    if(b.dataset.admin){if(!confirm("Set administrator status to "+b.dataset.status+"?"))return;await api("adminStatus",{uid:b.dataset.admin,status:b.dataset.status});await loadList(false);return;}
    if(b.dataset.restore){if(!confirm("Restore this configuration as a new published version?"))return;await api("rollback",{id:current.id,version:Number(b.dataset.restore),expectedVersion:current.configurationVersion||0,expectedRevision:current.revision||0});await history(current.id);return;}
    if(b.dataset.templateStatus){const status=prompt("Template status: ACTIVE, DEPRECATED or DISABLED","DEPRECATED");if(!status)return;const next=clone(catalog);next.templates.find(t=>t.templateId===b.dataset.templateStatus&&t.version===Number(b.dataset.version)).status=status;await saveRegistry(next);return;}
    if(b.dataset.templateVersion){const next=clone(catalog),source=next.templates.find(t=>t.templateId===b.dataset.templateVersion&&t.version===Number(b.dataset.version));next.templates.push({...source,version:Math.max(...next.templates.filter(t=>t.templateId===source.templateId).map(t=>t.version))+1,status:"ACTIVE",updatedAt:new Date().toISOString()});await saveRegistry(next);return;}
    const action=b.dataset.action;
    if(action==="retry")return navigate(page);
    if(action==="recent")return navigate("Audit Logs");
    if(action==="search"){search=$("search").value;filter=$("filter").value;return loadList(false);}
    if(action==="more")return loadList(true);
    if(action==="moreAudit")return auditPage(true);
    if(action==="next"||action==="previous"){collect();step=Math.max(0,Math.min(9,step+(action==="next"?1:-1)));renderWizard();}
    if(action==="saveDraft")await saveDraft();
    if(action==="validate"){collect();const r=await api("validate",{config:draft});notice(r.status+"\n"+[...r.errors,...r.warnings].join("\n"));step=9;renderWizard();}
    if(action==="publish"){collect();if(!confirm("Save this draft and publish its configuration? Existing attempts keep their captured settings."))return;await saveDraft();const r=await api("publish",{id:current.id,expectedVersion:current.configurationVersion||0,expectedRevision:current.revision||0});await openInstitute(current.id);notice("Configuration v"+r.version+" published. Activation is a separate action.");}
    if(action==="history")await history(current.id);
    if(action==="clone"){const name=prompt("New institute name");if(!name)return;const code=prompt("New institute code (blank generates one)","");if(code===null)return;const r=await api("cloneInstitute",{sourceId:current.id,name,code});await openInstitute(r.id);notice("Configuration cloned. Logo URL is cleared to avoid sharing mutable branding assets.");}
    if(action==="newAdmin")await adminForm();
    if(action==="createAdmin"){const r=await api("createAdmin",{name:$("adminName").value,email:$("adminEmail").value,phone:$("adminPhone").value,instituteId:$("adminInstitute").value});notice("Institute Admin created: "+r.email+". Use the admin portal password reset to set a password.");await navigate("Institute Admins");}
    if(action==="saveSettings"){const name=document.querySelector('[data-path="platformName"]').value,maintenance=document.querySelector('[data-path="maintenanceMode"]').checked;if(!confirm("Save platform settings?"))return;await api("saveSettings",{platformName:name,maintenanceMode:maintenance,expectedVersion:settings.version});await navigate("Platform Settings");notice("Platform settings saved.");}
    if(action==="password"){await sendPasswordResetEmail(auth,auth.currentUser.email);notice("Password reset requested.");}
    if(action==="addType"){const type=prompt("New institute type identifier (uppercase letters and underscores)");if(!type)return;const next=clone(catalog);next.types.push(type);next.templates=next.templates.map(t=>({...t,supportedInstituteTypes:[...t.supportedInstituteTypes,type]}));await saveRegistry(next);}
  });
});
