// The only outbound link in the app. It is a plain anchor rather than an
// embedded iframe: embedding would need a CSP exception for Google's domains,
// and would load third-party code into a page that otherwise talks to nobody.
// Opened in a new tab so an in-progress check-in is never lost, and with
// Referrer-Policy: no-referrer (set in vercel.json) the destination is not told
// which page you came from.
export const FEEDBACK_URL = 'https://forms.gle/Ey2iYL7ijvUrVSVz9'
