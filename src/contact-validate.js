// src/contact-validate.js
// Validace kontaktního formuláře + i18n chybové zprávy

export function initContactFormValidation({ lang = 'cs', t = (k, fb) => fb } = {}) {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const errorMsg = document.querySelector('#contact-error');

  const getField = (formEl, fieldName) => formEl.querySelector(`[name="${fieldName}"]`);
  const getErrorEl = (formEl, fieldName) => formEl.querySelector(`#error-${fieldName}`);
  const getGroup = (formEl, fieldName) => getField(formEl, fieldName)?.closest('.form-group') || null;

  const clearFieldState = (formEl, fieldName) => {
    const inputEl = getField(formEl, fieldName);
    const errEl = getErrorEl(formEl, fieldName);
    const groupEl = getGroup(formEl, fieldName);

    if (errEl) {
      errEl.textContent = '';
      errEl.classList.remove('active');
    }

    if (inputEl) {
      inputEl.classList.remove('input-error');
      inputEl.removeAttribute('aria-invalid');
    }

    if (groupEl) {
      groupEl.classList.remove('is-invalid', 'is-valid');
    }
  };

  const markFieldInvalid = (formEl, fieldName, msg) => {
    const inputEl = getField(formEl, fieldName);
    const errEl = getErrorEl(formEl, fieldName);
    const groupEl = getGroup(formEl, fieldName);

    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add('active');
    }

    if (inputEl) {
      inputEl.classList.add('input-error');
      inputEl.setAttribute('aria-invalid', 'true');
    }

    if (groupEl) {
      groupEl.classList.remove('is-valid');
      groupEl.classList.add('is-invalid');
    }
  };

  const markFieldValid = (formEl, fieldName) => {
    const inputEl = getField(formEl, fieldName);
    const groupEl = getGroup(formEl, fieldName);

    if (inputEl) {
      inputEl.setAttribute('aria-invalid', 'false');
    }

    if (groupEl) {
      groupEl.classList.remove('is-invalid');
      groupEl.classList.add('is-valid');
    }
  };

  const hideAllFieldErrors = (formEl) => {
    ['name', 'email', 'message'].forEach((fieldName) => clearFieldState(formEl, fieldName));
  };

  const validators = {
    name: (value) => !!value.trim(),
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
    message: (value) => !!value.trim(),
  };

  const messages = {
    name: () => t('contact-error-name', 'Zadejte své jméno.'),
    email: () => t('contact-error-email', 'Zadejte platný e-mail.'),
    message: () => t('contact-error-message', 'Napište zprávu.'),
  };

  const validateField = (formEl, fieldName) => {
    const inputEl = getField(formEl, fieldName);
    if (!inputEl) return true;

    const value = inputEl.value || '';
    const isValid = validators[fieldName](value);

    if (isValid) {
      clearFieldState(formEl, fieldName);
      if (value.trim()) {
        markFieldValid(formEl, fieldName);
      }
      return true;
    }

    clearFieldState(formEl, fieldName);
    markFieldInvalid(formEl, fieldName, messages[fieldName]());
    return false;
  };

  const updateFormActionWithLang = () => {
    form.setAttribute('action', `/thank-you.html?lang=${lang}`);
  };

  // Live validace po opuštění pole
  ['name', 'email', 'message'].forEach((fieldName) => {
    const field = getField(form, fieldName);
    if (!field) return;

    field.addEventListener('blur', () => {
      validateField(form, fieldName);
    });

    field.addEventListener('input', () => {
      const groupEl = getGroup(form, fieldName);
      const errEl = getErrorEl(form, fieldName);

      // Jakmile uživatel začne opravovat chybné pole, schovej starou chybu
      if (field.classList.contains('input-error') || groupEl?.classList.contains('is-invalid')) {
        if (errEl) {
          errEl.textContent = '';
          errEl.classList.remove('active');
        }
        field.classList.remove('input-error');
        field.removeAttribute('aria-invalid');
        groupEl?.classList.remove('is-invalid');
      }

      // valid state jen pokud pole není prázdné a je správně
      if ((field.value || '').trim() && validators[fieldName](field.value || '')) {
        markFieldValid(form, fieldName);
      } else {
        groupEl?.classList.remove('is-valid');
      }
    });
  });

  form.addEventListener('submit', function (e) {
    hideAllFieldErrors(form);
    if (errorMsg) errorMsg.style.display = 'none';

    updateFormActionWithLang();

    // honeypot
    if (form.querySelector('input[name="bot-field"]')?.value) {
      e.preventDefault();
      return;
    }

    const nameValid = validateField(form, 'name');
    const emailValid = validateField(form, 'email');
    const messageValid = validateField(form, 'message');

    const valid = nameValid && emailValid && messageValid;

    if (!valid) {
      e.preventDefault();

      const firstInvalid =
        form.querySelector('[name="name"][aria-invalid="true"]') ||
        form.querySelector('[name="email"][aria-invalid="true"]') ||
        form.querySelector('[name="message"][aria-invalid="true"]');

      firstInvalid?.focus();
    }
  });
}