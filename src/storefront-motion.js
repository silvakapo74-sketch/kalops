import {useCallback, useEffect, useLayoutEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {useNavigate} from 'react-router-dom';

let activeTransition;
export function navigateWithMotion(navigate,to,options) {
  if(typeof to!=='string'||!document.startViewTransition||window.matchMedia('(prefers-reduced-motion: reduce)').matches||new URL(to,location.href).pathname===location.pathname){navigate(to,options);return;}
  activeTransition?.skipTransition();
  document.documentElement.dataset.routeTransition='active';
  const transition=document.startViewTransition(()=>{
    flushSync(()=>navigate(to,options));
    const hash=new URL(to,location.href).hash;
    if(hash)document.getElementById(hash.slice(1))?.scrollIntoView({behavior:'instant'});
    else window.scrollTo({top:0,behavior:'instant'});
  });
  activeTransition=transition;
  const finish=()=>{if(activeTransition===transition){activeTransition=null;delete document.documentElement.dataset.routeTransition;}};
  transition.finished.then(finish,finish);
}

export function useMotionNavigate(){
  const navigate=useNavigate();
  return useCallback((to,options)=>navigateWithMotion(navigate,to,options),[navigate]);
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const change=()=>{setReduced(media.matches);if(media.matches)activeTransition?.skipTransition();};
    media.addEventListener('change',change);
    return()=>media.removeEventListener('change',change);
  },[]);
  return reduced;
}

// Keep only the closing shell mounted. Callers make it inert immediately so
// animation never delays navigation, focus restoration or another interaction.
export function usePresence(open, reduced, duration=220) {
  const [present,setPresent]=useState(open);
  useEffect(()=>{
    if(open){setPresent(true);return;}
    if(reduced){setPresent(false);return;}
    const timer=setTimeout(()=>setPresent(false),duration);
    return()=>clearTimeout(timer);
  },[open,reduced,duration]);
  return open||(!reduced&&present);
}

export function usePageMotion(path, disabled) {
  useLayoutEffect(()=>{
    if(disabled||!Element.prototype.animate)return;
    const animations=[];
    const enter=(element,delay=0)=>animations.push(element.animate(
      [{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'translateY(0)'}],
      {duration:560,delay,easing:'cubic-bezier(.2,.75,.25,1)',fill:'backwards'},
    ));
    // Animate content, never a wrapper around fixed purchase controls.
    if(!document.documentElement.dataset.routeTransition)document.querySelectorAll('.hero-copy > *, .breadcrumbs, .back-to-products, .product-detail-top > *, .checkout-page > h1, .not-found > *')
      .forEach((element,index)=>enter(element,Math.min(index*35,140)));
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){enter(entry.target);observer.unobserve(entry.target);}
    },{threshold:.12});
    document.querySelectorAll('.benefit-strip > div, .brand-section > div, .how-section > h2, .steps > div, .bottom-cta > div').forEach(element=>observer.observe(element));
    return()=>{observer.disconnect();animations.forEach(animation=>animation.cancel());};
  },[path,disabled]);
}

export function useCatalogMotion(key,disabled){
  useLayoutEffect(()=>{
    if(disabled||!Element.prototype.animate)return;
    const animations=[];
    const observer=new IntersectionObserver(entries=>{
      let stagger=0;
      for(const entry of entries)if(entry.isIntersecting){
        animations.push(entry.target.animate([{opacity:0,transform:'translateY(28px)'},{opacity:1,transform:'translateY(0)'}],{duration:620,delay:stagger++*75,easing:'cubic-bezier(.2,.75,.25,1)',fill:'backwards'}));
        observer.unobserve(entry.target);
      }
    },{threshold:.08});
    document.querySelectorAll('.product-card').forEach(card=>observer.observe(card));
    return()=>{observer.disconnect();animations.forEach(animation=>animation.cancel());};
  },[key,disabled]);
}

export function usePressFeedback(disabled){
  useEffect(()=>{
    if(disabled)return;
    const timers=new Map();
    const press=event=>{
      if(event.type==='click'&&event.detail!==0)return;
      const button=event.target.closest?.('.button,.add-button,.bag-button,.icon-button,.tabs button,.mobile-order-bar button,.product-purchase-bar button');
      if(!button||button.disabled||button.closest('.admin-app'))return;
      const rect=button.getBoundingClientRect();
      button.style.setProperty('--press-x',(event.detail===0&&event.type==='click'?rect.width/2:event.clientX-rect.left)+'px');
      button.style.setProperty('--press-y',(event.detail===0&&event.type==='click'?rect.height/2:event.clientY-rect.top)+'px');
      clearTimeout(timers.get(button));delete button.dataset.pressed;
      void button.offsetWidth;
      button.dataset.pressed='true';
      timers.set(button,setTimeout(()=>{delete button.dataset.pressed;timers.delete(button);},600));
    };
    document.addEventListener('pointerdown',press,{passive:true});document.addEventListener('click',press);
    return()=>{document.removeEventListener('pointerdown',press);document.removeEventListener('click',press);for(const [button,timer] of timers){clearTimeout(timer);delete button.dataset.pressed;}};
  },[disabled]);
}
