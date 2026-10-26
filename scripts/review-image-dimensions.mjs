import path from 'node:path';
import sharp from 'sharp';

const cache = new Map();

export async function readReviewCoverDimensions(cover, publicRoot = path.resolve('public')) {
  if (!cover) return null;
  const url = new URL(cover, 'https://ajsee.cz');
  // This is a build-time local asset check; never request remote editorial URLs.
  if (url.origin !== 'https://ajsee.cz') return null;
  const file = path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(publicRoot + path.sep)) return null;
  if (!cache.has(file)) {
    cache.set(file, sharp(file).metadata().then(metadata => {
      const { width, height } = metadata.autoOrient || metadata;
      return width > 0 && height > 0 ? { width, height } : null;
    }).catch(error => {
      console.warn(`[reviews] Cannot determine cover dimensions: ${url.pathname}: ${error.message}`);
      return null;
    }));
  }
  return cache.get(file);
}

export function coverDimensionsAttributes(dimensions) {
  if (!dimensions) return '';
  const { width, height } = dimensions;
  return ` width="${width}" height="${height}" style="--review-cover-width: ${width}px; --review-cover-ratio: ${width} / ${height}"`;
}
