// Shim react.cache for Jest (React 18 CJS bundle does not expose cache).
// cache() is a server-only React API; in tests we just want a pass-through.
const react = require('react')
if (typeof react.cache !== 'function') {
  react.cache = (fn) => fn
}
