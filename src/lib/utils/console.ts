/**
 * Console utility for production builds
 * Disables console methods in production to reduce bundle size and improve performance
 */

export function disableConsoleInProduction() {
  if (process.env.NODE_ENV === "production") {
    const noop = () => {};
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.warn = noop;
    // Keep console.error for critical error tracking
    // console.error = noop;
  }
}
