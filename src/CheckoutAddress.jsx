import React, {useEffect, useRef, useState} from 'react';
import {lookupCep, states, validCep} from './cep.js';

export default function CheckoutAddress({busy}) {
  const [cep, setCep] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [message, setMessage] = useState('Informe o CEP para preencher cidade e estado. Você pode corrigir os campos.');
  const [loading, setLoading] = useState(false);
  const active = useRef(null);
  const edits = useRef({city:0, state:0});

  useEffect(() => {
    if (!validCep(cep) || busy) return;
    const controller = new AbortController();
    active.current = controller;
    const before = {...edits.current};
    let current = true;
    let timeout;
    const timer = setTimeout(async () => {
      setLoading(true);
      setMessage('Consultando CEP…');
      timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const address = await lookupCep(cep, {signal:controller.signal});
        if (!current || controller.signal.aborted) return;
        if (edits.current.city === before.city) setCity(address.city);
        if (edits.current.state === before.state) setState(address.state);
        setMessage('Consulta concluída. Confira cidade e estado e corrija se necessário.');
      } catch (error) {
        if (current) setMessage(controller.signal.aborted
          ? 'A consulta demorou demais. Preencha cidade e estado manualmente.'
          : error instanceof SyntaxError ? 'Resposta inválida da consulta. Preencha cidade e estado manualmente.'
          : error instanceof TypeError ? 'Não foi possível consultar o CEP. Preencha cidade e estado manualmente.' : error.message);
      } finally {
        clearTimeout(timeout);
        if (current) setLoading(false);
      }
    }, 400);
    return () => {current=false; clearTimeout(timer); clearTimeout(timeout); controller.abort();};
  }, [cep, busy]);

  function changeCep(event) {
    active.current?.abort();
    const value = event.target.value;
    setCep(value);
    setLoading(false);
    setMessage(value && !validCep(value) ? 'Informe um CEP com 8 dígitos (00000-000).' : 'Você pode preencher ou corrigir cidade e estado manualmente.');
  }

  return <>
    <label>CEP<input name="cep" value={cep} onChange={changeCep} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" pattern="[0-9]{5}-?[0-9]{3}" maxLength={9} required aria-describedby="cep-status" aria-invalid={Boolean(cep && !validCep(cep))}/></label>
    <label>Estado<select name="state" value={state} onChange={event=>{edits.current.state++;setState(event.target.value);}} autoComplete="address-level1" required><option value="" disabled>Selecione</option>{states.map(uf=><option key={uf}>{uf}</option>)}</select></label>
    <label className="wide">Cidade<input name="city" value={city} onChange={event=>{edits.current.city++;setCity(event.target.value);}} autoComplete="address-level2" minLength={2} maxLength={100} required/></label>
    <p className="wide checkout-cep-status" id="cep-status" role="status" aria-live="polite" aria-busy={loading}>{message}</p>
  </>;
}
