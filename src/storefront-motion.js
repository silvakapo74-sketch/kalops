import {useEffect, useLayoutEffect, useState} from 'react';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const change=()=>setReduced(media.matches);
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
      [{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],
      {duration:380,delay,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'},
    ));
    // Animate content, never a wrapper around fixed purchase controls.
    document.querySelectorAll('.hero-copy > *, .breadcrumbs, .back-to-products, .product-detail-top > *, .checkout-page > h1, .not-found > *')
      .forEach((element,index)=>enter(element,Math.min(index*35,140)));
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){enter(entry.target);observer.unobserve(entry.target);}
    },{threshold:.12});
    document.querySelectorAll('.benefit-strip > div, .brand-section > div, .how-section > h2, .steps > div, .bottom-cta > div').forEach(element=>observer.observe(element));
    return()=>{observer.disconnect();animations.forEach(animation=>animation.cancel());};
  },[path,disabled]);
}
