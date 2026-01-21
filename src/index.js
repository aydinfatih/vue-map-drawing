// Vue Map Drawing - Main entry point

// Composables (main API)
export { useMapDrawing } from './composables/useMapDrawing.js'
export { useShapeStyle } from './composables/useShapeStyle.js'
export { useDrawingEvents } from './composables/useDrawingEvents.js'

// Core classes (for advanced usage)
export { DrawingManager } from './core/DrawingManager.js'
export { EventBus } from './core/EventBus.js'
export { HistoryManager } from './core/HistoryManager.js'

// Shape classes
export { BaseShape, Polygon, Circle, Rectangle, Polyline, createShape } from './shapes/index.js'

// Snapping
export { SnapEngine } from './snapping/SnapEngine.js'

// Utilities
export * from './utils/geometry.js'

// Version
export const VERSION = '0.1.1'
