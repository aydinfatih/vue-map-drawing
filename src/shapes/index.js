export { BaseShape } from './BaseShape.js'
export { Polygon } from './Polygon.js'
export { Circle } from './Circle.js'
export { Rectangle } from './Rectangle.js'
export { Polyline } from './Polyline.js'

/**
 * Shape factory - creates shape instances by type
 * @param {string} type - Shape type
 * @param {Object} options - Shape options
 * @returns {BaseShape}
 */
export function createShape(type, options) {
  switch (type) {
    case 'polygon':
      return new Polygon(options)
    case 'circle':
      return new Circle(options)
    case 'rectangle':
      return new Rectangle(options)
    case 'polyline':
      return new Polyline(options)
    default:
      throw new Error(`Unknown shape type: ${type}`)
  }
}
