// Screen glass: a translucent cover over a shell's screen with an anime-style glare, drawn as an SVG at
// the opening's real size (so round glints stay round on any aspect). Kept faint enough that the game
// stays readable: the glare lives in the top-left, the rest of the glass is a whisper of sheen.
//   round: curved toy plastic or slime: soft dome sheen, a crescent band, two round glints
//   crt:   a bulging tube: edge vignette, a broad diagonal glare and a crescent along the top
//   flat:  a modern panel: one clean diagonal streak and a thin top-edge sheen
export const GLASS_TYPES = ['round', 'crt', 'flat'];

const n = (v) => +v.toFixed(1);

/** SVG markup for a w x h opening with corner radius r (CSS px). Unknown types fall back to 'round'. */
export function glassSvg(w, h, r = 0, type = 'round') {
  if (!(w > 0 && h > 0)) return '';
  const m = Math.min(w, h), R = Math.min(r, w / 2, h / 2);
  const defs = [
    `<linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
    `<radialGradient id="gv" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient>`,
  ];
  const body = [];
  if (type === 'crt') {
    body.push(`<rect width="${w}" height="${h}" rx="${R}" fill="url(#gv)"/>`);
    body.push(`<rect width="${w}" height="${h}" rx="${R}" fill="url(#gs)"/>`);
    // broad diagonal glare from the top-left corner
    body.push(`<path d="M0 ${n(h * 0.36)}C${n(w * 0.12)} ${n(h * 0.2)} ${n(w * 0.22)} ${n(h * 0.08)} ${n(w * 0.34)} 0H0Z" fill="url(#gb)" opacity=".38"/>`);
    // crescent hugging the top edge
    body.push(`<path d="M${n(w * 0.1)} ${n(h * 0.07)}Q${n(w * 0.5)} ${n(-h * 0.02)} ${n(w * 0.9)} ${n(h * 0.07)}Q${n(w * 0.5)} ${n(h * 0.03)} ${n(w * 0.1)} ${n(h * 0.07)}Z" fill="#fff" opacity=".22"/>`);
    body.push(`<circle cx="${n(w * 0.08)}" cy="${n(h * 0.12)}" r="${n(m * 0.018)}" fill="#fff" opacity=".7"/>`);
  } else if (type === 'flat') {
    body.push(`<rect width="${w}" height="${n(h * 0.5)}" fill="url(#gs)" opacity=".7"/>`);
    const a = w * 0.18, b = w * 0.07;
    body.push(`<path d="M${n(a)} 0H${n(a + b)}L${n(a + b - h * 0.55)} ${h}H${n(a - h * 0.55)}Z" fill="#fff" opacity=".07"/>`);
    body.push(`<path d="M${n(a + b * 1.6)} 0H${n(a + b * 1.9)}L${n(a + b * 1.9 - h * 0.55)} ${h}H${n(a + b * 1.6 - h * 0.55)}Z" fill="#fff" opacity=".05"/>`);
    body.push(`<path d="M${n(Math.max(R, 4))} 1.5H${n(w - Math.max(R, 4))}" stroke="#fff" stroke-opacity=".28" stroke-width="1.5" stroke-linecap="round"/>`);
  } else {
    // dome sheen over the top half
    body.push(`<ellipse cx="${n(w * 0.5)}" cy="${n(h * 0.08)}" rx="${n(w * 0.62)}" ry="${n(h * 0.42)}" fill="url(#gs)"/>`);
    // the crescent band: an outer arc from the left side over the top-left corner, an inner arc back
    const x0 = w * 0.05, y0 = h * 0.55, x1 = w * 0.55, y1 = h * 0.05;
    body.push(`<path d="M${n(x0)} ${n(y0)}C${n(x0 - w * 0.01)} ${n(h * 0.2)} ${n(w * 0.2)} ${n(y1 - h * 0.01)} ${n(x1)} ${n(y1)}C${n(w * 0.24)} ${n(h * 0.12)} ${n(w * 0.1)} ${n(h * 0.26)} ${n(x0)} ${n(y0)}Z" fill="url(#gb)" opacity=".5"/>`);
    // two round glints and a soft bottom-right bounce light
    body.push(`<circle cx="${n(w * 0.13)}" cy="${n(h * 0.16)}" r="${n(m * 0.045)}" fill="#fff" opacity=".75"/>`);
    body.push(`<circle cx="${n(w * 0.2)}" cy="${n(h * 0.1)}" r="${n(m * 0.018)}" fill="#fff" opacity=".7"/>`);
    body.push(`<path d="M${n(w * 0.68)} ${n(h * 0.95)}Q${n(w * 0.92)} ${n(h * 0.9)} ${n(w * 0.95)} ${n(h * 0.66)}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="${n(Math.max(2, m * 0.018))}" stroke-linecap="round"/>`);
  }
  // a faint rim catching light all the way round
  body.push(`<rect x=".75" y=".75" width="${n(w - 1.5)}" height="${n(h - 1.5)}" rx="${n(Math.max(0, R - 0.75))}" fill="none" stroke="#fff" stroke-opacity=".1" stroke-width="1.5"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}" height="${n(h)}" viewBox="0 0 ${n(w)} ${n(h)}" aria-hidden="true"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
}
