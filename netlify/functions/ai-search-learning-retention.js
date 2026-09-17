import {
  getStore,
  listStores
} from '@netlify/blobs';

const STORE_PREFIX =
  'ai-search-learning-v1';

export const LEARNING_RETENTION_DAYS =
  90;

export const LEARNING_RETENTION_DELETE_CONCURRENCY =
  20;

function normalizeDateOnly(
  value
) {
  const normalized =
    String(value || '')
      .trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalized
    )
  ) {
    return '';
  }

  const parsed =
    new Date(
      normalized +
      'T00:00:00.000Z'
    );

  if (
    Number.isNaN(
      parsed.getTime()
    ) ||
    parsed
      .toISOString()
      .slice(0, 10) !==
      normalized
  ) {
    return '';
  }

  return normalized;
}

export function getLearningRetentionCutoffDate(
  now,
  retentionDays =
    LEARNING_RETENTION_DAYS
) {
  const parsed =
    new Date(
      now
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    throw new Error(
      'invalid-retention-now'
    );
  }

  if (
    !Number.isInteger(
      retentionDays
    ) ||
    retentionDays < 1 ||
    retentionDays > 3650
  ) {
    throw new Error(
      'invalid-retention-days'
    );
  }

  const midnightUtc =
    new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate()
      )
    );

  midnightUtc.setUTCDate(
    midnightUtc.getUTCDate() -
      retentionDays
  );

  return midnightUtc
    .toISOString()
    .slice(0, 10);
}

function learningStoreName(
  value
) {
  const name =
    String(value || '')
      .trim();

  if (
    name ===
    STORE_PREFIX
  ) {
    return true;
  }

  return (
    name.startsWith(
      STORE_PREFIX +
      '-preview-'
    ) ||
    name.startsWith(
      STORE_PREFIX +
      '-agent-'
    )
  );
}

function extractSessionDate(
  directory
) {
  const normalized =
    String(directory || '')
      .trim();

  const match =
    normalized.match(
      /(?:^|\/)(\d{4}-\d{2}-\d{2})\/?$/
    );

  if (!match) {
    return '';
  }

  return normalizeDateOnly(
    match[1]
  );
}

function sessionDatePrefix(
  directory,
  date
) {
  const normalized =
    String(directory || '')
      .trim();

  if (
    normalized.startsWith(
      'sessions/'
    )
  ) {
    return normalized.endsWith(
      '/'
    )
      ? normalized
      : normalized + '/';
  }

  return (
    'sessions/' +
    date +
    '/'
  );
}

async function deleteKeysInBatches(
  store,
  keys,
  concurrency =
    LEARNING_RETENTION_DELETE_CONCURRENCY
) {
  if (
    !Array.isArray(
      keys
    ) ||
    keys.length ===
      0
  ) {
    return 0;
  }

  if (
    !Number.isInteger(
      concurrency
    ) ||
    concurrency <
      1
  ) {
    throw new Error(
      'invalid-delete-concurrency'
    );
  }

  let deleted =
    0;

  for (
    let offset = 0;
    offset < keys.length;
    offset += concurrency
  ) {
    const batch =
      keys.slice(
        offset,
        offset +
          concurrency
      );

    await Promise.all(
      batch.map(
        async key => {
          await store.delete(
            key
          );

          deleted +=
            1;
        }
      )
    );
  }

  return deleted;
}

async function cleanStore(
  store,
  cutoffDate
) {
  const directoryResult =
    await store.list({
      directories:
        true,

      prefix:
        'sessions/'
    });

  let expiredPartitions =
    0;

  let deletedBlobs =
    0;

  for (
    const directory
    of (
      directoryResult
        ?.directories ||
      []
    )
  ) {
    const date =
      extractSessionDate(
        directory
      );

    if (
      !date ||
      date >= cutoffDate
    ) {
      continue;
    }

    const prefix =
      sessionDatePrefix(
        directory,
        date
      );

    const entries =
      await store.list({
        prefix
      });

    const keysToDelete =
      (
        entries?.blobs ||
        []
      )
        .map(
          blob =>
            String(
              blob?.key ||
              ''
            )
        )
        .filter(
          key =>
            key.startsWith(
              prefix
            )
        );

    deletedBlobs +=
      await deleteKeysInBatches(
        store,
        keysToDelete
      );

    expiredPartitions +=
      1;
  }

  return {
    expiredPartitions,
    deletedBlobs
  };
}

export function createAiSearchLearningRetentionHandler({
  listStoresFn =
    listStores,

  getStoreFn =
    getStore,

  nowProvider =
    () => new Date(),

  retentionDays =
    LEARNING_RETENTION_DAYS
} = {}) {
  return async function aiSearchLearningRetentionHandler() {
    const cutoffDate =
      getLearningRetentionCutoffDate(
        nowProvider(),
        retentionDays
      );

    const storeResult =
      await listStoresFn();

    const storeNames =
      (
        storeResult?.stores ||
        []
      )
        .filter(
          learningStoreName
        )
        .sort();

    let deletedBlobs =
      0;

    let expiredPartitions =
      0;

    for (
      const name
      of storeNames
    ) {
      const store =
        getStoreFn({
          name,

          consistency:
            'strong'
        });

      const result =
        await cleanStore(
          store,
          cutoffDate
        );

      deletedBlobs +=
        result.deletedBlobs;

      expiredPartitions +=
        result.expiredPartitions;
    }

    const summary = {
      retentionDays,
      cutoffDate,
      storesScanned:
        storeNames.length,
      expiredPartitions,
      deletedBlobs
    };

    console.info(
      '[ai-search-learning-retention]',
      summary
    );

    return summary;
  };
}

const handler =
  createAiSearchLearningRetentionHandler();

export default handler;

export const config = {
  schedule:
    '@daily'
};
