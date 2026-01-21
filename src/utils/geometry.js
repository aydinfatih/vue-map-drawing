/**
 * Geometry utility functions for map drawing operations
 */

/**
 * Calculate distance between two points in pixels
 * @param {Object} p1 - First point {x, y}
 * @param {Object} p2 - Second point {x, y}
 * @returns {number} Distance in pixels
 */
export function distancePixels(p1, p2) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate distance between two LatLng points using Haversine formula
 * @param {Object} p1 - First point {lat, lng}
 * @param {Object} p2 - Second point {lat, lng}
 * @returns {number} Distance in meters
 */
export function distanceLatLng(p1, p2) {
  const R = 6371000 // Earth's radius in meters
  const lat1 = toRadians(p1.lat)
  const lat2 = toRadians(p2.lat)
  const deltaLat = toRadians(p2.lat - p1.lat)
  const deltaLng = toRadians(p2.lng - p1.lng)

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  return R * c
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number}
 */
export function toRadians(degrees) {
  return degrees * (Math.PI / 180)
}

/**
 * Convert radians to degrees
 * @param {number} radians
 * @returns {number}
 */
export function toDegrees(radians) {
  return radians * (180 / Math.PI)
}

/**
 * Project a point onto a line segment
 * @param {Object} point - Point to project {x, y}
 * @param {Object} lineStart - Line start point {x, y}
 * @param {Object} lineEnd - Line end point {x, y}
 * @returns {Object} Projected point and distance info
 */
export function projectPointToLine(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    // Line segment is actually a point
    return {
      point: { x: lineStart.x, y: lineStart.y },
      distance: distancePixels(point, lineStart),
      t: 0
    }
  }

  // Calculate projection parameter t
  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared

  // Clamp t to [0, 1] to stay within line segment
  t = Math.max(0, Math.min(1, t))

  // Calculate projected point
  const projected = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy
  }

  return {
    point: projected,
    distance: distancePixels(point, projected),
    t: t
  }
}

/**
 * Project a LatLng point onto a LatLng line segment
 * @param {Object} point - Point to project {lat, lng}
 * @param {Object} lineStart - Line start {lat, lng}
 * @param {Object} lineEnd - Line end {lat, lng}
 * @param {google.maps.Map} map - Google Maps instance for projection
 * @returns {Object} Projected point info
 */
export function projectLatLngToLine(point, lineStart, lineEnd, map) {
  const projection = map.getProjection()
  
  // Convert to pixel coordinates
  const pointPixel = projection.fromLatLngToPoint(new google.maps.LatLng(point.lat, point.lng))
  const startPixel = projection.fromLatLngToPoint(new google.maps.LatLng(lineStart.lat, lineStart.lng))
  const endPixel = projection.fromLatLngToPoint(new google.maps.LatLng(lineEnd.lat, lineEnd.lng))

  // Project in pixel space
  const result = projectPointToLine(
    { x: pointPixel.x, y: pointPixel.y },
    { x: startPixel.x, y: startPixel.y },
    { x: endPixel.x, y: endPixel.y }
  )

  // Convert back to LatLng
  const projectedLatLng = projection.fromPointToLatLng(
    new google.maps.Point(result.point.x, result.point.y)
  )

  return {
    point: { lat: projectedLatLng.lat(), lng: projectedLatLng.lng() },
    distance: result.distance,
    t: result.t
  }
}

/**
 * Calculate the area of a polygon using Shoelace formula
 * @param {Array<Object>} coordinates - Array of {lat, lng} points
 * @returns {number} Area in square meters
 */
export function calculatePolygonArea(coordinates) {
  if (coordinates.length < 3) return 0

  // Use spherical excess formula for accurate geodesic area
  const R = 6371000 // Earth's radius in meters
  let total = 0

  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length
    const p1 = coordinates[i]
    const p2 = coordinates[j]
    
    total += toRadians(p2.lng - p1.lng) * 
             (2 + Math.sin(toRadians(p1.lat)) + Math.sin(toRadians(p2.lat)))
  }

  return Math.abs(total * R * R / 2)
}

/**
 * Calculate the perimeter of a polygon
 * @param {Array<Object>} coordinates - Array of {lat, lng} points
 * @returns {number} Perimeter in meters
 */
export function calculatePolygonPerimeter(coordinates) {
  if (coordinates.length < 2) return 0

  let perimeter = 0
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length
    perimeter += distanceLatLng(coordinates[i], coordinates[j])
  }

  return perimeter
}

/**
 * Calculate the centroid of a polygon
 * @param {Array<Object>} coordinates - Array of {lat, lng} points
 * @returns {Object} Centroid {lat, lng}
 */
export function calculateCentroid(coordinates) {
  if (coordinates.length === 0) return { lat: 0, lng: 0 }

  let sumLat = 0
  let sumLng = 0

  for (const coord of coordinates) {
    sumLat += coord.lat
    sumLng += coord.lng
  }

  return {
    lat: sumLat / coordinates.length,
    lng: sumLng / coordinates.length
  }
}

/**
 * Get edges from polygon coordinates
 * @param {Array<Object>} coordinates - Array of {lat, lng} points
 * @param {boolean} [closed=true] - Whether the polygon is closed
 * @returns {Array<Object>} Array of edges {start, end, index}
 */
export function getEdgesFromCoordinates(coordinates, closed = true) {
  const edges = []
  const length = closed ? coordinates.length : coordinates.length - 1

  for (let i = 0; i < length; i++) {
    const j = (i + 1) % coordinates.length
    edges.push({
      start: coordinates[i],
      end: coordinates[j],
      index: i
    })
  }

  return edges
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param {Object} point - Point to check {lat, lng}
 * @param {Array<Object>} polygon - Polygon coordinates
 * @returns {boolean}
 */
export function isPointInPolygon(point, polygon) {
  let inside = false
  const x = point.lng
  const y = point.lat

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng
    const yi = polygon[i].lat
    const xj = polygon[j].lng
    const yj = polygon[j].lat

    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    
    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Generate a unique ID
 * @param {string} [prefix='shape'] - ID prefix
 * @returns {string}
 */
export function generateId(prefix = 'shape') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
