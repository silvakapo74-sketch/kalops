import React, {useState,useEffect} from 'react';
import {productImages} from './product-images.js';

export default function ProductImage({product,hero=false}){
  const photo=productImages[product.id];
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[photo?.src]);
  return <div className={'product-photo '+(hero?'hero-product':'')} style={{backgroundColor:photo?.background}}>
    {photo&&!failed
      ? <img src={photo.src} width={photo.width} height={photo.height} alt={'Embalagem Kalops '+product.name} loading={hero?'eager':'lazy'} decoding="async" onError={()=>setFailed(true)}/>
      : <div className="product-photo-pending" role="img" aria-label={'Foto de '+product.name+' em atualização'}><img src="/brand/monogram.svg" alt="" aria-hidden="true"/><span>{product.name}</span><small>Foto em atualização</small></div>}
  </div>
}
