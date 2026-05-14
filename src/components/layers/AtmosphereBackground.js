import React from 'react';
import './AtmosphereBackground.css';

const h = React.createElement;

export default function AtmosphereBackground() {
  return h('div', { className: 'wrapper' },
    h('div', { className: 'orbTop' }),
    h('div', { className: 'orbBottom' })
  );
}