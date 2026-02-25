/**
 * blueprint.styles — Color tokens and CSS animations for Blueprint/Unreal aesthetic.
 * Injected once into document.head on first mount.
 * @security No eval — pure data constants.
 */

export type NodeStatus = 'idle' | 'pending' | 'active' | 'done' | 'failed';

export const BP = {
  bg:          '#050d18',
  nodeBg:      '#0b1628',
  nodeIdle:    '#183050',
  nodeActive:  '#00c8f0',
  nodeDone:    '#00e896',
  nodeFailed:  '#ff3d3d',
  nodePending: '#0c1c36',
  text:        '#d2ecff',
  textDim:     '#3a6e9a',
  edgeActive:  '#00c8f0',
  edgeDefault: '#1a3555',
} as const;

export const BORDER: Record<string, string> = {
  idle:    BP.nodeIdle,
  pending: BP.nodePending,
  active:  BP.nodeActive,
  done:    BP.nodeDone,
  failed:  BP.nodeFailed,
};

export const GLOW: Record<string, string> = {
  idle:    'none',
  pending: 'none',
  active:  `0 0 12px ${BP.nodeActive}99, 0 0 32px ${BP.nodeActive}33`,
  done:    `0 0 10px ${BP.nodeDone}77, 0 0 24px ${BP.nodeDone}22`,
  failed:  `0 0 12px ${BP.nodeFailed}99, 0 0 32px ${BP.nodeFailed}33`,
};

export const BLUEPRINT_CSS = `
  .bp-active { animation: bp-pulse 2s ease-in-out infinite; }
  .bp-failed { animation: bp-shake 0.55s ease-in-out; }
  .bp-done   { animation: bp-flash 0.8s ease-out forwards; }
  @keyframes bp-pulse {
    0%,100% { box-shadow: 0 0 16px ${BP.nodeActive}88, 0 0 40px ${BP.nodeActive}22, 0 4px 20px rgba(0,0,0,0.4); }
    50%     { box-shadow: 0 0 28px ${BP.nodeActive}cc, 0 0 60px ${BP.nodeActive}44, 0 4px 20px rgba(0,0,0,0.4); }
  }
  @keyframes bp-shake {
    0%,100%{ transform:translateX(0) }  15%{ transform:translateX(-7px) }
    30%    { transform:translateX(7px) } 45%{ transform:translateX(-5px) }
    60%    { transform:translateX(5px) } 75%{ transform:translateX(-2px) }
    90%    { transform:translateX(2px) }
  }
  @keyframes bp-flash {
    0%   { box-shadow: 0 0 28px ${BP.nodeDone}cc, 0 4px 20px rgba(0,0,0,0.4); }
    100% { box-shadow: 0 0 12px ${BP.nodeDone}44, 0 4px 20px rgba(0,0,0,0.4); }
  }
  .react-flow__node { filter: none; }
  .react-flow__controls { background: #0b162888 !important; border: 1px solid #183050 !important; }
  .react-flow__controls-button { background: transparent !important; border-color: #183050 !important; fill: #3a6e9a !important; }
  .react-flow__controls-button:hover { background: #00c8f018 !important; fill: #00c8f0 !important; }
  .react-flow__minimap { border-radius: 8px; overflow: hidden; }
  .react-flow__edge-path { stroke-width: 2; }
`;
