const ALLOWED_PUBLICATION_ACTIONS = new Set([
  'publish',
  'unpublish'
]);

const PUBLISHABLE_STATUSES = new Set([
  'approved',
  'published'
]);

function cloneReview(review) {
  return JSON.parse(
    JSON.stringify(review)
  );
}

function isValidIsoDate(value) {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    Number.isFinite(Date.parse(value))
  );
}

function assertReviewObject(review) {
  if (
    !review ||
    typeof review !== 'object' ||
    Array.isArray(review)
  ) {
    throw new Error(
      'Review must be a JSON object.'
    );
  }

  if (
    typeof review.slug !== 'string' ||
    review.slug.trim() === ''
  ) {
    throw new Error(
      'Review must contain a valid slug.'
    );
  }

  if (typeof review.status !== 'string') {
    throw new Error(
      'Review must contain a string status.'
    );
  }

  if (typeof review.published !== 'boolean') {
    throw new Error(
      'Review must contain a boolean published value.'
    );
  }

  if (typeof review.publishedAt !== 'string') {
    throw new Error(
      'Review must contain a string publishedAt value.'
    );
  }
}

export function assertReviewPublicationInvariant(review) {
  assertReviewObject(review);

  if (review.published === true) {
    if (review.status !== 'published') {
      throw new Error(
        `Published review ${review.slug} must have status "published".`
      );
    }

    if (!isValidIsoDate(review.publishedAt)) {
      throw new Error(
        `Published review ${review.slug} must have a valid publishedAt value.`
      );
    }

    return true;
  }

  if (review.status === 'published') {
    throw new Error(
      `Unpublished review ${review.slug} cannot have status "published".`
    );
  }

  if (review.publishedAt !== '') {
    throw new Error(
      `Unpublished review ${review.slug} must have an empty publishedAt value.`
    );
  }

  return true;
}

export function transitionReviewPublication(
  review,
  action,
  nowIso = new Date().toISOString()
) {
  assertReviewObject(review);

  if (!ALLOWED_PUBLICATION_ACTIONS.has(action)) {
    throw new Error(
      `Unsupported publication action: ${action}`
    );
  }

  if (!PUBLISHABLE_STATUSES.has(review.status)) {
    throw new Error(
      `Review ${review.slug} cannot be ${action}ed from status "${review.status}".`
    );
  }

  const nextReview = cloneReview(review);

  if (action === 'publish') {
    if (
      review.status === 'published' &&
      review.published === true &&
      isValidIsoDate(review.publishedAt)
    ) {
      assertReviewPublicationInvariant(nextReview);
      return nextReview;
    }

    if (!isValidIsoDate(nowIso)) {
      throw new Error(
        'Publish action requires a valid ISO timestamp.'
      );
    }

    nextReview.status = 'published';
    nextReview.published = true;
    nextReview.publishedAt =
      new Date(nowIso).toISOString();
  }

  if (action === 'unpublish') {
    nextReview.status = 'approved';
    nextReview.published = false;
    nextReview.publishedAt = '';
  }

  assertReviewPublicationInvariant(nextReview);

  return nextReview;
}