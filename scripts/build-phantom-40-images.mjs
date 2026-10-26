import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('public/uploads/reviews/phantom-of-the-opera-40th-anniversary-reunion');

// Original source links are intentionally build-time-only: never embedded in published HTML.
const PHOTOGRAPHS = [
  {
    name: 'phantom-40th-crawford-brightman-gala.webp',
    source: 'https://d3s3zh7icgjwgd.cloudfront.net/AcuCustom/Sitename/DAM/377/processed-AD12776F-972C-4978-B539-532B3E9C0689_LargeLandscape.jpg',
    photographer: 'Matthew Hemley / The Stage',
    width: 1400
  },
  {
    name: 'phantom-40th-donica-penny-toure-gondola.webp',
    source: 'https://images.ctfassets.net/6pezt69ih962/U5yuRPNyY53550aPMsMYt/5b030be068a24ba46fc7fa8539c3f1cc/4ac8bf8a-a39d-4506-bd8e-1e0812e1f20c.jpg?fm=webp&h=1000&q=80',
    photographer: 'Johan Persson / TodayTix',
    width: 1200
  },
  {
    name: 'phantom-40th-donica-penny-toure-production.webp',
    source: 'https://images.ctfassets.net/6pezt69ih962/19Tv0cSgkpOgnuop5v9U9x/445f53e03c2f84f0d04924c26ee24c9a/0c4e04b7-cec9-4790-ab25-bb333d015ef0.jpg?fm=webp&h=1000&q=80',
    photographer: 'Johan Persson / TodayTix',
    width: 1200
  }
];

async function fetchImage(url, attempts = 3) {
  const trustedHosts = new Set(['d3s3zh7icgjwgd.cloudfront.net', 'images.ctfassets.net']);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
        headers: {
          Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*;q=0.5',
          'User-Agent': 'AJSEE-EditorialImageBuild/1.0 (https://ajsee.cz)'
        }
      });

      const remoteHost = new URL(response.url).hostname;
      if (!trustedHosts.has(remoteHost)) {
        throw new Error('Unexpected photo origin after redirect: ' + remoteHost);
      }

      if (!response.ok) {
        throw new Error('Source returned HTTP ' + response.status + ' (' + remoteHost + ')');
      }

      const mime = response.headers.get('content-type') || '';
      if (!/^image\/(?:jpeg|png|webp|avif)(?:;|$)/i.test(mime)) {
        throw new Error('Unexpected image media type: ' + mime);
      }
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > 20 * 1024 * 1024) throw new Error('Source image exceeds 20 MB');

      const data = Buffer.from(await response.arrayBuffer());
      if (data.length < 3000 || data.length > 20 * 1024 * 1024) {
        throw new Error('Source photo has invalid size: ' + data.length);
      }

      const metadata = await sharp(data).metadata();
      if (!metadata.width || !metadata.height || metadata.width < 320 || metadata.height < 240) {
        throw new Error('Source image resolution is inadequate');
      }

      return data;
    } catch (err) {
      lastError = err;
      if (attempt !== attempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  throw lastError;
}

async function processPhotograph(photo) {
  const destination = path.join(ROOT, photo.name);

  const sourceBytes = await fetchImage(photo.source);
  const webp = await sharp(sourceBytes)
    .rotate()
    .resize({ width: photo.width, withoutEnlargement: true })
    .webp({ quality: 81, effort: 5, smartSubsample: true })
    .toBuffer();
  const dimensions = await sharp(webp).metadata();

  const tmp = destination + '.part';
  await fs.writeFile(tmp, webp);
  await fs.rename(tmp, destination);

  console.log(
    '[phantom-40-images] ' + photo.name + ': ' +
    dimensions.width + 'x' + dimensions.height + ', ' +
    Math.round(webp.length / 1024) + ' KiB, ' + photo.photographer
  );
}

await fs.mkdir(ROOT, { recursive: true });
for (const photo of PHOTOGRAPHS) {
  // Fail the build instead of silently shipping broken/third-party hotlinked photographs.
  await processPhotograph(photo);
}
