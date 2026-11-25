const languageLink = document.querySelector('[data-language-switch]');

function updateLanguageLink() {
  const destination = new URL(languageLink.href);
  const section = document.getElementById(location.hash.slice(1));
  destination.hash = section?.hasAttribute('data-translated') ? location.hash : '';
  languageLink.href = destination.href;
}

updateLanguageLink();
window.addEventListener('hashchange', updateLanguageLink);
languageLink.addEventListener('click', updateLanguageLink);
