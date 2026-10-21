// Gold Cabinet skin for the Pixel Arcade: black lacquer with gold T-molding, a crimson velvet marquee
// with gold crowns round the logo, a gold coin door and trim, ruby / gold / sapphire buttons and
// diamond studs set into the racing stripes.
import base, { PALETTES } from '../frames/px-arcade.mjs';
import { INK, sprite, sparkle } from '../kit.mjs';
import { withPalette, repunch } from '../skinkit.mjs';

const LACQUER = ['#07060a', '#110f16', '#1b1822', '#262230', '#353042', '#4a4458', '#6a6480'];
const GOLD = ['#6a3c0e', '#a8701c', '#e0a83a', '#ffd166', '#fff3b0'];
const AMBER = ['#6a2a0e', '#b0621c', '#e89a3a', '#ffd08a'];
const VELVET = ['#2a0610', '#4a0c1c', '#7a1428', '#a8203a', '#d23a4a'];
const GILT = ['#4a2c0a', '#8a5a16', '#c89430', '#ecc860', '#fff0b8']; // replaces the chrome
const SAPPHIRE = ['#0a1a5a', '#1a3aa8', '#3a6ae8', '#8ab0ff', '#e0ecff'];

const CROWN = ['k.k..k..k.k', 'kak.kak.kak', 'kaakaaakaak', 'kaaaaaaaaak', 'kabarabarak', 'kaaaaaaaaak', 'kbbbbbbbbbk', 'kkkkkkkkkkk'];

export default {
  id: 'skin-px-arcade-gold', frame: 'px-arcade', name: 'Gold Cabinet', rarity: 'legendary',
  desc: 'A collector edition cabinet in black lacquer and gold, with a velvet marquee, jewel buttons and diamond studs.',
  tags: ['arcade', 'cabinet', 'gold', 'luxury', 'retro', 'animated', 'pixel'],
  css: base.css,
  draw() {
    const cv = withPalette(PALETTES, { C: LACQUER, T: GOLD, O: AMBER, MQ: VELVET, G: GILT, K: SAPPHIRE }, () => base.draw());
    cv.use(LACQUER, GOLD, VELVET, GILT, SAPPHIRE);

    // Gold crowns either side of the logo.
    for (const x of [40, 173]) sprite(cv, x, 25, CROWN, { k: INK, a: GOLD[3], b: GOLD[1], r: '#e0283f' });
    cv.set(45, 27, GOLD[4]).set(178, 27, GOLD[4]);

    // Diamond studs set into both racing stripes.
    for (let y = 30; y < 300; y += 34) {
      if (y > 196 && y < 252) continue; // the control deck overhangs here
      for (const x of [8, 211]) sprite(cv, x, y, ['..k..', '.kak.', 'kabck', '.kck.', '..k..'], { k: INK, a: '#ffffff', b: '#bfefff', c: '#5cc2e8' });
    }
    // Gilt pinstripe framing the bezel.
    cv.fill(cv.mask().rrect(17, 69, 190, 138, 5).edge(), (x, y, c) => (c === INK ? c : GOLD[2]));
    sparkle(cv, 206, 70, 2, GOLD[3], '#ffffff');
    sparkle(cv, 18, 206, 1, GOLD[3], '#ffffff');
    return repunch(cv);
  },
};
