import React, {useEffect, useRef, useState} from 'react';
import Link from './StoreLink.jsx';
import {ArrowLeft, ArrowUpRight, Check, LoaderCircle, LockKeyhole, ShoppingBag} from 'lucide-react';
import ProductImage from './ProductImage.jsx';
import './checkout.css';
import CheckoutAddress from './CheckoutAddress.jsx';

const money = value => value.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

export default function CheckoutPage({cart, products, onSubmitted, onEdit}) {
  const selected = products.filter(p=>cart[p.id]);
  const valid = selected.length > 0 && selected.every(p=>Number.isInteger(cart[p.id]) && cart[p.id]>=10 && cart[p.id]<=10000);
  const total = selected.reduce((sum,p)=>sum+p.price*cart[p.id],0);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [receipt,setReceipt] = useState(null);
  const [availability,setAvailability] = useState('loading');
  const attempt = useRef(null);
  const successHeading = useRef(null);
  useEffect(()=>{if(receipt)successHeading.current?.focus();},[receipt]);
  useEffect(()=>{const controller=new AbortController();fetch('/api/orders',{signal:controller.signal}).then(async response=>{const data=await response.json();setAvailability(response.ok&&data.available?'ready':'unavailable');}).catch(error=>{if(error.name!=='AbortError')setAvailability('unavailable');});return()=>controller.abort();},[]);
  async function submit(event) {
    event.preventDefault();
    if(busy || !valid || availability!=='ready') return;
    const form = new FormData(event.currentTarget);
    const customer = Object.fromEntries(['name','company','phone','email','cep','city','state','notes'].map(key=>[key,String(form.get(key)||'').trim()]));
    const data = {customer,items:selected.map(p=>({id:p.id,quantity:cart[p.id]})),consent:form.get('consent')==='on'};
    const signature = JSON.stringify(data);
    if(attempt.current?.signature!==signature) attempt.current={signature,id:crypto.randomUUID()};
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,requestId:attempt.current.id})});
      const result=await response.json().catch(()=>null);
      if(!response.ok || !result?.order) throw new Error(result?.error || 'Não foi possível enviar agora. Seu pedido continua salvo; tente novamente.');
      setReceipt(result.order);onSubmitted();
      window.scrollTo({top:0,behavior:'instant'});
    } catch(error) {setError(error.message || 'Verifique sua conexão e tente novamente.');}
    finally {setBusy(false);}
  }
  if(receipt) return <main className="checkout-page checkout-success">
    <div className="receipt-icon"><Check size={30}/></div>
    <div className="eyebrow dark">SOLICITAÇÃO RECEBIDA</div><h1 ref={successHeading} tabIndex={-1}>Seu próximo estoque<br/><em>está a um passo.</em></h1>
    <p>Seu pedido foi registrado. A equipe Kalops entrará em contato para confirmar disponibilidade, frete e pagamento.</p>
    <div className="receipt-card"><span>Protocolo do pedido</span><strong>{receipt.id}</strong><span>Total dos produtos</span><b>{money(receipt.totalCents/100)}</b><small>Frete a confirmar. Nenhuma cobrança foi realizada.</small></div>
    <Link className="button green" to="/#catalogo">Voltar à loja <ArrowUpRight size={18}/></Link>
  </main>;
  if(!selected.length) return <main className="checkout-page checkout-empty"><ShoppingBag size={32}/><h1 tabIndex={-1}>Vamos montar seu pedido?</h1><p>Escolha os produtos que quer levar para o seu negócio.</p><Link className="button green" to="/#catalogo">Explorar produtos <ArrowUpRight size={18}/></Link></main>;
  if(availability==='loading')return <main className="checkout-page checkout-empty" aria-busy="true"><LoaderCircle className="checkout-spinner"/><p role="status">Preparando o envio do seu pedido…</p></main>;
  if(availability==='unavailable')return <main className="checkout-page checkout-empty"><h1 tabIndex={-1}>Vamos conversar?</h1><p>O envio direto está temporariamente indisponível. Seu carrinho continua salvo: copie o resumo no pedido e envie para a Kalops pelo Instagram.</p><button className="button green" onClick={onEdit}>Ver meu pedido <ShoppingBag size={18}/></button><p><a href="https://www.instagram.com/kalopscosmeticos/" target="_blank" rel="noreferrer">Falar com @kalopscosmeticos ↗</a></p></main>;
  return <main className="checkout-page">
    <Link className="back-to-products" to="/#catalogo"><ArrowLeft size={15}/>Continuar escolhendo</Link>
    <div className="eyebrow dark">DIRETO PARA A EQUIPE KALOPS</div><h1 tabIndex={-1}>Seu pedido. <em>Nossa parceria.</em></h1>
    <p className="checkout-intro">Deixe seus dados para receber a confirmação de estoque, frete e pagamento.</p>
    <div className="checkout-layout">
      <form className="checkout-form" onSubmit={submit}>
        <fieldset disabled={busy}><legend>Como podemos falar com você?</legend>
          <div className="checkout-fields">
            <label className="wide">Seu nome<input name="name" autoComplete="name" minLength={2} maxLength={100} required/></label>
            <label className="wide">Empresa ou nome da loja <span>(opcional)</span><input name="company" autoComplete="organization" maxLength={120}/></label>
            <label>WhatsApp com DDD<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" maxLength={22} required/></label>
            <label>E-mail<input name="email" type="email" autoComplete="email" maxLength={160} required/></label>
          </div>
        </fieldset>
        <fieldset disabled={busy}><legend>Para onde vai o pedido?</legend><p>Usaremos essas informações para consultar o frete.</p>
          <div className="checkout-fields"><CheckoutAddress busy={busy}/><label className="wide">Observações <span>(opcional)</span><textarea name="notes" rows={3} maxLength={1000} placeholder="Conte o que precisamos saber sobre seu pedido."/></label></div>
        </fieldset>
        <label className="checkout-consent"><input name="consent" type="checkbox" required disabled={busy}/><span>Autorizo a Kalops a usar meus dados para atender este pedido e entrar em contato comigo. <Link to="/privacidade" target="_blank" rel="noreferrer">Como cuidamos dos seus dados</Link>.</span></label>
        {!valid&&<p className="checkout-error" role="alert">Cada produto deve ter entre 10 e 10.000 unidades. Ajuste as quantidades no pedido.</p>}
        {error&&<p className="checkout-error" role="alert">{error}</p>}
        <button className="button green full" type="submit" disabled={!valid||busy}>{busy?<><LoaderCircle className="checkout-spinner" size={18}/>Enviando pedido…</>:<>Enviar solicitação de pedido <ArrowUpRight size={18}/></>}</button>
        <p className="checkout-note"><LockKeyhole size={14}/>Seus dados ficam disponíveis apenas para atendimento do pedido.</p>
      </form>
      <aside className="checkout-summary"><div className="checkout-summary-heading"><h2>Seu pedido</h2><button type="button" onClick={onEdit} disabled={busy}>Editar</button></div>
        {selected.map(p=><div className="checkout-item" key={p.id}><ProductImage product={p}/><div><h3>{p.name}</h3><span>{cart[p.id]} un. × {money(p.price)}</span><b>{money(cart[p.id]*p.price)}</b></div></div>)}
        <div className="checkout-total"><span>Total dos produtos</span><strong>{money(total)}</strong></div><div className="checkout-freight"><span>Frete</span><span>A confirmar</span></div><p>Esta é uma solicitação de pedido, sem cobrança online. Preços e disponibilidade serão confirmados pela equipe.</p>
      </aside>
    </div>
  </main>;
}
