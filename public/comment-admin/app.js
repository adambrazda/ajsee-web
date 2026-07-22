(function initializeCommentAdmin() {
  'use strict';

  const API_URL =
    '/api/article-comments-admin';

  const STATUS_LABELS = {
    pending:
      'Čekající komentáře',

    approved:
      'Schválené komentáře',

    rejected:
      'Zamítnuté komentáře'
  };

  const elements = {
    loadingPanel:
      document.getElementById(
        'loading-panel'
      ),

    signedOutPanel:
      document.getElementById(
        'signed-out-panel'
      ),

    forbiddenPanel:
      document.getElementById(
        'forbidden-panel'
      ),

    errorPanel:
      document.getElementById(
        'error-panel'
      ),

    errorMessage:
      document.getElementById(
        'error-message'
      ),

    application:
      document.getElementById(
        'admin-application'
      ),

    loginButton:
      document.getElementById(
        'login-button'
      ),

    logoutButton:
      document.getElementById(
        'logout-button'
      ),

    forbiddenLogoutButton:
      document.getElementById(
        'forbidden-logout-button'
      ),

    retryButton:
      document.getElementById(
        'retry-button'
      ),

    refreshButton:
      document.getElementById(
        'refresh-button'
      ),

    accountEmail:
      document.getElementById(
        'account-email'
      ),

    operationStatus:
      document.getElementById(
        'operation-status'
      ),

    commentsHeading:
      document.getElementById(
        'comments-heading'
      ),

    commentsCount:
      document.getElementById(
        'comments-count'
      ),

    commentsList:
      document.getElementById(
        'comments-list'
      ),

    tabs:
      Array.from(
        document.querySelectorAll(
          '[data-comment-status]'
        )
      )
  };

  const state = {
    identity:
      null,

    user:
      null,

    activeStatus:
      'pending',

    loading:
      false
  };

  function hideAllPrimaryPanels() {
    elements.loadingPanel.hidden =
      true;

    elements.signedOutPanel.hidden =
      true;

    elements.forbiddenPanel.hidden =
      true;

    elements.errorPanel.hidden =
      true;

    elements.application.hidden =
      true;
  }

  function showLoadingPanel() {
    hideAllPrimaryPanels();

    elements.loadingPanel.hidden =
      false;
  }

  function showSignedOutPanel() {
    hideAllPrimaryPanels();

    elements.signedOutPanel.hidden =
      false;
  }

  function showForbiddenPanel() {
    hideAllPrimaryPanels();

    elements.forbiddenPanel.hidden =
      false;
  }

  function showErrorPanel(
    message
  ) {
    hideAllPrimaryPanels();

    elements.errorMessage.textContent =
      message;

    elements.errorPanel.hidden =
      false;
  }

  function showApplication() {
    hideAllPrimaryPanels();

    elements.application.hidden =
      false;
  }

  function setOperationStatus(
    message,
    tone = 'neutral'
  ) {
    elements.operationStatus.textContent =
      message || '';

    elements.operationStatus.dataset.tone =
      tone;
  }

  function setLoading(
    isLoading
  ) {
    state.loading =
      isLoading;

    elements.commentsList.setAttribute(
      'aria-busy',
      String(isLoading)
    );

    elements.refreshButton.disabled =
      isLoading;

    for (
      const tab of elements.tabs
    ) {
      tab.disabled =
        isLoading;
    }
  }

  function setActiveTab(
    status
  ) {
    state.activeStatus =
      status;

    for (
      const tab of elements.tabs
    ) {
      const isActive =
        tab.dataset.commentStatus ===
        status;

      tab.setAttribute(
        'aria-selected',
        String(isActive)
      );

      tab.tabIndex =
        isActive
          ? 0
          : -1;
    }

    elements.commentsHeading.textContent =
      STATUS_LABELS[status];

    elements.commentsList.setAttribute(
      'aria-label',
      STATUS_LABELS[status]
    );
  }

  function createElement(
    tagName,
    {
      className = '',
      text = ''
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

    return element;
  }

  function formatDate(
    value
  ) {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 'Neznámé datum';
    }

    return new Intl.DateTimeFormat(
      'cs-CZ',
      {
        dateStyle:
          'medium',

        timeStyle:
          'short'
      }
    ).format(date);
  }

  function getArticleUrl(
    comment
  ) {
    const prefixes = {
      blog:
        '/blog/',

      review:
        '/reviews/',

      microguide:
        '/microguides/'
    };

    const prefix =
      prefixes[comment.postType];

    if (!prefix) {
      return null;
    }

    const url =
      new URL(
        `${prefix}${encodeURIComponent(comment.postId)}/`,
        window.location.origin
      );

    url.searchParams.set(
      'lang',
      comment.language
    );

    return (
      url.pathname +
      url.search
    );
  }

  function createDefinitionRow(
    term,
    value
  ) {
    const wrapper =
      createElement(
        'div',
        {
          className:
            'comment-card__detail'
        }
      );

    const definitionTerm =
      createElement(
        'dt',
        {
          text:
            term
        }
      );

    const definitionDescription =
      createElement(
        'dd'
      );

    if (
      value instanceof Node
    ) {
      definitionDescription.append(
        value
      );
    }
    else {
      definitionDescription.textContent =
        String(value || '—');
    }

    wrapper.append(
      definitionTerm,
      definitionDescription
    );

    return wrapper;
  }

  function createStatusBadge(
    status
  ) {
    const labels = {
      pending:
        'Čeká na schválení',

      approved:
        'Schváleno',

      rejected:
        'Zamítnuto'
    };

    return createElement(
      'span',
      {
        className:
          `status-badge status-badge--${status}`,

        text:
          labels[status] || status
      }
    );
  }

  function createArticleLink(
    comment
  ) {
    const articleUrl =
      getArticleUrl(
        comment
      );

    if (!articleUrl) {
      return document.createTextNode(
        comment.postId
      );
    }

    const link =
      createElement(
        'a',
        {
          text:
            comment.postId
        }
      );

    link.href =
      articleUrl;

    link.target =
      '_blank';

    link.rel =
      'noopener noreferrer';

    return link;
  }

  function createEmailLink(
    comment
  ) {
    const link =
      createElement(
        'a',
        {
          text:
            comment.email
        }
      );

    link.href =
      `mailto:${comment.email}`;

    return link;
  }

  function disableCardActions(
    card,
    disabled
  ) {
    const buttons =
      card.querySelectorAll(
        'button'
      );

    for (
      const button of buttons
    ) {
      button.disabled =
        disabled;
    }

    card.setAttribute(
      'aria-busy',
      String(disabled)
    );
  }

  async function getIdentityToken() {
    if (
      !state.user ||
      typeof state.user.jwt !==
        'function'
    ) {
      throw Object.assign(
        new Error(
          'Přihlášení vypršelo.'
        ),
        {
          status:
            401
        }
      );
    }

    return state.user.jwt();
  }

  async function requestAdminApi(
    url,
    options = {}
  ) {
    const token =
      await getIdentityToken();

    const headers =
      new Headers(
        options.headers || {}
      );

    headers.set(
      'Authorization',
      `Bearer ${token}`
    );

    if (
      options.body &&
      !headers.has(
        'Content-Type'
      )
    ) {
      headers.set(
        'Content-Type',
        'application/json'
      );
    }

    const response =
      await fetch(
        url,
        {
          ...options,
          headers,
          credentials:
            'same-origin'
        }
      );

    let payload = {};

    try {
      payload =
        await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const error =
        new Error(
          payload.error ||
          'Požadavek se nezdařil.'
        );

      error.status =
        response.status;

      error.code =
        payload.error || null;

      throw error;
    }

    return payload;
  }

  async function moderateComment(
    comment,
    action,
    card
  ) {
    if (
      state.loading
    ) {
      return;
    }

    if (
      action === 'reject'
    ) {
      const confirmed =
        window.confirm(
          `Opravdu zamítnout komentář od „${comment.name}“?`
        );

      if (!confirmed) {
        return;
      }
    }

    disableCardActions(
      card,
      true
    );

    setOperationStatus(
      action === 'approve'
        ? 'Schvaluji komentář…'
        : 'Zamítám komentář…'
    );

    try {
      await requestAdminApi(
        API_URL,
        {
          method:
            'POST',

          body:
            JSON.stringify({
              key:
                comment.key,

              action
            })
        }
      );

      setOperationStatus(
        action === 'approve'
          ? 'Komentář byl schválen.'
          : 'Komentář byl zamítnut.',
        'success'
      );

      await loadComments({
        preserveStatusMessage:
          true
      });
    } catch (error) {
      disableCardActions(
        card,
        false
      );

      handleRequestError(
        error,
        'Moderaci komentáře se nepodařilo dokončit.'
      );
    }
  }

  function createCommentCard(
    comment
  ) {
    const card =
      createElement(
        'article',
        {
          className:
            'comment-card'
        }
      );

    const header =
      createElement(
        'header',
        {
          className:
            'comment-card__header'
        }
      );

    const authorWrapper =
      createElement(
        'div'
      );

    const author =
      createElement(
        'h3',
        {
          className:
            'comment-card__author',

          text:
            comment.name
        }
      );

    const created =
      createElement(
        'time',
        {
          className:
            'comment-card__time',

          text:
            formatDate(
              comment.createdAt
            )
        }
      );

    created.dateTime =
      comment.createdAt;

    authorWrapper.append(
      author,
      created
    );

    header.append(
      authorWrapper,
      createStatusBadge(
        comment.status
      )
    );

    const commentText =
      createElement(
        'p',
        {
          className:
            'comment-card__text',

          text:
            comment.comment
        }
      );

    const details =
      createElement(
        'dl',
        {
          className:
            'comment-card__details'
        }
      );

    details.append(
      createDefinitionRow(
        'E-mail',
        createEmailLink(
          comment
        )
      ),

      createDefinitionRow(
        'Obsah',
        createArticleLink(
          comment
        )
      ),

      createDefinitionRow(
        'Typ',
        comment.postType
      ),

      createDefinitionRow(
        'Jazyk',
        comment.language.toUpperCase()
      )
    );

    card.append(
      header,
      commentText,
      details
    );

    if (
      comment.moderatedAt
    ) {
      const moderationInfo =
        createElement(
          'p',
          {
            className:
              'comment-card__moderation',

            text:
              `Moderováno ${formatDate(comment.moderatedAt)} uživatelem ${comment.moderatedBy || 'admin'}.`
          }
        );

      card.append(
        moderationInfo
      );
    }

    if (
      comment.status ===
      'pending'
    ) {
      const actions =
        createElement(
          'div',
          {
            className:
              'comment-card__actions'
          }
        );

      const approveButton =
        createElement(
          'button',
          {
            className:
              'button button--approve',

            text:
              'Schválit'
          }
        );

      approveButton.type =
        'button';

      approveButton.setAttribute(
        'aria-label',
        `Schválit komentář od ${comment.name}`
      );

      approveButton.addEventListener(
        'click',
        () =>
          moderateComment(
            comment,
            'approve',
            card
          )
      );

      const rejectButton =
        createElement(
          'button',
          {
            className:
              'button button--reject',

            text:
              'Zamítnout'
          }
        );

      rejectButton.type =
        'button';

      rejectButton.setAttribute(
        'aria-label',
        `Zamítnout komentář od ${comment.name}`
      );

      rejectButton.addEventListener(
        'click',
        () =>
          moderateComment(
            comment,
            'reject',
            card
          )
      );

      actions.append(
        approveButton,
        rejectButton
      );

      card.append(
        actions
      );
    }

    return card;
  }

  function renderEmptyState() {
    const wrapper =
      createElement(
        'div',
        {
          className:
            'empty-state'
        }
      );

    const title =
      createElement(
        'h3',
        {
          text:
            state.activeStatus ===
            'pending'
              ? 'Žádné komentáře nečekají na schválení'
              : 'V této kategorii zatím nejsou žádné komentáře'
        }
      );

    const description =
      createElement(
        'p',
        {
          text:
            state.activeStatus ===
            'pending'
              ? 'Moderace je aktuálně hotová.'
              : 'Po změně stavu komentáře se zde zobrazí jeho historie.'
        }
      );

    wrapper.append(
      title,
      description
    );

    elements.commentsList.replaceChildren(
      wrapper
    );
  }

  function renderComments(
    comments
  ) {
    elements.commentsCount.textContent =
      String(comments.length);

    elements.commentsCount.setAttribute(
      'aria-label',
      `Počet komentářů: ${comments.length}`
    );

    if (
      comments.length === 0
    ) {
      renderEmptyState();
      return;
    }

    const fragment =
      document.createDocumentFragment();

    for (
      const comment of comments
    ) {
      fragment.append(
        createCommentCard(
          comment
        )
      );
    }

    elements.commentsList.replaceChildren(
      fragment
    );
  }

  function handleRequestError(
    error,
    fallbackMessage
  ) {
    if (
      error.status === 401
    ) {
      state.user =
        null;

      showSignedOutPanel();
      return;
    }

    if (
      error.status === 403
    ) {
      showForbiddenPanel();
      return;
    }

    setOperationStatus(
      fallbackMessage,
      'error'
    );

    elements.commentsList.replaceChildren();

    const errorState =
      createElement(
        'div',
        {
          className:
            'empty-state empty-state--error'
        }
      );

    errorState.append(
      createElement(
        'h3',
        {
          text:
            fallbackMessage
        }
      ),

      createElement(
        'p',
        {
          text:
            error.code
              ? `Kód chyby: ${error.code}`
              : 'Zkus seznam znovu načíst.'
        }
      )
    );

    elements.commentsList.append(
      errorState
    );
  }

  async function loadComments({
    preserveStatusMessage =
      false
  } = {}) {
    if (
      !state.user ||
      state.loading
    ) {
      return;
    }

    setLoading(
      true
    );

    if (
      !preserveStatusMessage
    ) {
      setOperationStatus(
        'Načítám komentáře…'
      );
    }

    try {
      const url =
        new URL(
          API_URL,
          window.location.origin
        );

      url.searchParams.set(
        'status',
        state.activeStatus
      );

      url.searchParams.set(
        'limit',
        '250'
      );

      const payload =
        await requestAdminApi(
          url
        );

      renderComments(
        Array.isArray(
          payload.items
        )
          ? payload.items
          : []
      );

      if (
        !preserveStatusMessage
      ) {
        setOperationStatus(
          payload.count === 1
            ? 'Načten 1 komentář.'
            : `Načteno ${payload.count || 0} komentářů.`,
          'success'
        );
      }
    } catch (error) {
      handleRequestError(
        error,
        'Komentáře se nepodařilo načíst.'
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function handleAuthenticatedUser(
    user
  ) {
    state.user =
      user;

    elements.accountEmail.textContent =
      user.email ||
      'Přihlášený administrátor';

    showApplication();

    setActiveTab(
      state.activeStatus
    );

    await loadComments();
  }

  function handleIdentityState(
    user
  ) {
    if (!user) {
      state.user =
        null;

      showSignedOutPanel();
      return;
    }

    handleAuthenticatedUser(
      user
    ).catch((error) => {
      showErrorPanel(
        error.message ||
        'Přihlášení se nepodařilo dokončit.'
      );
    });
  }

  function bindEvents() {
    elements.loginButton.addEventListener(
      'click',
      () => {
        state.identity.open(
          'login'
        );
      }
    );

    elements.logoutButton.addEventListener(
      'click',
      () => {
        state.identity.logout();
      }
    );

    elements.forbiddenLogoutButton.addEventListener(
      'click',
      () => {
        state.identity.logout();
      }
    );

    elements.retryButton.addEventListener(
      'click',
      () => {
        if (state.user) {
          showApplication();
          loadComments();
          return;
        }

        showSignedOutPanel();
      }
    );

    elements.refreshButton.addEventListener(
      'click',
      () => {
        loadComments();
      }
    );

    for (
      const tab of elements.tabs
    ) {
      tab.addEventListener(
        'click',
        () => {
          const status =
            tab.dataset.commentStatus;

          if (
            !STATUS_LABELS[status] ||
            status ===
              state.activeStatus
          ) {
            return;
          }

          setActiveTab(
            status
          );

          elements.commentsCount.textContent =
            '0';

          elements.commentsList.replaceChildren();

          loadComments();
        }
      );
    }
  }

  function boot() {
    showLoadingPanel();

    if (
      !window.netlifyIdentity
    ) {
      showErrorPanel(
        'Nepodařilo se načíst přihlašovací službu Netlify Identity.'
      );

      return;
    }

    state.identity =
      window.netlifyIdentity;

    bindEvents();

    state.identity.on(
      'init',
      handleIdentityState
    );

    state.identity.on(
      'login',
      (user) => {
        state.identity.close();

        handleIdentityState(
          user
        );
      }
    );

    state.identity.on(
      'logout',
      () => {
        handleIdentityState(
          null
        );
      }
    );

    state.identity.on(
      'error',
      (error) => {
        showErrorPanel(
          error?.message ||
          'Přihlášení se nepodařilo.'
        );
      }
    );

    state.identity.init();
  }

  boot();
})();