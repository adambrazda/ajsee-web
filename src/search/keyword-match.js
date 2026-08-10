function normalizeSearchText(value = '') {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '');
}

function tokenizeSearchText(value = '') {
  return (
    normalizeSearchText(value)
      .match(/[\p{L}\p{N}]+/gu) ||
    []
  );
}

export function matchesKeywordPrefix(
  haystack = '',
  keyword = ''
) {
  const queryTokens = tokenizeSearchText(keyword);

  if (!queryTokens.length) return true;

  const haystackTokens = tokenizeSearchText(haystack);

  if (!haystackTokens.length) return false;

  return queryTokens.every((queryToken) =>
    haystackTokens.some((token) => {
      if (queryToken.length === 1) {
        return token === queryToken;
      }

      return token.startsWith(queryToken);
    })
  );
}
