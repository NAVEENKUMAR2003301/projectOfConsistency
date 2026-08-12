import { readApp, readBuiltCss, createChecker } from './_setup.mjs'

// The details that separate "web page in a browser" from "app". Each one here
// is invisible when present and obvious when missing, which is exactly the
// kind of thing that gets dropped in a refactor.
const css = readBuiltCss()
const app = readApp('src', 'App.jsx')
const { check, done } = createChecker()

// --- touch feel -------------------------------------------------------------
check(
  'tap highlight suppressed',
  /-webkit-tap-highlight-color:\s*transparent/.test(css),
  'iOS flashes a grey box on every tap without this',
)
check(
  'text not auto-enlarged in landscape',
  /text-size-adjust:\s*100%/.test(css),
  'iOS resizes text on rotation otherwise',
)
check(
  'chrome is not selectable',
  /user-select:\s*none/.test(css),
  'long-pressing a nav item would start a text selection',
)

// --- scrolling --------------------------------------------------------------
check(
  'page does not rubber-band',
  /overscroll-behavior-y:\s*none/.test(css),
  'over-scrolling exposes the browser background behind the app',
)
check(
  'scroll panels do not chain to the page',
  /overscroll-behavior:\s*contain/.test(css),
  'a modal scrolled to its end drags the page behind it',
)

// --- notch / safe areas -----------------------------------------------------
// The manifest asks for a translucent status bar, so iOS draws the page under
// the notch when installed. Without the inset the date row sits behind the
// clock.
check('top safe-area inset applied', app.includes('safe-area-inset-top'))
check('side insets applied for landscape', app.includes('safe-area-inset-left'))
check(
  'bottom inset still on the nav',
  readApp('src', 'components', 'MobileNav.jsx').includes('safe-area-inset-bottom'),
)

// --- typography -------------------------------------------------------------
check('system font stack in use', /-apple-system/.test(css))
check('grayscale smoothing for macOS', /-moz-osx-font-smoothing:\s*grayscale/.test(css))
check('figures use fixed-width digits', /font-variant-numeric:\s*tabular-nums/.test(css))

// --- motion is a preference, not a given ------------------------------------
check('reduced motion honoured', css.includes('prefers-reduced-motion'))

// --- the focus ring must survive `outline-none` on inputs -------------------
// It is deliberately unlayered so it outranks the utility; if it ever moves
// into a layer, keyboard users lose the ring entirely.
const src = readApp('src', 'index.css')
const focusIndex = src.indexOf(':focus-visible')
const layerIndex = src.lastIndexOf('@layer components {', focusIndex)
const layerEnd = layerIndex === -1 ? -1 : src.indexOf('\n}', layerIndex)
check(
  'focus ring stays unlayered',
  focusIndex > -1 && (layerIndex === -1 || focusIndex > layerEnd),
  'a layered focus ring loses to outline-none on inputs',
)
check('focus ring sets no border-radius', !/:focus-visible[^{]*\{[^}]*border-radius/.test(src))

done('polish')
