(() => {
  "use strict";

  const API_URL =
    "/api/review-publication-admin";

  const slugInput =
    document.getElementById("review-slug");

  const statusElement =
    document.getElementById("publication-status");

  const prepareButton =
    document.getElementById("prepare-publication");

  prepareButton.disabled = true;

  let user = null;
  let requestId = 0;

  function setStatus(message) {
    statusElement.textContent =
      message;
  }

  function normalizeSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function isValidSlug(slug) {
    return (
      slug.length > 0 &&
      slug.length <= 180 &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    );
  }

  async function getJwt() {
    if (!user) {
      throw new Error(
        "not-authenticated"
      );
    }

    const token =
      await user.jwt();

    if (
      typeof token !== "string" ||
      token.trim() === ""
    ) {
      throw new Error(
        "identity-token-missing"
      );
    }

    return token;
  }

  async function loadPublicationStatus() {
    prepareButton.disabled = true;

    const slug =
      normalizeSlug(
        slugInput.value
      );

    if (!user) {
      setStatus(
        "Pro kontrolu stavu se nejprve p?ihlaste do AJSEE Admin."
      );
      return;
    }

    if (!slug) {
      setStatus(
        "Zadejte slug recenze nebo preview."
      );
      return;
    }

    if (!isValidSlug(slug)) {
      setStatus(
        "Slug nen? ve spr?vn?m form?tu."
      );
      return;
    }

    const currentRequestId =
      ++requestId;

    setStatus(
      "Ov??uji stav obsahu?"
    );

    try {
      const token =
        await getJwt();

      const url =
        new URL(
          API_URL,
          window.location.origin
        );

      url.searchParams.set(
        "slug",
        slug
      );

      const response =
        await fetch(
          url.toString(),
          {
            method:
              "GET",

            headers: {
              Accept:
                "application/json",

              Authorization:
                `Bearer ${token}`
            },

            cache:
              "no-store"
          }
        );

      const data =
        await response.json()
          .catch(() => null);

      if (
        currentRequestId !==
        requestId
      ) {
        return;
      }

      if (!response.ok) {
        const code =
          typeof data?.error ===
            "string"
            ? data.error
            : "unknown-error";

        setStatus(
          `Stav se nepoda?ilo na??st (${code}).`
        );
        return;
      }

      const state =
        typeof data?.state ===
          "string"
          ? data.state
          : "unknown";

      if (
        data?.published === true
      ) {
        setStatus(
          "Obsah je ji? zve?ejn?n?."
        );
        return;
      }

      if (
        state === "approved" &&
        data?.canPrepare === true
      ) {
        setStatus(
          "Obsah je schv?len? a p?ipraven? k bezpe?n? p??prav? publikace. Akce zat?m nen? v t?to verzi povolena."
        );
        return;
      }

      if (
        state === "draft"
      ) {
        setStatus(
          "Obsah je st?le ve stavu draft a nelze jej p?ipravit k publikaci."
        );
        return;
      }

      setStatus(
        `Aktu?ln? stav obsahu: ${state}. Publika?n? akce nen? dostupn?.`
      );
    }
    catch {
      if (
        currentRequestId !==
        requestId
      ) {
        return;
      }

      setStatus(
        "Stav se nepoda?ilo ov??it. Zkuste str?nku obnovit nebo se znovu p?ihl?sit."
      );
    }
    finally {
      prepareButton.disabled = true;
    }
  }

  function handleIdentityUser(
    nextUser
  ) {
    user =
      nextUser || null;

    prepareButton.disabled = true;

    if (user) {
      setStatus(
        "P?ihl??en? ov??eno. Zadejte slug recenze nebo preview."
      );

      if (
        normalizeSlug(
          slugInput.value
        )
      ) {
        void loadPublicationStatus();
      }

      return;
    }

    setStatus(
      "Pro kontrolu stavu se nejprve p?ihlaste do AJSEE Admin."
    );
  }

  function initializeIdentity() {
    const identity =
      window.netlifyIdentity;

    if (!identity) {
      setStatus(
        "Netlify Identity se nepoda?ilo na??st."
      );
      prepareButton.disabled = true;
      return;
    }

    identity.on(
      "login",
      (nextUser) => {
        handleIdentityUser(
          nextUser
        );

        identity.close();
      }
    );

    identity.on(
      "logout",
      () => {
        handleIdentityUser(
          null
        );
      }
    );

    const currentUser =
      identity.currentUser();

    handleIdentityUser(
      currentUser
    );

    if (!currentUser) {
      identity.open(
        "login"
      );
    }
  }

  slugInput.addEventListener(
    "change",
    () => {
      void loadPublicationStatus();
    }
  );

  slugInput.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter"
      ) {
        event.preventDefault();
        void loadPublicationStatus();
      }
    }
  );

  window.addEventListener(
    "load",
    initializeIdentity,
    {
      once:
        true
    }
  );
})();
