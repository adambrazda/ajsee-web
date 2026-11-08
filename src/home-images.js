import images from './generated/home-image-variants.json' with { type: 'json' };

export const HOME_EDITORIAL_IMAGE_SIZES = '(max-width: 370px) calc(100vw - 32px), (max-width: 760px) min(560px, calc(100vw - 40px)), (max-width: 1100px) calc((100vw - 100px) / 3), (max-width: 1244px) calc((100vw - 112px) / 3), 377px';
export const HOME_PROMO_IMAGE_SIZES = '(max-width: 370px) calc(100vw - 32px), (max-width: 600px) calc((100vw - 40px) * .425), (max-width: 760px) 238px, (max-width: 1100px) calc((100vw - 88px) / 2), (max-width: 1244px) calc((100vw - 88px) * .2375), 275px';

export function homeImageAttributes(source, sizes = HOME_EDITORIAL_IMAGE_SIZES) {
  const image = images[source];
  if (!image) return { src: source };
  const fallback = image.variants.find(variant => variant.width >= 640) || image.variants.at(-1);
  return {
    src: fallback.src,
    srcset: image.variants.map(variant => `${variant.src} ${variant.width}w`).join(', '),
    sizes,
    width: image.width,
    height: image.height,
  };
}
