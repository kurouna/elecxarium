// The worker harness, bundled to a self-contained IIFE string by the Vite plugin.
declare module 'virtual:worker-harness' {
  const harness: string;
  export default harness;
}
