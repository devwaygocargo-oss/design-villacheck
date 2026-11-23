import fs from 'node:fs';import path from 'node:path';import ts from 'typescript';
const exact=new Set(),patterns=new Map();
// The public release policy declares deny prefixes, not new API resources.
// Every allowed endpoint remains declared by the original route handlers.
for(const file of fs.readdirSync('server').filter(f=>f.endsWith('.mjs')&&!/test|fixture|api-route-manifest/.test(f)&&f!=='public-phase1-release.mjs')){
 const source=ts.createSourceFile(file,fs.readFileSync(path.join('server',file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const visit=node=>{if(ts.isStringLiteralLike(node)&&/^\/api\/[A-Za-z0-9/_-]+$/.test(node.text)&&!node.text.endsWith('/'))exact.add(node.text);
 if(node.kind===ts.SyntaxKind.RegularExpressionLiteral){const literal=node.getText(source),end=literal.lastIndexOf('/'),pattern=literal.slice(1,end),flags=literal.slice(end+1).replace(/[gy]/g,'');if(pattern.includes('api\\/')){try{new RegExp(pattern,flags);patterns.set(pattern,{pattern,flags})}catch{ /* Exclude unusable patterns. */ }}}
 ts.forEachChild(node,visit)};visit(source);
}
const output='// Generated from server route declarations by tools/generate-api-route-manifest.mjs.\n// Resource recognition does not grant authorization or bypass release policy.\nconst exact=new Set('+JSON.stringify([...exact].sort(),null,2)+');\nconst patterns='+JSON.stringify([...patterns.values()].sort((a,b)=>a.pattern.localeCompare(b.pattern)),null,2)+'.map(({pattern,flags})=>new RegExp(pattern,flags));\nexport function knownApiPath(path){return exact.has(path)||patterns.some(pattern=>{const match=pattern.exec(path);return match?.index===0&&match[0]===path})}\n';
fs.writeFileSync('server/api-route-manifest.mjs',output);console.log(JSON.stringify({exact:exact.size,patterns:patterns.size}));
