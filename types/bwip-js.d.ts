// bwip-js only publishes types under its "node"/"browser" export conditions,
// which TypeScript's bundler resolution does not apply. Declare the one API
// the ticket renderer uses (lib/tickets/symbols.ts).
declare module 'bwip-js' {
  interface BwipJs {
    raw(bcid: string, text: string, opts?: Record<string, string | number | boolean>): unknown[]
  }
  const bwipjs: BwipJs
  export default bwipjs
}
