/**
 * SnapEngine - Handles edge snapping for map drawing
 * Snaps drawing points to edges of existing shapes
 */
export class SnapEngine {
  /**
   * @param {Object} options
   * @param {google.maps.Map} options.map - Google Maps instance
   * @param {number} [options.threshold=15] - Snap threshold in pixels
   * @param {boolean} [options.showIndicator=true] - Show snap indicator marker
   */
  constructor(options = {}) {
    this.map = options.map
    this.threshold = options.threshold || 15
    this.showIndicator = options.showIndicator !== false
    this.enabled = true
    
    this.shapes = new Map() // shapeId -> shape data
    this.snapMarker = null
    
    this._onSnapCallback = null
  }

  /**
   * Enable snapping
   */
  enable() {
    this.enabled = true
  }

  /**
   * Disable snapping
   */
  disable() {
    this.enabled = false
    this.hideIndicator()
  }

  /**
   * Check if snapping is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled
  }

  /**
   * Set snap threshold in pixels
   * @param {number} threshold
   */
  setThreshold(threshold) {
    this.threshold = threshold
  }

  /**
   * Register a shape for snapping
   * @param {string} id - Shape ID
   * @param {string} type - Shape type ('polygon', 'circle', 'rectangle', 'polyline')
   * @param {google.maps.Polygon|google.maps.Circle|google.maps.Rectangle|google.maps.Polyline} googleObject
   */
  addShape(id, type, googleObject) {
    this.shapes.set(id, { id, type, obj: googleObject })
  }

  /**
   * Remove a shape from snapping
   * @param {string} id
   */
  removeShape(id) {
    this.shapes.delete(id)
  }

  /**
   * Clear all shapes
   */
  clearShapes() {
    this.shapes.clear()
  }

  /**
   * Find snap point for a given position
   * @param {Object} point - Position {lat, lng}
   * @param {string} [excludeShapeId] - Shape ID to exclude from snapping
   * @returns {Object|null} Snap result { point, distance, edge } or null
   */
  findSnapPoint(point, excludeShapeId = null) {
    if (!this.enabled || !this.map || this.shapes.size === 0) {
      return null
    }

    const edges = this._getAllEdges(excludeShapeId)
    if (edges.length === 0) return null

    const projection = this.map.getProjection()
    if (!projection) return null

    const zoom = this.map.getZoom()
    const scale = Math.pow(2, zoom)
    
    // Convert point to pixel coordinates
    const pointWorld = projection.fromLatLngToPoint(
      new google.maps.LatLng(point.lat, point.lng)
    )
    const pointPixel = { x: pointWorld.x * scale, y: pointWorld.y * scale }

    let bestSnap = null
    let minDistance = this.threshold

    for (const edge of edges) {
      // Convert edge to pixels
      const startWorld = projection.fromLatLngToPoint(
        new google.maps.LatLng(edge.start.lat, edge.start.lng)
      )
      const endWorld = projection.fromLatLngToPoint(
        new google.maps.LatLng(edge.end.lat, edge.end.lng)
      )
      const startPixel = { x: startWorld.x * scale, y: startWorld.y * scale }
      const endPixel = { x: endWorld.x * scale, y: endWorld.y * scale }

      // Project point to line segment
      const projected = this._projectPointToSegment(pointPixel, startPixel, endPixel)

      if (projected.distance < minDistance) {
        minDistance = projected.distance

        // Convert back to LatLng
        const projectedWorld = new google.maps.Point(
          projected.point.x / scale,
          projected.point.y / scale
        )
        const projectedLatLng = projection.fromPointToLatLng(projectedWorld)

        bestSnap = {
          point: { lat: projectedLatLng.lat(), lng: projectedLatLng.lng() },
          distance: projected.distance,
          edge: edge,
          t: projected.t
        }
      }
    }

    // Show/hide indicator and trigger callback
    if (bestSnap) {
      if (this.showIndicator) {
        this._showIndicator(bestSnap.point)
      }
      this._onSnapCallback?.(bestSnap)
    } else {
      this.hideIndicator()
    }

    return bestSnap
  }

  /**
   * Set callback for snap events
   * @param {Function} callback
   */
  onSnap(callback) {
    this._onSnapCallback = callback
  }

  /**
   * Hide snap indicator
   */
  hideIndicator() {
    if (this.snapMarker) {
      this.snapMarker.setVisible(false)
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.hideIndicator()
    if (this.snapMarker) {
      this.snapMarker.setMap(null)
      this.snapMarker = null
    }
    this.shapes.clear()
    this._onSnapCallback = null
  }

  /**
   * Get all edges from registered shapes
   * @param {string} [excludeId] - Shape ID to exclude
   * @returns {Array<Object>}
   * @private
   */
  _getAllEdges(excludeId = null) {
    const edges = []

    for (const [id, shape] of this.shapes) {
      if (id === excludeId) continue

      if (shape.type === 'polygon') {
        const path = shape.obj.getPath().getArray()
        for (let i = 0; i < path.length; i++) {
          const j = (i + 1) % path.length
          edges.push({
            start: { lat: path[i].lat(), lng: path[i].lng() },
            end: { lat: path[j].lat(), lng: path[j].lng() },
            shapeId: id
          })
        }
      } else if (shape.type === 'polyline') {
        const path = shape.obj.getPath().getArray()
        for (let i = 0; i < path.length - 1; i++) {
          edges.push({
            start: { lat: path[i].lat(), lng: path[i].lng() },
            end: { lat: path[i + 1].lat(), lng: path[i + 1].lng() },
            shapeId: id
          })
        }
      } else if (shape.type === 'rectangle') {
        const bounds = shape.obj.getBounds()
        const ne = bounds.getNorthEast()
        const sw = bounds.getSouthWest()
        const nw = { lat: ne.lat(), lng: sw.lng() }
        const se = { lat: sw.lat(), lng: ne.lng() }

        edges.push(
          { start: nw, end: { lat: ne.lat(), lng: ne.lng() }, shapeId: id },
          { start: { lat: ne.lat(), lng: ne.lng() }, end: se, shapeId: id },
          { start: se, end: { lat: sw.lat(), lng: sw.lng() }, shapeId: id },
          { start: { lat: sw.lat(), lng: sw.lng() }, end: nw, shapeId: id }
        )
      } else if (shape.type === 'circle') {
        // Approximate circle with segments
        const center = shape.obj.getCenter()
        const radius = shape.obj.getRadius()
        const segments = 36
        const points = []

        for (let i = 0; i < segments; i++) {
          const angle = (i / segments) * 2 * Math.PI
          const lat = center.lat() + (radius / 111111) * Math.sin(angle)
          const lng = center.lng() + (radius / (111111 * Math.cos(center.lat() * Math.PI / 180))) * Math.cos(angle)
          points.push({ lat, lng })
        }

        for (let i = 0; i < points.length; i++) {
          const j = (i + 1) % points.length
          edges.push({ start: points[i], end: points[j], shapeId: id })
        }
      }
    }

    return edges
  }

  /**
   * Project point to line segment in pixel coordinates
   * @param {Object} point - {x, y}
   * @param {Object} lineStart - {x, y}
   * @param {Object} lineEnd - {x, y}
   * @returns {Object} { point, distance, t }
   * @private
   */
  _projectPointToSegment(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x
    const dy = lineEnd.y - lineStart.y
    const lengthSquared = dx * dx + dy * dy

    if (lengthSquared === 0) {
      const dist = Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2)
      return { point: lineStart, distance: dist, t: 0 }
    }

    // Calculate projection parameter
    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared
    t = Math.max(0, Math.min(1, t)) // Clamp to segment

    const projected = {
      x: lineStart.x + t * dx,
      y: lineStart.y + t * dy
    }

    const distance = Math.sqrt((point.x - projected.x) ** 2 + (point.y - projected.y) ** 2)

    return { point: projected, distance, t }
  }

  /**
   * Show snap indicator at position
   * @param {Object} latLng - {lat, lng}
   * @private
   */
  _showIndicator(latLng) {
    if (!this.map) return

    if (!this.snapMarker) {
      this.snapMarker = new google.maps.Marker({
        map: this.map,
        clickable: false,
        zIndex: 2000,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3
        }
      })
    }

    this.snapMarker.setPosition(new google.maps.LatLng(latLng.lat, latLng.lng))
    this.snapMarker.setVisible(true)
  }
}

export default SnapEngine
