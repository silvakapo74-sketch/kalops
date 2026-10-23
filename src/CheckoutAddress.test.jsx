// @vitest-environment jsdom
import React from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import CheckoutAddress from './CheckoutAddress.jsx';
import CheckoutPage from './CheckoutPage.jsx';
import {MemoryRouter} from 'react-router-dom';
import {lookupCep, validCep} from './cep.js';

const reply = data => ({ok:true,json:async()=>data});
const address = {localidade:'São Paulo',uf:'SP'};
const tick = async (ms=400) => {await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});};
const fill = (label,value) => fireEvent.change(screen.getByLabelText(label),{target:{value}});
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(reply(address)));});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});

describe('CEP',()=>{
  it.each(['01001000','01001-000'])('aceita %s e consulta apenas os dígitos',async cep=>{
    expect(validCep(cep)).toBe(true);
    expect(await lookupCep(cep)).toEqual({city:'São Paulo',state:'SP'});
    expect(fetch.mock.calls[0][0]).toBe('https://viacep.com.br/ws/01001000/json/');
  });
  it.each(['123','0100A000','010010000',''])('rejeita formato %s sem consultar',async cep=>{
    await expect(lookupCep(cep)).rejects.toThrow('8 dígitos');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([{erro:true},{erro:'true'},{localidade:'',uf:'SP'},{localidade:'Cidade',uf:'XX'},null])('rejeita resposta %j',async data=>{
    fetch.mockResolvedValue(reply(data));
    await expect(lookupCep('01001000')).rejects.toThrow();
  });
  it('trata falha HTTP',async()=>{
    fetch.mockResolvedValue({ok:false});
    await expect(lookupCep('01001000')).rejects.toThrow('manualmente');
  });
});

describe('formulário de endereço',()=>{
  it('aguarda digitação, preenche e permite corrigir manualmente',async()=>{
    render(<CheckoutAddress busy={false}/>);
    fill('CEP','123');await tick();expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('8 dígitos');
    fill('CEP','01001-000');await tick(399);expect(fetch).not.toHaveBeenCalled();await tick(1);
    expect(screen.getByLabelText('Cidade').value).toBe('São Paulo');
    expect(screen.getByLabelText('Estado').value).toBe('SP');
    fill('Cidade','Campinas');fill('Estado','RJ');
    await tick(1000);expect(screen.getByLabelText('Cidade').value).toBe('Campinas');
    expect(screen.getByLabelText('Estado').value).toBe('RJ');
  });
  it('preserva correção feita durante consulta',async()=>{
    let resolve;fetch.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    render(<CheckoutAddress busy={false}/>);fill('CEP','01001000');await tick();
    fill('Cidade','Campinas');fill('Estado','RJ');
    await act(async()=>resolve(reply(address)));
    expect(screen.getByLabelText('Cidade').value).toBe('Campinas');
    expect(screen.getByLabelText('Estado').value).toBe('RJ');
  });
  it('ignora resposta de CEP anterior mesmo que o transporte ignore abort',async()=>{
    const pending=[];fetch.mockImplementation(()=>new Promise(resolve=>pending.push(resolve)));
    render(<CheckoutAddress busy={false}/>);fill('CEP','01001000');await tick();
    fill('CEP','20040002');await tick();
    await act(async()=>pending[1](reply({localidade:'Rio de Janeiro',uf:'RJ'})));
    await act(async()=>pending[0](reply(address)));
    expect(screen.getByLabelText('Cidade').value).toBe('Rio de Janeiro');
  });
  it.each([
    [()=>Promise.resolve(reply({erro:true})),'CEP não encontrado'],
    [()=>Promise.reject(new TypeError('Failed to fetch')),'Não foi possível'],
    [()=>Promise.resolve({ok:true,json:async()=>{throw new SyntaxError();}}),'Resposta inválida'],
    [()=>Promise.resolve({ok:false}),'Não foi possível'],
  ])('permite preenchimento manual em falha de consulta',async(implementation,message)=>{
    fetch.mockImplementation(implementation);render(<CheckoutAddress busy={false}/>);
    fill('CEP','99999999');await tick();
    expect(screen.getByRole('status').textContent).toContain(message);
    fill('Cidade','Salvador');fill('Estado','BA');
    expect(screen.getByLabelText('Cidade').value).toBe('Salvador');
  });
  it('limita a consulta a oito segundos',async()=>{
    fetch.mockImplementation((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))));
    render(<CheckoutAddress busy={false}/>);fill('CEP','01001000');await tick();await tick(8000);
    expect(screen.getByRole('status').textContent).toContain('demorou demais');
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('cancela ao desmontar e ao apagar o CEP',async()=>{
    fetch.mockImplementation(()=>new Promise(()=>{}));
    const view=render(<CheckoutAddress busy={false}/>);fill('CEP','01001000');await tick();
    const first=fetch.mock.calls[0][1].signal;fill('CEP','');expect(first.aborted).toBe(true);
    fill('CEP','01001000');await tick();const second=fetch.mock.calls[1][1].signal;
    view.unmount();expect(second.aborted).toBe(true);
  });
});

it.each([false,true])('envia o endereço corrigido e mantém recibo sem cobrança (consulta indisponível: %s)',async offline=>{
  fetch.mockImplementation(async(url,options)=>{
    if(url.includes('viacep')) {
      if(offline) throw new TypeError('Network request failed');
      return reply(address);
    }
    return options?.method==='POST'?reply({order:{id:'TEST-1',totalCents:19000}}):reply({available:true});
  });
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  const onSubmitted=vi.fn();
  render(<MemoryRouter><CheckoutPage cart={{leave:10}} products={[{id:'leave',name:'Leave-in',price:19}]} onSubmitted={onSubmitted} onEdit={()=>{}}/></MemoryRouter>);
  await act(async()=>{});
  fill('Seu nome','Cliente Teste');fill('WhatsApp com DDD','11999998888');fill('E-mail','teste@example.com');
  fill('CEP','01001000');await tick();fill('Cidade','Campinas');fill('Estado','SP');
  fireEvent.click(screen.getByRole('checkbox'));
  const form=screen.getByRole('button',{name:/Enviar solicitação/}).closest('form');
  expect(form.checkValidity()).toBe(true);
  await act(async()=>fireEvent.submit(form));
  const payload=JSON.parse(fetch.mock.calls.find(([,options])=>options?.method==='POST')[1].body);
  expect(payload.customer).toMatchObject({cep:'01001000',city:'Campinas',state:'SP'});
  expect(payload.items).toEqual([{id:'leave',quantity:10}]);
  expect(payload.requestId).toBeTruthy();expect(onSubmitted).toHaveBeenCalledOnce();
  expect(screen.getByText('Frete a confirmar. Nenhuma cobrança foi realizada.')).toBeTruthy();
});
