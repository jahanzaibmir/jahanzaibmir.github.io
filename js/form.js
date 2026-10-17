// Contact form, sent through Web3Forms. Fields are checked before sending,
// a hidden checkbox catches spam bots, and the request gives up after 15s.

import { $ } from './lib/env.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function initForm() {
  const form = $('#contact-form');
  if (!form) return;
  const status = $('#form-status');
  const button = $('.submit', form);
  const label = $('.submit-label', form);

  const setStatus = (msg, kind = '') => {
    status.className = `form-status${kind ? ` is-${kind}` : ''}`;
    status.textContent = msg;
  };

  function check() {
    let firstBad = null;
    form.querySelectorAll('.field').forEach((field) => {
      const input = field.querySelector('input, textarea');
      const value = input.value.trim();
      const ok = value.length > 0 && (input.type !== 'email' || EMAIL.test(value));
      field.classList.toggle('is-bad', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      if (!ok && !firstBad) firstBad = input;
    });
    return firstBad;
  }

  form.addEventListener('input', (e) => {
    const field = e.target.closest('.field');
    if (field && field.classList.contains('is-bad')) {
      field.classList.remove('is-bad');
      e.target.removeAttribute('aria-invalid');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = check();
    if (bad) {
      setStatus('Please fill in every field and use a real email address.', 'err');
      bad.focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    if (data.botcheck) return;
    delete data.botcheck;

    button.disabled = true;
    label.textContent = 'Sending';
    setStatus('');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
        signal: ctrl.signal
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) throw new Error(result.message || res.statusText);
      setStatus('Thank you. Your message was sent.', 'ok');
      form.reset();
    } catch {
      setStatus('Sorry, the message could not be sent. Please try again.', 'err');
    } finally {
      clearTimeout(timer);
      button.disabled = false;
      label.textContent = 'Send message';
    }
  });
}
