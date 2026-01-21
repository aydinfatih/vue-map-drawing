import { onMounted, onUnmounted } from 'vue'

/**
 * Vue composable for handling drawing events
 * @param {Object} drawing - Drawing composable instance from useMapDrawing
 * @param {Object} handlers - Event handlers
 * @returns {void}
 */
export function useDrawingEvents(drawing, handlers = {}) {
  const {
    onShapeCreated: handleCreated,
    onShapeUpdated: handleUpdated,
    onShapeDeleted: handleDeleted,
    onSnapDetected: handleSnap,
    onDrawingStart: handleDrawingStart,
    onDrawingComplete: handleDrawingComplete,
    onDrawingCancel: handleDrawingCancel
  } = handlers

  onMounted(() => {
    // Register event callbacks
    if (handleCreated) {
      drawing.onShapeCreated(handleCreated)
    }
    
    if (handleUpdated) {
      drawing.onShapeUpdated(handleUpdated)
    }
    
    if (handleDeleted) {
      drawing.onShapeDeleted(handleDeleted)
    }
    
    if (handleSnap) {
      drawing.onSnapDetected(handleSnap)
    }
  })

  // Cleanup happens automatically when drawing is destroyed
}

export default useDrawingEvents
