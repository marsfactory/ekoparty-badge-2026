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
  menuToggle.setAttribute('aria-label', isOpen ? 'Cerrar menú de capítulos' : 'Abrir menú de capítulos');
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
