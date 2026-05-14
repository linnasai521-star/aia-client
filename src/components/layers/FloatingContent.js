import React from 'react';

const h = React.createElement;

export default function FloatingContent({ stats = [], scene }) {
  return h('div', { className: 'floatingArea' },
    stats.length > 0
      ? h('div', { className: 'statsRow' },
          stats.map((s, i) =>
            h('div', { key: i, className: 'statCard' },
              h('div', { className: 'statValue' }, s.value),
              h('div', { className: 'statLabel' }, s.label)
            )
          )
        )
      : null,
    scene ? h('div', { className: 'sceneText' }, scene) : null
  );
}