import { generateId, calculateCentroid, getEdgesFromCoordinates } from '../utils/geometry.js'

/**
 * BaseShape - Abstract base class for all map shapes
 */
export class BaseShape {
  /**
   * @param {Object} options
   * @param {google.maps.Map} options.map - Google Maps instance
   * @param {Object} [options.style] - Shape style options
   * @param {string} [options.id] - Custom shape ID
   */
  constructor(options = {}) {
    this.id = options.id || generateId(this.type)
    this.map = options.map
    this.style = {
      strokeColor: '#1E88E5',
      strokeWeight: 2,
      strokeOpacity: 1,
      fillColor: '#1E88E5',
      fillOpacity: 0.3,
      ...options.style
    }
    this.coordinates = []
    this.editable = false
    this.visible = true
    this.googleObject = null
    this._listeners = []
  }

  /**
   * Shape type identifier (override in subclasses)
   * @returns {string}
   */
  get type() {
    return 'base'
  }

  /**
   * Get shape bounds
   * @returns {google.maps.LatLngBounds|null}
   */
  get bounds() {
    if (!this.googleObject) return null
    
    if (typeof this.googleObject.getBounds === 'function') {
      return this.googleObject.getBounds()
    }

    // Calculate bounds from coordinates
    if (this.coordinates.length === 0) return null

    const bounds = new google.maps.LatLngBounds()
    for (const coord of this.coordinates) {
      bounds.extend(new google.maps.LatLng(coord.lat, coord.lng))
    }
    return bounds
  }

  /**
   * Get shape area in square meters
   * @returns {number}
   */
  get area() {
    return 0 // Override in subclasses
  }

  /**
   * Get shape perimeter in meters
   * @returns {number}
   */
  get perimeter() {
    return 0 // Override in subclasses
  }

  /**
   * Get shape center
   * @returns {Object} {lat, lng}
   */
  getCenter() {
    return calculateCentroid(this.coordinates)
  }

  /**
   * Get edges for snapping
   * @returns {Array<Object>}
   */
  getEdges() {
    return getEdgesFromCoordinates(this.coordinates, true)
  }

  /**
   * Create the shape on the map (override in subclasses)
   * @param {Array<Object>} coordinates
   */
  create(coordinates) {
    throw new Error('create() must be implemented in subclass')
  }

  /**
   * Update shape coordinates
   * @param {Array<Object>} coordinates
   */
  update(coordinates) {
    this.coordinates = coordinates
    this._syncToGoogleObject()
  }

  /**
   * Set shape visibility
   * @param {boolean} visible
   */
  setVisible(visible) {
    this.visible = visible
    if (this.googleObject) {
      this.googleObject.setVisible(visible)
    }
  }

  /**
   * Set shape editable state
   * @param {boolean} editable
   */
  setEditable(editable) {
    this.editable = editable
    if (this.googleObject && typeof this.googleObject.setEditable === 'function') {
      this.googleObject.setEditable(editable)
    }
  }

  /**
   * Set shape style
   * @param {Object} style
   */
  setStyle(style) {
    this.style = { ...this.style, ...style }
    if (this.googleObject) {
      this.googleObject.setOptions(this.style)
    }
  }

  /**
   * Delete the shape from the map
   */
  delete() {
    this._removeListeners()
    if (this.googleObject) {
      this.googleObject.setMap(null)
      this.googleObject = null
    }
  }

  /**
   * Convert shape to GeoJSON
   * @returns {Object}
   */
  toGeoJSON() {
    return {
      type: 'Feature',
      properties: {
        id: this.id,
        shapeType: this.type,
        style: this.style
      },
      geometry: this._getGeoJSONGeometry()
    }
  }

  /**
   * Get GeoJSON geometry (override in subclasses)
   * @returns {Object}
   * @protected
   */
  _getGeoJSONGeometry() {
    return {
      type: 'Polygon',
      coordinates: [[]]
    }
  }

  /**
   * Sync internal coordinates to Google Maps object (override in subclasses)
   * @protected
   */
  _syncToGoogleObject() {
    // Override in subclasses
  }

  /**
   * Sync from Google Maps object to internal coordinates (override in subclasses)
   * @protected
   */
  _syncFromGoogleObject() {
    // Override in subclasses
  }

  /**
   * Add event listener to Google object
   * @param {string} event
   * @param {Function} callback
   * @protected
   */
  _addListener(event, callback) {
    if (this.googleObject) {
      const listener = google.maps.event.addListener(this.googleObject, event, callback)
      this._listeners.push(listener)
    }
  }

  /**
   * Remove all event listeners
   * @protected
   */
  _removeListeners() {
    for (const listener of this._listeners) {
      google.maps.event.removeListener(listener)
    }
    this._listeners = []
  }

  /**
   * Serialize shape to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      coordinates: this.coordinates,
      style: this.style,
      editable: this.editable,
      visible: this.visible
    }
  }

  /**
   * Clone the shape
   * @returns {BaseShape}
   */
  clone() {
    const ShapeClass = this.constructor
    const clone = new ShapeClass({
      map: this.map,
      style: { ...this.style }
    })
    clone.create([...this.coordinates])
    return clone
  }
}

export default BaseShape
