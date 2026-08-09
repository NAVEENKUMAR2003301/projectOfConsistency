// Resolves the theme before first paint so there is no light/dark flash.
// Kept as a separate file rather than an inline <script> so the Content
// Security Policy can stay at script-src 'self' with no 'unsafe-inline'.
// It must load synchronously in <head> — deferring it reintroduces the flash.
try {
  var stored = localStorage.getItem('consistency.theme.v1')
  if (stored !== 'light' && stored !== 'dark') {
    stored = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.dataset.theme = stored
} catch {
  // Private mode can throw on localStorage access — fall back rather than
  // leaving the page unthemed.
  document.documentElement.dataset.theme = 'dark'
}
