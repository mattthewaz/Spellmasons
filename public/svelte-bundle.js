var app=function(){"use strict";function t(){}function n(t){return t()}function e(){return Object.create(null)}function o(t){t.forEach(n)}function c(t){return"function"==typeof t}function r(t,n){return t!=t?n==n:t!==n||t&&"object"==typeof t||"function"==typeof t}function i(t,n){t.appendChild(n)}function u(t,n,e){t.insertBefore(n,e||null)}function l(t){t.parentNode.removeChild(t)}function s(t){return document.createElement(t)}function a(t){return document.createTextNode(t)}function d(){return a(" ")}function f(){return a("")}function p(t,n,e,o){return t.addEventListener(n,e,o),()=>t.removeEventListener(n,e,o)}function h(t,n){t.value=null==n?"":n}function m(t,n,e,o){null===e?t.style.removeProperty(n):t.style.setProperty(n,e,o?"important":"")}let g;function b(t){g=t}function $(){if(!g)throw new Error("Function called outside component initialization");return g}const k=[],v=[],w=[],y=[],x=Promise.resolve();let _=!1;function C(t){w.push(t)}const E=new Set;let P=0;function j(){const t=g;do{for(;P<k.length;){const t=k[P];P++,b(t),S(t.$$)}for(b(null),k.length=0,P=0;v.length;)v.pop()();for(let t=0;t<w.length;t+=1){const n=w[t];E.has(n)||(E.add(n),n())}w.length=0}while(k.length);for(;y.length;)y.pop()();_=!1,E.clear(),b(t)}function S(t){if(null!==t.fragment){t.update(),o(t.before_update);const n=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,n),t.after_update.forEach(C)}}const N=new Set;let A;function L(t,n){t&&t.i&&(N.delete(t),t.i(n))}function O(t,n){const e=n.token={};function c(t,c,r,i){if(n.token!==e)return;n.resolved=i;let u=n.ctx;void 0!==r&&(u=u.slice(),u[r]=i);const l=t&&(n.current=t)(u);let s=!1;n.block&&(n.blocks?n.blocks.forEach(((t,e)=>{e!==c&&t&&(A={r:0,c:[],p:A},function(t,n,e,o){if(t&&t.o){if(N.has(t))return;N.add(t),A.c.push((()=>{N.delete(t),o&&(e&&t.d(1),o())})),t.o(n)}}(t,1,1,(()=>{n.blocks[e]===t&&(n.blocks[e]=null)})),A.r||o(A.c),A=A.p)})):n.block.d(1),l.c(),L(l,1),l.m(n.mount(),n.anchor),s=!0),n.block=l,n.blocks&&(n.blocks[c]=l),s&&j()}if((r=t)&&"object"==typeof r&&"function"==typeof r.then){const e=$();if(t.then((t=>{b(e),c(n.then,1,n.value,t),b(null)}),(t=>{if(b(e),c(n.catch,2,n.error,t),b(null),!n.hasCatch)throw t})),n.current!==n.pending)return c(n.pending,0),!0}else{if(n.current!==n.then)return c(n.then,1,n.value,t),!0;n.resolved=t}var r}function z(t,n,e){const o=n.slice(),{resolved:c}=t;t.current===t.then&&(o[t.value]=c),t.current===t.catch&&(o[t.error]=c),t.block.p(o,e)}function B(t,n){-1===t.$$.dirty[0]&&(k.push(t),_||(_=!0,x.then(j)),t.$$.dirty.fill(0)),t.$$.dirty[n/31|0]|=1<<n%31}function M(r,i,u,s,a,d,f,p=[-1]){const h=g;b(r);const m=r.$$={fragment:null,ctx:null,props:d,update:t,not_equal:a,bound:e(),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(i.context||(h?h.$$.context:[])),callbacks:e(),dirty:p,skip_bound:!1,root:i.target||h.$$.root};f&&f(m.root);let $=!1;if(m.ctx=u?u(r,i.props||{},((t,n,...e)=>{const o=e.length?e[0]:n;return m.ctx&&a(m.ctx[t],m.ctx[t]=o)&&(!m.skip_bound&&m.bound[t]&&m.bound[t](o),$&&B(r,t)),n})):[],m.update(),$=!0,o(m.before_update),m.fragment=!!s&&s(m.ctx),i.target){if(i.hydrate){const t=function(t){return Array.from(t.childNodes)}(i.target);m.fragment&&m.fragment.l(t),t.forEach(l)}else m.fragment&&m.fragment.c();i.intro&&L(r.$$.fragment),function(t,e,r,i){const{fragment:u,on_mount:l,on_destroy:s,after_update:a}=t.$$;u&&u.m(e,r),i||C((()=>{const e=l.map(n).filter(c);s?s.push(...e):o(e),t.$$.on_mount=[]})),a.forEach(C)}(r,i.target,i.anchor,i.customElement),j()}b(h)}function R(n){let e;return{c(){e=s("p"),e.textContent="Something went wrong loading assets",m(e,"color","red")},m(t,n){u(t,e,n)},p:t,d(t){t&&l(e)}}}function T(t){let n,e=!1===t[0]&&q(t);return{c(){e&&e.c(),n=f()},m(t,o){e&&e.m(t,o),u(t,n,o)},p(t,o){!1===t[0]?e?e.p(t,o):(e=q(t),e.c(),e.m(n.parentNode,n)):e&&(e.d(1),e=null)},d(t){e&&e.d(t),t&&l(n)}}}function q(t){let n,e,c,r,m,g,b,$,k,v,w,y,x={ctx:t,current:null,token:null,hasCatch:!0,pending:G,then:F,catch:D,error:10};return O(v=t[2],x),{c(){n=a("Server Url\n    "),e=s("div"),c=s("input"),r=d(),m=s("button"),m.textContent="Connect",g=d(),b=s("button"),b.textContent="Disconnect",$=d(),k=f(),x.block.c()},m(o,l){u(o,n,l),u(o,e,l),i(e,c),h(c,t[1]),i(e,r),i(e,m),i(e,g),i(e,b),u(o,$,l),u(o,k,l),x.block.m(o,x.anchor=l),x.mount=()=>k.parentNode,x.anchor=k,w||(y=[p(c,"input",t[8]),p(m,"click",t[6]),p(b,"click",J)],w=!0)},p(n,e){t=n,2&e&&c.value!==t[1]&&h(c,t[1]),x.ctx=t,4&e&&v!==(v=t[2])&&O(v,x)||z(x,t,e)},d(t){t&&l(n),t&&l(e),t&&l($),t&&l(k),x.block.d(t),x.token=null,x=null,w=!1,o(y)}}}function D(t){let n,e,o=t[10].message+"";return{c(){n=s("p"),e=a(o),m(n,"color","red")},m(t,o){u(t,n,o),i(n,e)},p(t,n){4&n&&o!==(o=t[10].message+"")&&function(t,n){n=""+n,t.wholeText!==n&&(t.data=n)}(e,o)},d(t){t&&l(n)}}}function F(t){let n,e,c,r,f,g,b,$,k;return{c(){n=a("Game name\n      "),e=s("input"),c=a("\n      Password (optional)\n      "),r=s("div"),f=s("button"),f.textContent="Host",g=d(),b=s("button"),b.textContent="Join",m(r,"display","flex")},m(o,l){u(o,n,l),u(o,e,l),h(e,t[3]),u(o,c,l),u(o,r,l),i(r,f),i(r,g),i(r,b),$||(k=[p(e,"input",t[9]),p(f,"click",t[7]),p(b,"click",t[7])],$=!0)},p(t,n){8&n&&e.value!==t[3]&&h(e,t[3])},d(t){t&&l(n),t&&l(e),t&&l(c),t&&l(r),$=!1,o(k)}}}function G(n){return{c:t,m:t,p:t,d:t}}function H(n){let e;return{c(){e=a("loading assets...")},m(t,n){u(t,e,n)},p:t,d(t){t&&l(e)}}}function I(n){let e,c,r,i,a,h,m,g,b,$={ctx:n,current:null,token:null,hasCatch:!0,pending:H,then:T,catch:R};return O(window.setupPixiPromise,$),{c(){var t,n,o;e=s("div"),c=d(),r=s("button"),r.textContent="Singleplayer",i=d(),a=s("button"),a.textContent="Multiplayer",h=d(),m=f(),$.block.c(),t=e,n="id",null==(o="websocket-pie-connection-status")?t.removeAttribute(n):t.getAttribute(n)!==o&&t.setAttribute(n,o)},m(t,o){u(t,e,o),u(t,c,o),u(t,r,o),u(t,i,o),u(t,a,o),u(t,h,o),u(t,m,o),$.block.m(t,$.anchor=o),$.mount=()=>m.parentNode,$.anchor=m,g||(b=[p(r,"click",n[4]),p(a,"click",n[5])],g=!0)},p(t,[e]){z($,n=t,e)},i:t,o:t,d(t){t&&l(e),t&&l(c),t&&l(r),t&&l(i),t&&l(a),t&&l(h),t&&l(m),$.block.d(t),$.token=null,$=null,g=!1,o(b)}}}function J(){window.pie.disconnect()}function U(t,n,e){let o,c,r,i;return[o,c,r,i,function(){e(0,o=!0),window.connect_to_wsPie_server().then((()=>{window.joinRoom()}))},function(){e(0,o=!1)},function(){c&&e(2,r=window.connect_to_wsPie_server(c))},function(){window.pie.isConnected()?(console.log("Setup: Loading complete.. initialize game"),window.joinRoom({name:i})):console.error("Cannot join room until pieClient is connected to a pieServer")},function(){c=this.value,e(1,c)},function(){i=this.value,e(3,i)}]}return new class extends class{$destroy(){!function(t,n){const e=t.$$;null!==e.fragment&&(o(e.on_destroy),e.fragment&&e.fragment.d(n),e.on_destroy=e.fragment=null,e.ctx=[])}(this,1),this.$destroy=t}$on(t,n){const e=this.$$.callbacks[t]||(this.$$.callbacks[t]=[]);return e.push(n),()=>{const t=e.indexOf(n);-1!==t&&e.splice(t,1)}}$set(t){var n;this.$$set&&(n=t,0!==Object.keys(n).length)&&(this.$$.skip_bound=!0,this.$$set(t),this.$$.skip_bound=!1)}}{constructor(t){super(),M(this,t,U,I,r,{})}}({target:document.getElementById("menu-inner")||document.body,props:{}})}();
//# sourceMappingURL=svelte-bundle.js.map
