import React from 'react';

const money = value => value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

export default function ResalePrice({value}) {
  return <div className="resale-price">
    <span className="resale-label">Revenda sugerida</span>
    <div className="resale-value"><span>A partir de</span><strong>{money(value)}</strong></div>
  </div>;
}
