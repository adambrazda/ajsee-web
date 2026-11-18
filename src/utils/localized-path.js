import londonRoutes from '../../shared/london-musicals-routes.json' with { type: 'json' };

const languagePrefix = /^\/(cs|en|de|sk|pl|hu)(?=\/|$)/i;
const londonPaths = new Set(Object.values(londonRoutes).map(route => route.replace(languagePrefix, '')));

export function buildLocalizedPath(pathname = '/', lang = 'cs') {
  const language = String(lang || '').trim().toLowerCase().slice(0, 2);
  const targetLang = Object.hasOwn(londonRoutes, language) ? language : 'cs';
  let path = String(pathname || '/')
    .replace(languagePrefix, '')
    .replace(/\/index\.html$/i, '/')
    .replace(/\.html$/i, '')
    .replace(/\/{2,}/g, '/');

  if (!path.startsWith('/')) path = '/' + path;
  if (!path.endsWith('/')) path += '/';

  if (londonPaths.has(path)) return londonRoutes[targetLang];
  return targetLang === 'cs' ? path : '/' + targetLang + path;
}
