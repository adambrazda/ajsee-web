import sharp from 'sharp';

// Mechanical encoding only: retain the original photographs and their aspect ratio.
for (const name of ['adam', 'jan']) {
  for (const width of [192, 384, 768]) {
    const output = `public/images/team/${name}-${width}.webp`;
    await sharp(`public/images/team/${name}.png`)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 85, effort: 6 })
      .toFile(output);
    console.log(output);
  }
}
