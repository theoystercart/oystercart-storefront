(()=>{if(location.pathname.replace(/\/$/,"")!=="/products/fine-de-claire")return;class b extends HTMLElement{static get observedAttributes(){return["product-data","cart-state","cart-ready","background-request"]}constructor(){super(),this.attachShadow({mode:"open"}),this.product=null,this.options=[],this.combinations=[],this.selections={},this.currentPrice=0,this.added=!1,this.pending=!1,this.pendingTimer=null,this.lastMobileState=null,this.datePickerMonths={},this.ecwidWarmFrame=null,this.ecwidWarmStarted=!1,this.ecwidWarmCleanupTimer=null,this.ecwidWarmStartTimer=null,this.handleResize=this.handleResize.bind(this),this.renderLoading()}connectedCallback(){window.addEventListener("resize",this.handleResize);const e=this.getAttribute("background-request");e&&this.scheduleBackground(e),this.hasAttribute("product-data")&&!this.product&&this.loadProduct(this.getAttribute("product-data"))}disconnectedCallback(){window.removeEventListener("resize",this.handleResize),clearTimeout(this.pendingTimer),clearTimeout(this.ecwidWarmCleanupTimer),clearTimeout(this.ecwidWarmStartTimer)}attributeChangedCallback(e,i,t){if(e==="background-request"&&t&&t!==i){this.scheduleBackground(t);return}if(i!==t){if(e==="cart-ready"){const o=this.shadowRoot.querySelector("#addButton");o&&(o.disabled=this.pending||t!=="true",o.textContent=this.pending?"ADDING\u2026":t==="true"?"ADD TO CART":"PREPARING CART\u2026");return}if(e==="product-data"&&t){this.loadProduct(t);return}e==="cart-state"&&t&&String(t).startsWith("added-")&&this.markAdded()}}prepareEcwidConnections(){try{[{rel:"preconnect",href:"https://app.ecwid.com"},{rel:"dns-prefetch",href:"https://app.ecwid.com"},{rel:"preconnect",href:"https://d2j6dbq0eux0bg.cloudfront.net"},{rel:"dns-prefetch",href:"https://d2j6dbq0eux0bg.cloudfront.net"}].forEach(i=>{const t=`oyster-${i.rel}-${i.href}`;if(document.head.querySelector(`link[data-oyster-warm="${t}"]`))return;const o=document.createElement("link");o.rel=i.rel,o.href=i.href,o.setAttribute("data-oyster-warm",t),document.head.appendChild(o)}),console.log("[buybox] Ecwid network warm-up prepared")}catch(e){console.warn("[buybox] Ecwid connection warm-up skipped:",e)}}warmEcwidCart(){}isMobileLayout(){try{if(navigator.userAgentData&&navigator.userAgentData.mobile)return!0}catch{}const e=navigator.userAgent||"";if(/Android|iPhone|iPod|Mobile/i.test(e))return!0;const i=Number(window.innerWidth||9999),t=Number(window.screen&&window.screen.width?window.screen.width:9999);return Math.min(i,t)<=760}handleResize(){const e=this.isMobileLayout();e!==this.lastMobileState&&(this.lastMobileState=e,this.product&&this.render())}scheduleBackground(e){requestAnimationFrame(()=>requestAnimationFrame(()=>{const i=()=>{!this.isConnected||this.getAttribute("background-request")!==e||this.dispatchEvent(new CustomEvent("productPainted",{detail:{token:e},bubbles:!0,composed:!0}))};typeof window.requestIdleCallback=="function"?window.requestIdleCallback(i,{timeout:1500}):setTimeout(i,0)}))}loadProduct(e){try{if(this._lastProductPayload===e)return;const i=JSON.parse(e);if(this._lastProductPayload=e,i.unavailable){this.product=null,this.options=[],this.combinations=[],this.selections={},this.renderError("This product is currently unavailable.");return}const t=this.product&&String(this.product.ecwidId)===String(i.ecwidId),o=t?this.selections:null,s=this.shadowRoot.activeElement,a=s?Array.from(s.attributes).filter(r=>r.name==="id"||r.name.startsWith("data-")).map(r=>[r.name,r.value]):[],d=s?.selectionStart,n=s?.selectionEnd;if(this.product=i,this.options=this.product.options&&Array.isArray(this.product.options.list)?this.product.options.list:[],this.combinations=this.product.combinations&&Array.isArray(this.product.combinations.list)?this.product.combinations.list:[],this.initialiseDefaultSelections(),o?this.options.forEach(r=>{if(!Object.prototype.hasOwnProperty.call(o,r.name))return;const l=o[r.name],c=(r.choices||[]).map(p=>p.text);r.type==="CHECKBOX"?this.selections[r.name]=Array.isArray(l)?l.filter(p=>c.includes(p)):[]:r.type==="DATE"||r.type==="TEXTFIELD"?this.selections[r.name]=l:this.selections[r.name]=c.includes(l)?l:""}):(this.datePickerMonths={},this.added=!1,this.pending=!1),this.lastMobileState=this.isMobileLayout(),this.render(),t&&a.length){const r=Array.from(this.shadowRoot.querySelectorAll("input, select, textarea, button, a")).find(l=>a.every(([c,p])=>l.getAttribute(c)===p));if(r&&(r.focus({preventScroll:!0}),typeof d=="number"&&typeof r.setSelectionRange=="function"))try{r.setSelectionRange(d,n)}catch{}}clearTimeout(this.ecwidWarmStartTimer),this.ecwidWarmStartTimer=setTimeout(()=>{this.warmEcwidCart()},1e3)}catch(i){console.error("[buybox] Invalid product-data:",i),this.renderError("Unable to load this product.")}}initialiseDefaultSelections(){this.selections={},this.options.forEach(e=>{const i=Array.isArray(e.choices)?e.choices:[];if(e.type==="CHECKBOX"){this.selections[e.name]=[];return}if(e.type==="DATE"||e.type==="TEXTFIELD"){this.selections[e.name]="";return}if(!this.isSingleChoiceOption(e)||!i.length)return;let t=Number(e.defaultChoice);if(!Number.isInteger(t)||t<0||t>=i.length){if(e.required){this.selections[e.name]="";return}t=0}this.selections[e.name]=i[t].text})}isSingleChoiceOption(e){return!!e&&["SELECT","RADIO","SIZE","SWATCHES"].includes(e.type)}findMatchingVariation(){return this.combinations.length&&this.combinations.find(e=>!e||!Array.isArray(e.options)||!e.options.length?!1:e.options.every(i=>String(this.selections[i.name])===String(i.value)))||null}getVariationOptionNames(e){return e&&Array.isArray(e.options)?e.options.map(i=>i.name):[]}applyModifier(e,i){const t=Number(i.priceModifier||0);return t?i.priceModifierType==="PERCENT"?e+e*t/100:e+t:e}calculateCurrentPrice(){if(!this.product)return 0;const e=this.findMatchingVariation()||(this.product.catalogueSource==="WIX"?this.combinations.filter(o=>o.inStock!==!1&&o.options.every(s=>this.selections[s.name]===void 0||this.selections[s.name]===null||this.selections[s.name]===""||this.selections[s.name]===s.value)).sort((o,s)=>o.price-s.price)[0]:null);let i=Number(this.product.price||0);if(e){const o=Number(e.defaultDisplayedPrice),s=Number(e.price);e.defaultDisplayedPrice!==void 0&&e.defaultDisplayedPrice!==null&&Number.isFinite(o)?i=o:e.price!==void 0&&e.price!==null&&Number.isFinite(s)&&(i=s)}const t=this.getVariationOptionNames(e);return this.options.forEach(o=>{if(e&&t.includes(o.name))return;const s=this.selections[o.name];if(s==null)return;const a=Array.isArray(o.choices)?o.choices:[];if(Array.isArray(s)){s.forEach(n=>{const r=a.find(l=>String(l.text)===String(n));r&&(i=this.applyModifier(i,r))});return}const d=a.find(n=>String(n.text)===String(s));d&&(i=this.applyModifier(i,d))}),Number(i||0)}money(e){return"$"+Number(e||0).toFixed(2)}escapeHtml(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}friendlyOptionLabel(e){const i=String(e||"").trim(),t=i.toLowerCase();return t.includes("shuck or unshuck")?"Preparation":t.includes("special sauce bundle")?"Sauce Bundle":i}friendlyChoiceText(e){const i=String(e||"").trim(),t=i.toLowerCase();return t==="shuck (open)"?"Shucked":t==="*unshuck*"||t==="unshuck"?"Unshucked":i.replace(/^\*+|\*+$/g,"").trim()}priceModifierText(e,i=this.options.find(t=>t.choices?.includes(e))){let t=Number(e.priceModifier||0),o=e.priceModifierType;if(this.product?.catalogueSource==="WIX"&&i?.priceReferenceChoice&&i.type!=="CHECKBOX"){const s=this.combinations.filter(l=>l.options.every(c=>c.name===i.name||!this.selections[c.name]||this.selections[c.name]===c.value)),a=l=>l.options.find(c=>c.name===i.name)?.value,d=s.filter(l=>a(l)===i.priceReferenceChoice),n=[];for(const l of s.filter(c=>a(c)===e.text)){const c=d.find(p=>l.options.every(u=>u.name===i.name||p.options.some(g=>g.name===u.name&&g.value===u.value)));c&&n.push(Math.round((l.price-c.price)*100))}const r=[...new Set(n)];if(r.length!==1)return"";t=r[0]/100,o="ABSOLUTE"}return!Number.isFinite(t)||!t?"":o==="PERCENT"?`${t>0?"+":""}${t}%`:`${t>0?"+":"\u2212"}S$${Math.abs(t).toFixed(2)}`}preparationIcon(e){return`
      <img
        class="prep-icon"
        src="${String(e||"").toLowerCase().includes("unshuck")?"data:image/webp;base64,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":"data:image/webp;base64,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"}"
        alt=""
        aria-hidden="true"
      >
    `}descriptionData(){const e=String(this.product&&this.product.description||"");if(!e)return{lead:this.product&&this.product.shortDescription||"",details:""};const t=new DOMParser().parseFromString(e,"text/html");t.querySelectorAll("script, style, iframe, object, embed").forEach(a=>a.remove()),t.querySelectorAll("*").forEach(a=>Array.from(a.attributes).forEach(d=>a.removeAttribute(d.name)));const o=Array.from(t.body.querySelectorAll("p, div")).find(a=>a.textContent.trim().length>0);let s="";return o&&(s=o.textContent.trim(),o.remove()),Array.from(t.body.children).forEach(a=>{!a.textContent.trim()&&a.querySelectorAll("img").length===0&&a.remove()}),{lead:s||this.product&&this.product.shortDescription||"",details:t.body.innerHTML.trim()}}detailSnippet(e){if(!e)return"";const t=new DOMParser().parseFromString(String(e),"text/html"),o=String(t.body.textContent||"").replace(/\s+/g," ").trim();if(!o)return"";const s=118;if(o.length<=s)return o;const a=o.substring(0,s),d=a.lastIndexOf(" ");return(d>70?a.substring(0,d):a).replace(/[,:;\-]+$/,"").trim()+"\u2026"}isSizeOption(e){return String(e.name||"").trim().toLowerCase()==="size"&&Array.isArray(e.choices)&&e.choices.length===3}isPreparationOption(e){return String(e.name||"").toLowerCase().includes("shuck or unshuck")}prefersDropdown(e){const i=String(e.name||"").toLowerCase();return i==="quantity"||i.includes("sauce bundle")}sizeInfo(e){const i=String(e||"").trim(),t=i.match(/^(cocktail|average|large)\s+size\s*\(([^)]+)\)/i);return t?{title:t[1][0].toUpperCase()+t[1].slice(1).toLowerCase(),size:t[2].trim()}:{title:this.friendlyChoiceText(i),size:""}}renderOption(e,i){const t=Array.isArray(e.choices)?e.choices:[];return e.type==="DATE"?this.renderDateOption(e,i):e.type==="TEXTFIELD"?this.renderTextFieldOption(e,i):e.type==="CHECKBOX"?this.renderCheckboxOption(e,i):this.isSizeOption(e)?this.renderSizeOption(e,i):this.isPreparationOption(e)?this.renderPreparationOption(e,i):!this.prefersDropdown(e)&&t.length>=2&&t.length<=3?this.renderChoiceOption(e,i):this.renderDropdown(e,i)}isMusselMadnessProduct(){return String(this.product&&this.product.ecwidId?this.product.ecwidId:"")==="806985688"}musselMadnessMinDate(){const e=new Date(Date.now()+288e5);return e.setUTCDate(e.getUTCDate()+1),e.toISOString().slice(0,10)}isAllowedMusselMadnessDate(e){if(!e||e==="2026-09-24"||e==="2026-10-01"||e==="2026-10-15")return!1;const i=String(e).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!i)return!1;const o=new Date(Date.UTC(Number(i[1]),Number(i[2])-1,Number(i[3]))).getUTCDay();return o===2||o===4}parseIsoDate(e){const i=String(e||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!i)return null;const t=Number(i[1]),o=Number(i[2]),s=Number(i[3]),a=new Date(Date.UTC(t,o-1,s));return a.getUTCFullYear()!==t||a.getUTCMonth()!==o-1||a.getUTCDate()!==s?null:a}isoDate(e){return e.toISOString().slice(0,10)}monthStart(e){const i=this.parseIsoDate(e);return i?this.isoDate(new Date(Date.UTC(i.getUTCFullYear(),i.getUTCMonth(),1))):""}addMonths(e,i){const t=this.parseIsoDate(e);return t?this.isoDate(new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+i,1))):""}isBeforeIsoDate(e,i){return!!e&&!!i&&String(e)<String(i)}musselMadnessCalendarMonth(e,i){const t=this.monthStart(this.datePickerMonths[e]);if(t)return t;const o=this.selections[e],s=this.monthStart(o);return s||this.monthStart(i)}monthTitle(e){const i=this.parseIsoDate(e);return i?["January","February","March","April","May","June","July","August","September","October","November","December"][i.getUTCMonth()]+" "+i.getUTCFullYear():""}dayLabel(e){const i=this.parseIsoDate(e);if(!i)return"";const t=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],o=["January","February","March","April","May","June","July","August","September","October","November","December"];return[t[i.getUTCDay()],i.getUTCDate(),o[i.getUTCMonth()],i.getUTCFullYear()].join(" ")}renderMusselMadnessCalendar(e,i,t,o){const s=this.musselMadnessCalendarMonth(e.name,o),a=this.parseIsoDate(s);if(!a)return"";const d=a.getUTCFullYear(),n=a.getUTCMonth(),r=a.getUTCDay(),l=new Date(Date.UTC(d,n+1,0)).getUTCDate(),c=[];for(let h=0;h<r;h+=1)c.push('<span class="inline-date-empty" aria-hidden="true"></span>');for(let h=1;h<=l;h+=1){const m=this.isoDate(new Date(Date.UTC(d,n,h))),y=!this.isBeforeIsoDate(m,o)&&this.isAllowedMusselMadnessDate(m),v=String(t)===m,z=["inline-date-day",y?"":"unavailable",v?"selected":""].filter(Boolean).join(" ");c.push(`
        <button
          type="button"
          class="${z}"
          ${y?`data-date-day="${i}:${m}"`:'disabled aria-disabled="true"'}
          aria-pressed="${v?"true":"false"}"
          aria-label="${this.escapeHtml(this.dayLabel(m))}"
        >
          ${h}
        </button>
      `)}const p=this.monthStart(o),u=this.addMonths(s,-1),g=this.addMonths(s,1),w=!u||p&&u<p;return`
      <input
        type="date"
        class="date-input-proxy"
        data-field="${i}"
        data-inline-date="true"
        value="${this.escapeHtml(t)}"
        ${e.required?"required":""}
        min="${this.escapeHtml(o)}"
        tabindex="-1"
        aria-hidden="true"
      >

      <div
        class="inline-date-picker"
        data-inline-date-picker="${i}"
        role="group"
        aria-label="Choose Mussel Madness date"
      >

        <div class="inline-date-header">

          <button
            type="button"
            class="inline-date-nav"
            data-date-nav="${i}:prev"
            data-calendar-month="${this.escapeHtml(s)}"
            aria-label="Previous month"
            ${w?"disabled":""}
          >
            \u2190
          </button>

          <div class="inline-date-title">
            ${this.escapeHtml(this.monthTitle(s))}
          </div>

          <button
            type="button"
            class="inline-date-nav"
            data-date-nav="${i}:next"
            data-calendar-month="${this.escapeHtml(s)}"
            aria-label="Next month"
            ${g?"":"disabled"}
          >
            \u2192
          </button>

        </div>

        <div
          class="inline-date-weekdays"
          aria-hidden="true"
        >
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        <div class="inline-date-grid">
          ${c.join("")}
        </div>

        <div
          class="inline-date-message"
          data-inline-date-message="${i}"
          hidden
        ></div>

        ${t?`
              <div class="inline-date-selected">
                Selected:
                ${this.escapeHtml(this.dayLabel(t))}
              </div>
            `:""}

      </div>
    `}renderDateOption(e,i){const t=this.selections[e.name]||"",o=this.isMusselMadnessProduct(),s=o?this.musselMadnessMinDate():"";return`
      <section class="option-section">

        <div class="option-label">
          ${this.escapeHtml(this.friendlyOptionLabel(e.name))}
          ${e.required?" *":""}
        </div>

        ${o?this.renderMusselMadnessCalendar(e,i,t,s):`
              <input
                type="date"
                data-field="${i}"
                value="${this.escapeHtml(t)}"
                ${e.required?"required":""}
                ${s?`min="${s}"`:""}
                style="width:100%;box-sizing:border-box;height:59px;padding:0 18px;border:1px solid var(--line);border-radius:4px;outline:none;background:#292925;color:var(--text);font:inherit;font-size:19px;color-scheme:dark;"
              >
            `}

        ${o?`
              <div style="margin-top:8px;font-size:12px;line-height:1.45;opacity:.68;">
                Available on Tuesdays and Thursdays. Please book at least one day in advance.
              </div>
            `:""}

      </section>
    `}renderTextFieldOption(e,i){const t=this.selections[e.name]||"",o=String(e.name||"").toLowerCase(),s=o.includes("contact")||o.includes("phone")||o.includes("mobile");return`
      <section class="option-section">

        <div class="option-label">
          ${this.escapeHtml(this.friendlyOptionLabel(e.name))}
          ${e.required?" *":""}
        </div>

        <input
          type="${s?"tel":"text"}"
          class="field-input"
          data-field="${i}"
          value="${this.escapeHtml(t)}"
          ${e.required?"required":""}
          autocomplete="${s?"tel":"name"}"
        >

      </section>
    `}renderDropdown(e,i){const t=e.choices||[],o=this.selections[e.name],s=t.map((a,d)=>{const n=this.priceModifierText(a,e);return`
            <option
              value="${d}"
              ${String(o)===String(a.text)?"selected":""}
            >
              ${this.escapeHtml(this.friendlyChoiceText(a.text))}
              ${n?` \u2014 ${this.escapeHtml(n)}`:""}
            </option>
          `}).join("");return`
      <section class="option-section">

        <div class="option-label">
          ${this.escapeHtml(this.friendlyOptionLabel(e.name))}
        </div>

        <div class="select-wrap">

          <select
            data-select="${i}"
            ${e.required?"required":""}
            aria-label="${this.escapeHtml(this.friendlyOptionLabel(e.name))}"
          >
            ${e.required?`<option value="" disabled ${o?"":"selected"}>Please select</option>`:""}
            ${s}
          </select>

          <span class="select-arrow">
            \u2193
          </span>

        </div>

      </section>
    `}renderPreparationOption(e,i){const t=this.selections[e.name];return`
      <section class="option-section">

        <div class="option-label">
          Preparation
        </div>

        <div class="preparation-grid">
          ${(e.choices||[]).map((a,d)=>`
            <button
              type="button"
              class="
                preparation-card
                ${String(t)===String(a.text)?"selected":""}
              "
              data-choice="${i}:${d}"
            >

              <span class="prep-icon-wrap">
                ${this.preparationIcon(a.text)}
              </span>

              <span class="prep-title">
                ${this.escapeHtml(this.friendlyChoiceText(a.text))}
              </span>

            </button>
          `).join("")}
        </div>

      </section>
    `}renderChoiceOption(e,i){const t=e.choices||[],o=this.selections[e.name],s=t.map((a,d)=>{const n=String(o)===String(a.text),r=this.priceModifierText(a,e);return`
            <button
              type="button"
              class="
                choice
                ${n?"selected":""}
              "
              data-choice="${i}:${d}"
            >

              <span>
                ${this.escapeHtml(this.friendlyChoiceText(a.text))}
              </span>

              ${r?`
                    <small>
                      ${this.escapeHtml(r)}
                    </small>
                  `:""}

            </button>
          `}).join("");return`
      <section class="option-section">

        <div class="option-label">
          ${this.escapeHtml(this.friendlyOptionLabel(e.name))}
        </div>

        <div
          class="
            choice-grid
            count-${Math.min(t.length,3)}
          "
        >
          ${s}
        </div>

      </section>
    `}renderSizeOption(e,i){const t=this.selections[e.name];return`
      <section class="option-section">

        <div class="option-label">
          Size
        </div>

        <div class="size-grid">
          ${(e.choices||[]).map((a,d)=>{const n=String(t)===String(a.text),r=this.sizeInfo(a.text),l=this.priceModifierText(a,e);return`
            <button
              type="button"
              class="
                size-choice
                ${n?"selected":""}
              "
              data-choice="${i}:${d}"
            >

              <strong>
                ${this.escapeHtml(r.title)}
              </strong>

              ${r.size?`
                    <span>
                      ${this.escapeHtml(r.size)}
                    </span>
                  `:""}

              ${l?`
                    <small>
                      ${this.escapeHtml(l)}
                    </small>
                  `:""}

            </button>
          `}).join("")}
        </div>

      </section>
    `}renderCheckboxOption(e,i){const t=Array.isArray(this.selections[e.name])?this.selections[e.name]:[],s=(e.choices||[]).map((a,d)=>{const n=t.includes(a.text),r=this.priceModifierText(a,e);return`
            <button
              type="button"
              class="
                addon
                ${n?"selected":""}
              "
              data-check="${i}:${d}"
            >

              <span class="addon-main">

                <span class="check">
                  ${n?"\u2713":""}
                </span>

                <span class="addon-text">
                  ${this.escapeHtml(this.friendlyChoiceText(a.text))}
                </span>

              </span>

              ${r?`
                    <span class="addon-price">
                      ${this.escapeHtml(r)}
                    </span>
                  `:""}

            </button>
          `}).join("");return`
      <section
        class="
          option-section
          addons-section
        "
      >

        <div class="option-heading">

          <div class="option-label">
            ${this.escapeHtml(this.friendlyOptionLabel(e.name))}
          </div>

          <span class="optional">
            Optional
          </span>

        </div>

        <div class="addons">
          ${s}
        </div>

      </section>
    `}render(){if(!this.product){this.renderLoading();return}this.currentPrice=this.calculateCurrentPrice();const e=this.descriptionData(),i=this.detailSnippet(e.details),t=this.options.map((s,a)=>this.renderOption(s,a)).join(""),o=this.isMobileLayout();this.lastMobileState=o,this.shadowRoot.innerHTML=`

      ${this.styles()}

      <div class="product-wrapper">

        <nav class="back-row" aria-label="Product breadcrumb">

          <a
            href="https://www.theoystercart.com/delivery"
            class="back-link"
          >
            <span class="back-arrow" aria-hidden="true">
              \u2190
            </span>

            <span>
              Online Store
            </span>
          </a>

          <span class="breadcrumb-separator" aria-hidden="true">
            /
          </span>

          <span class="breadcrumb-current">
            ${this.escapeHtml(this.product.name||"")}
          </span>

        </nav>

        <div
          class="
            product-layout
            ${o?"mobile-layout":""}
          "
        >

          <div class="visual-column">

            ${this.product.image?`
                  <div class="image-frame">

                    <img
                      loading="eager"
                      fetchpriority="high"
                      decoding="async"
                      src="${this.escapeHtml(this.product.image)}"
                      alt="${this.escapeHtml(this.product.name||"")}"
                    >

                  </div>
                `:""}

          </div>

          <div class="product-column">

            <header class="intro">

              <h1>
                ${this.escapeHtml(this.product.name||"")}
              </h1>

              <div class="title-price-separator"></div>

              <div class="top-price">
                ${this.money(this.currentPrice)}
              </div>

              ${e.lead?`
                    <div class="lead-description">
                      ${this.escapeHtml(e.lead)}
                    </div>
                  `:""}

              ${e.details?`
                    <details class="product-details">

                      <summary>

                        <span class="detail-heading">

                          <span class="detail-title">
                            Product details
                          </span>

                          ${i?`
                                <span class="detail-preview">
                                  ${this.escapeHtml(i)}
                                </span>
                              `:""}

                        </span>

                        <span class="detail-plus">
                          +
                        </span>

                      </summary>

                      <div class="detail-content">
                        ${e.details}
                      </div>

                    </details>
                  `:""}

            </header>

            <div class="divider"></div>

            <div class="options">
              ${t}
            </div>

            <div class="purchase-area">

              <div class="total-row">

                <span class="total-label">
                  Your selection
                </span>

                <strong>
                  ${this.money(this.currentPrice)}
                </strong>

              </div>

              <button
                type="button"
                id="addButton"
                class="add-button"
                ${this.pending||this.getAttribute("cart-ready")!=="true"?"disabled":""}
              >
                ${this.pending?"ADDING\u2026":this.getAttribute("cart-ready")==="true"?"ADD TO CART":"PREPARING CART\u2026"}
              </button>

              ${this.added?`
                    <div class="added-status">
                      \u2713 Added to cart
                    </div>

                    <button
                      type="button"
                      id="goToCart"
                      class="cart-button"
                    >
                      GO TO CART
                      <span>\u2192</span>
                    </button>
                  `:""}

            </div>

          </div>

        </div>

      </div>
    `,this.bindEvents()}validateFieldInput(e,i,t){if(i&&i.type==="DATE"&&this.isMusselMadnessProduct()){let o="";i.required&&!t?o="Please choose a date for Mussel Madness.":t&&this.isBeforeIsoDate(t,this.musselMadnessMinDate())?o="Please book at least one day in advance.":t&&!this.isAllowedMusselMadnessDate(t)&&(o="This date is unavailable. Please choose an available Tuesday or Thursday."),e.setCustomValidity(o),e.dataset.inlineDate==="true"&&!o&&this.clearInlineDateMessage(e)}}showInlineDateMessage(e,i){if(!e||e.dataset.inlineDate!=="true")return!1;const t=e.dataset.field,o=this.shadowRoot.querySelector(`[data-inline-date-message="${t}"]`);o&&(o.textContent=i||"Please choose a date.",o.hidden=!1);const s=this.shadowRoot.querySelector(`[data-inline-date-picker="${t}"]`);return s&&s.setAttribute("aria-invalid","true"),!0}clearInlineDateMessage(e){if(!e||e.dataset.inlineDate!=="true")return;const i=e.dataset.field,t=this.shadowRoot.querySelector(`[data-inline-date-message="${i}"]`);t&&(t.textContent="",t.hidden=!0);const o=this.shadowRoot.querySelector(`[data-inline-date-picker="${i}"]`);o&&o.removeAttribute("aria-invalid")}focusInlineDatePicker(e){if(!e||e.dataset.inlineDate!=="true")return;const i=e.dataset.field,t=this.shadowRoot.querySelector(`[data-inline-date-picker="${i}"] .inline-date-day:not(:disabled)`);t&&t.focus()}bindEvents(){this.shadowRoot.querySelectorAll("[data-select]").forEach(t=>{t.addEventListener("change",()=>{const o=this.options[Number(t.dataset.select)],s=o&&o.choices?o.choices[Number(t.value)]:null;s&&(this.selections[o.name]=s.text,this.selectionChanged())})}),this.shadowRoot.querySelectorAll("[data-choice]").forEach(t=>{t.addEventListener("click",()=>{const[o,s]=t.dataset.choice.split(":").map(Number),a=this.options[o],d=a&&a.choices?a.choices[s]:null;d&&(this.selections[a.name]=d.text,this.selectionChanged())})}),this.shadowRoot.querySelectorAll("[data-check]").forEach(t=>{t.addEventListener("click",()=>{const[o,s]=t.dataset.check.split(":").map(Number),a=this.options[o],d=a&&a.choices?a.choices[s]:null;if(!d)return;const n=Array.isArray(this.selections[a.name])?this.selections[a.name].slice():[],r=n.indexOf(d.text);r===-1?n.push(d.text):n.splice(r,1),this.selections[a.name]=n,this.selectionChanged()})}),this.shadowRoot.querySelectorAll("[data-date-nav]").forEach(t=>{t.addEventListener("click",()=>{const[o,s]=t.dataset.dateNav.split(":"),a=this.options[Number(o)];if(!a)return;const d=this.monthStart(t.dataset.calendarMonth),n=this.addMonths(d,s==="prev"?-1:1),r=this.monthStart(this.musselMadnessMinDate());!n||r&&n<r||(this.datePickerMonths[a.name]=n,this.render())})}),this.shadowRoot.querySelectorAll("[data-date-day]").forEach(t=>{t.addEventListener("click",()=>{const[o,s]=t.dataset.dateDay.split(":"),a=this.options[Number(o)];!a||this.isBeforeIsoDate(s,this.musselMadnessMinDate())||!this.isAllowedMusselMadnessDate(s)||(this.selections[a.name]=s,this.datePickerMonths[a.name]=this.monthStart(s),this.selectionChanged())})}),this.shadowRoot.querySelectorAll("[data-field]").forEach(t=>{const o=this.options[Number(t.dataset.field)];if(!o)return;const s=()=>{const a=String(t.value||"").trim();this.validateFieldInput(t,o,a),this.selections[o.name]=a};t.addEventListener("input",s),t.addEventListener("change",()=>{if(s(),!t.checkValidity()){if(this.showInlineDateMessage(t,t.validationMessage)){this.focusInlineDatePicker(t);return}t.reportValidity()}})});const e=this.shadowRoot.getElementById("addButton");e&&(["pointerenter","focus","touchstart"].forEach(t=>{e.addEventListener(t,()=>this.warmEcwidCart(),{once:!0,passive:!0})}),e.addEventListener("click",()=>{if(this.pending)return;const t=this.shadowRoot.querySelector("select[required]:invalid");if(t){t.reportValidity(),t.focus();return}const o=Array.from(this.shadowRoot.querySelectorAll("[data-field]"));let s=null;if(o.forEach(n=>{const r=this.options[Number(n.dataset.field)],l=String(n.value||"").trim();r&&this.validateFieldInput(n,r,l),!s&&!n.checkValidity()&&(s=n)}),s){if(this.showInlineDateMessage(s,s.validationMessage)){this.focusInlineDatePicker(s);return}s.reportValidity();return}this.warmEcwidCart(),this.pending=!0,this.added=!1;const a=this.currentPrice,d=this.cloneSelections();this.render(),this.dispatchEvent(new CustomEvent("addToCart",{detail:{selections:d,price:a},bubbles:!0,composed:!0})),clearTimeout(this.pendingTimer),this.pendingTimer=setTimeout(()=>{this.pending&&(this.pending=!1,this.render())},4e3)}));const i=this.shadowRoot.getElementById("goToCart");i&&i.addEventListener("click",()=>{this.warmEcwidCart(),this.dispatchEvent(new CustomEvent("goToCart",{bubbles:!0,composed:!0}))})}selectionChanged(){this.added=!1,this.pending=!1,clearTimeout(this.pendingTimer),this.render()}cloneSelections(){const e={};return Object.keys(this.selections).forEach(i=>{const t=this.selections[i];e[i]=Array.isArray(t)?t.slice():t}),e}markAdded(){this.pending=!1,this.added=!0,this.warmEcwidCart(),clearTimeout(this.pendingTimer),this.product&&this.render()}renderLoading(){this.shadowRoot.innerHTML=`
      ${this.styles()}

      <div class="loading">

        <div class="loading-image">
        </div>

        <div class="loading-info">
          <div></div>
          <div></div>
          <div></div>
        </div>

      </div>
    `}renderError(e){this.shadowRoot.innerHTML=`
      ${this.styles()}

      <div class="error">
        ${this.escapeHtml(e)}
      </div>
    `}styles(){return`
      <style>

        :host {
          display:
            block;

          width:
            100%;

          --gold:
            #cda654;

          --gold-bright:
            #e6c47a;

          --text:
            #fbf7ef;

          --cream:
            #eee8dd;

          --secondary:
            #d1c9bc;

          --secondary-soft:
            #b9b0a3;

          --line:
            #625a4d;

          --line-soft:
            #49433a;

          --surface:
            #20201d;

          --surface-selected:
            #2a2720;

          font-family:
            "Adobe Caslon Pro",
            "Adobe Caslon",
            Caslon,
            Georgia,
            "Times New Roman",
            serif;

          color:
            var(--text);

          -webkit-font-smoothing:
            antialiased;
        }

        * {
          box-sizing:
            border-box;
        }

        button,
        select {
          font-family:
            inherit;
        }

        button {
          -webkit-tap-highlight-color:
            transparent;
        }

        /* WRAPPER */

        .product-wrapper {
          width:
            100%;

          max-width:
            1240px;

          margin:
            0 auto;
        }

        /* BREADCRUMB / DIRECTORY */

        .back-row {
          margin-bottom:
            22px;

          display:
            flex;

          align-items:
            center;

          gap:
            10px;

          min-width:
            0;

          font-size:
            15px;

          line-height:
            1.2;

          letter-spacing:
            .15px;
        }

        .back-link {
          display:
            inline-flex;

          align-items:
            center;

          gap:
            8px;

          flex:
            0 0 auto;

          text-decoration:
            none;

          color:
            var(--gold-bright);

          transition:
            color .15s ease,
            opacity .15s ease;
        }

        .back-link:hover {
          color:
            #f0d493;
        }

        .back-arrow {
          font-size:
            18px;

          line-height:
            1;

          color:
            var(--gold);
        }

        .breadcrumb-separator {
          flex:
            0 0 auto;

          color:
            #766d60;
        }

        .breadcrumb-current {
          min-width:
            0;

          overflow:
            hidden;

          white-space:
            nowrap;

          text-overflow:
            ellipsis;

          color:
            var(--secondary-soft);
        }

        /* LAYOUT */

        .product-layout {
          display:
            grid;

          grid-template-columns:
            minmax(
              0,
              1.08fr
            )
            minmax(
              430px,
              .92fr
            );

          gap:
            68px;

          align-items:
            start;
        }

        /* IMAGE */

        .image-frame {
          width:
            100%;

          aspect-ratio:
            4 / 3;

          overflow:
            hidden;

          background:
            #141412;
        }

        .image-frame img {
          display:
            block;

          width:
            100%;

          height:
            100%;

          object-fit:
            cover;
        }

        /* PRODUCT */

        .product-column {
          padding-top:
            4px;
        }

        .intro h1 {
          margin:
            0;

          font-size:
            62px;

          line-height:
            .98;

          font-weight:
            400;

          color:
            var(--gold);
        }

        .title-price-separator {
          width:
            100%;

          height:
            1px;

          margin:
            20px 0 14px;

          background:
            var(--line-soft);
        }

        .top-price {
          margin-top:
            0;

          font-size:
            33px;

          color:
            var(--text);
        }

        .lead-description {
          margin-top:
            24px;

          max-width:
            530px;

          font-size:
            20px;

          line-height:
            1.5;

          color:
            #eee8dd;
        }

        /* DETAILS */

        .product-details {
          margin-top:
            23px;

          border-top:
            1px solid
            var(--line-soft);

          border-bottom:
            1px solid
            var(--line-soft);
        }

        .product-details summary {
          min-height:
            68px;

          padding:
            9px 0;

          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          gap:
            24px;

          list-style:
            none;

          cursor:
            pointer;

          color:
            var(--gold-bright);
        }

        .product-details summary::-webkit-details-marker {
          display:
            none;
        }

        .detail-heading {
          min-width:
            0;

          display:
            flex;

          flex-direction:
            column;

          gap:
            5px;
        }

        .detail-title {
          font-size:
            17px;
        }

        .detail-preview {
          max-width:
            440px;

          overflow:
            hidden;

          white-space:
            nowrap;

          text-overflow:
            ellipsis;

          font-size:
            14px;

          line-height:
            1.35;

          color:
            var(--secondary-soft);
        }

        .product-details[open]
        .detail-preview {
          display:
            none;
        }

        .detail-plus {
          flex:
            0 0 auto;

          font-size:
            23px;

          transition:
            transform .15s ease;
        }

        .product-details[open]
        .detail-plus {
          transform:
            rotate(
              45deg
            );
        }

        .detail-content {
          padding:
            10px 0 22px;

          font-size:
            17px;

          line-height:
            1.56;

          color:
            var(--secondary);
        }

        .detail-content p {
          margin:
            0 0 14px;
        }

        .detail-content ul,
        .detail-content ol {
          padding-left:
            23px;
        }

        .divider {
          height:
            1px;

          margin:
            32px 0;

          background:
            var(--line-soft);
        }

        /* LABELS */

        .option-section {
          margin-bottom:
            29px;
        }

        .option-heading {
          display:
            flex;

          justify-content:
            space-between;

          align-items:
            center;
        }

        .option-label {
          margin-bottom:
            12px;

          font-size:
            16px;

          line-height:
            1;

          font-weight:
            600;

          letter-spacing:
            .9px;

          text-transform:
            uppercase;

          color:
            #f0e9de;
        }

        .optional {
          margin-bottom:
            12px;

          font-size:
            14px;

          color:
            var(--secondary-soft);
        }

        .field-input {
          width:
            100%;

          box-sizing:
            border-box;

          height:
            59px;

          padding:
            0 18px;

          border:
            1px solid
            #d2bd9a;

          border-radius:
            4px;

          outline:
            none;

          background:
            #fff8ec;

          color:
            #2b2418;

          font:
            inherit;

          font-size:
            19px;

          color-scheme:
            light;

          box-shadow:
            inset
            0 1px 0
            rgba(
              255,
              255,
              255,
              .55
            );

          transition:
            border-color .15s ease,
            background .15s ease,
            box-shadow .15s ease;
        }

        .field-input:hover {
          border-color:
            #c3aa7d;

          background:
            #fffdf6;
        }

        .field-input:focus {
          border-color:
            var(--gold);

          background:
            #fffdf6;

          box-shadow:
            0 0 0 3px
            rgba(
              205,
              166,
              84,
              .18
            );
        }

        /* DROPDOWN */

        .select-wrap {
          position:
            relative;
        }

        select {
          width:
            100%;

          height:
            59px;

          padding:
            0 52px
            0 18px;

          appearance:
            none;

          -webkit-appearance:
            none;

          border:
            1px solid
            var(--line);

          border-radius:
            4px;

          outline:
            none;

          background:
            #292925;

          color:
            var(--text);

          font-size:
            19px;

          cursor:
            pointer;
        }

        select:hover,
        select:focus {
          border-color:
            var(--gold);
        }

        .select-arrow {
          position:
            absolute;

          top:
            50%;

          right:
            18px;

          transform:
            translateY(
              -50%
            );

          color:
            var(--gold);

          font-size:
            18px;

          pointer-events:
            none;
        }

        /* INLINE DATE PICKER */

        .date-input-proxy {
          position:
            absolute;

          width:
            1px;

          height:
            1px;

          opacity:
            0;

          pointer-events:
            none;
        }

        .inline-date-picker {
          width:
            100%;

          border:
            1px solid
            #ded4c3;

          border-radius:
            4px;

          background:
            #fffdf8;

          padding:
            14px;

          box-shadow:
            0 14px 34px
            rgba(
              19,
              15,
              9,
              .13
            ),
            inset
            0 1px 0
            rgba(
              255,
              255,
              255,
              .82
            );
        }

        .inline-date-picker[aria-invalid="true"] {
          border-color:
            #b85d5d;
        }

        .inline-date-header {
          min-height:
            42px;

          display:
            grid;

          grid-template-columns:
            42px 1fr 42px;

          align-items:
            center;

          gap:
            8px;

          margin-bottom:
            10px;
        }

        .inline-date-title {
          text-align:
            center;

          font-size:
            20px;

          line-height:
            1.2;

          color:
            #211d16;
        }

        .inline-date-nav {
          width:
            42px;

          height:
            42px;

          border:
            1px solid
            #ded2bf;

          border-radius:
            4px;

          background:
            #f8f3ea;

          color:
            #4f3a1c;

          font-size:
            20px;

          cursor:
            pointer;
        }

        .inline-date-nav:hover:not(:disabled) {
          border-color:
            var(--gold);

          background:
            #fff8ec;

          color:
            #2f2415;
        }

        .inline-date-nav:disabled {
          opacity:
            .35;

          cursor:
            default;
        }

        .inline-date-weekdays,
        .inline-date-grid {
          display:
            grid;

          grid-template-columns:
            repeat(
              7,
              minmax(
                0,
                1fr
              )
            );

          gap:
            6px;
        }

        .inline-date-weekdays {
          margin-bottom:
            8px;

          color:
            #746a5c;

          font-size:
            12px;

          line-height:
            1;

          font-weight:
            700;

          text-align:
            center;
        }

        .inline-date-empty {
          min-height:
            42px;
        }

        .inline-date-day {
          min-width:
            0;

          min-height:
            43px;

          padding:
            0;

          border:
            1px solid
            #e3d8c7;

          border-radius:
            4px;

          background:
            #ffffff;

          color:
            #252018;

          font-size:
            17px;

          line-height:
            1;

          cursor:
            pointer;
        }

        .inline-date-day:hover:not(:disabled):not(.selected) {
          border-color:
            var(--gold);

          background:
            #fff7e9;
        }

        .inline-date-day.selected {
          border-color:
            var(--gold);

          background:
            #211d16;

          color:
            #fff8ea;

          box-shadow:
            0 0 0 2px
            rgba(
              205,
              166,
              84,
              .18
            ),
            inset
            0 -2px 0
            rgba(
              205,
              166,
              84,
              .55
            );
        }

        .inline-date-day.unavailable {
          background:
            #f2eee7;

          color:
            #aaa095;

          border-color:
            #eadfce;

          cursor:
            default;

          opacity:
            .92;
        }

        .inline-date-message {
          margin-top:
            11px;

          color:
            #8f3131;

          font-size:
            13px;

          line-height:
            1.35;
        }

        .inline-date-selected {
          margin-top:
            11px;

          color:
            #4f3a1c;

          font-size:
            14px;

          line-height:
            1.35;
        }

        /* PREPARATION */

        .preparation-grid {
          display:
            grid;

          grid-template-columns:
            repeat(
              2,
              minmax(
                0,
                1fr
              )
            );

          gap:
            11px;
        }

        .preparation-card {
          min-height:
            74px;

          padding:
            12px 18px;

          display:
            flex;

          flex-direction:
            row;

          justify-content:
            center;

          align-items:
            center;

          gap:
            14px;

          border:
            1px solid
            var(--line);

          border-radius:
            5px;

          background:
            #171715;

          color:
            var(--cream);

          cursor:
            pointer;

          transition:
            border-color .15s ease,
            background .15s ease,
            color .15s ease,
            box-shadow .15s ease;
        }

        .preparation-card:hover {
          border-color:
            var(--gold);
        }

        .preparation-card.selected {
          border-color:
            var(--gold);

          background:
            linear-gradient(
              180deg,
              #3a311f 0%,
              #2b251a 100%
            );

          color:
            var(--gold-bright);

          box-shadow:
            inset
            0 0 0 1px
            rgba(
              205,
              166,
              84,
              .12
            );
        }

        .prep-icon-wrap {
          width:
            44px;

          height:
            44px;

          flex:
            0 0 44px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;
        }

        .prep-icon {
          width:
            44px;

          height:
            44px;

          display:
            block;

          object-fit:
            contain;
        }

        .prep-title {
          font-size:
            20px;

          line-height:
            1;

          color:
            inherit;
        }

        /* CHOICES */

        .choice-grid {
          display:
            grid;

          gap:
            10px;
        }

        .choice-grid.count-2 {
          grid-template-columns:
            repeat(
              2,
              1fr
            );
        }

        .choice-grid.count-3 {
          grid-template-columns:
            repeat(
              3,
              1fr
            );
        }

        .choice {
          min-height:
            59px;

          border:
            1px solid
            var(--line);

          border-radius:
            4px;

          background:
            var(--surface);

          color:
            var(--text);

          font-size:
            18px;

          cursor:
            pointer;
        }

        .choice.selected {
          border-color:
            var(--gold);

          background:
            var(--surface-selected);

          color:
            var(--gold-bright);
        }

        .choice small {
          display:
            block;

          margin-top:
            4px;

          color:
            var(--secondary);

          font-size:
            13px;
        }

        /* SIZE */

        .size-grid {
          display:
            grid;

          grid-template-columns:
            repeat(
              3,
              minmax(
                0,
                1fr
              )
            );

          gap:
            10px;
        }

        .size-choice {
          min-height:
            82px;

          padding:
            11px 7px;

          display:
            flex;

          flex-direction:
            column;

          align-items:
            center;

          justify-content:
            center;

          border:
            1px solid
            var(--line);

          border-radius:
            4px;

          background:
            #171715;

          color:
            var(--text);

          cursor:
            pointer;
        }

        .size-choice.selected {
          border-color:
            var(--gold);

          background:
            linear-gradient(
              180deg,
              #322b1e,
              #262118
            );
        }

        .size-choice strong {
          font-size:
            18px;

          font-weight:
            600;
        }

        .size-choice.selected
        strong {
          color:
            var(--gold-bright);
        }

        .size-choice span {
          margin-top:
            5px;

          font-size:
            14px;

          color:
            var(--secondary);
        }

        .size-choice small {
          margin-top:
            4px;

          font-size:
            13px;

          color:
            var(--gold);
        }

        /* ADD ONS */

        .addons {
          display:
            grid;

          gap:
            9px;
        }

        .addon {
          width:
            100%;

          min-height:
            61px;

          padding:
            12px 14px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          gap:
            15px;

          border:
            1px solid
            var(--line);

          border-radius:
            4px;

          background:
            #171715;

          color:
            var(--text);

          text-align:
            left;

          cursor:
            pointer;
        }

        .addon:hover {
          border-color:
            #85714b;
        }

        .addon.selected {
          border-color:
            var(--gold);

          background:
            #272319;
        }

        .addon-main {
          display:
            flex;

          align-items:
            center;

          gap:
            12px;

          min-width:
            0;
        }

        .check {
          width:
            21px;

          height:
            21px;

          flex:
            0 0 21px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          border:
            1px solid
            #aaa194;

          border-radius:
            2px;

          color:
            #111;

          font-size:
            13px;
        }

        .addon.selected
        .check {
          background:
            var(--gold);

          border-color:
            var(--gold);
        }

        .addon-text {
          font-size:
            17px;

          line-height:
            1.28;

          color:
            #f2ece2;
        }

        .addon-price {
          flex:
            0 0 auto;

          white-space:
            nowrap;

          font-size:
            15px;

          color:
            var(--gold-bright);
        }

        /* PURCHASE */

        .purchase-area {
          margin-top:
            42px;

          padding-top:
            27px;

          border-top:
            1px solid
            var(--line-soft);
        }

        .total-row {
          display:
            flex;

          justify-content:
            space-between;

          align-items:
            flex-end;

          margin-bottom:
            18px;
        }

        .total-label {
          padding-bottom:
            4px;

          font-size:
            15px;

          letter-spacing:
            .9px;

          text-transform:
            uppercase;

          color:
            var(--secondary-soft);
        }

        .total-row strong {
          font-size:
            34px;

          line-height:
            1;

          font-weight:
            400;
        }

        .add-button {
          width:
            100%;

          min-height:
            62px;

          border:
            1px solid
            var(--gold);

          border-radius:
            3px;

          background:
            var(--gold);

          color:
            #111;

          font-size:
            18px;

          font-weight:
            600;

          letter-spacing:
            1.2px;

          cursor:
            pointer;
        }

        .add-button:hover:not(:disabled) {
          background:
            var(--gold-bright);

          border-color:
            var(--gold-bright);
        }

        .add-button:disabled {
          opacity:
            .6;
        }

        .added-status {
          margin:
            14px 0 11px;

          font-size:
            17px;

          color:
            var(--gold-bright);
        }

        .cart-button {
          width:
            100%;

          min-height:
            57px;

          border:
            1px solid
            var(--gold);

          border-radius:
            3px;

          background:
            transparent;

          color:
            var(--gold-bright);

          font-size:
            17px;

          letter-spacing:
            1.1px;

          cursor:
            pointer;
        }

        /* TABLET */

        @media (
          max-width:
          1180px
        ) {
          .product-wrapper {
            max-width:
              720px;
          }

          .product-layout {
            grid-template-columns:
              1fr;

            gap:
              34px;
          }
        }

        /* MOBILE */

        .product-layout.mobile-layout {
          display:
            block;

          width:
            100%;

          max-width:
            100%;
        }

        .mobile-layout
        .visual-column {
          margin-bottom:
            32px;
        }

        .mobile-layout
        .intro h1 {
          font-size:
            54px;
        }

        .mobile-layout
        .top-price {
          margin-top:
            13px;

          font-size:
            36px;
        }

        .mobile-layout
        .lead-description {
          margin-top:
            23px;

          max-width:
            none;

          font-size:
            22px;

          line-height:
            1.48;
        }

        .mobile-layout
        .product-details
        summary {
          min-height:
            78px;
        }

        .mobile-layout
        .detail-title {
          font-size:
            20px;
        }

        .mobile-layout
        .detail-preview {
          max-width:
            78vw;

          font-size:
            16px;
        }

        .mobile-layout
        .detail-content {
          font-size:
            19px;
        }

        .mobile-layout
        .option-label {
          font-size:
            17px;
        }

        .mobile-layout
        .optional {
          font-size:
            16px;
        }

        .mobile-layout
        select {
          height:
            65px;

          font-size:
            21px;
        }

        .mobile-layout
        .preparation-card {
          min-height:
            76px;

          padding:
            12px 14px;

          gap:
            12px;
        }

        .mobile-layout
        .prep-icon-wrap {
          width:
            48px;

          height:
            48px;

          flex-basis:
            48px;
        }

        .mobile-layout
        .prep-icon {
          width:
            48px;

          height:
            48px;
        }

        .mobile-layout
        .prep-title {
          font-size:
            21px;
        }

        .mobile-layout
        .inline-date-picker {
          padding:
            12px;
        }

        .mobile-layout
        .inline-date-title {
          font-size:
            22px;
        }

        .mobile-layout
        .inline-date-day {
          min-height:
            46px;

          font-size:
            18px;
        }

        .mobile-layout
        .size-choice {
          min-height:
            90px;
        }

        .mobile-layout
        .size-choice strong {
          font-size:
            19px;
        }

        .mobile-layout
        .size-choice span {
          font-size:
            15px;
        }

        .mobile-layout
        .addon {
          min-height:
            69px;

          padding:
            14px;
        }

        .mobile-layout
        .addon-text {
          font-size:
            19px;
        }

        .mobile-layout
        .addon-price {
          font-size:
            17px;
        }

        .mobile-layout
        .total-label {
          font-size:
            16px;
        }

        .mobile-layout
        .total-row strong {
          font-size:
            37px;
        }

        .mobile-layout
        .add-button {
          min-height:
            68px;

          font-size:
            20px;
        }

        .mobile-layout
        .cart-button {
          min-height:
            64px;

          font-size:
            19px;
        }

        @media (
          max-width:
          760px
        ) {
          .back-row {
            margin-bottom:
              18px;

            gap:
              8px;

            font-size:
              14px;
          }

          .back-link {
            font-size:
              14px;
          }

          .back-arrow {
            font-size:
              17px;
          }
        }

        @media (
          max-width:
          420px
        ) {
          .mobile-layout
          .intro h1 {
            font-size:
              49px;
          }

          .mobile-layout
          .lead-description {
            font-size:
              20px;
          }

          .mobile-layout
          .prep-title {
            font-size:
              19px;
          }

          .mobile-layout
          .addon-text {
            font-size:
              17px;
          }

          .mobile-layout
          .addon-price {
            font-size:
              15px;
          }

          .mobile-layout
          .inline-date-picker {
            padding:
              10px;
          }

          .mobile-layout
          .inline-date-weekdays,
          .mobile-layout
          .inline-date-grid {
            gap:
              4px;
          }

          .mobile-layout
          .inline-date-day {
            min-height:
              42px;

            font-size:
              17px;
          }
        }

        /* Phone sizing also supports Wix's scaled 980px canvas. Desktop is untouched. */
        .product-wrapper:has(.mobile-layout) {
          width: 92vw;
          max-width: none;
          margin-inline: calc((100% - 92vw) / 2);
        }
        .product-wrapper:has(.mobile-layout) .back-row { font-size: 3.8vw; gap: 2vw; margin-bottom: 4vw; }
        .product-wrapper:has(.mobile-layout) .back-link { font-size: 3.8vw; }
        .product-wrapper:has(.mobile-layout) .back-arrow { font-size: 4.4vw; }
        .mobile-layout .intro h1 { font-size: 8vw; line-height: 1.12; overflow-wrap: anywhere; }
        .mobile-layout .top-price { font-size: 6.2vw; margin-top: 3vw; }
        .mobile-layout .lead-description { font-size: 4.4vw; line-height: 1.45; margin-top: 5vw; }
        .mobile-layout .product-details summary { min-height: 14vw; padding-block: 3vw; }
        .mobile-layout .detail-title { font-size: 4.4vw; }
        .mobile-layout .detail-preview { font-size: 3.8vw; max-width: 80vw; }
        .mobile-layout .detail-content { font-size: 4.4vw; line-height: 1.45; }
        .mobile-layout .option-label, .mobile-layout .optional { font-size: 3.8vw; }
        .mobile-layout .option-group { margin-top: 5vw; }
        .mobile-layout select { width: 100%; max-width: 100%; height: 14vw; font-size: 4.4vw; padding-inline: 3vw 7vw; }
        .mobile-layout .size-grid, .mobile-layout .choice-grid { gap: 2vw; }
        .mobile-layout .size-choice { min-height: 19vw; padding: 3vw 1vw; }
        .mobile-layout .size-choice strong, .mobile-layout .choice, .mobile-layout .prep-title { font-size: 4.4vw; }
        .mobile-layout .size-choice span, .mobile-layout .size-choice small, .mobile-layout .choice small { font-size: 3.6vw; }
        .mobile-layout .choice, .mobile-layout .preparation-card { min-height: 14vw; }
        .mobile-layout .addons { gap: 2vw; }
        .mobile-layout .addon { min-height: 14vw; padding: 3vw; gap: 2vw; }
        .mobile-layout .addon-main { gap: 2.5vw; }
        .mobile-layout .addon-text { font-size: 4.4vw; line-height: 1.35; overflow-wrap: anywhere; }
        .mobile-layout .addon-price { font-size: 3.8vw; }
        .mobile-layout .check { width: 5vw; height: 5vw; flex-basis: 5vw; font-size: 3.5vw; }
        .mobile-layout .purchase-area { margin-top: 7vw; padding-top: 5vw; }
        .mobile-layout .total-row { margin-bottom: 4vw; }
        .mobile-layout .total-label { font-size: 3.8vw; }
        .mobile-layout .total-row strong { font-size: 7vw; }
        .mobile-layout .add-button, .mobile-layout .cart-button { min-height: 14vw; font-size: 4.4vw; }
        .mobile-layout .added-status { font-size: 4.4vw; }
        @media (max-device-width: 360px), (max-width: 360px) {
          .mobile-layout .intro h1 { font-size: 8.75vw; }
          .mobile-layout .lead-description, .mobile-layout .detail-content,
          .mobile-layout .addon-text, .mobile-layout select,
          .mobile-layout .size-choice strong, .mobile-layout .choice,
          .mobile-layout .prep-title, .mobile-layout .add-button,
          .mobile-layout .cart-button { font-size: 5vw; }
        }

        /* Match action and option controls to the original logo gold. */
        .add-button,.cart-button,.choice,.size-choice,.preparation-card,.addon {
          --gold: #B48932;
          --gold-bright: #C39B4D;
          --surface-selected: #282319;
        }
        .addon:hover { border-color: #B48932; }
        .size-choice.selected,.preparation-card.selected { background: #282319; }

        /* LOADING */

        .loading {
          width:
            100%;

          max-width:
            1240px;

          margin:
            auto;

          display:
            grid;

          grid-template-columns:
            1fr 1fr;

          gap:
            60px;
        }

        .loading-image {
          aspect-ratio:
            4 / 3;

          background:
            #20201d;
        }

        .loading-info {
          display:
            grid;

          gap:
            20px;

          align-content:
            start;
        }

        .loading-info div {
          height:
            56px;

          background:
            #20201d;
        }

        .error {
          padding:
            30px 0;

          font-size:
            18px;

          color:
            #e3a7a7;
        }

      </style>
    `}}customElements.get("oyster-product-buybox")||customElements.define("oyster-product-buybox",b);const f=customElements.get("oyster-product-buybox");if(f&&f!==b&&String(f.prototype.priceModifierText)!==String(b.prototype.priceModifierText)){f.prototype.priceModifierText=b.prototype.priceModifierText;for(const x of document.querySelectorAll("oyster-product-buybox"))x.product&&x.render()}})();
