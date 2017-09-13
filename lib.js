"use strict";function e(e){return e&&"object"==typeof e&&"default"in e?e.default:e}function t(){return""}function s(e){return String(e).replace(/(^|-)(\w|$)/g,(e,t,s)=>s.toUpperCase())}function i(e){return s(_.parse(e).name)}function r(e){return String(e)}function n(e){return String(e).replace(/[&"<>\']/g,e=>e in S?S[e]:e)}function o(e){return String(e).replace(/[`\\$]/g,e=>e in $?$[e]:e)}function a(e,t,s){return e.startsWith(t)&&e.endsWith(s)}function l(e){let t="";if(e)for(let s in e)t+=" "+s,e[s]&&(t+='="'+e[s]+'"');return t}Object.defineProperty(exports,"__esModule",{value:!0});var c=require("events"),h=require("bluebird"),p=require("chokidar"),u=e(require("globby")),_=require("path"),g=require("fs"),d=require("htmlparser2"),m=require("html-minifier");class f{constructor(e,t,s,r){this._fileName=e,this._name=i(e),this._style=t,this._script=s,this._template=r}get fileName(){return this._fileName}get name(){return this._name}get style(){return this._style}get script(){return this._script}get template(){return this._template}}class y{constructor(e,s){this._delegate=null,this._delegates={},this._style="",this._script="",this._template=null,this._promise=new h((e,i)=>{const r=new d.Parser({onerror:e=>{this.onError(e),i(e)},onopentag:(e,t,...s)=>{this.onOpenTag(e,t)},onclosetag:e=>{this.onCloseTag(e)},ontext:e=>{this.onText(e)},onend:()=>{this.onEnd(),e(new f(s,this._style,this._script,this._template||t))}},{xmlMode:!1,decodeEntities:!1,lowerCaseTags:!1,lowerCaseAttributeNames:!1,recognizeCDATA:!0,recognizeSelfClosing:!0});g.createReadStream(_.resolve(s)).on("error",e=>{i(e)}).on("data",e=>{r.write(e)}).on("close",()=>{r.end()})})}get promise(){return this._promise}changeDelegate(e){this._delegate=e}addTagDelegate(e,t){this._delegates[e]=t}appendStyle(e){this._style+=e}appendScript(e){this._script+=e}appendTemplate(e){if(this._template){const t=this._template;this._template=((s,i,r)=>t(s,i,r)+e(s,i,r))}else this._template=e}onError(e){console.error(e),this._delegate&&this._delegate.onError(this,e)}onText(e){this._delegate&&this._delegate.onText(this,e)}onOpenTag(e,t){this._delegate||e in this._delegates&&(this._delegate=new this._delegates[e]),this._delegate&&this._delegate.onOpenTag(this,e,t)}onCloseTag(e){this._delegate&&this._delegate.onCloseTag(this,e)}onEnd(){}}class T{constructor(){this._stack=0,this._contents=""}onError(e,t){}onText(e,t){1==this._stack&&(this._contents+=t)}onOpenTag(e,t,s){++this._stack}onCloseTag(e,t){0==--this._stack&&(e.appendStyle(this._contents),e.changeDelegate(null))}}class b{constructor(){this._stack=0,this._contents=""}onError(e,t){}onText(e,t){1==this._stack&&(this._contents+=t)}onOpenTag(e,t,s){++this._stack}onCloseTag(e,t){0==--this._stack&&(e.appendScript(this._contents),e.changeDelegate(null))}}const S={">":"&gt;","<":"&lt;","'":"&apos;",'"':"&quot;","&":"&amp;"},$={"`":"\\`","\\":"\\\\",$:"\\$"},w="value",x="{{",C="}}",k="raw",A="{=",v="=}",D="code",E="{#",O="#}";class q{constructor(){this._stack=0,this._closeTag=!0,this._ignore=!1,this._parsed="var $buf=[];with($locals=$locals||{}){$buf.push(`"}onError(e,t){}onText(e,t){this._ignore||(this._parsed+=this.parseText(t,r))}onOpenTag(e,t,s){if(++this._stack>1){const e=t.charAt(0);if(e!=e.toUpperCase()){let e="<"+n(t);for(let t in s)e+=" "+o(n(t)),s[t]&&(e+='="'+this.parseText(s[t],n)+'"');this._parsed+=e+">"}else if("Styles"===t)this._ignore=!0,this._parsed+="</Styles"+l(s)+"/>";else if("Scripts"===t)this._ignore=!0,this._parsed+="</Scripts"+l(s)+"/>";else if("Children"===t)this._ignore=!0,this._parsed+="`,$children(),`";else{this._parsed+="`,$ins(`"+o(t)+"`,{";for(let e in s)this._parsed+=this.parseAttribute(e,s[e]);this._parsed+="[`$children`]:function(){var $buf=[];$buf.push(`"}}}onCloseTag(e,s){if(this._stack>1){const e=s.charAt(0);e!=e.toUpperCase()?this._closeTag&&(this._parsed+="</"+n(s)+">"):"Styles"===s?this._ignore=!1:"Scripts"===s?this._ignore=!1:"Children"===s?this._ignore=!1:this._parsed+="`);return $buf.join(``);}}),`",this._closeTag=!0}if(0==--this._stack){this._parsed+="`)}return $buf.join(``);";let s=t;try{s=new Function("$esc","$ins","$locals",this._parsed)}catch(e){console.error(e),console.log(this._parsed)}e.appendTemplate(s),e.changeDelegate(null)}}parseText(e,t){function s(t){const s=e.indexOf(t,r);return s<0?i:s}const i=e.length;let r=0,n=s(x),a=s(A),l=s(E),c="";for(;n<i||a<i||l<i;)switch(n<l||a<l?n<a?w:k:D){case w:{c+=o(t(e.slice(r,n))),r=n+x.length;const i=s(C);c+="`,$esc("+e.slice(r,i)+"),`",r=i+C.length,n=s(x);break}case k:{c+=o(t(e.slice(r,a))),r=a+A.length;const i=s(v);c+="`,String("+e.slice(r,i)+"),`",r=i+A.length,a=s(A);break}case D:{c+=o(t(e.slice(r,l))),r=l+E.length;const i=s(O);c+="`);"+e.slice(r,i)+";$buf.push(`",r=i+O.length,l=s(E);break}default:console.error("")}return c+=o(e.slice(r))}parseAttribute(e,t){return a(e,x,C)&&""===t?"..."+e.slice(x.length,-C.length)+",":"[`"+o(e)+"`]:"+this.parseAttributeValue(t)+","}parseAttributeValue(e){function t(t){const r=e.indexOf(t,i);return r<0?s:r}const s=e.length;let i=0,r=t(x),l="";if(a(e,x,C))return"("+e.slice(x.length,-C.length)+")";for(;r<s;){l+=o(n(e.slice(i,r))),i=r+x.length;const s=t(C);l+="`+$esc("+e.slice(i,s)+")+`",i=s+C.length,r=t(x)}return"`"+(l+=o(e.slice(i)))+"`"}}class L extends y{constructor(e,t){super(e,t),this.addTagDelegate("style",T),this.addTagDelegate("script",b),this.addTagDelegate("template",q)}}class N extends c{constructor(e){super(),this._options=this.getDefaultOptions(e),this._modules={},this._watcher=null,this.setMaxListeners(1/0),this.start()}getDefaultOptions(e){return{parser:e&&e.parser||L,sources:e&&e.sources||[],watch:e&&e.watch||!1}}start(){this.stop(),u(this._options.sources).then(e=>h.all(e.map(e=>new this._options.parser(this,e).promise.catch(t=>{this.emit("error",t,e)})))).then(e=>{if(e.forEach(e=>{this._modules[e.name]=e}),this.emit("done"),this._options.watch){const e=e=>{new this._options.parser(this,e).promise.then(e=>{this._modules[e.name]=e,this.emit("update",e)})},t=e=>{delete this._modules[i(e)]};this._watcher=p.watch(this._options.sources,{ignoreInitial:!0}).on("add",e).on("change",e).on("unlink",t).setMaxListeners(1/0)}})}getRenderFunctions(e,t,s){const i={};return Object.entries(this._modules).forEach(([s,r])=>{i[s]=[r,r.template.bind(null,e,t)]}),i}stop(){this._watcher&&(this._watcher.close(),this._watcher=null)}}class j extends c{constructor(e,t,s){super(),(s=s||{}).escape=s.escape||n,s.minify=s.minify||!1,s.doctype=!1!==s.doctype,s.data=s.data||{},this._library=e,this._fileName=t,this._name=i(t);const r=()=>{function e(e,s){const[o,a]=t[e];return i[e]||(i[e]=!0,r+=o.style,n+=o.script),a(s)}const t=this._library.getRenderFunctions(s.escape,e),i={};let r="",n="",o="";try{o=e(this._name,s.data)}catch(e){console.error(e)}o=r?o.replace(/<\/Styles(.*)\/>/g,"<style$1>"+r.replace("$",()=>"\\$")+"</style>"):o.replace(/<\/Styles(.*)\/>/g,""),o=n?o.replace(/<\/Scripts(.*)\/>/g,"<script$1>"+n.replace("$",()=>"\\$")+"<\/script>"):o.replace(/<\/Scripts(.*)\/>/g,""),s.minify&&(o=m.minify(o,{collapseBooleanAttributes:!0,collapseWhitespace:!0,decodeEntities:!0,minifyCSS:!0,minifyJS:!0,quoteCharacter:'"',removeComments:!0,removeRedundantAttributes:!0,removeScriptTypeAttributes:!0,removeStyleLinkTypeAttributes:!0,sortAttributes:!0,sortClassName:!0,useShortDoctype:!0})),s.doctype&&(o="<!doctype html>"+o),this.emit("output",o)};e.on("done",r).on("update",r),this.stop=(()=>{e.removeListener("done",r).removeListener("update",r)})}}exports.Library=N,exports.Application=j;
