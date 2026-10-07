(()=>{
 if(window.__oysterHeroMotionV1)return;window.__oysterHeroMotionV1=true;
 const media=matchMedia('(prefers-reduced-motion: reduce)');let mounted=null,timer=0,attempts=0;
 const home=()=>location.pathname.replace(/\/$/,'')==='';
 const mobile=()=>Math.min(innerWidth,screen.width)<=680;
 function clear(){if(!mounted)return;mounted.abort.abort();clearTimeout(mounted.delay);mounted.io.disconnect();mounted.video.pause();mounted.video.removeAttribute('src');mounted.video.load();mounted.video.remove();mounted.button.remove();mounted.style.remove();mounted=null;}
 function mount(){clearTimeout(timer);if(!home()||!mobile()||media.matches||navigator.connection?.saveData){clear();return;}
 const root=document.querySelector('[data-oyster-home-root]'),shadow=root?.shadowRoot,hero=shadow?.querySelector('.story-hero'),photo=hero?.querySelector('.story-photo');
 if(mounted&&mounted.root===root&&root.isConnected)return;
 clear();if(!photo){if(attempts++<80)timer=setTimeout(mount,250);return;}
 const video=document.createElement('video'),button=document.createElement('button'),style=document.createElement('style'),abort=new AbortController();
 video.className='oyster-hero-motion';video.muted=true;video.playsInline=true;video.preload='none';video.setAttribute('aria-hidden','true');button.className='oyster-hero-motion-toggle';button.type='button';button.hidden=true;button.textContent='Pause motion';
 style.textContent='.oyster-hero-motion{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;opacity:0;transition:opacity .7s;pointer-events:none;transform:scaleX(-1)}.oyster-hero-motion.is-ready{opacity:1}.story-hero .hero-type{z-index:2}.oyster-hero-motion-toggle{position:absolute;right:16px;top:16px;z-index:4;min-height:44px;padding:8px 14px;background:#070707cc;color:#fff;border:1px solid #b18a36;border-radius:4px;font:16px "Adobe Caslon Pro",Georgia,serif}.oyster-hero-motion-toggle[hidden]{display:none}.oyster-hero-motion-toggle:focus-visible{outline:2px solid #fff;outline-offset:3px}';
 shadow.append(style);hero.insertBefore(video,hero.querySelector('.hero-type'));hero.append(button);
 let started=false,visible=false,ready=false;
 const state={root,video,button,style,abort,delay:0,io:null};mounted=state;
 function start(){if(started||!ready||!visible||document.hidden||media.matches||!home()||!mobile())return;started=true;video.src='https://theoystercart.github.io/oystercart-storefront/hero-mobile-v1.mp4';video.play().catch(()=>{video.classList.remove('is-ready');button.hidden=true;});}
 const opts={signal:abort.signal};
 video.addEventListener('playing',()=>{video.classList.add('is-ready');button.hidden=false;button.textContent='Pause motion'},opts);
 video.addEventListener('error',()=>{video.classList.remove('is-ready');button.hidden=true},opts);
 video.addEventListener('ended',()=>button.textContent='Replay motion',opts);
 button.addEventListener('click',()=>{if(video.paused)video.play().catch(()=>{});else{video.pause();button.textContent='Play motion'}},opts);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){video.pause();button.textContent='Play motion'}else start()},opts);
 state.io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else if(!video.paused){video.pause();button.textContent='Play motion'}},{threshold:.15});state.io.observe(hero);
 function schedule(){state.delay=setTimeout(()=>{ready=true;start()},1800)}
 if(photo.complete&&photo.naturalWidth)schedule();else photo.addEventListener('load',schedule,{once:true,signal:abort.signal});
 }
 const observer=new MutationObserver(()=>{if(mounted&&(!home()||!mounted.root.isConnected))clear();if(!mounted&&home()){attempts=0;clearTimeout(timer);timer=setTimeout(mount,100)}});
 function init(){observer.observe(document.body,{childList:true,subtree:true});mount()}
 addEventListener('resize',mount);addEventListener('popstate',()=>{attempts=0;mount()});media.addEventListener('change',mount);
 if(document.body)init();else addEventListener('DOMContentLoaded',init,{once:true});
})();
