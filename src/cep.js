export const states = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const validCep = value => /^\d{5}-?\d{3}$/.test(value.trim());

export async function lookupCep(value, {signal} = {}) {
  if (!validCep(value)) throw new Error('Informe um CEP com 8 dígitos.');
  const response = await fetch(`https://viacep.com.br/ws/${value.replace('-', '').trim()}/json/`, {signal, credentials:'omit', referrerPolicy:'no-referrer'});
  if (!response.ok) throw new Error('Não foi possível consultar o CEP. Preencha cidade e estado manualmente.');
  const data = await response.json();
  if (data?.erro) throw new Error('CEP não encontrado. Confira o CEP ou preencha cidade e estado manualmente.');
  if (!data || typeof data.localidade !== 'string' || !data.localidade.trim() || !states.includes(data.uf)) {
    throw new Error('Resposta inválida da consulta. Preencha cidade e estado manualmente.');
  }
  return {city:data.localidade.trim(), state:data.uf};
}
