import { BaseShape } from './BaseShape.js'
import { distanceLatLng, getEdgesFromCoordinates } from '../utils/geometry.js'

/**
 * Polyline shape for Google Maps
 */
export class Polyline extends BaseShape {
  get type() {
    return 'polyline'
  }

  get area() {
    return 0 // Polylines don't have area
  }

  get perimeter() {
    // For polyline, perimeter is the total length
    return this.getLength()
  }

  /**
   * Get total length of the polyline in meters
   * @returns {number}
   */
  getLength() {
    if (this.coordinates.length < 2) return 0

    let length = 0
    for (let i = 0; i < this.coordinates.length - 1; i++) {
      length += distanceLatLng(this.coordinates[i], this.coordinates[i + 1])
    }
    return length
  }

  /**
   * Get edges for snapping (polyline is not closed)
   * @returns {Array<Object>}
   */
  getEdges() {
    return getEdgesFromCoordinates(this.coordinates, false)
  }

  /**
   * Create polyline on the map
   * @param {Array<Object>} coordinates - Array of {lat, lng}
   */
  create(coordinates) {
    this.coordinates = coordinates

    // Polyline doesn't have fill
    const polylineStyle = {
      strokeColor: this.style.strokeColor,
      strokeWeight: this.style.strokeWeight,
      strokeOpacity: this.style.strokeOpacity
    }

    this.googleObject = new google.maps.Polyline({
      path: coordinates.map(c => new google.maps.LatLng(c.lat, c.lng)),
      map: this.map,
      editable: this.editable,
      draggable: false,
      ...polylineStyle
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

    this._addListener('mouseup', () => {
      this._syncFromGoogleObject()
      this._onUpdate?.()
    })

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
    return {
      type: 'LineString',
      coordinates: this.coordinates.map(c => [c.lng, c.lat])
    }
  }
}

export default Polyline
