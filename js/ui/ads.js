// =====================================================================
//  Google AdSense integration (configure in js/config.js -> ADS)
//  Ad containers: <div class="ad" data-slot="home|lobby|death">
//  Ads are filled lazily the first time their screen becomes visible.
// =====================================================================
import { ADS } from '../config.js';
let loaded = false;
export function initAds() {
  const els = document.querySelectorAll('.ad');
  if (!ADS.enabled || !ADS.client || ADS.client.includes('XXXX')) {
    if (ADS.showPlaceholders) els.forEach(e => { e.classList.add('ph'); e.textContent = 'AD · ' + e.dataset.slot.toUpperCase() });
    return
  }
  const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ADS.client);
  if (ADS.h5games) { s.setAttribute('data-ad-frequency-hint', '120s'); window.adsbygoogle = window.adsbygoogle || []; window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o) }; window.adConfig({ preloadAdBreaks: 'on', sound: 'on' }) }
  document.head.appendChild(s); loaded = true
}
// call after a screen containing ad slots is shown
export function fillAds(root) {
  if (!loaded) return;
  (root || document).querySelectorAll('.ad:not(.filled)').forEach(el => {
    if (!el.offsetParent || el.offsetWidth < 120) return; const slot = ADS.slots[el.dataset.slot]; if (!slot) return;
    el.classList.add('filled');
    el.innerHTML = `<ins class="adsbygoogle" style="display:block" data-ad-client="${ADS.client}" data-ad-slot="${slot}" data-ad-format="${el.dataset.format || 'auto'}" data-full-width-responsive="true"></ins>`;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch (e) { }
  })
}
// H5 Games interstitial between matches (no-op unless ADS.h5games is on)
export function interstitial(name, done) {
  if (loaded && ADS.h5games && window.adBreak) { let called = false; const fin = () => { if (!called) { called = true; done && done() } }; try { window.adBreak({ type: 'next', name, adBreakDone: fin }) } catch (e) { fin() } setTimeout(fin, 8000) }
  else done && done()
}
