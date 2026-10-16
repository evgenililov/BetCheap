/* BetCheap /compare age gate. Independent of market/API initialization. */
(() => {
  'use strict';
  const dialog = document.getElementById('ageGate');
  const confirm = document.getElementById('ageConfirm');
  const exit = document.getElementById('ageExit');
  if (!dialog || !confirm || !exit) return;
  const storageKey = 'betcheap_age_ok';
  const hide = () => {
    dialog.classList.add('hidden');
    dialog.setAttribute('aria-hidden', 'true');
    const first = document.getElementById('modePrematch') || document.getElementById('mode') || document.querySelector('main button');
    if (first && typeof first.focus === 'function') first.focus();
  };
  let confirmed = false;
  try { confirmed = localStorage.getItem(storageKey) === '1'; } catch (_) { /* private browsing */ }
  if (confirmed) { hide(); return; }
  confirm.addEventListener('click', () => {
    try { localStorage.setItem(storageKey, '1'); } catch (_) { /* still allow this visit */ }
    hide();
  });
  exit.addEventListener('click', () => {
    // Replace the age-gated page instead of navigating back into it.
    window.location.replace('about:blank');
  });
})();
