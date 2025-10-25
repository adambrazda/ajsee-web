// src/contact-validate.js
// Validace kontaktního formuláře + i18n chybové zprávy

export function initContactFormValidation({ lang = 'cs', t = (k, fb)=>fb } = {}) {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const errorMsg = document.querySelector('#contact-error');

  const hideAllFieldErrors = (formEl) => {
    formEl.querySelectorAll('.form-error').forEach((el) => {
      el.textContent = '';
      el.classList.remove('active');
    });
    formEl.querySelectorAll('input, textarea').forEach((el) => {
      el.classList.remove('input-error');
    });
  };

  const showFieldError = (formEl, fieldName, msg) => {
    const errEl = formEl.querySelector(`#error-${fieldName}`);
    const inputEl = formEl.querySelector(`[name="${fieldName}"]`);
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add('active');
    }
    if (inputEl) inputEl.classList.add('input-error');
  };

  form.addEventListener('submit', function (e) {
    hideAllFieldErrors(form);
    if (errorMsg) errorMsg.style.display = 'none';

    // přepiš action s langem
    form.setAttribute('action', `/thank-you.html?lang=${lang}`);

    // honeypot
    if (form.querySelector('input[name="bot-field"]')?.value) {
      e.preventDefault();
      return;
    }

    const name = form.name?.value?.trim();
    const email = form.email?.value?.trim();
    const message = form.message?.value?.trim();

    let valid = true;
    if (!name) {
      showFieldError(form, 'name', t('contact-error-name', 'Enter your name.'));
      valid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError(form, 'email', t('contact-error-email', 'Enter a valid e-mail.'));
      valid = false;
    }
    if (!message) {
      showFieldError(form, 'message', t('contact-error-message', 'Write a message.'));
      valid = false;
    }
    if (!valid) e.preventDefault();
  });
}
