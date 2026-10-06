import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const outboundPath = path.join(
  root,
  'netlify/functions/tmOutbound.js'
);
const packagePath = path.join(
  root,
  'package.json'
);

const source = fs.readFileSync(
  outboundPath,
  'utf8'
);
const pkg = JSON.parse(
  fs.readFileSync(packagePath, 'utf8')
);

const checks = [
  {
    name:
      'Ticketmaster CZ uses current Impact asset 1958979 / program 23901',
    ok:
      /'ticketmaster\.cz'\s*:\s*\{\s*assetId:\s*'1958979',\s*programId:\s*'23901'/.test(
        source
      )
  },
  {
    name:
      'default Ticketmaster Impact mode is server-side',
    ok:
      /return\s+'server';\s*\}\s*\n\s*const IMPACT_TRACKING_MODE/s.test(
        source
      )
  },
  {
    name:
      'server-side Impact resolver exists',
    ok:
      source.includes(
        'async function resolveAffiliateServerSide'
      )
  },
  {
    name:
      'successful server resolution redirects only to resolved seller URL',
    ok:
      source.includes(
        'return safeRedirect(resolved.url);'
      )
  },
  {
    name:
      'default server failure falls back directly to seller URL',
    ok:
      /Server-side Impact resolution failed; using direct seller fallback:[\s\S]*return safeRedirect\(cleanDestinationUrl\);/.test(
        source
      )
  },
  {
    name:
      'browser-side adaptive Impact fallback is absent',
    ok:
      !source.includes(
        'adaptiveAffiliateRedirect'
      )
  },
  {
    name:
      'raw Impact browser redirect is explicit emergency mode only',
    ok:
      /if \(IMPACT_TRACKING_MODE === 'affiliate'\) \{\s*return safeRedirect\(affiliateUrl\);\s*\}/s.test(
        source
      )
  },
  {
    name:
      'Ticketmaster outbound regression tests are part of required build tests',
    ok:
      String(
        pkg?.scripts?.['reviews:test'] || ''
      ).includes(
        'tests/tm-outbound.test.mjs'
      ) &&
      String(
        pkg?.scripts?.prebuild || ''
      ).includes(
        'npm run reviews:test'
      )
  }
];

const failed =
  checks.filter(
    (check) => !check.ok
  );

for (const check of checks) {
  console.log(
    `${check.ok ? 'PASS' : 'FAIL'}: ${check.name}`
  );
}

if (failed.length) {
  console.error(
    '\nCRITICAL: Ticketmaster affiliate safety contract changed. ' +
      'Do not deploy until the server-side Impact protection is restored ' +
      'or the change is deliberately reviewed as a revenue-critical migration.'
  );
  process.exit(1);
}

console.log(
  '\nPASS: Ticketmaster affiliate safety contract is intact.'
);
