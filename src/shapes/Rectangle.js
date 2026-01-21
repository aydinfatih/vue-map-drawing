import { BaseShape } from './BaseShape.js'

/**
 * Rectangle shape for Google Maps
 */
export class Rectangle extends BaseShape {
  constructor(options = {}) {
    super(options)
    this.bounds = null
  }

  get type() {
    return 'rectangle'
  }

  get area() {
    if (!this.bounds) return 0

    // Calculate approximate area using coordinates
    const ne = this.bounds.getNorthEast()
    const sw = this.bounds.getSouthWest()
    
    // Width in meters (at average latitude)
    const avgLat = (ne.lat() + sw.lat()) / 2
    const width = Math.abs(ne.lng() - sw.lng()) * 111111 * Math.cos(avgLat * Math.PI / 180)
    
    // Height in meters
    const height = Math.abs(ne.lat() - sw.lat()) * 111111

    return width * height
  }

  get perimeter() {
    if (!this.bounds) return 0

    const ne = this.bounds.getNorthEast()
    const sw = this.bounds.getSouthWest()
    
    const avgLat = (ne.lat() + sw.lat()) / 2
    const width = Math.abs(ne.lng() - sw.lng()) * 111111 * Math.cos(avgLat * Math.PI / 180)
    const height = Math.abs(ne.lat() - sw.lat()) * 111111

    return 2 * (width + height)
  }

  /**
   * Get rectangle center
   * @returns {Object} {lat, lng}
   */
  getCenter() {
    if (!this.bounds) return { lat: 0, lng: 0 }
    const center = this.bounds.getCenter()
    return { lat: center.lat(), lng: center.lng() }
  }

  /**
   * Create rectangle on the map
   * @param {Object} bounds - Bounds {north, south, east, west} or LatLngBounds
   */
  create(bounds) {
    if (bounds instanceof google.maps.LatLngBounds) {
      this.bounds = bounds
    } else {
      this.bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(bounds.south, bounds.west),
        new google.maps.LatLng(bounds.north, bounds.east)
      )
    }

    this._updateCoordinates()

    this.googleObject = new google.maps.Rectangle({
      bounds: this.bounds,
      map: this.map,
      editable: this.editable,
      draggable: false,
      ...this.style
    })

    this._setupListeners()
    return this
  }

  /**
   * Update rectangle bounds
   * @param {Object} bounds
   */
  update(bounds) {
    if (bounds instanceof google.maps.LatLngBounds) {
      this.bounds = bounds
    } else {
      this.bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(bounds.south, bounds.west),
        new google.maps.LatLng(bounds.north, bounds.east)
      )
    }
    this._updateCoordinates()
    this._syncToGoogleObject()
  }

  /**
   * Update coordinates array from bounds
   * @private
   */
  _updateCoordinates() {
    if (!this.bounds) return

    const ne = this.bounds.getNorthEast()
    const sw = this.bounds.getSouthWest()

    this.coordinates = [
      { lat: ne.lat(), lng: sw.lng() }, // NW
      { lat: ne.lat(), lng: ne.lng() }, // NE
      { lat: sw.lat(), lng: ne.lng() }, // SE
      { lat: sw.lat(), lng: sw.lng() }  // SW
    ]
  }

  /**
   * Setup event listeners
   * @private
   */
  _setupListeners() {
    if (!this.googleObject) return

    this._addListener('bounds_changed', () => {
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
      this.googleObject.setBounds(this.bounds)
    }
  }

  _syncFromGoogleObject() {
    if (this.googleObject) {
      this.bounds = this.googleObject.getBounds()
      this._updateCoordinates()
    }
  }

  _getGeoJSONGeometry() {
    const coords = this.coordinates.map(c => [c.lng, c.lat])
    if (coords.length > 0) {
      coords.push(coords[0]) // Close the ring
    }

    return {
      type: 'Polygon',
      coordinates: [coords]
    }
  }

  toJSON() {
    const ne = this.bounds?.getNorthEast()
    const sw = this.bounds?.getSouthWest()

    return {
      ...super.toJSON(),
      bounds: this.bounds ? {
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng()
      } : null
    }
  }
}

export default Rectangle
