import { BaseShape } from './BaseShape.js'
import { calculatePolygonArea, calculatePolygonPerimeter } from '../utils/geometry.js'

/**
 * Polygon shape for Google Maps
 */
export class Polygon extends BaseShape {
  get type() {
    return 'polygon'
  }

  get area() {
    return calculatePolygonArea(this.coordinates)
  }

  get perimeter() {
    return calculatePolygonPerimeter(this.coordinates)
  }

  /**
   * Create polygon on the map
   * @param {Array<Object>} coordinates - Array of {lat, lng}
   */
  create(coordinates) {
    this.coordinates = coordinates

    this.googleObject = new google.maps.Polygon({
      paths: coordinates.map(c => new google.maps.LatLng(c.lat, c.lng)),
      map: this.map,
      editable: this.editable,
      draggable: false,
      ...this.style
    })

    this._setupListeners()
    return this
  }

  /**
   * Setup event listeners for path changes
   * @private
   */
  _setupListeners() {
    if (!this.googleObject) return

    const path = this.googleObject.getPath()

    // Listen for vertex changes
    this._addListener('mouseup', () => {
      this._syncFromGoogleObject()
      this._onUpdate?.()
    })

    // Listen for path changes
    google.maps.event.addListener(path, 'set_at', () => {
      this._syncFromGoogleObject()
      this._onUpdate?.()
    })

    google.maps.event.addListener(path, 'insert_at', () => {
      this._syncFromGoogleObject()
      this._onUpdate?.()
    })

    google.maps.event.addListener(path, 'remove_at', () => {
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
      const path = this.coordinates.map(c => new google.maps.LatLng(c.lat, c.lng))
      this.googleObject.setPath(path)
    }
  }

  _syncFromGoogleObject() {
    if (this.googleObject) {
      const path = this.googleObject.getPath()
      this.coordinates = path.getArray().map(latLng => ({
        lat: latLng.lat(),
        lng: latLng.lng()
      }))
    }
  }

  _getGeoJSONGeometry() {
    // GeoJSON requires closing the ring
    const coords = this.coordinates.map(c => [c.lng, c.lat])
    if (coords.length > 0) {
      coords.push(coords[0]) // Close the ring
    }

    return {
      type: 'Polygon',
      coordinates: [coords]
    }
  }
}

export default Polygon
