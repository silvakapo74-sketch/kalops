import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,ArrowUpRight,Check,Minus,Plus,ShoppingBag,Truck,PackageCheck} from 'lucide-react';
import ProductImage from './ProductImage.jsx';
import ResalePrice from './ResalePrice.jsx';

const money=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export default function ProductPage({product,products,onAdd,drawerOpen}){
  const [quantity,setQuantity]=useState('10');
  const units=Number(quantity);
  const valid=quantity!==''&&Number.isInteger(units)&&units>=10&&units<=999999;
  const related=products.filter(p=>p.id!==product.id).sort((a,b)=>Number(b.category===product.category)-Number(a.category===product.category)).slice(0,3);
  const change=delta=>setQuantity(String(Math.min(999999,Math.max(10,(Number.isFinite(units)?Math.floor(units):10)+delta))));
  const submit=e=>{e.preventDefault();if(valid)onAdd(product,units)};
  return <main className="product-detail-page">
    <div className="breadcrumbs" aria-label="Navegação estrutural">
      <Link to="/">Início</Link><span>/</span><Link to="/#catalogo">Produtos</Link><span>/</span><span aria-current="page">{product.name}</span>
    </div>
    <Link className="back-to-products" to="/#catalogo"><ArrowLeft size={15}/> Voltar aos produtos</Link>
    <section className="product-detail-top" aria-labelledby="product-heading">
      <div className="product-detail-image"><span className="product-detail-tag">{product.tag}</span><ProductImage product={product} hero/></div>
      <div className="product-detail-info">
        <div className="eyebrow dark">KALOPS · {product.category.toUpperCase()}</div>
        <h1 id="product-heading" tabIndex={-1}>{product.name}</h1>
        <p className="product-detail-kind">{product.kind} <span>· {product.size}</span></p>
        <p className="product-detail-intro">{product.desc.split('. ')[0]}.</p>
        <ul className="product-benefits">{product.benefits.map(benefit=><li key={benefit}><Check size={14}/>{benefit}</li>)}</ul>
        <div className="pdp-price"><span>PREÇO DE ATACADO</span><div><strong>{money(product.price)}</strong><small>/ unidade</small></div></div><ResalePrice value={product.retail}/>
        <form className="product-purchase" onSubmit={submit} noValidate>
          <label htmlFor="product-quantity">Quantidade <span>Mínimo de 10 unidades por produto</span></label>
          <div className="purchase-quantity-row">
            <div className="pdp-quantity">
              <button type="button" onClick={()=>change(-1)} disabled={valid&&units===10} aria-label="Diminuir quantidade"><Minus size={17}/></button>
              <input id="product-quantity" type="number" inputMode="numeric" min="10" max="999999" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)} aria-invalid={!valid} aria-describedby={!valid?'quantity-error':undefined}/>
              <button type="button" onClick={()=>change(1)} aria-label="Aumentar quantidade"><Plus size={17}/></button>
            </div>
            <div className="pdp-subtotal"><span>Total dos produtos</span><strong>{valid?money(product.price*units):'—'}</strong></div>
          </div>
          {!valid&&<p className="pdp-error" id="quantity-error" role="alert">Informe uma quantidade inteira entre 10 e 999.999 unidades.</p>}
          <button className="button green full pdp-add-button" type="submit" disabled={!valid}><ShoppingBag size={18}/>Adicionar ao pedido <ArrowUpRight size={18}/></button>
          <p className="pdp-commercial-note">Você monta o pedido e confirma os valores, a disponibilidade e o pagamento com a equipe Kalops.</p>
        </form>
        <div className="pdp-delivery"><Truck size={20}/><div><b>Frete sob consulta</b><p>Informe seu CEP ao enviar o orçamento.</p></div></div>
      </div>
    </section>
    <section className="product-description">
      <div><div className="eyebrow dark">CUIDADO EM CADA DETALHE</div><h2>Sobre o produto</h2><p>{product.desc}</p>
        {product.id==='leave'&&<div className="product-how-to"><h3>Como usar</h3><ol><li>Aplique uma pequena quantidade nas mãos, com os cabelos secos ou úmidos.</li><li>Distribua pelo comprimento e pelas pontas de maneira uniforme.</li><li>Finalize com as mãos, pente ou secador. Não enxágue.</li></ol></div>}
      </div>
      <div className="product-specs"><h3>Informações do produto</h3><dl><div><dt>Marca</dt><dd>Kalops</dd></div><div><dt>Categoria</dt><dd>{product.category}</dd></div><div><dt>Conteúdo</dt><dd>{product.size}</dd></div><div><dt>Pedido mínimo</dt><dd>10 unidades deste produto</dd></div></dl><p><PackageCheck size={18}/>Compra direto da marca.</p></div>
    </section>
    <section className="related-products"><div className="section-top"><div><div className="eyebrow dark">COMPLETE SEU PEDIDO</div><h2>Mais cuidados. <em>Mais Kalops.</em></h2></div><Link to="/#catalogo">Ver todos os produtos <ArrowUpRight size={17}/></Link></div><div className="related-grid">{related.map(p=><Link className="related-card" to={p.path} key={p.id}><div className="related-image"><ProductImage product={p}/></div><span>{p.kind}</span><h3>{p.name}<ArrowUpRight size={16}/></h3><p><b>{money(p.price)}</b> / unidade</p></Link>)}</div></section>
    {!drawerOpen&&<div className="product-purchase-bar"><div><span>{valid?units+' unidades':'Quantidade inválida'}</span><strong>{valid?money(product.price*units):'—'}</strong></div><button disabled={!valid} onClick={()=>onAdd(product,units)}><ShoppingBag size={17}/>Adicionar ao pedido</button></div>}
  </main>;
}
