(()=>{
 if(window.__oysterDeliveryMotionV1)return;window.__oysterDeliveryMotionV1=true;
 const media=matchMedia('(prefers-reduced-motion: reduce)');let mounted=null,timer=0,attempts=0,prepared=null;
 const home=()=>location.pathname.replace(/\/$/,'')==='/delivery';
 const mobile=()=>Math.min(innerWidth,screen.width)<=680;
 function prepare(){if(!prepared){prepared=document.createElement('video');prepared.muted=true;prepared.playsInline=true;prepared.preload='auto';prepared.src='https://theoystercart.github.io/oystercart-storefront/delivery-hero-mobile-v1.mp4';prepared.load();}return prepared;}
 function clear(){if(!mounted)return;mounted.abort.abort();clearTimeout(mounted.delay);mounted.io.disconnect();mounted.video.pause();mounted.video.removeAttribute('src');mounted.video.load();mounted.video.remove();mounted.style.remove();mounted=null;}
 function mount(){clearTimeout(timer);if(!home()||!mobile()||media.matches||navigator.connection?.saveData){clear();if(prepared){prepared.removeAttribute('src');prepared.load();prepared=null;}return;}
 const root=document.querySelector('oyster-delivery-catalogue'),shadow=root?.shadowRoot,hero=shadow?.querySelector('.hero'),photo=hero?.querySelector('.hero-photo');
 if(mounted&&mounted.root===root&&root.isConnected&&mounted.video.isConnected)return;
 clear();prepare();if(!photo){if(attempts++<80)timer=setTimeout(mount,250);return;}
 const video=prepare(),style=document.createElement('style'),abort=new AbortController();
 video.className='oyster-delivery-motion';video.muted=true;video.playsInline=true;video.preload='auto';prepared=null;video.setAttribute('aria-hidden','true');
 style.textContent='.oyster-delivery-motion{position:absolute;top:0;left:0;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;object-position:center;opacity:0;transition:opacity .25s;pointer-events:none;z-index:1}.oyster-delivery-motion.is-ready{opacity:1}';
 shadow.append(style);hero.insertBefore(video,hero.querySelector('.hero-inner'));
 let started=false,visible=false,ready=true;
 const state={root,video,style,abort,delay:0,io:null};mounted=state;
 function start(){if(started||!ready||!visible||document.hidden||media.matches||!home()||!mobile())return;started=true;video.play().catch(()=>{video.classList.remove('is-ready');});}
 const opts={signal:abort.signal};
 video.addEventListener('playing',()=>{video.classList.add('is-ready');},opts);
 video.addEventListener('error',()=>{video.classList.remove('is-ready');},opts);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){video.pause();}else start()},opts);
 state.io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else if(!video.paused){video.pause();}},{threshold:.15});state.io.observe(hero);

 }
 const observer=new MutationObserver(()=>{if(mounted&&(!home()||!mounted.root.isConnected))clear();if(!mounted&&home()){attempts=0;clearTimeout(timer);timer=setTimeout(mount,100)}});
 function init(){observer.observe(document.body,{childList:true,subtree:true});mount()}
 addEventListener('resize',mount);addEventListener('popstate',()=>{attempts=0;mount()});media.addEventListener('change',mount);
 if(document.body)init();else addEventListener('DOMContentLoaded',init,{once:true});
})();
