import { DOMAdapter } from 'pixi.js'

// Keep real Pixi filters in renderer-free tests; only the optional WebGL
// capability probe has no canvas/context. Browser rendering is checked separately.
DOMAdapter.set({ ...DOMAdapter.get(), createCanvas: () => ({ getContext: () => null }) })
