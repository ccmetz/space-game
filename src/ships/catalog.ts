export const shipTypes = [
  { id: 'pathfinder', name: 'Pathfinder', code: 'SF–01' },
  { id: 'arrow', name: 'Arrow', code: 'IN–02' },
  { id: 'atlas', name: 'Atlas', code: 'EX–03' },
] as const;

export const paints = [
  { id: 'ivory', name: 'Ivory', hull: '#b9bbb6', accent: '#a75643', engine: '#ae96ff' },
  { id: 'graphite', name: 'Graphite', hull: '#424953', accent: '#d7bd83', engine: '#ffbd77' },
  { id: 'cobalt', name: 'Cobalt', hull: '#315c94', accent: '#96d7e1', engine: '#77dbff' },
  { id: 'crimson', name: 'Crimson', hull: '#a8403c', accent: '#e1d1ad', engine: '#ffad94' },
] as const;

export interface ShipSelection {
  shipId: string;
  paintId: string;
}
