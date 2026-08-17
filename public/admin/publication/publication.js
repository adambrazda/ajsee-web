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
        "Pro kontrolu stavu se nejprve přihlaste do AJSEE Admin."
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
        "Slug není ve správném formátu."
      );
      return;
    }

    const currentRequestId =
      ++requestId;

    setStatus(
      "Ověřuji stav obsahu…"
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
          `Stav se nepodařilo načíst (${code}).`
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
          "Obsah je již zveřejněný."
        );
        return;
      }

      if (
        state === "approved" &&
        data?.canPrepare === true
      ) {
        setStatus(
          "Obsah je schválený a připravený k bezpečné přípravě publikace. Akce zatím není v této verzi povolena."
        );
        return;
      }

      if (
        state === "draft"
      ) {
        setStatus(
          "Obsah je stále ve stavu draft a nelze jej připravit k publikaci."
        );
        return;
      }

      setStatus(
        `Aktuální stav obsahu: ${state}. Publikační akce není dostupná.`
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
        "Stav se nepodařilo ověřit. Zkuste stránku obnovit nebo se znovu přihlásit."
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
        "Přihlášení ověřeno. Zadejte slug recenze nebo preview."
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
      "Pro kontrolu stavu se nejprve přihlaste do AJSEE Admin."
    );
  }

  function initializeIdentity() {
    const identity =
      window.netlifyIdentity;

    if (!identity) {
      setStatus(
        "Netlify Identity se nepodařilo načíst."
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
