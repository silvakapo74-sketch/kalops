import React from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {navigateWithMotion} from './storefront-motion.js';

export default function StoreLink({onClick,...props}){
  const navigate=useNavigate();
  return <Link {...props} onClick={event=>{
    onClick?.(event);
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||(props.target&&props.target!=='_self')||props.download!==undefined||typeof props.to!=='string')return;
    if(!document.startViewTransition||window.matchMedia('(prefers-reduced-motion: reduce)').matches||new URL(props.to,location.href).pathname===location.pathname)return;
    event.preventDefault();
    navigateWithMotion(navigate,props.to,{replace:props.replace,state:props.state});
  }}/>;
}
