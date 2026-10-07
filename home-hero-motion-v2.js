(()=>{
 if(window.__oysterHeroMotionV1)return;window.__oysterHeroMotionV1=true;
 const media=matchMedia('(prefers-reduced-motion: reduce)');let mounted=null,timer=0,attempts=0;
 const home=()=>location.pathname.replace(/\/$/,'')==='';
 const mobile=()=>Math.min(innerWidth,screen.width)<=680;
 function clear(){if(!mounted)return;mounted.abort.abort();clearTimeout(mounted.delay);mounted.io.disconnect();mounted.video.pause();mounted.video.removeAttribute('src');mounted.video.load();mounted.video.remove();mounted.style.remove();mounted=null;}
 function mount(){clearTimeout(timer);if(!home()||!mobile()||media.matches||navigator.connection?.saveData){clear();return;}
 const root=document.querySelector('[data-oyster-home-root]'),shadow=root?.shadowRoot,hero=shadow?.querySelector('.story-hero'),photo=hero?.querySelector('.story-photo');
 if(mounted&&mounted.root===root&&root.isConnected)return;
 clear();if(!photo){if(attempts++<80)timer=setTimeout(mount,250);return;}
 const video=document.createElement('video'),style=document.createElement('style'),abort=new AbortController();
 video.className='oyster-hero-motion';video.muted=true;video.playsInline=true;video.preload='none';video.setAttribute('aria-hidden','true');
 style.textContent='.oyster-hero-motion{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;opacity:0;transition:opacity .7s;pointer-events:none;transform:scaleX(-1)}.oyster-hero-motion.is-ready{opacity:1}.story-hero .hero-type{z-index:2}';
 shadow.append(style);hero.insertBefore(video,hero.querySelector('.hero-type'));
 let started=false,visible=false,ready=false;
 const state={root,video,style,abort,delay:0,io:null};mounted=state;
 function start(){if(started||!ready||!visible||document.hidden||media.matches||!home()||!mobile())return;started=true;video.src='https://theoystercart.github.io/oystercart-storefront/hero-mobile-v1.mp4';video.play().catch(()=>{video.classList.remove('is-ready');});}
 const opts={signal:abort.signal};
 video.addEventListener('playing',()=>{video.classList.add('is-ready');},opts);
 video.addEventListener('error',()=>{video.classList.remove('is-ready');},opts);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){video.pause();}else start()},opts);
 state.io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else if(!video.paused){video.pause();}},{threshold:.15});state.io.observe(hero);
 function schedule(){state.delay=setTimeout(()=>{ready=true;start()},150)}
 if(photo.complete&&photo.naturalWidth)schedule();else photo.addEventListener('load',schedule,{once:true,signal:abort.signal});
 }
 const observer=new MutationObserver(()=>{if(mounted&&(!home()||!mounted.root.isConnected))clear();if(!mounted&&home()){attempts=0;clearTimeout(timer);timer=setTimeout(mount,100)}});
 function init(){observer.observe(document.body,{childList:true,subtree:true});mount()}
 addEventListener('resize',mount);addEventListener('popstate',()=>{attempts=0;mount()});media.addEventListener('change',mount);
 if(document.body)init();else addEventListener('DOMContentLoaded',init,{once:true});
})();
