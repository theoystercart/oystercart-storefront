/* Oyster Cart mobile summary v1 — display only, no cart or checkout writes. */
(function () {
  'use strict';
  var CHANNEL = 'oyster-cart-summary-v1';
  var SITE = 'https://www.theoystercart.com';
  var STORE = 'https://wix.ecwid.com';
  var test = location.hostname === 'localhost';
  if (test) { SITE = location.origin; STORE = location.origin; }
  function text(el) { return el ? el.textContent.trim().replace(/\s+/g, ' ').slice(0,500) : ''; }
  function money(el) { var t = text(el); var m = t.match(/(?:[-−]\s*)?(?:S\$|\$)\s*[-−]?[\d,]+(?:\.\d{2})?/); return m ? m[0] : ''; }
  // The existing Ecwid bridge loads this side inside the store frame.
  if (window.parent !== window && (location.origin === STORE)) {
    if (window.__oysterSummarySender) return;
    window.__oysterSummarySender = true;
    var enabled = false, pending = 0, observer, expiry;
    function send(focus) {
      if (!enabled) return;
      var cart = document.querySelector('.ec-store__cart-page .ec-cart, .ec-store__checkout-page .ec-cart');
      var data = null;
      if (cart && !cart.classList.contains('ec-cart--empty')) {
        var nodes = Array.from(cart.querySelectorAll('.ec-cart-item:not(.ec-cart-item--summary)'));
        var rows = Array.from(cart.querySelectorAll('.ec-cart-summary__row')).map(function (r) {
          return {label:text(r.querySelector('.ec-cart-summary__title')),value:money(r.querySelector('.ec-cart-summary__price'))};
        }).filter(function (r) { return r.label && r.value; });
        var items = nodes.slice(0,60).map(function (n) {
          var p=n.querySelector('.ec-cart-item__picture-inner');
          var b=p ? getComputedStyle(p).backgroundImage : '';
          var match=b.match(/https:\/\/[^"\s)]+/);
          return {name:text(n.querySelector('.ec-cart-item__title')),qty:text(n.querySelector('.form-control__select-text')),price:money(n.querySelector('.ec-cart-item__price-inner')),options:Array.from(n.querySelectorAll('.ec-cart-item__option')).map(text).join('; '),image:match ? match[0] : ''};
        });
        if (items.length && rows.length) {
          var total=rows[rows.length-1];
          // Keep the native label when there are discounts, tax, shipping or other charges.
          var initial=rows.length===1 && !!cart.querySelector('.ec-cart-step--delivery.ec-cart-step--empty');
          data={items:items,rows:rows,label:initial?'Item subtotal':total.label,amount:total.value,note:initial?'Delivery calculated after selection':'See the breakdown below',focus:!!focus};
        }
      }
      window.parent.postMessage({channel:CHANNEL,data:data},SITE);
    }
    function schedule() { clearTimeout(pending); pending=setTimeout(function(){send(false);},100); }
    window.addEventListener('message',function(e){
      if(e.origin!==SITE || e.source!==window.parent || !e.data || e.data.channel!==CHANNEL || e.data.command!=='read')return;
      clearTimeout(expiry);expiry=setTimeout(function(){enabled=false;if(observer)observer.disconnect();clearTimeout(pending);},5000);
      if(!enabled){enabled=true;observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});}
      send(false);
    });
    document.addEventListener('focusin',function(e){if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))send(true);});
    return;
  }
  if (location.origin !== SITE || window.__oysterSummaryView) return;
  window.__oysterSummaryView=true;
  var host,root,button,panel,label,amount,hint,toggle,frame,lastData,lastJSON='',lastAt=0;
  var mobile=matchMedia('(max-width:680px)'), expanded=false;
  function route(){return /^\/online-store(?:\/|$)/.test(location.pathname) || test;}
  function toggleText(){return (lastData?lastData.items.length+' '+(lastData.items.length===1?'item':'items')+' \u00b7 ':'')+(expanded?'Hide items \u25b4':'View items \u25be');}
  function close(){expanded=false;if(panel){panel.hidden=true;button.setAttribute('aria-expanded','false');toggle.textContent=toggleText();}}
  function remove(){if(host)host.remove();host=null;root=null;lastData=null;lastJSON='';expanded=false;}
  function node(tag,cls,value){var e=document.createElement(tag);if(cls)e.className=cls;if(value)e.textContent=value;return e;}
  function mount(){
    host=document.createElement('div');host.id='oyster-sticky-cart-summary';host.style.cssText='position:fixed;left:0;right:0;z-index:95;display:none';
    root=host.attachShadow({mode:'open'});
    var style=node('style');style.textContent='@font-face{font-family:OysterSummary;src:url(https://static.wixstatic.com/ufonts/620f15_5a7bae7ed8554f3a8547ebff0add219b/woff2/file.woff2) format("woff2");font-display:swap}:host{color:#fff;font-family:OysterSummary,Georgia,serif}*{box-sizing:border-box}button{display:grid;grid-template-columns:1fr auto;width:100%;text-align:left;border:0;border-bottom:1px solid #b18a36;background:#191916;color:#fff;padding:9px 18px;cursor:pointer;font:inherit;gap:0 12px;min-height:72px}button:focus-visible{outline:2px solid #b18a36;outline-offset:-3px}.label{font-size:12px;line-height:1.3;color:#ddd}.amount{font-size:23px;line-height:1.25}.toggle{grid-column:2;grid-row:1 / 3;align-self:center;font-size:16px;color:#d7b56d}.hint{grid-column:1 / 3;font-size:13px;color:#ccc;line-height:1.25}.panel{background:#151512;border-bottom:1px solid #b18a36;padding:0 18px 12px;overflow:auto;overscroll-behavior:contain;max-height:36vh;box-shadow:0 12px 24px #0005}.item{display:grid;grid-template-columns:52px 1fr auto;gap:10px;padding:12px 0;border-bottom:1px solid #b18a3655;font-size:16px}.item img{width:52px;height:58px;object-fit:cover}.name{font-size:18px}.detail{font-size:14px;line-height:1.3;color:#ccc;overflow-wrap:anywhere}.price{white-space:nowrap;font-size:16px}.row{display:flex;justify-content:space-between;gap:12px;font-size:16px;padding-top:8px}[hidden]{display:none!important}';root.appendChild(style);
    button=node('button');button.type='button';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','items');
    label=node('span','label');amount=node('span','amount');toggle=node('span','toggle','View items \u25be');hint=node('span','hint');
    button.append(label,amount,toggle,hint);root.appendChild(button);
    panel=node('section','panel');panel.id='items';panel.setAttribute('aria-label','Cart items and charges');panel.hidden=true;root.appendChild(panel);
    button.addEventListener('click',function(){expanded=!expanded;panel.hidden=!expanded;button.setAttribute('aria-expanded',String(expanded));toggle.textContent=toggleText();});
    root.addEventListener('keydown',function(e){if(e.key==='Escape'){close();button.focus();}});
    document.body.appendChild(host);
  }
  function render(data){
    if(!host || !host.isConnected)mount();
    toggle.textContent=toggleText();label.textContent=data.label;amount.textContent=data.amount;hint.textContent=data.note;
    panel.replaceChildren();
    data.items.forEach(function(item){
      var row=node('div','item'),image=node('img');image.alt='';
      if(/^https:\/\/d2j6dbq0eux0bg\.cloudfront\.net\/images\//.test(item.image)){image.src=item.image;image.loading='lazy';}
      else image.hidden=true;
      var info=node('div');info.append(node('div','name',item.name),node('div','detail',item.options),node('div','detail',item.qty));
      row.append(image,info,node('div','price',item.price));panel.appendChild(row);
    });
    data.rows.forEach(function(r){var row=node('div','row');row.append(node('span','',r.label),node('span','',r.value));panel.appendChild(row);});
  }
  function position(){
    if(!host || !frame)return;
    var r=frame.getBoundingClientRect();
    var header=document.querySelector('[data-oyster-mobile-header]');
    var top=header?Math.max(0,header.getBoundingClientRect().bottom):0;
    var viewport=window.visualViewport;
    if(viewport)top=Math.max(top,viewport.offsetTop);
    // Only pin once the shopper has scrolled into the cart; never cover a site menu.
    var menu=header && (header.querySelector('[aria-expanded="true"]') || Array.from(header.querySelectorAll('*')).some(function(n){return n.shadowRoot && n.shadowRoot.querySelector('[aria-expanded="true"]');}));
    host.style.top=Math.round(top)+'px';
    host.style.display=mobile.matches&&route()&&lastData&&Date.now()-lastAt<5000&&r.top<top+1&&r.bottom>top+140&&!menu?'block':'none';
    panel.style.maxHeight=Math.max(90,Math.min(280,((viewport&&viewport.height)||innerHeight)-top-180))+'px';
  }
  window.addEventListener('message',function(e){
    if(!mobile.matches||!route()||!frame||e.source!==frame.contentWindow||e.origin!==STORE||!e.data||e.data.channel!==CHANNEL)return;
    var d=e.data.data;
    if(!d){remove();return;}
    if(!Array.isArray(d.items)||!Array.isArray(d.rows)||d.items.length>60||typeof d.amount!=='string'||typeof d.label!=='string')return;
    lastAt=Date.now();lastData=d;
    var json=JSON.stringify({items:d.items,rows:d.rows,label:d.label,amount:d.amount,note:d.note});
    if(json!==lastJSON || !host || !host.isConnected){render(d);lastJSON=json;}
    if(d.focus)close();position();
  });
  function tick(){
    if(!mobile.matches||!route()){remove();frame=null;return;}
    var f=document.querySelector('iframe[title="Online Store"]');
    if(f!==frame){remove();frame=f;}
    if(frame)frame.contentWindow.postMessage({channel:CHANNEL,command:'read'},STORE);
    position();
  }
  window.addEventListener('scroll',position,{passive:true});window.addEventListener('resize',function(){if(!mobile.matches)remove();position();},{passive:true});
  if(window.visualViewport){window.visualViewport.addEventListener('resize',function(){close();position();},{passive:true});window.visualViewport.addEventListener('scroll',position,{passive:true});}
  setInterval(tick,1500);tick();
})();
