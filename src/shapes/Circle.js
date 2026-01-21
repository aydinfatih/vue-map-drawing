import { BaseShape } from './BaseShape.js'

/**
 * Circle shape for Google Maps
 */
export class Circle extends BaseShape {
  constructor(options = {}) {
    super(options)
    this.center = null
    this.radius = 0 // in meters
  }

  get type() {
    return 'circle'
  }

  get area() {
    return Math.PI * this.radius * this.radius
  }

  get perimeter() {
    return 2 * Math.PI * this.radius
  }

  /**
   * Get circle center
   * @returns {Object} {lat, lng}
   */
  getCenter() {
    return this.center
  }

  /**
   * Get edges for snapping (approximate circle as polygon)
   * @param {number} [segments=36] - Number of segments
   * @returns {Array<Object>}
   */
  getEdges(segments = 36) {
    if (!this.center || !this.radius) return []

    const edges = []
    const points = this._getCirclePoints(segments)

    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      edges.push({
        start: points[i],
        end: points[j],
        index: i
      })
    }

    return edges
  }

  /**
   * Create circle on the map
   * @param {Object} center - Center point {lat, lng}
   * @param {number} radius - Radius in meters
   */
  create(center, radius) {
    this.center = center
    this.radius = radius
    this.coordinates = [center] // Store center as coordinate

    this.googleObject = new google.maps.Circle({
      center: new google.maps.LatLng(center.lat, center.lng),
      radius: radius,
      map: this.map,
      editable: this.editable,
      draggable: false,
      ...this.style
    })

    this._setupListeners()
    return this
  }

  /**
   * Update circle
   * @param {Object} center - New center
   * @param {number} radius - New radius
   */
  update(center, radius) {
    if (center) {
      this.center = center
      this.coordinates = [center]
    }
    if (radius !== undefined) {
      this.radius = radius
    }
    this._syncToGoogleObject()
  }

  /**
   * Setup event listeners
   * @private
   */
  _setupListeners() {
    if (!this.googleObject) return

    this._addListener('center_changed', () => {
      this._syncFromGoogleObject()
      this._onUpdate?.()
    })

    this._addListener('radius_changed', () => {
      this._syncFromGoogleObject()
      this._onUpdate?.()
    })
  }

  /**
   * Set callback for updates
   * @param {Function} callback
   */
  onUpdate(callback) {
    this._onUpdate = callback
  }

  _syncToGoogleObject() {
    if (this.googleObject) {
      this.googleObject.setCenter(new google.maps.LatLng(this.center.lat, this.center.lng))
      this.googleObject.setRadius(this.radius)
    }
  }

  _syncFromGoogleObject() {
    if (this.googleObject) {
      const center = this.googleObject.getCenter()
      this.center = { lat: center.lat(), lng: center.lng() }
      this.radius = this.googleObject.getRadius()
      this.coordinates = [this.center]
    }
  }

  /**
   * Get approximation points for circle
   * @param {number} segments
   * @returns {Array<Object>}
   * @private
   */
  _getCirclePoints(segments = 36) {
    const points = []
    const lat = this.center.lat
    const lng = this.center.lng
    
    // Approximate conversion: 1 degree latitude ≈ 111,111 meters
    const latRadius = this.radius / 111111
    const lngRadius = this.radius / (111111 * Math.cos(lat * Math.PI / 180))

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * 2 * Math.PI
      points.push({
        lat: lat + latRadius * Math.sin(angle),
        lng: lng + lngRadius * Math.cos(angle)
      })
    }

    return points
  }

  _getGeoJSONGeometry() {
    // GeoJSON doesn't have native circle, represent as polygon
    const points = this._getCirclePoints(64)
    const coords = points.map(p => [p.lng, p.lat])
    coords.push(coords[0]) // Close the ring

    return {
      type: 'Polygon',
      coordinates: [coords]
    }
  }

  toJSON() {
    return {
      ...super.toJSON(),
      center: this.center,
      radius: this.radius
    }
  }
}

export default Circle
