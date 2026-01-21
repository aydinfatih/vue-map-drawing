import { ref, computed, watch, toValue } from 'vue'

/**
 * Vue composable for managing shape styles
 * @param {Ref<Object>} shapeRef - Shape object ref
 * @param {Function} updateFn - Function to apply style updates
 * @returns {Object} Style state and methods
 */
export function useShapeStyle(shapeRef, updateFn) {
  // Default style values
  const defaultStyle = {
    strokeColor: '#4CAF50',
    strokeWeight: 2,
    strokeOpacity: 1,
    fillColor: '#4CAF50',
    fillOpacity: 0.2
  }

  // Reactive style state
  const currentStyle = ref({ ...defaultStyle })

  // Sync style from shape
  watch(
    () => toValue(shapeRef),
    (shape) => {
      if (shape?.style) {
        currentStyle.value = { ...defaultStyle, ...shape.style }
      }
    },
    { immediate: true, deep: true }
  )

  /**
   * Apply style update
   * @param {Object} styleUpdate
   */
  function applyStyle(styleUpdate) {
    const shape = toValue(shapeRef)
    if (shape && updateFn) {
      currentStyle.value = { ...currentStyle.value, ...styleUpdate }
      updateFn(shape.id, currentStyle.value)
    }
  }

  /**
   * Set stroke color
   * @param {string} color
   */
  function setStrokeColor(color) {
    applyStyle({ strokeColor: color })
  }

  /**
   * Set fill color
   * @param {string} color
   */
  function setFillColor(color) {
    applyStyle({ fillColor: color })
  }

  /**
   * Set stroke weight
   * @param {number} weight
   */
  function setStrokeWeight(weight) {
    applyStyle({ strokeWeight: weight })
  }

  /**
   * Set stroke opacity
   * @param {number} opacity
   */
  function setStrokeOpacity(opacity) {
    applyStyle({ strokeOpacity: opacity })
  }

  /**
   * Set fill opacity
   * @param {number} opacity
   */
  function setFillOpacity(opacity) {
    applyStyle({ fillOpacity: opacity })
  }

  /**
   * Reset to default style
   */
  function resetStyle() {
    applyStyle(defaultStyle)
  }

  /**
   * Set complete style
   * @param {Object} style
   */
  function setStyle(style) {
    applyStyle(style)
  }

  return {
    currentStyle,
    setStrokeColor,
    setFillColor,
    setStrokeWeight,
    setStrokeOpacity,
    setFillOpacity,
    resetStyle,
    setStyle
  }
}

export default useShapeStyle
