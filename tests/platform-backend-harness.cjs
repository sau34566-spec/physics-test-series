// In-memory callable tests. This harness does not replace Firebase Rules Emulator tests.
async function runBackendTests(source, schema, crypto) {
  let values=new Map(), serial=Promise.resolve(), auto=0;
  const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
  const apply=(old,data)=>{const out={...copy(old||{})};for(const [k,v]of Object.entries(data))out[k]=v?.__union?[...new Set([...(out[k]||[]),...v.__union])]:copy(v);return out;};
  function snapshot(path){const value=values.get(path);return {id:path.split("/").at(-1),ref:reference(path),exists:value!==undefined,data:()=>copy(value)};}
  function reference(path){return {path,id:path.split("/").at(-1),get:async()=>snapshot(path),
    set:async(data,options)=>{values.set(path,options?.merge?apply(values.get(path),data):copy(data));},
    collection:name=>query(path+"/"+name)};}
  function query(path,filters=[],maximum=Infinity){return {path,doc:id=>reference(path+"/"+(id||"auto"+(++auto))),
    where:(k,op,v)=>query(path,[...filters,[k,op,v]],maximum),limit:n=>query(path,filters,n),
    get:async()=>{const docs=[...values.keys()].filter(k=>k.startsWith(path+"/")&&k.split("/").length===path.split("/").length+1)
      .map(snapshot).filter(d=>filters.every(([k,op,v])=>op==="=="?d.data()[k]===v:op==="in"?v.includes(d.data()[k]):false)).slice(0,maximum);
      return {docs,empty:docs.length===0,size:docs.length};}};}
  const db={collection:query,runTransaction:fn=>{
    const job=serial.then(async()=>{const writes=[];let wrote=false;const tx={
      get:async r=>{if(wrote)throw new Error("Firestore transaction read after write");return r.get();},
      set:(r,d,o)=>{wrote=true;writes.push(()=>values.set(r.path,o?.merge?apply(values.get(r.path),d):copy(d)));},
      update:(r,d)=>{wrote=true;writes.push(()=>{if(!values.has(r.path))throw new Error("Missing update target");values.set(r.path,apply(values.get(r.path),d));});},
      create:(r,d)=>{wrote=true;writes.push(()=>{if(values.has(r.path))throw new Error("Duplicate create");values.set(r.path,copy(d));});}};
      const result=await fn(tx);for(const write of writes)write();return result;});serial=job.catch(()=>{});return job;}};
  const exported={};
  class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
  const mocks={"firebase-functions/v2/https":{onCall:(_,fn)=>fn,HttpsError},
    "firebase-admin/app":{initializeApp(){}},
    "firebase-admin/firestore":{getFirestore:()=>db,FieldValue:{serverTimestamp:()=>"SERVER_TIME",arrayUnion:(...xs)=>({__union:xs})},FieldPath:{documentId:()=>"__name__"}},
    "firebase-admin/auth":{getAuth:()=>({})},"node:crypto":crypto,"./schema":schema};
  new Function("require","exports",source)(name=>{if(!mocks[name])throw new Error(name);return mocks[name];},exported);
  const results=[];
  async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  const call=(action,payload={},requestId="request"+(++auto),uid="owner")=>exported.platformAdmin({auth:uid?{uid}:null,data:{action,payload,requestId}});
  async function rejects(fn,code){try{await fn();}catch(e){assert(e.code===code,"Expected "+code+" got "+e.code+": "+e.message);return;}throw new Error("Expected rejection");}
  const config=()=>({...schema.defaults(),instituteName:"Institute A",instituteCode:"CODE001"});
  await check("Unauthenticated requests denied",()=>rejects(()=>call("createInstitute",{config:config()},"unauth",null),"unauthenticated"));
  values.set("superAdminAccess/owner",{active:true});
  await check("Allowlist without active role denied",()=>rejects(()=>call("createInstitute",{config:config()}),"permission-denied"));
  values.set("admins/owner",{role:"super_admin",status:"ACTIVE"});
  let created;
  await check("Create pending institute and protected draft",async()=>{created=await call("createInstitute",{config:config()},"create1");assert(created.status==="PENDING","Must not auto-activate");assert(values.has("institutes/"+created.id+"/drafts/current"),"Draft missing");});
  await check("Retry returns same institute without extra creation",async()=>{const retry=await call("createInstitute",{config:config()},"create1");assert(retry.id===created.id,"Duplicate institute");});
  await check("Same request ID cannot carry new payload",()=>rejects(()=>call("createInstitute",{config:{...config(),instituteName:"Changed"}},"create1"),"already-exists"));
  await check("Duplicate institute code rejected",()=>rejects(()=>call("createInstitute",{config:config()}),"already-exists"));
  await check("Invalid config cannot publish",async()=>{await call("saveDraft",{id:created.id,config:{...config(),loginTemplateVersion:999},expectedRevision:1});
    await rejects(()=>call("publish",{id:created.id,expectedVersion:0,expectedRevision:2}),"invalid-argument");});
  await check("Stale draft revision rejected",()=>rejects(()=>call("saveDraft",{id:created.id,config:config(),expectedRevision:1}),"aborted"));
  await check("Publish creates immutable version and public projection",async()=>{await call("saveDraft",{id:created.id,config:config(),expectedRevision:2});
    const published=await call("publish",{id:created.id,expectedVersion:0,expectedRevision:3});assert(published.version===1,"Version mismatch");
    const pub=values.get("publicInstitutes/"+created.id).config;assert(!Object.hasOwn(pub,"contactEmail")&&!Object.hasOwn(pub,"instituteCode"),"Private fields leaked");});
  await check("Cannot activate without institute admin",()=>rejects(()=>call("setStatus",{id:created.id,status:"ACTIVE",expectedStatus:"PENDING"}),"failed-precondition"));
  await check("Archive requires explicit pending restoration",async()=>{await call("setStatus",{id:created.id,status:"ARCHIVED",expectedStatus:"PENDING"});
    await rejects(()=>call("setStatus",{id:created.id,status:"ACTIVE",expectedStatus:"ARCHIVED"}),"failed-precondition");});
  await check("Rollback produces new version without deleting history",async()=>{const result=await call("rollback",{id:created.id,version:1,expectedVersion:1,expectedRevision:3});
    assert(result.version===2&&values.has("institutes/"+created.id+"/versions/1"),"History lost");});
  await check("Platform mutation does not write student collections",async()=>assert(![...values.keys()].some(k=>/^(candidates|questions|results|attempts)\//.test(k)),"Operational data touched"));
  await check("Live revoked role blocks subsequent requests",async()=>{values.set("admins/owner",{role:"super_admin",status:"DISABLED"});
    await rejects(()=>call("createInstitute",{config:{...config(),instituteCode:"CODE002"}}),"permission-denied");});
  return results;
}
module.exports={runBackendTests};
