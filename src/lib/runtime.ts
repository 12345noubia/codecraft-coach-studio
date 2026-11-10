import type { Runtime } from "./curriculum";

const BRIDGE = `<script>(function(){
var send=function(level,args){try{parent.postMessage({__cc:'log',level:level,text:Array.prototype.map.call(args,function(a){if(typeof a==='string')return a;try{return JSON.stringify(a)}catch(e){return String(a)}}).join(' ')},'*')}catch(e){}};
['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);o&&o.apply(console,arguments)}});
window.addEventListener('error',function(e){send('error',[(e.message||'Error')+(e.lineno?' (line '+e.lineno+')':'')])});
window.addEventListener('unhandledrejection',function(e){send('error',['Unhandled promise: '+(e.reason&&e.reason.message||e.reason)])});
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(a){var h=a.getAttribute('href')||'';if(h.charAt(0)==='#')return;e.preventDefault();send('info',['Link clicked: '+h+' (navigation is disabled inside the preview)'])}},true);
})();<\/script>`;

const EXPRESS = `<script>(function(){
function compile(p){var keys=[];var re=new RegExp('^'+p.replace(/\\/$/,'').replace(/:([A-Za-z_]+)/g,function(_,k){keys.push(k);return '([^/]+)'})+'/?$');return {re:re,keys:keys}}
function express(){var routes=[],mws=[];var app={};
['get','post','put','patch','delete'].forEach(function(m){app[m]=function(p){var hs=Array.prototype.slice.call(arguments,1);var c=compile(p);routes.push({m:m.toUpperCase(),p:p,re:c.re,keys:c.keys,hs:hs});return app}});
app.use=function(a,b){var fn=typeof a==='function'?a:b;if(typeof fn==='function')mws.push(fn);return app};
app.listen=function(port,cb){window.__ccPort=port;console.info('Server listening on http://localhost:'+port);if(typeof cb==='function')setTimeout(cb,0);return {close:function(){}}};
app.__routes=function(){return routes.map(function(r){return r.m+' '+r.p})};
app.__handle=function(method,url,body){return new Promise(function(resolve){
var u=new URL(url,'http://localhost');var path=u.pathname;var query={};u.searchParams.forEach(function(v,k){query[k]=v});
var done=false;var res={statusCode:200,headers:{},status:function(c){res.statusCode=c;return res},set:function(){return res},setHeader:function(){return res},
json:function(d){if(done)return res;done=true;resolve({status:res.statusCode,body:d});return res},send:function(d){if(done)return res;done=true;resolve({status:res.statusCode,body:d});return res},end:function(){return res.send('')},sendStatus:function(c){res.statusCode=c;return res.send(String(c))}};
var req={method:method,path:path,url:url,query:query,params:{},headers:{'content-type':'application/json'},body:body};
var route=null;for(var i=0;i<routes.length;i++){var r=routes[i];if(r.m!==method)continue;var mm=r.re.exec(path);if(mm){route=r;r.keys.forEach(function(k,j){req.params[k]=decodeURIComponent(mm[j+1])});break}}
var chain=mws.slice();if(route)chain=chain.concat(route.hs);else chain.push(function(q,s){s.status(404).json({error:'Cannot '+method+' '+path})});
var idx=0;function next(err){if(err){done||resolve({status:500,body:{error:String(err&&err.message||err)}});return}var fn=chain[idx++];if(!fn)return;try{var r=fn(req,res,next);if(r&&r.catch)r.catch(function(e){next(e)})}catch(e){console.error(e.message);next(e)}}
next();setTimeout(function(){if(!done){done=true;resolve({status:504,body:{error:'Handler never sent a response. Did you forget res.json() or res.send()?'}})}},3000);
})};
window.__ccApp=app;return app}
express.json=function(){return function(q,s,n){n()}};express.urlencoded=express.json;express.static=function(){return function(q,s,n){n()}};
express.Router=function(){return express()};
var FILES=window.__ccFiles||{};var cache={};
function resolve(from,p){var parts=from.split('/');parts.pop();p.split('/').forEach(function(seg){if(seg==='..')parts.pop();else if(seg!=='.')parts.push(seg)});var b=parts.filter(Boolean).join('/');var c=[b,b+'.js',b+'/index.js',b+'.json'];for(var i=0;i<c.length;i++)if(c[i] in FILES)return c[i];return null}
function makeRequire(from){return function(name){
if(name==='express')return express;if(name==='cors')return function(){return function(q,s,n){n()}};
if(name==='fs'||name==='path'||name==='http')throw new Error('Module "'+name+'" is not available in the browser sandbox. Use in-memory data for now.');
if(name.charAt(0)==='.'){var f=resolve(from,name);if(!f)throw new Error('Cannot find module "'+name+'" from '+from);return load(f)}
throw new Error('Package "'+name+'" is not installed in this sandbox.')}}
function load(file){if(cache[file])return cache[file].exports;var module={exports:{}};cache[file]=module;
if(/\\.json$/.test(file)){module.exports=JSON.parse(FILES[file]);return module.exports}
try{new Function('require','module','exports','__filename',FILES[file]+'\\n//# sourceURL='+file)(makeRequire(file),module,module.exports,file)}catch(e){console.error(file+': '+e.message);throw e}
return module.exports}
window.__ccRun=function(entry){try{load(entry)}catch(e){}};
window.addEventListener('message',function(e){var d=e.data;if(!d||d.__cc!=='request')return;var app=window.__ccApp;
if(!app){parent.postMessage({__cc:'response',id:d.id,status:0,body:{error:'No Express app is running. Create one with const app = express() and call app.listen().'}},'*');return}
console.info('-> '+d.method+' '+d.path);
app.__handle(d.method,d.path,d.body).then(function(r){console.info('<- '+r.status+' '+d.method+' '+d.path);parent.postMessage({__cc:'response',id:d.id,status:r.status,body:r.body,routes:app.__routes()},'*')})});
window.__ccFetchShim=function(){var orig=window.fetch;window.fetch=function(input,init){var url=typeof input==='string'?input:input.url;if(url.charAt(0)!=='/'||!window.__ccApp)return orig(input,init);init=init||{};var method=(init.method||'GET').toUpperCase();var body;try{body=init.body?JSON.parse(init.body):undefined}catch(e){body=init.body}
console.info('fetch '+method+' '+url);return window.__ccApp.__handle(method,url,body).then(function(r){console.info('<- '+r.status+' '+method+' '+url);var text=typeof r.body==='string'?r.body:JSON.stringify(r.body);return new Response(text,{status:r.status,headers:{'content-type':'application/json'}})})}};
})();<\/script>`;

const esc = (s: string) => s.replace(/<\/script/gi, "<\\/script");
const norm = (p: string) => p.replace(/^\.\//, "").replace(/^\//, "");

function inlineAssets(html: string, files: Record<string, string>, base: string) {
  const resolve = (href: string) => {
    if (/^https?:|^\/\//.test(href)) return null;
    const parts = base ? base.split("/") : [];
    norm(href).split("/").forEach((seg) => (seg === ".." ? parts.pop() : seg !== "." && parts.push(seg)));
    const p = parts.join("/");
    return p in files ? p : null;
  };
  return html
    .replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
      const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
      const f = href ? resolve(href) : null;
      return f ? `<style data-file="${f}">\n${files[f]}\n</style>` : tag;
    })
    .replace(/<script([^>]*)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, _a, src: string) => {
      const f = resolve(src);
      return f ? `<script data-file="${f}">\n${esc(files[f] ?? "")}\n</script>` : tag;
    });
}

function wrapDoc(body: string, head = "") {
  if (/<html[\s>]/i.test(body)) {
    return body.replace(/<head(\s[^>]*)?>/i, (m) => m + BRIDGE + head).replace(/^(?![\s\S]*<head[\s>])/, BRIDGE + head);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${BRIDGE}${head}</head><body>${body}</body></html>`;
}

function stripModules(code: string) {
  return code
    .replace(/^\s*import\s[^;\n]*;?\s*$/gm, "")
    .replace(/export\s+default\s+function/g, "function")
    .replace(/export\s+default\s+[A-Za-z_$][\w$]*;?/g, "")
    .replace(/export\s+(const|let|function|class)/g, "$1");
}

export function findEntry(runtime: Runtime, files: Record<string, string>) {
  const keys = Object.keys(files);
  if (runtime === "node") return ["server.js", "index.js", "app.js", "main.js"].find((k) => k in files) ?? keys.find((k) => k.endsWith(".js"));
  if (runtime === "fullstack") return ["public/index.html", "index.html", "client/index.html"].find((k) => k in files) ?? keys.find((k) => k.endsWith(".html"));
  return ["index.html", "public/index.html"].find((k) => k in files) ?? keys.find((k) => k.endsWith(".html"));
}

export function buildPreview(runtime: Runtime, files: Record<string, string>): { html: string; error?: string } {
  const keys = Object.keys(files);
  if (keys.length === 0) return { html: wrapDoc(""), error: "No files yet. Create a file in the Explorer to get started." };

  if (runtime === "react") {
    const css = keys.filter((k) => k.endsWith(".css")).map((k) => files[k]).join("\n");
    const jsx = keys.filter((k) => /\.(jsx|js|tsx)$/.test(k));
    const rank = (k: string) => (/main\.(jsx|js|tsx)$/.test(k) ? 3 : /App\.(jsx|js|tsx)$/.test(k) ? 2 : 1);
    jsx.sort((a, b) => rank(a) - rank(b));
    const hasMain = jsx.some((k) => rank(k) === 3);
    const code =
      "const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, createContext, Fragment } = React;\n" +
      jsx.map((k) => `// ${k}\n${stripModules(files[k] ?? "")}`).join("\n") +
      (hasMain ? "" : "\nif (typeof App !== 'undefined') ReactDOM.createRoot(document.getElementById('root')).render(<App />);");
    const head =
      `<script src="https://unpkg.com/react@18/umd/react.development.js"></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><style>body{font-family:system-ui,sans-serif;margin:0}${css}</style>`;
    return { html: wrapDoc(`<div id="root"></div><script type="text/babel" data-presets="react">\ntry{\n${esc(code)}\n}catch(e){console.error(e.message)}\n</script>`, head) };
  }

  if (runtime === "node") {
    const entry = findEntry(runtime, files);
    if (!entry) return { html: wrapDoc(""), error: "Create index.js or server.js to run your program." };
    const head = `<script>window.__ccFiles=${esc(JSON.stringify(files))};</script>${EXPRESS}`;
    return { html: wrapDoc(`<script>console.info('$ node ${entry}');window.__ccRun(${JSON.stringify(entry)});</script>`, head) };
  }

  if (runtime === "fullstack") {
    const server = ["server.js", "index.js", "app.js"].find((k) => k in files);
    const entry = findEntry(runtime, files);
    const head = `<script>window.__ccFiles=${esc(JSON.stringify(files))};</script>${EXPRESS}<script>${server ? `console.info('$ node ${server}');window.__ccRun(${JSON.stringify(server)});` : "console.warn('No server.js found. API calls will fail.');"}window.__ccFetchShim();</script>`;
    if (!entry) return { html: wrapDoc("", head), error: "Create public/index.html for the frontend." };
    const base = entry.includes("/") ? entry.slice(0, entry.lastIndexOf("/")) : "";
    return { html: wrapDoc(inlineAssets(files[entry] ?? "", files, base), head) };
  }

  const entry = findEntry(runtime, files);
  if (!entry) return { html: wrapDoc(""), error: "Create index.html to see a preview." };
  const base = entry.includes("/") ? entry.slice(0, entry.lastIndexOf("/")) : "";
  const head = runtime === "vue" ? `<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>` : "";
  return { html: wrapDoc(inlineAssets(files[entry] ?? "", files, base), head) };
}

export type Connection = { from: string; to: string; label: string; kind: "style" | "script" | "import" | "selector" | "api" };

export function findConnections(files: Record<string, string>): Connection[] {
  const out: Connection[] = [];
  const keys = Object.keys(files);
  const css = keys.filter((k) => k.endsWith(".css"));
  const html = keys.filter((k) => k.endsWith(".html"));
  const js = keys.filter((k) => /\.(js|jsx|ts|tsx)$/.test(k));
  for (const h of html) {
    const src = files[h] ?? "";
    for (const m of src.matchAll(/href=["']([^"']+\.css)["']/g)) out.push({ from: h, to: m[1]!, label: "loads stylesheet", kind: "style" });
    for (const m of src.matchAll(/src=["']([^"'h][^"']*\.js)["']/g)) out.push({ from: h, to: m[1]!, label: "runs script", kind: "script" });
    const classes = new Set([...src.matchAll(/class=["']([^"']+)["']/g)].flatMap((m) => m[1]!.split(/\s+/)));
    const ids = new Set([...src.matchAll(/id=["']([^"']+)["']/g)].map((m) => m[1]!));
    for (const c of css) {
      for (const cls of classes) if (new RegExp(`\\.${cls.replace(/[^\w-]/g, "")}\\b`).test(files[c] ?? "")) out.push({ from: `${h} .${cls}`, to: c, label: "styled by", kind: "selector" });
      for (const id of ids) if ((files[c] ?? "").includes(`#${id}`)) out.push({ from: `${h} #${id}`, to: c, label: "styled by", kind: "selector" });
    }
    for (const j of js) for (const id of ids) if (new RegExp(`["'#]${id}["']|getElementById\\(["']${id}`).test(files[j] ?? "")) out.push({ from: `${h} #${id}`, to: j, label: "controlled by", kind: "selector" });
  }
  for (const j of js) {
    const src = files[j] ?? "";
    for (const m of src.matchAll(/(?:from\s+|require\()["'](\.[^"']+)["']/g)) out.push({ from: j, to: m[1]!, label: "imports", kind: "import" });
    for (const m of src.matchAll(/fetch\(["'`](\/[^"'`]+)["'`]/g)) out.push({ from: j, to: `API ${m[1]}`, label: "calls", kind: "api" });
    for (const m of src.matchAll(/app\.(get|post|put|delete)\(["']([^"']+)["']/g)) out.push({ from: `${m[1]!.toUpperCase()} ${m[2]}`, to: j, label: "handled in", kind: "api" });
  }
  for (const h of html) for (const m of (files[h] ?? "").matchAll(/fetch\(["'`](\/[^"'`]+)["'`]/g)) out.push({ from: h, to: `API ${m[1]}`, label: "calls", kind: "api" });
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = c.from + c.to + c.label;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
