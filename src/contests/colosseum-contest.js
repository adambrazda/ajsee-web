export const CONTEST = Object.freeze({
  id: 'colosseum-film-orchestra-2026',
  path: '/souteze/filmovy-orchestr-praha/',
  instagram: 'https://www.instagram.com/ajseeofficial/',
  start: '2026-10-20T19:00:00+02:00',
  // Exclusive boundary: all of 1 November at 23:59 is included (after the DST change).
  end: '2026-11-02T00:00:00+01:00',
  announcement: '2026-11-02T19:00:00+01:00',
});

export function getContestState(now = Date.now()) {
  const timestamp = Number(new Date(now));
  if (timestamp < Date.parse(CONTEST.start)) return 'upcoming';
  if (timestamp < Date.parse(CONTEST.end)) return 'active';
  return 'ended';
}

export function contestPath(lang = 'cs') {
  return lang === 'cs' ? CONTEST.path : `/${lang}${CONTEST.path}`;
}

export function renderContest(root, copy, { now = Date.now(), lang = 'cs' } = {}) {
  const state = getContestState(now);
  const suffix = state[0].toUpperCase() + state.slice(1);
  root.dataset.contestState = state;
  if (root.hasAttribute('data-contest-banner')) root.hidden = state === 'ended';

  root.querySelectorAll('[data-contest-status]').forEach(node => {
    node.dataset.contestCopy = `status${suffix}`;
    node.setAttribute('data-i18n-key', `contestPromo.status${suffix}`);
  });
  root.querySelectorAll('[data-contest-primary]').forEach(link => {
    link.dataset.contestCopy = `primary${suffix}`;
    link.setAttribute('data-i18n-key', `contestPromo.primary${suffix}`);
    link.href = state === 'active' ? CONTEST.instagram : `${contestPath(lang)}#section-4`;
    if (state === 'active') {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else {
      link.removeAttribute('target');
      link.removeAttribute('rel');
    }
  });
  root.querySelectorAll('[data-contest-rules]').forEach(link => { link.href = contestPath(lang); });
  root.querySelectorAll('[data-contest-copy]').forEach(node => {
    const value = copy[node.dataset.contestCopy];
    if (typeof value === 'string') node.textContent = value;
  });
  root.querySelectorAll('[data-contest-photo]').forEach(node => { node.alt = copy.photoAlt; });
  return state;
}
