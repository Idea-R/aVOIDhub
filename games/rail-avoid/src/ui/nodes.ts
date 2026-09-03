/** Settlement / node-type presentation: icon, label, colour and a one-line blurb (tooltips, stop pill, legends). */

export interface NodeMeta { icon: string; label: string; color: string; blurb: string }

export const NODE_META: Record<string, NodeMeta> = {
  start:      { icon: '⌂', label: 'Origin',       color: '#a9b3cc', blurb: 'Where the last train set out.' },
  village:    { icon: '⌂', label: 'Village',      color: '#6fbf73', blurb: 'Passengers waiting for rescue.' },
  depot:      { icon: '═', label: 'Rail depot',   color: '#e8c170', blurb: 'Stockpiled rails for new track.' },
  mine:       { icon: '⚙', label: 'Mine',         color: '#c98a4b', blurb: 'Scrap for repairs and new cars.' },
  farm:       { icon: '✿', label: 'Farm',         color: '#8ee29a', blurb: 'Food to keep passengers fed.' },
  fuel:       { icon: '⬢', label: 'Fuel stop',    color: '#ff8f3a', blurb: 'Coal for the boiler.' },
  clinic:     { icon: '✚', label: 'Clinic',       color: '#6fb7e8', blurb: 'A medic may join the crew.' },
  armory:     { icon: '➤', label: 'Armory',       color: '#e86f6f', blurb: 'Ammunition for the guns.' },
  yard:       { icon: '⚒', label: 'Repair yard',  color: '#e8c170', blurb: 'Repair, buy, sell, reorder and upgrade cars.' },
  terminus:   { icon: '◈', label: 'Terminus',     color: '#f6dc9a', blurb: 'Passengers are delivered here.' },
  watchtower: { icon: '⚑', label: 'Watchtower',   color: '#6fb7e8', blurb: 'Early warning: longer wave warnings and sappers revealed for a while.' },
  shrine:     { icon: '☥', label: 'Shrine',       color: '#d6b4f0', blurb: 'A choice awaits on arrival.' },
  wreck:      { icon: '☒', label: 'Wreck',        color: '#a3a8b8', blurb: 'Salvage — with luck, a free car.' },
  market:     { icon: '⚖', label: 'Market',       color: '#e8c170', blurb: 'Trade goods on arrival.' },
  mystery:    { icon: '?', label: 'Unknown event', color: '#d6b4f0', blurb: 'An unreadable signal on the main line. Its nature is hidden until arrival.' },
  crossroads: { icon: '⑂', label: 'Crossroads',   color: '#9aa3b8', blurb: 'Where lines meet — choose a branch.' },
};

export function nodeMeta(type: string | null | undefined): NodeMeta {
  return (type && NODE_META[type]) || { icon: '◦', label: type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Settlement', color: '#a9b3cc', blurb: '' };
}
