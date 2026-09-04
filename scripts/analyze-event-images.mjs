import {
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';

import path from 'node:path';

import {
  EVENT_IMAGE_ANALYSIS_DETAIL,
  EVENT_IMAGE_ANALYSIS_MODEL,
  analyzeEventImageTarget,
  assertPreviewOutputPath,
  buildImageAnalysisPreview,
  selectSmsticketAnalysisTargets
} from './event-image-analyzer.mjs';

const FEED_FILE =
  path.resolve(
    'public/data/smsticket-events.json'
  );

function usage() {
  console.log(
    [
      'AJSEE event image analyzer — PREVIEW ONLY',
      '',
      'Required selector:',
      '  --match <text>',
      '  --id <event-id>       repeatable',
      '  --ids <id,id,...>',
      '',
      'Options:',
      '  --provider smsticket',
      '  --limit <1-50>',
      '  --model <model-id>',
      '  --detail low|high|original|auto',
      '  --output <file>',
      '',
      'The command never writes the production image-analysis cache.'
    ].join('\n')
  );
}

function parseArgs(
  argv
) {
  const options = {
    provider:
      'smsticket',

    match:
      '',

    ids:
      [],

    limit:
      20,

    model:
      process.env.AJSEE_IMAGE_ANALYSIS_MODEL ||
      EVENT_IMAGE_ANALYSIS_MODEL,

    detail:
      process.env.AJSEE_IMAGE_ANALYSIS_DETAIL ||
      EVENT_IMAGE_ANALYSIS_DETAIL,

    output:
      '',

    help:
      false
  };

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const arg =
      argv[index];

    const next = () => {
      index += 1;

      if (
        index >=
        argv.length
      ) {
        throw new Error(
          `Missing value for ${arg}`
        );
      }

      return argv[index];
    };

    switch (arg) {
      case '--provider':
        options.provider =
          next();
        break;

      case '--match':
        options.match =
          next();
        break;

      case '--id':
        options.ids.push(
          next()
        );
        break;

      case '--ids':
        options.ids.push(
          ...next()
            .split(',')
            .map(
              (value) =>
                value.trim()
            )
            .filter(Boolean)
        );
        break;

      case '--limit':
        options.limit =
          Number(
            next()
          );
        break;

      case '--model':
        options.model =
          next();
        break;

      case '--detail':
        options.detail =
          next();
        break;

      case '--output':
        options.output =
          next();
        break;

      case '--help':
      case '-h':
        options.help =
          true;
        break;

      default:
        throw new Error(
          `Unknown argument: ${arg}`
        );
    }
  }

  return options;
}

async function main() {
  const options =
    parseArgs(
      process.argv.slice(2)
    );

  if (
    options.help
  ) {
    usage();
    return;
  }

  if (
    options.provider !==
      'smsticket'
  ) {
    throw new Error(
      'Slice 4B currently supports only provider=smsticket.'
    );
  }

  if (
    !options.match &&
    !options.ids.length
  ) {
    throw new Error(
      'Safety stop: provide --match or at least one --id.'
    );
  }

  if (
    !Number.isFinite(
      options.limit
    ) ||
    options.limit < 1 ||
    options.limit > 50
  ) {
    throw new Error(
      '--limit must be between 1 and 50.'
    );
  }

  const apiKey =
    String(
      process.env.OPENAI_API_KEY ||
      ''
    ).trim();

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Set it locally; never paste the key into chat.'
    );
  }

  const payload =
    JSON.parse(
      await readFile(
        FEED_FILE,
        'utf8'
      )
    );

  const targets =
    selectSmsticketAnalysisTargets(
      payload,
      options
    );

  if (!targets.length) {
    throw new Error(
      'No matching SMS Ticket source images found.'
    );
  }

  console.log(
    '===== AJSEE IMAGE ANALYSIS PREVIEW ====='
  );

  console.log(
    'Mode    : preview-only'
  );

  console.log(
    'Provider:',
    options.provider
  );

  console.log(
    'Model   :',
    options.model
  );

  console.log(
    'Detail  :',
    options.detail
  );

  console.log(
    'Targets :',
    targets.length
  );

  console.log('');

  const results = [];

  for (
    let index = 0;
    index < targets.length;
    index += 1
  ) {
    const target =
      targets[index];

    console.log(
      `[${index + 1}/${targets.length}] ${target.id} — ${target.title}`
    );

    const result =
      await analyzeEventImageTarget(
        target,
        {
          apiKey,
          model:
            options.model,
          detail:
            options.detail
        }
      );

    results.push(
      result
    );

    const focal =
      Number.isFinite(
        result.analysis.x
      ) &&
      Number.isFinite(
        result.analysis.y
      )
        ? `${result.analysis.x},${result.analysis.y}`
        : 'null';

    console.log(
      '  type      :',
      result.analysis.contentType
    );

    console.log(
      '  confidence:',
      result.analysis.confidence
    );

    console.log(
      '  cropSafe  :',
      result.analysis.cropSafe
    );

    console.log(
      '  focal     :',
      focal
    );

    console.log(
      '  rationale :',
      result.rationale
    );

    console.log('');
  }

  const preview =
    buildImageAnalysisPreview(
      targets,
      results,
      {
        provider:
          options.provider,
        model:
          options.model,
        detail:
          options.detail
      }
    );

  if (
    options.output
  ) {
    const output =
      assertPreviewOutputPath(
        options.output
      );

    await mkdir(
      path.dirname(
        output
      ),
      {
        recursive: true
      }
    );

    await writeFile(
      output,
      JSON.stringify(
        preview,
        null,
        2
      ) + '\n',
      'utf8'
    );

    console.log(
      'Preview written:',
      output
    );
  } else {
    console.log(
      JSON.stringify(
        preview,
        null,
        2
      )
    );
  }

  console.log('');
  console.log(
    'PASS: preview analysis complete. Production cache was not modified.'
  );
}

await main();
