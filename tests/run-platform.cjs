const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {runBackendTests}=require("./platform-backend-harness.cjs");
const schema=require("../firebase/functions/schema");
runBackendTests(fs.readFileSync(path.join(__dirname,"../firebase/functions/index.js"),"utf8"),schema,crypto).then(results=>{
  for(const r of results)console.log((r.passed?"PASS":"FAIL")+" "+r.name+(r.error?": "+r.error:""));
  if(results.some(r=>!r.passed))process.exitCode=1;
});
