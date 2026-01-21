import { ref, watch, onUnmounted, toValue, computed } from 'vue'
import { DrawingManager } from '../core/DrawingManager.js'

/**
 * Vue 3 composable for Google Maps drawing with snapping
 * All logic is handled by the package - minimal code needed in components
 * 
 * @param {Ref<google.maps.Map>|google.maps.Map} mapRef - Google Maps instance
 * @param {Object} options - Configuration options
 * @returns {Object} Reactive state and methods
 */
export function useMapDrawing(mapRef, options = {}) {
  let manager = null

  // Reactive state - automatically synced with DrawingManager
  const shapes = ref([])
  const activeShape = ref(null)
  const isDrawing = ref(false)
  const drawingType = ref(null)
  const pointCount = ref(0)
  const canUndo = ref(false)
  const canRedo = ref(false)
  const snapActive = ref(false)
  const snappingEnabled = ref(options.snapping?.enabled !== false)

  // Event callbacks
  const _callbacks = {}

  // Computed hint text
  const drawingHint = computed(() => {
    switch (drawingType.value) {
      case 'polygon': return 'Click to add points, double-click or Enter to complete'
      case 'polyline': return 'Click to add points, double-click or Enter to complete'
      case 'circle': return 'Click center, then click to set radius'
      case 'rectangle': return 'Click first corner, then click opposite corner'
      default: return ''
    }
  })

  function init(map) {
    if (manager) manager.destroy()

    manager = new DrawingManager(map, options)

    // Sync all events to reactive state
    manager.on('shape:created', (d) => { shapes.value = manager.getShapes(); _callbacks.onShapeCreated?.(d.shape) })
    manager.on('shape:updated', (d) => { shapes.value = manager.getShapes(); if (activeShape.value?.id === d.shape.id) activeShape.value = d.shape; _callbacks.onShapeUpdated?.(d.shape) })
    manager.on('shape:deleted', (d) => { shapes.value = manager.getShapes(); if (activeShape.value?.id === d.id) activeShape.value = null; _callbacks.onShapeDeleted?.(d) })
    manager.on('shape:selected', (d) => { activeShape.value = d.shape })
    manager.on('shape:deselected', () => { activeShape.value = null })
    manager.on('shapes:cleared', () => { shapes.value = []; activeShape.value = null })
    manager.on('drawing:start', (d) => { isDrawing.value = true; drawingType.value = d.type; pointCount.value = 0 })
    manager.on('drawing:update', (d) => { pointCount.value = d.count })
    manager.on('drawing:cancel', () => { isDrawing.value = false; drawingType.value = null; pointCount.value = 0; snapActive.value = false })
    manager.on('drawing:complete', () => { isDrawing.value = false; drawingType.value = null; pointCount.value = 0; snapActive.value = false })
    manager.on('history:change', (s) => { canUndo.value = s.canUndo; canRedo.value = s.canRedo })
    manager.on('snap:active', (d) => { snapActive.value = d.active })
    manager.on('snap:detected', (d) => { _callbacks.onSnapDetected?.(d) })
  }

  // Watch for map changes
  watch(() => toValue(mapRef), (map) => { if (map) init(map) }, { immediate: true })

  // Cleanup
  onUnmounted(() => { manager?.destroy(); manager = null })

  // ==================== API ====================

  return {
    // State
    shapes,
    activeShape,
    isDrawing,
    drawingType,
    drawingHint,
    pointCount,
    canUndo,
    canRedo,
    snapActive,
    snappingEnabled,

    // Drawing
    startDrawing: (type) => manager?.startDrawing(type),
    stopDrawing: () => manager?.stopDrawing(),
    completeDrawing: () => manager?.completeDrawing(),

    // Shapes
    deleteShape: (id) => manager?.deleteShape(id),
    deleteActiveShape: () => { if (activeShape.value) manager?.deleteShape(activeShape.value.id) },
    clearAll: () => manager?.clearAll(),
    selectShape: (id) => manager?.selectShape(id),
    deselectShape: () => manager?.deselectShape(),
    getShapeById: (id) => manager?.getShapeById(id),
    updateShapeName: (id, name) => manager?.updateShapeName(id, name),

    // History
    undo: () => manager?.undo(),
    redo: () => manager?.redo(),

    // Snapping
    setSnapping: (opts) => { manager?.setSnapping(opts); if (opts.enabled !== undefined) snappingEnabled.value = opts.enabled },
    toggleSnapping: () => { const v = !snappingEnabled.value; manager?.setSnapping({ enabled: v }); snappingEnabled.value = v },

    // Event callbacks
    onShapeCreated: (cb) => { _callbacks.onShapeCreated = cb },
    onShapeUpdated: (cb) => { _callbacks.onShapeUpdated = cb },
    onShapeDeleted: (cb) => { _callbacks.onShapeDeleted = cb },
    onSnapDetected: (cb) => { _callbacks.onSnapDetected = cb }
  }
}

export default useMapDrawing
