const test=require("node:test"),assert=require("node:assert/strict"),S=require("../schema");
const valid=()=>({...S.defaults(),instituteName:"Test Institute",instituteCode:"TEST001"});
test("valid school and CBT configurations",()=>{
  const c=valid();assert.deepEqual(S.validate(c).errors,[]);
  c.examMode="CBT";c.examTemplate="exam-cbt";c.features.cbt=true;c.features.palette=true;assert.deepEqual(S.validate(c).errors,[]);
});
const invalidCases=[
  ["unsafe code",c=>c.instituteCode="../bad"],
  ["missing CBT feature",c=>{c.examMode="CBT";c.examTemplate="exam-cbt";}],
  ["hidden identity",c=>c.studentFields[0].visible=false],
  ["duplicate field",c=>c.studentFields.push({...c.studentFields[0]})],
  ["unknown version",c=>c.loginTemplateVersion=999],
  ["script URL",c=>c.branding.logoUrl="javascript:alert(1)"],
  ["missing declaration",c=>c.instructions=[]],
  ["HTML field type",c=>c.studentFields[0].type="html"],
  ["negative penalty",c=>c.penalty.marks=-1],
  ["normal palette",c=>c.features.palette=true],
  ["malformed sections",c=>c.instructions={}],
  ["null field",c=>c.studentFields=[null]],
  ["role injection",c=>c.role="super_admin"]
];
for(const [name,change]of invalidCases)test(name,()=>{const c=valid();change(c);assert.equal(S.validate(c).status,"INVALID");});
