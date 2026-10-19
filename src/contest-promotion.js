import copy from './content/colosseum-contest-promo.json';
import { CONTEST, renderContest } from './contests/colosseum-contest.js';

let timer;
function refreshContest() {
  window.clearTimeout(timer);
  const lang = document.documentElement.lang.slice(0, 2);
  const dictionary = copy[lang] || copy.cs;
  document.querySelectorAll('[data-colosseum-contest]').forEach(root => {
    renderContest(root, dictionary, { lang: copy[lang] ? lang : 'cs' });
  });
  const now = Date.now();
  const next = [CONTEST.start, CONTEST.end].map(Date.parse).find(boundary => boundary > now);
  if (next) timer = window.setTimeout(refreshContest, Math.min(next - now + 50, 2147483647));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', refreshContest, { once: true });
} else refreshContest();
window.addEventListener('ajsee:lang-changed', refreshContest);
window.addEventListener('pageshow', refreshContest);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshContest(); });

document.addEventListener('click', event => {
  const link = event.target.closest?.('[data-colosseum-contest] a');
  if (!link) return;
  // Uses the existing analytics queue; no new analytics service or identifiers.
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'contest_click', contest_id: CONTEST.id,
    placement: link.closest('[data-contest-banner]') ? 'home_banner' : 'contest_rules',
    destination_url: link.href, language: document.documentElement.lang });
});
