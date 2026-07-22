const API_URL =
  '/api/article-comments';

const SUPPORTED_LANGUAGES =
  new Set([
    'cs',
    'en',
    'de',
    'sk',
    'pl',
    'hu'
  ]);

const SUPPORTED_POST_TYPES =
  new Set([
    'blog',
    'review',
    'microguide'
  ]);

const DATE_LOCALES = {
  cs: 'cs-CZ',
  en: 'en-GB',
  de: 'de-DE',
  sk: 'sk-SK',
  pl: 'pl-PL',
  hu: 'hu-HU'
};

const COPY = {
  cs: {
    title:
      'Koment\u00e1\u0159e',
    intro:
      'Zapojte se do diskuze. E-mail nebude ve\u0159ejn\u011b zobrazen a koment\u00e1\u0159 zve\u0159ejn\u00edme po schv\u00e1len\u00ed.',
    loading:
      'Na\u010d\u00edt\u00e1me koment\u00e1\u0159e\u2026',
    empty:
      'Zat\u00edm tu nejsou \u017e\u00e1dn\u00e9 koment\u00e1\u0159e.',
    loadError:
      'Koment\u00e1\u0159e se nepoda\u0159ilo na\u010d\u00edst.',
    retry:
      'Na\u010d\u00edst znovu',
    name:
      'Jm\u00e9no',
    namePlaceholder:
      'Va\u0161e jm\u00e9no',
    email:
      'E-mail',
    emailPlaceholder:
      'vas@email.cz',
    emailHint:
      'E-mail nebude ve\u0159ejn\u011b zobrazen.',
    comment:
      'Koment\u00e1\u0159',
    commentPlaceholder:
      'Napi\u0161te sv\u016fj koment\u00e1\u0159\u2026',
    submit:
      'Odeslat koment\u00e1\u0159',
    submitting:
      'Odes\u00edl\u00e1me\u2026',
    success:
      'D\u011bkujeme. Koment\u00e1\u0159 jsme p\u0159ijali a zve\u0159ejn\u00edme ho po schv\u00e1len\u00ed.',
    rateLimit:
      'Dal\u0161\u00ed koment\u00e1\u0159 m\u016f\u017eete odeslat nejd\u0159\u00edve za jednu minutu.',
    timing:
      'Po\u010dkejte pros\u00edm chv\u00edli a zkuste formul\u00e1\u0159 odeslat znovu.',
    validation:
      'Zkontrolujte pros\u00edm vypln\u011bn\u00e9 \u00fadaje.',
    genericError:
      'Koment\u00e1\u0159 se nepoda\u0159ilo odeslat. Zkuste to pros\u00edm znovu.',
    oneComment:
      '1 koment\u00e1\u0159',
    manyComments:
      '{count} koment\u00e1\u0159\u016f',
    anonymous:
      'Anonym'
  },

  en: {
    title:
      'Comments',
    intro:
      'Join the discussion. Your email will remain private and comments are published after approval.',
    loading:
      'Loading comments\u2026',
    empty:
      'There are no comments yet.',
    loadError:
      'Comments could not be loaded.',
    retry:
      'Try again',
    name:
      'Name',
    namePlaceholder:
      'Your name',
    email:
      'Email',
    emailPlaceholder:
      'your@email.com',
    emailHint:
      'Your email will not be shown publicly.',
    comment:
      'Comment',
    commentPlaceholder:
      'Write your comment\u2026',
    submit:
      'Post comment',
    submitting:
      'Submitting\u2026',
    success:
      'Thank you. Your comment was received and will be published after approval.',
    rateLimit:
      'You can submit another comment after one minute.',
    timing:
      'Please wait a moment and submit the form again.',
    validation:
      'Please check the information you entered.',
    genericError:
      'Your comment could not be submitted. Please try again.',
    oneComment:
      '1 comment',
    manyComments:
      '{count} comments',
    anonymous:
      'Anonymous'
  },

  de: {
    title:
      'Kommentare',
    intro:
      'Beteilige dich an der Diskussion. Deine E-Mail bleibt privat und Kommentare werden nach der Freigabe ver\u00f6ffentlicht.',
    loading:
      'Kommentare werden geladen\u2026',
    empty:
      'Es gibt noch keine Kommentare.',
    loadError:
      'Die Kommentare konnten nicht geladen werden.',
    retry:
      'Erneut versuchen',
    name:
      'Name',
    namePlaceholder:
      'Dein Name',
    email:
      'E-Mail',
    emailPlaceholder:
      'deine@email.de',
    emailHint:
      'Deine E-Mail wird nicht \u00f6ffentlich angezeigt.',
    comment:
      'Kommentar',
    commentPlaceholder:
      'Schreibe deinen Kommentar\u2026',
    submit:
      'Kommentar senden',
    submitting:
      'Wird gesendet\u2026',
    success:
      'Vielen Dank. Dein Kommentar wurde empfangen und nach der Freigabe ver\u00f6ffentlicht.',
    rateLimit:
      'Du kannst nach einer Minute einen weiteren Kommentar senden.',
    timing:
      'Bitte warte einen Moment und sende das Formular erneut.',
    validation:
      'Bitte pr\u00fcfe deine Eingaben.',
    genericError:
      'Der Kommentar konnte nicht gesendet werden. Bitte versuche es erneut.',
    oneComment:
      '1 Kommentar',
    manyComments:
      '{count} Kommentare',
    anonymous:
      'Anonym'
  },

  sk: {
    title:
      'Koment\u00e1re',
    intro:
      'Zapojte sa do diskusie. E-mail nebude verejne zobrazen\u00fd a koment\u00e1r zverejn\u00edme po schv\u00e1len\u00ed.',
    loading:
      'Na\u010d\u00edtavame koment\u00e1re\u2026',
    empty:
      'Zatia\u013e tu nie s\u00fa \u017eiadne koment\u00e1re.',
    loadError:
      'Koment\u00e1re sa nepodarilo na\u010d\u00edta\u0165.',
    retry:
      'Na\u010d\u00edta\u0165 znova',
    name:
      'Meno',
    namePlaceholder:
      'Va\u0161e meno',
    email:
      'E-mail',
    emailPlaceholder:
      'vas@email.sk',
    emailHint:
      'E-mail nebude verejne zobrazen\u00fd.',
    comment:
      'Koment\u00e1r',
    commentPlaceholder:
      'Nap\u00ed\u0161te svoj koment\u00e1r\u2026',
    submit:
      'Odosla\u0165 koment\u00e1r',
    submitting:
      'Odosielame\u2026',
    success:
      '\u010eakujeme. Koment\u00e1r sme prijali a zverejn\u00edme ho po schv\u00e1len\u00ed.',
    rateLimit:
      '\u010eal\u0161\u00ed koment\u00e1r m\u00f4\u017eete odosla\u0165 najsk\u00f4r o jednu min\u00fatu.',
    timing:
      'Po\u010dkajte pros\u00edm chv\u00ed\u013eu a odo\u0161lite formul\u00e1r znova.',
    validation:
      'Skontrolujte pros\u00edm vyplnen\u00e9 \u00fadaje.',
    genericError:
      'Koment\u00e1r sa nepodarilo odosla\u0165. Sk\u00faste to pros\u00edm znova.',
    oneComment:
      '1 koment\u00e1r',
    manyComments:
      '{count} koment\u00e1rov',
    anonymous:
      'Anonym'
  },

  pl: {
    title:
      'Komentarze',
    intro:
      'Do\u0142\u0105cz do dyskusji. Tw\u00f3j e-mail pozostanie prywatny, a komentarz opublikujemy po zatwierdzeniu.',
    loading:
      '\u0141adowanie komentarzy\u2026',
    empty:
      'Nie ma jeszcze \u017cadnych komentarzy.',
    loadError:
      'Nie uda\u0142o si\u0119 wczyta\u0107 komentarzy.',
    retry:
      'Spr\u00f3buj ponownie',
    name:
      'Imi\u0119',
    namePlaceholder:
      'Twoje imi\u0119',
    email:
      'E-mail',
    emailPlaceholder:
      'twoj@email.pl',
    emailHint:
      'E-mail nie b\u0119dzie widoczny publicznie.',
    comment:
      'Komentarz',
    commentPlaceholder:
      'Napisz komentarz\u2026',
    submit:
      'Dodaj komentarz',
    submitting:
      'Wysy\u0142anie\u2026',
    success:
      'Dzi\u0119kujemy. Komentarz zosta\u0142 przyj\u0119ty i opublikujemy go po zatwierdzeniu.',
    rateLimit:
      'Kolejny komentarz mo\u017cesz wys\u0142a\u0107 po up\u0142ywie jednej minuty.',
    timing:
      'Odczekaj chwil\u0119 i wy\u015blij formularz ponownie.',
    validation:
      'Sprawd\u017a wprowadzone dane.',
    genericError:
      'Nie uda\u0142o si\u0119 wys\u0142a\u0107 komentarza. Spr\u00f3buj ponownie.',
    oneComment:
      '1 komentarz',
    manyComments:
      '{count} komentarzy',
    anonymous:
      'Anonim'
  },

  hu: {
    title:
      'Hozz\u00e1sz\u00f3l\u00e1sok',
    intro:
      'Csatlakozz a besz\u00e9lget\u00e9shez. Az e-mail-c\u00edmed nem lesz nyilv\u00e1nos, a hozz\u00e1sz\u00f3l\u00e1s pedig j\u00f3v\u00e1hagy\u00e1s ut\u00e1n jelenik meg.',
    loading:
      'Hozz\u00e1sz\u00f3l\u00e1sok bet\u00f6lt\u00e9se\u2026',
    empty:
      'M\u00e9g nincsenek hozz\u00e1sz\u00f3l\u00e1sok.',
    loadError:
      'A hozz\u00e1sz\u00f3l\u00e1sokat nem siker\u00fclt bet\u00f6lteni.',
    retry:
      '\u00dajrapr\u00f3b\u00e1lkoz\u00e1s',
    name:
      'N\u00e9v',
    namePlaceholder:
      'A neved',
    email:
      'E-mail',
    emailPlaceholder:
      'email@pelda.hu',
    emailHint:
      'Az e-mail-c\u00edmed nem jelenik meg nyilv\u00e1nosan.',
    comment:
      'Hozz\u00e1sz\u00f3l\u00e1s',
    commentPlaceholder:
      '\u00cdrd meg a hozz\u00e1sz\u00f3l\u00e1sod\u2026',
    submit:
      'Hozz\u00e1sz\u00f3l\u00e1s elk\u00fcld\u00e9se',
    submitting:
      'K\u00fcld\u00e9s\u2026',
    success:
      'K\u00f6sz\u00f6nj\u00fck. A hozz\u00e1sz\u00f3l\u00e1st megkaptuk, \u00e9s j\u00f3v\u00e1hagy\u00e1s ut\u00e1n k\u00f6zz\u00e9tessz\u00fck.',
    rateLimit:
      'Egy perc eltelt\u00e9vel k\u00fcldhetsz \u00fajabb hozz\u00e1sz\u00f3l\u00e1st.',
    timing:
      'V\u00e1rj egy pillanatot, majd k\u00fcldd el \u00fajra az \u0171rlapot.',
    validation:
      'Ellen\u0151rizd a megadott adatokat.',
    genericError:
      'A hozz\u00e1sz\u00f3l\u00e1st nem siker\u00fclt elk\u00fcldeni. Pr\u00f3b\u00e1ld \u00fajra.',
    oneComment:
      '1 hozz\u00e1sz\u00f3l\u00e1s',
    manyComments:
      '{count} hozz\u00e1sz\u00f3l\u00e1s',
    anonymous:
      'N\u00e9vtelen'
  }
};

let instanceCounter =
  0;

function normalizeLanguage(
  value
) {
  const language =
    String(value || '')
      .trim()
      .toLowerCase()
      .split(/[-_]/)[0];

  return SUPPORTED_LANGUAGES.has(
    language
  )
    ? language
    : 'cs';
}

function createElement(
  tagName,
  {
    className = '',
    text,
    attributes = {}
  } = {}
) {
  const element =
    document.createElement(
      tagName
    );

  if (className) {
    element.className =
      className;
  }

  if (
    text !== undefined &&
    text !== null
  ) {
    element.textContent =
      String(text);
  }

  for (
    const [name, value] of
    Object.entries(attributes)
  ) {
    if (
      value !== undefined &&
      value !== null
    ) {
      element.setAttribute(
        name,
        String(value)
      );
    }
  }

  return element;
}

function createField({
  id,
  label,
  input,
  hint
}) {
  const wrapper =
    createElement(
      'div',
      {
        className:
          'article-comments__field'
      }
    );

  const labelElement =
    createElement(
      'label',
      {
        text:
          label,
        attributes: {
          for:
            id
        }
      }
    );

  wrapper.append(
    labelElement,
    input
  );

  if (hint) {
    const hintId =
      id + '-hint';

    const hintElement =
      createElement(
        'p',
        {
          className:
            'article-comments__hint',
          text:
            hint,
          attributes: {
            id:
              hintId
          }
        }
      );

    input.setAttribute(
      'aria-describedby',
      hintId
    );

    wrapper.append(
      hintElement
    );
  }

  return wrapper;
}

function formatDate(
  value,
  language
) {
  try {
    return new Intl.DateTimeFormat(
      DATE_LOCALES[language] ||
        DATE_LOCALES.cs,
      {
        dateStyle:
          'medium',
        timeStyle:
          'short'
      }
    ).format(
      new Date(value)
    );
  } catch {
    return String(value || '');
  }
}

function commentCountText(
  count,
  copy
) {
  if (count === 1) {
    return copy.oneComment;
  }

  return copy.manyComments.replace(
    '{count}',
    String(count)
  );
}

function resolveSubmitError(
  code,
  copy
) {
  if (
    code ===
    'rate-limit-exceeded'
  ) {
    return copy.rateLimit;
  }

  if (
    code ===
    'invalid-form-timing'
  ) {
    return copy.timing;
  }

  if (
    code === 'invalid-name' ||
    code === 'invalid-email' ||
    code === 'invalid-comment' ||
    code === 'invalid-language' ||
    code === 'invalid-post-type' ||
    code === 'invalid-post-id'
  ) {
    return copy.validation;
  }

  return copy.genericError;
}

function normalizeConfiguration(
  root
) {
  const language =
    normalizeLanguage(
      root.dataset.lang ||
      document.documentElement.lang
    );

  const postType =
    String(
      root.dataset.postType || ''
    )
      .trim()
      .toLowerCase();

  const postId =
    String(
      root.dataset.postId || ''
    )
      .trim()
      .toLowerCase();

  if (
    !SUPPORTED_POST_TYPES.has(
      postType
    )
  ) {
    throw new Error(
      'Invalid article comments post type.'
    );
  }

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      postId
    )
  ) {
    throw new Error(
      'Invalid article comments post id.'
    );
  }

  return {
    language,
    postType,
    postId
  };
}

function buildApiUrl({
  postType,
  postId,
  language
}) {
  const url =
    new URL(
      API_URL,
      window.location.origin
    );

  url.searchParams.set(
    'postType',
    postType
  );

  url.searchParams.set(
    'postId',
    postId
  );

  url.searchParams.set(
    'lang',
    language
  );

  url.searchParams.set(
    'limit',
    '100'
  );

  return url;
}

export function initializeArticleComments(
  root
) {
  if (
    !(root instanceof HTMLElement)
  ) {
    return null;
  }

  if (
    root.dataset.articleCommentsInitialized ===
    'true'
  ) {
    return null;
  }

  let configuration;

  try {
    configuration =
      normalizeConfiguration(
        root
      );
  } catch (error) {
    console.error(
      'Article comments initialization failed:',
      error
    );

    root.hidden =
      true;

    return null;
  }

  root.dataset.articleCommentsInitialized =
    'true';

  root.classList.add(
    'article-comments'
  );

  const {
    language,
    postType,
    postId
  } = configuration;

  const copy =
    COPY[language] ||
    COPY.cs;

  instanceCounter += 1;

  const idPrefix =
    'article-comments-' +
    instanceCounter;

  const title =
    createElement(
      'h2',
      {
        className:
          'article-comments__title',
        text:
          copy.title,
        attributes: {
          id:
            idPrefix + '-title'
        }
      }
    );

  const intro =
    createElement(
      'p',
      {
        className:
          'article-comments__intro',
        text:
          copy.intro
      }
    );

  const form =
    createElement(
      'form',
      {
        className:
          'article-comments__form',
        attributes: {
          'aria-labelledby':
            idPrefix + '-title'
        }
      }
    );

  const nameInput =
    createElement(
      'input',
      {
        attributes: {
          id:
            idPrefix + '-name',
          name:
            'name',
          type:
            'text',
          required:
            '',
          autocomplete:
            'name',
          maxlength:
            '120',
          placeholder:
            copy.namePlaceholder
        }
      }
    );

  const emailInput =
    createElement(
      'input',
      {
        attributes: {
          id:
            idPrefix + '-email',
          name:
            'email',
          type:
            'email',
          required:
            '',
          autocomplete:
            'email',
          maxlength:
            '254',
          placeholder:
            copy.emailPlaceholder
        }
      }
    );

  const commentInput =
    createElement(
      'textarea',
      {
        attributes: {
          id:
            idPrefix + '-comment',
          name:
            'comment',
          required:
            '',
          rows:
            '5',
          maxlength:
            '2000',
          placeholder:
            copy.commentPlaceholder
        }
      }
    );

  const companyInput =
    createElement(
      'input',
      {
        attributes: {
          name:
            'company',
          type:
            'text',
          tabindex:
            '-1',
          autocomplete:
            'off'
        }
      }
    );

  const honeypot =
    createElement(
      'div',
      {
        attributes: {
          hidden:
            '',
          'aria-hidden':
            'true'
        }
      }
    );

  honeypot.append(
    companyInput
  );

  const submitButton =
    createElement(
      'button',
      {
        className:
          'article-comments__submit',
        text:
          copy.submit,
        attributes: {
          type:
            'submit'
        }
      }
    );

  const formStatus =
    createElement(
      'p',
      {
        className:
          'article-comments__status',
        attributes: {
          role:
            'status',
          'aria-live':
            'polite'
        }
      }
    );

  form.append(
    createField({
      id:
        nameInput.id,
      label:
        copy.name,
      input:
        nameInput
    }),

    createField({
      id:
        emailInput.id,
      label:
        copy.email,
      input:
        emailInput,
      hint:
        copy.emailHint
    }),

    createField({
      id:
        commentInput.id,
      label:
        copy.comment,
      input:
        commentInput
    }),

    honeypot,
    submitButton,
    formStatus
  );

  const listHeading =
    createElement(
      'h3',
      {
        className:
          'article-comments__count',
        text:
          copy.loading,
        attributes: {
          id:
            idPrefix + '-list-heading'
        }
      }
    );

  const list =
    createElement(
      'div',
      {
        className:
          'article-comments__list',
        attributes: {
          role:
            'list',
          'aria-labelledby':
            idPrefix + '-list-heading',
          'aria-live':
            'polite',
          'aria-busy':
            'true'
        }
      }
    );

  root.replaceChildren(
    title,
    intro,
    form,
    listHeading,
    list
  );

  let startedAt =
    Date.now();

  function setFormBusy(
    isBusy
  ) {
    form.setAttribute(
      'aria-busy',
      String(isBusy)
    );

    submitButton.disabled =
      isBusy;

    submitButton.textContent =
      isBusy
        ? copy.submitting
        : copy.submit;
  }

  function renderLoading() {
    list.setAttribute(
      'aria-busy',
      'true'
    );

    listHeading.textContent =
      copy.loading;

    list.replaceChildren();
  }

  function renderEmpty() {
    list.setAttribute(
      'aria-busy',
      'false'
    );

    listHeading.textContent =
      commentCountText(
        0,
        copy
      );

    const emptyState =
      createElement(
        'p',
        {
          className:
            'article-comments__empty',
          text:
            copy.empty
        }
      );

    list.replaceChildren(
      emptyState
    );
  }

  function renderError() {
    list.setAttribute(
      'aria-busy',
      'false'
    );

    listHeading.textContent =
      copy.title;

    const wrapper =
      createElement(
        'div',
        {
          className:
            'article-comments__error'
        }
      );

    const message =
      createElement(
        'p',
        {
          text:
            copy.loadError
        }
      );

    const retryButton =
      createElement(
        'button',
        {
          text:
            copy.retry,
          attributes: {
            type:
              'button'
          }
        }
      );

    retryButton.addEventListener(
      'click',
      () => {
        loadComments();
      }
    );

    wrapper.append(
      message,
      retryButton
    );

    list.replaceChildren(
      wrapper
    );
  }

  function renderComments(
    comments
  ) {
    if (
      !Array.isArray(comments) ||
      comments.length === 0
    ) {
      renderEmpty();
      return;
    }

    list.setAttribute(
      'aria-busy',
      'false'
    );

    listHeading.textContent =
      commentCountText(
        comments.length,
        copy
      );

    const fragment =
      document.createDocumentFragment();

    for (
      const comment of comments
    ) {
      const item =
        createElement(
          'article',
          {
            className:
              'article-comments__item',
            attributes: {
              role:
                'listitem'
            }
          }
        );

      const header =
        createElement(
          'header',
          {
            className:
              'article-comments__item-header'
          }
        );

      const author =
        createElement(
          'strong',
          {
            className:
              'article-comments__author',
            text:
              comment.name ||
              copy.anonymous
          }
        );

      const time =
        createElement(
          'time',
          {
            className:
              'article-comments__date',
            text:
              formatDate(
                comment.createdAt,
                language
              ),
            attributes: {
              datetime:
                comment.createdAt || ''
            }
          }
        );

      const body =
        createElement(
          'p',
          {
            className:
              'article-comments__text',
            text:
              comment.comment || ''
          }
        );

      header.append(
        author,
        time
      );

      item.append(
        header,
        body
      );

      fragment.append(
        item
      );
    }

    list.replaceChildren(
      fragment
    );
  }

  async function loadComments() {
    renderLoading();

    try {
      const response =
        await fetch(
          buildApiUrl({
            postType,
            postId,
            language
          }),
          {
            method:
              'GET',
            headers: {
              Accept:
                'application/json'
            },
            cache:
              'no-store'
          }
        );

      if (!response.ok) {
        throw new Error(
          'Comments request failed.'
        );
      }

      const payload =
        await response.json();

      renderComments(
        payload.items
      );
    } catch {
      renderError();
    }
  }

  form.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      if (
        !form.reportValidity()
      ) {
        return;
      }

      setFormBusy(
        true
      );

      formStatus.textContent =
        '';

      try {
        const response =
          await fetch(
            API_URL,
            {
              method:
                'POST',
              headers: {
                Accept:
                  'application/json',
                'Content-Type':
                  'application/json'
              },
              body:
                JSON.stringify({
                  postType,
                  postId,
                  lang:
                    language,
                  name:
                    nameInput.value,
                  email:
                    emailInput.value,
                  comment:
                    commentInput.value,
                  company:
                    companyInput.value,
                  startedAt
                })
            }
          );

        const payload =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (!response.ok) {
          formStatus.textContent =
            resolveSubmitError(
              payload.error,
              copy
            );

          return;
        }

        form.reset();

        startedAt =
          Date.now();

        formStatus.textContent =
          copy.success;

        nameInput.focus();
      } catch {
        formStatus.textContent =
          copy.genericError;
      } finally {
        setFormBusy(
          false
        );
      }
    }
  );

  loadComments();

  return {
    load:
      loadComments
  };
}

export function initializeAllArticleComments(
  scope = document
) {
  const roots =
    scope.querySelectorAll(
      '[data-article-comments]'
    );

  for (
    const root of roots
  ) {
    initializeArticleComments(
      root
    );
  }
}

function autoInitialize() {
  initializeAllArticleComments(
    document
  );
}

if (
  typeof document !==
  'undefined'
) {
  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      autoInitialize,
      {
        once:
          true
      }
    );
  } else {
    autoInitialize();
  }
}
