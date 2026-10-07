const supportedLanguages = {
  es: 'es-AR',
  en: 'en',
  pt: 'pt-BR',
};
const translationCatalog = new Map(
  (window.EKO_I18N || []).map(([spanish, english, portuguese]) => [spanish, { en: english, pt: portuguese }]),
);
const languagePicker = document.querySelector('.language-picker');
const languageTrigger = document.querySelector('.language-trigger');
const languageMenu = document.querySelector('.language-menu');
const languageOptions = [...document.querySelectorAll('.language-option[data-language]')];
const languageCurrent = document.querySelector('.language-current');
const translatableText = [];
const translatableAttributes = [];
let currentLanguage = 'es';

const textWalker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT, {
  acceptNode(node) {
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName) || parent.closest('[data-i18n-ignore]')) {
      return NodeFilter.FILTER_REJECT;
    }
    return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
  },
});

while (textWalker.nextNode()) {
  translatableText.push({ node: textWalker.currentNode, original: textWalker.currentNode.nodeValue });
}

for (const element of document.querySelectorAll('[alt], [aria-label], [title], [placeholder], meta[name="description"]')) {
  for (const attribute of ['alt', 'aria-label', 'title', 'placeholder', 'content']) {
    if (element.hasAttribute(attribute)) {
      translatableAttributes.push({ element, attribute, original: element.getAttribute(attribute) });
    }
  }
}

function translatedText(spanish, language = currentLanguage) {
  return language === 'es' ? spanish : translationCatalog.get(spanish)?.[language] || spanish;
}

function translateTextNode(original, language) {
  const spanish = original.trim();
  const translation = translatedText(spanish, language);
  return `${original.match(/^\s*/)[0]}${translation}${original.match(/\s*$/)[0]}`;
}

function applyLanguage(language, persist = true) {
  currentLanguage = Object.hasOwn(supportedLanguages, language) ? language : 'es';

  for (const entry of translatableText) {
    entry.node.nodeValue = translateTextNode(entry.original, currentLanguage);
  }
  for (const entry of translatableAttributes) {
    entry.element.setAttribute(entry.attribute, translatedText(entry.original, currentLanguage));
  }

  document.documentElement.lang = supportedLanguages[currentLanguage];
  document.documentElement.dataset.language = currentLanguage;
  languageCurrent.textContent = currentLanguage.toUpperCase();
  for (const option of languageOptions) {
    const isSelected = option.dataset.language === currentLanguage;
    option.setAttribute('aria-checked', String(isSelected));
    option.tabIndex = isSelected ? 0 : -1;
  }

  if (typeof setMenuOpen === 'function') {
    setMenuOpen(document.body.classList.contains('menu-open'));
  }

  if (persist) {
    try {
      localStorage.setItem('eko-guide-language', currentLanguage);
    } catch {
      // The guide still works when storage is unavailable (for example in private browsing).
    }

    try {
      const url = new URL(window.location.href);
      if (currentLanguage === 'es') url.searchParams.delete('lang');
      else url.searchParams.set('lang', currentLanguage);
      window.history.replaceState(null, '', url);
    } catch {
      // Language switching does not depend on URL updates.
    }
  }
}

const printButtons = document.querySelectorAll('[data-print]');

async function prepareImagesForPrint() {
  const images = [...document.images].filter((image) => !image.closest('.lightbox'));

  await Promise.all(images.map(async (image) => {
    image.loading = 'eager';

    if (!image.complete) {
      await new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }

    if (image.naturalWidth > 0 && typeof image.decode === 'function') {
      try {
        await image.decode();
      } catch {
        // The load/error listeners above already prevent a broken image from blocking printing.
      }
    }
  }));

  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

for (const button of printButtons) {
  button.addEventListener('click', async () => {
    if (button.disabled) return;

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');

    try {
      await prepareImagesForPrint();
      window.print();
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  });
}

const menuToggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('#guide-menu');
const menuBackdrop = document.querySelector('.menu-backdrop');
const mobileMenu = window.matchMedia('(max-width: 900px)');

function setMenuOpen(open) {
  const isOpen = open && mobileMenu.matches;
  document.body.classList.toggle('menu-open', isOpen);
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', translatedText(isOpen ? 'Cerrar menú de capítulos' : 'Abrir menú de capítulos'));
  menuBackdrop.hidden = !isOpen;
  menu.inert = mobileMenu.matches && !isOpen;
}

menuToggle.addEventListener('click', () => setMenuOpen(!document.body.classList.contains('menu-open')));
menuBackdrop.addEventListener('click', () => {
  setMenuOpen(false);
  menuToggle.focus();
});
menu.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => setMenuOpen(false));
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) {
    setMenuOpen(false);
    menuToggle.focus();
  }
});
mobileMenu.addEventListener('change', () => setMenuOpen(false));
setMenuOpen(false);

const printDetails = [...document.querySelectorAll('details')];
let openDetailsBeforePrint = [];
window.addEventListener('beforeprint', () => {
  for (const image of document.images) image.loading = 'eager';
  openDetailsBeforePrint = printDetails.filter((detail) => detail.open);
  for (const detail of printDetails) detail.open = true;
});
window.addEventListener('afterprint', () => {
  for (const detail of printDetails) detail.open = openDetailsBeforePrint.includes(detail);
});

const lightbox = document.querySelector('.lightbox');
const lightboxImage = lightbox.querySelector('img');
const lightboxCaption = lightbox.querySelector('p');
const closeButton = lightbox.querySelector('.lightbox-close');

if (typeof lightbox.showModal === 'function') {
  for (const link of document.querySelectorAll('[data-lightbox]')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const source = link.querySelector('img');
      lightboxImage.src = link.href;
      lightboxImage.alt = source.alt;
      lightboxCaption.textContent = link.closest('figure')?.querySelector('figcaption')?.textContent || '';
      lightbox.showModal();
      closeButton.focus();
    });
  }

  closeButton.addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) lightbox.close();
  });
  lightbox.addEventListener('close', () => {
    lightboxImage.removeAttribute('src');
  });
}

function setLanguageMenuOpen(open, focusSelected = false) {
  const isOpen = Boolean(open);
  languageTrigger.setAttribute('aria-expanded', String(isOpen));
  languageMenu.hidden = !isOpen;

  if (isOpen && focusSelected) {
    (languageOptions.find((option) => option.dataset.language === currentLanguage) || languageOptions[0]).focus();
  }
}

languageTrigger.addEventListener('click', () => {
  setLanguageMenuOpen(languageTrigger.getAttribute('aria-expanded') !== 'true');
});

languageTrigger.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  setLanguageMenuOpen(true, true);
});

for (const option of languageOptions) {
  option.addEventListener('click', () => {
    applyLanguage(option.dataset.language);
    setLanguageMenuOpen(false);
    languageTrigger.focus();
  });
}

languageMenu.addEventListener('keydown', (event) => {
  const currentIndex = languageOptions.indexOf(document.activeElement);
  let nextIndex;

  if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % languageOptions.length;
  else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + languageOptions.length) % languageOptions.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = languageOptions.length - 1;
  else if (event.key === 'Escape') {
    event.preventDefault();
    setLanguageMenuOpen(false);
    languageTrigger.focus();
    return;
  } else return;

  event.preventDefault();
  languageOptions[nextIndex].focus();
});

document.addEventListener('click', (event) => {
  if (!languagePicker.contains(event.target)) setLanguageMenuOpen(false);
});

languagePicker.addEventListener('focusout', () => {
  requestAnimationFrame(() => {
    if (!languagePicker.contains(document.activeElement)) setLanguageMenuOpen(false);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && languageTrigger.getAttribute('aria-expanded') === 'true') {
    setLanguageMenuOpen(false);
    languageTrigger.focus();
  }
});

setLanguageMenuOpen(false);

let initialLanguage = 'es';
try {
  const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
  const savedLanguage = localStorage.getItem('eko-guide-language');
  if (Object.hasOwn(supportedLanguages, requestedLanguage)) initialLanguage = requestedLanguage;
  else if (Object.hasOwn(supportedLanguages, savedLanguage)) initialLanguage = savedLanguage;
} catch {
  // Spanish remains the default when storage cannot be read.
}
applyLanguage(initialLanguage, false);
