function updateLanguageLink() {
  const languageLink = document.querySelector('[data-language-switch]');
  if (!languageLink) return;
  const destination = new URL(languageLink.href);
  const section = document.getElementById(location.hash.slice(1));
  destination.hash = section?.hasAttribute('data-translated') ? location.hash : '';
  languageLink.href = destination.href;
}

document.addEventListener('DOMContentLoaded', updateLanguageLink, { once: true });
window.addEventListener('hashchange', updateLanguageLink);
document.addEventListener('click', event => {
  if (event.target.closest?.('[data-language-switch]')) updateLanguageLink();
});
