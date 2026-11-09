import { iconSrc } from './icons.js';

/* Thin wrapper around the <lord-icon> web component (player script loaded in index.html).
   `icon` is a key from icons.js; `colors` is "primary:#hex,secondary:#hex". */
export function LordIcon({ icon, size = 24, colors, trigger = 'hover', stroke = 'bold', style }) {
  return <lord-icon
    src={iconSrc(icon)}
    trigger={trigger}
    stroke={stroke}
    colors={colors}
    style={{ width: size, height: size, ...style }}
  />;
}
