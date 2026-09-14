// Configuration rendering uses DOM text, never executable template HTML.
export function applyPortalConfig(institute) {
  const c=institute.config;if(!c)return;
  globalThis.activePortalConfig=c;
  document.title=c.instituteName+" | Examination";
  document.documentElement.style.setProperty("--primary-color",c.branding.color);
  document.documentElement.style.setProperty("--accent-color",c.branding.color);
  const login=document.querySelector("#loginScreen .login-card");
  if(login){login.dataset.template=c.loginTemplate;login.style.borderTop="5px solid "+c.branding.color;}
  document.querySelectorAll("#loginScreen .brand h1").forEach(e=>e.textContent=c.instituteName);
  const icon=document.querySelector("#loginScreen .brand-icon");
  if(icon&&c.branding.logoUrl){const img=document.createElement("img");img.src=c.branding.logoUrl;img.alt=c.instituteName;img.style.cssText="max-width:80px;max-height:80px";icon.replaceChildren(img);}
  const support=document.querySelector("#loginScreen .login-footer");if(support&&c.supportContact)support.textContent=c.supportContact;
  document.getElementById("dynamicStudentFields")?.remove();
  const container=document.createElement("div");container.id="dynamicStudentFields";
  for(const field of c.studentFields){
    const native=field.name==="name"?document.getElementById("candidateName"):field.name==="email"?document.getElementById("candidateEmail"):null;
    if(native){native.placeholder=field.placeholder||field.label;native.required=field.required;continue;}
    if(!field.visible)continue;
    const label=document.createElement("label");label.textContent=field.label+(field.required?" *":"");
    const input=document.createElement(field.type==="select"?"select":field.type==="textarea"?"textarea":"input");
    input.dataset.fieldName=field.name;input.required=field.required;input.placeholder=field.placeholder||"";
    if(field.type==="select"){const empty=document.createElement("option");empty.value="";empty.textContent="Select";input.append(empty);for(const value of field.options){const o=document.createElement("option");o.value=value;o.textContent=value;input.append(o);}}
    else input.type=field.type;
    input.value=field.defaultValue||"";label.append(input);
    if(field.helpText){const help=document.createElement("small");help.textContent=field.helpText;label.append(help);}
    container.append(label);
  }
  document.getElementById("loginBtn")?.before(container);
  const legacyRules=document.querySelector("#instructionScreen .rules-section");if(legacyRules)legacyRules.hidden=true;
  document.getElementById("configuredInstructions")?.remove();
  const instructions=document.createElement("div");instructions.id="configuredInstructions";instructions.dataset.template=c.instructionTemplate;
  for(const section of c.instructions){
    const box=document.createElement("section"),heading=document.createElement("h3");heading.textContent=section.heading;box.append(heading);
    if(["bullets","numbered"].includes(section.type)){const list=document.createElement(section.type==="bullets"?"ul":"ol");for(const line of section.text.split("\n").filter(Boolean)){const item=document.createElement("li");item.textContent=line;list.append(item);}box.append(list);}
    else{const text=document.createElement("p");text.textContent=section.text;text.style.whiteSpace="pre-line";box.append(text);}
    if(section.type==="warning")box.className="configured-warning";instructions.append(box);
  }
  document.querySelector("#instructionScreen .instruction-actions")?.before(instructions);
  document.getElementById("examScreen").dataset.mode=c.examMode;
}
export function readPortalFields(){
  const values={};
  for(const input of document.querySelectorAll("#dynamicStudentFields [data-field-name]")){
    if(!input.reportValidity())throw new Error("Please complete the required candidate details.");
    values[input.dataset.fieldName]=input.value.trim();
  }return values;
}
