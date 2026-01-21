import { EventBus } from './EventBus.js'
import { HistoryManager } from './HistoryManager.js'
import { SnapEngine } from '../snapping/SnapEngine.js'
import { distanceLatLng, calculatePolygonArea } from '../utils/geometry.js'

/**
 * DrawingManager - Manages shape drawing and editing with snapping support
 */
export class DrawingManager {
  constructor(map, options = {}) {
    this.map = map
    this.options = {
      snapping: { enabled: true, threshold: 15, ...options.snapping },
      history: { enabled: true, maxSteps: 50, ...options.history },
      styles: {
        drawing: { strokeColor: '#6366f1', strokeWeight: 2, fillColor: '#6366f1', fillOpacity: 0.3 },
        completed: { strokeColor: '#22c55e', strokeWeight: 2, fillColor: '#22c55e', fillOpacity: 0.2 },
        selected: { strokeColor: '#f59e0b', strokeWeight: 3 },
        ...options.styles
      }
    }

    this.shapes = new Map()
    this.selectedShapeId = null
    this.isDrawing = false
    this.drawingType = null
    this.drawingPath = []
    this.lastSnapPoint = null
    this._idCounter = 0
    this._previewLine = null
    this._previewMarkers = []
    this._drawingListeners = []
    this._vertexMarkers = new Map()
    this._midpointMarkers = new Map()
    this._labels = new Map()
    this._shapeNameCounter = 0

    this.events = new EventBus()
    this.history = new HistoryManager({
      ...this.options.history,
      onChange: (state) => this.events.emit('history:change', state)
    })
    this.snapEngine = new SnapEngine({ map, ...this.options.snapping })
    
    if (!this.options.snapping.enabled) this.snapEngine.disable()
    
    this._setupKeyboardShortcuts()
    this._setupMapClickListener()
  }

  // ==================== DRAWING ====================

  startDrawing(type) {
    if (this.isDrawing) this.stopDrawing()
    this.isDrawing = true
    this.drawingType = type
    this.drawingPath = []
    this.lastSnapPoint = null
    this.deselectShape()
    this.map.setOptions({ draggableCursor: 'crosshair' })
    this._setupDrawingListeners()
    this.events.emit('drawing:start', { type })
  }

  stopDrawing() {
    this._cleanupDrawing()
    this.isDrawing = false
    this.drawingType = null
    this.drawingPath = []
    this.map.setOptions({ draggableCursor: null })
    this.events.emit('drawing:cancel', {})
  }

  completeDrawing() {
    if (!this.isDrawing) return
    const minPoints = { polygon: 3, polyline: 2, circle: 2, rectangle: 2 }[this.drawingType] || 2
    if (this.drawingPath.length < minPoints) return

    const shape = this._createShape()
    if (shape) {
      this._registerShape(shape)
      this.events.emit('drawing:complete', { shape: this._serialize(shape) })
    }
    this.stopDrawing()
  }

  // ==================== SHAPES ====================

  getShapes() {
    return Array.from(this.shapes.values()).map(s => this._serialize(s))
  }

  getShapeById(id) {
    const s = this.shapes.get(id)
    return s ? this._serialize(s) : undefined
  }

  deleteShape(id) {
    const shape = this.shapes.get(id)
    if (!shape) return
    const data = this._serialize(shape)
    this.history.push({
      type: 'delete',
      undo: () => this._restoreShape(data),
      redo: () => this._removeShape(id)
    })
    this._removeShape(id)
  }

  updateShapeName(id, name) {
    const shape = this.shapes.get(id)
    if (!shape) return
    
    shape.name = name
    this._updateLabel(shape)
    this.events.emit('shape:updated', { shape: this._serialize(shape) })
  }

  clearAll() {
    if (this.shapes.size === 0) return
    const all = this.getShapes()
    this.history.push({
      type: 'clear',
      undo: () => all.forEach(d => this._restoreShape(d)),
      redo: () => { 
        this.shapes.forEach((s, id) => this._removeShape(id))
      }
    })
    this.shapes.forEach((s, id) => this._removeShape(id))
    this.events.emit('shapes:cleared', {})
  }

  selectShape(id) {
    if (this.selectedShapeId === id) return
    
    if (this.selectedShapeId) {
      this._hideMarkers(this.selectedShapeId)
      const prev = this.shapes.get(this.selectedShapeId)
      if (prev) prev.obj.setOptions(this.options.styles.completed)
    }
    
    this.selectedShapeId = id
    const shape = this.shapes.get(id)
    if (shape) {
      shape.obj.setOptions(this.options.styles.selected)
      this._showMarkers(id)
      this.events.emit('shape:selected', { shape: this._serialize(shape) })
    }
  }

  deselectShape() {
    if (!this.selectedShapeId) return
    
    this._hideMarkers(this.selectedShapeId)
    const shape = this.shapes.get(this.selectedShapeId)
    if (shape) shape.obj.setOptions(this.options.styles.completed)
    
    this.selectedShapeId = null
    this.events.emit('shape:deselected', {})
  }

  // ==================== HISTORY ====================

  undo() { this.history.undo() }
  redo() { this.history.redo() }
  get canUndo() { return this.history.canUndo }
  get canRedo() { return this.history.canRedo }

  // ==================== SNAPPING ====================

  setSnapping(opts) {
    if (opts.enabled !== undefined) {
      opts.enabled ? this.snapEngine.enable() : this.snapEngine.disable()
      this.options.snapping.enabled = opts.enabled
    }
    if (opts.threshold !== undefined) {
      this.snapEngine.setThreshold(opts.threshold)
      this.options.snapping.threshold = opts.threshold
    }
  }

  isSnappingEnabled() { return this.snapEngine.isEnabled() }

  // ==================== EVENTS ====================

  on(event, cb) { return this.events.on(event, cb) }
  off(event, cb) { this.events.off(event, cb) }

  // ==================== CLEANUP ====================

  destroy() {
    this.stopDrawing()
    this._removeKeyboardShortcuts()
    this._removeMapClickListener()
    this.shapes.forEach((s, id) => this._removeShape(id))
    this._labels.forEach((label) => label.setMap(null))
    this._labels.clear()
    this.snapEngine.destroy()
    this.events.clear()
  }

  // ==================== PRIVATE ====================

  _setupDrawingListeners() {
    const click = this.map.addListener('click', (e) => {
      if (!this.isDrawing) return
      const pt = this.lastSnapPoint || { lat: e.latLng.lat(), lng: e.latLng.lng() }
      this._handleDrawingClick(pt)
    })

    const move = this.map.addListener('mousemove', (e) => {
      const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() }
      
      if (this.options.snapping.enabled) {
        const snap = this.snapEngine.findSnapPoint(pt)
        this.lastSnapPoint = snap ? snap.point : null
        this.events.emit('snap:active', { active: !!snap, point: this.lastSnapPoint })
      }
      
      if (this.drawingPath.length > 0 && (this.drawingType === 'polygon' || this.drawingType === 'polyline')) {
        this._updatePreviewLine([...this.drawingPath, this.lastSnapPoint || pt])
      }
    })

    const dblclick = this.map.addListener('dblclick', () => this.completeDrawing())
    
    this._drawingListeners = [click, move, dblclick]
  }

  _handleDrawingClick(pt) {
    if (this.drawingType === 'polygon' || this.drawingType === 'polyline') {
      this.drawingPath.push(pt)
      this._addPreviewMarker(pt)
      this._updatePreviewLine(this.drawingPath)
      this.events.emit('drawing:update', { count: this.drawingPath.length })
    } else if (this.drawingType === 'circle' || this.drawingType === 'rectangle') {
      this.drawingPath.push(pt)
      if (this.drawingPath.length === 1) {
        this._addPreviewMarker(pt)
      } else {
        this.completeDrawing()
      }
    }
  }

  _createShape() {
    const id = `shape_${++this._idCounter}`
    const name = `Shape ${++this._shapeNameCounter}`
    const style = this.options.styles.completed
    let obj, data

    if (this.drawingType === 'polygon') {
      obj = new google.maps.Polygon({ paths: this.drawingPath, map: this.map, ...style, editable: false, clickable: true })
      data = { id, name, type: 'polygon', path: [...this.drawingPath], area: calculatePolygonArea(this.drawingPath), obj }
    } else if (this.drawingType === 'polyline') {
      obj = new google.maps.Polyline({ path: this.drawingPath, map: this.map, strokeColor: style.strokeColor, strokeWeight: style.strokeWeight, editable: false, clickable: true })
      data = { id, name, type: 'polyline', path: [...this.drawingPath], area: 0, obj }
    } else if (this.drawingType === 'circle') {
      const [center, edge] = this.drawingPath
      const radius = distanceLatLng(center, edge)
      obj = new google.maps.Circle({ center, radius, map: this.map, ...style, editable: true, clickable: true })
      data = { id, name, type: 'circle', center, radius, area: Math.PI * radius * radius, obj }
    } else if (this.drawingType === 'rectangle') {
      const [p1, p2] = this.drawingPath
      const bounds = { 
        north: Math.max(p1.lat, p2.lat), 
        south: Math.min(p1.lat, p2.lat), 
        east: Math.max(p1.lng, p2.lng), 
        west: Math.min(p1.lng, p2.lng) 
      }
      obj = new google.maps.Rectangle({ bounds, map: this.map, ...style, editable: true, clickable: true })
      const w = distanceLatLng({ lat: bounds.north, lng: bounds.west }, { lat: bounds.north, lng: bounds.east })
      const h = distanceLatLng({ lat: bounds.south, lng: bounds.west }, { lat: bounds.north, lng: bounds.west })
      data = { id, name, type: 'rectangle', bounds, area: w * h, obj }
    }

    return data
  }

  _registerShape(shape) {
    this.shapes.set(shape.id, shape)
    this.snapEngine.addShape(shape.id, shape.type, shape.obj)
    
    // Click on shape to select it (prevent map click propagation)
    shape.obj.addListener('click', (e) => {
      e.stop = true // Mark event as handled
      this.selectShape(shape.id)
    })
    
    // Create vertex markers for polygon/polyline
    if (shape.type === 'polygon' || shape.type === 'polyline') {
      this._createVertexMarkers(shape)
    }
    
    // Create label for the shape
    this._createLabel(shape)
    
    const data = this._serialize(shape)
    this.history.push({
      type: 'create',
      undo: () => this._removeShape(shape.id),
      redo: () => this._restoreShape(data)
    })
    this.events.emit('shape:created', { shape: data })
  }

  _removeShape(id) {
    const shape = this.shapes.get(id)
    if (!shape) return
    
    this._removeMarkers(id)
    this._removeLabel(id)
    shape.obj.setMap(null)
    this.shapes.delete(id)
    this.snapEngine.removeShape(id)
    
    if (this.selectedShapeId === id) {
      this.selectedShapeId = null
    }
    
    this.events.emit('shape:deleted', { id })
  }

  _restoreShape(data) {
    const style = this.options.styles.completed
    let obj

    if (data.type === 'polygon') {
      obj = new google.maps.Polygon({ paths: data.path, map: this.map, ...style, editable: false, clickable: true })
    } else if (data.type === 'polyline') {
      obj = new google.maps.Polyline({ path: data.path, map: this.map, strokeColor: style.strokeColor, strokeWeight: style.strokeWeight, editable: false, clickable: true })
    } else if (data.type === 'circle') {
      obj = new google.maps.Circle({ center: data.center, radius: data.radius, map: this.map, ...style, editable: true, clickable: true })
    } else if (data.type === 'rectangle') {
      obj = new google.maps.Rectangle({ bounds: data.bounds, map: this.map, ...style, editable: true, clickable: true })
    }

    const shape = { ...data, obj }
    this.shapes.set(data.id, shape)
    this.snapEngine.addShape(data.id, data.type, obj)
    
    obj.addListener('click', (e) => {
      e.stop = true // Mark event as handled
      this.selectShape(data.id)
    })
    
    if (shape.type === 'polygon' || shape.type === 'polyline') {
      this._createVertexMarkers(shape)
    }
    
    this._createLabel(shape)
    
    this.events.emit('shape:created', { shape: this._serialize(shape) })
  }

  _serialize(shape) {
    return { 
      id: shape.id, 
      name: shape.name,
      type: shape.type, 
      path: shape.path, 
      center: shape.center, 
      radius: shape.radius, 
      bounds: shape.bounds, 
      area: shape.area 
    }
  }

  // ==================== VERTEX MARKERS ====================

  _createVertexMarkers(shape) {
    const path = shape.obj.getPath()
    const vertices = []
    const midpoints = []

    // Create vertex markers
    for (let i = 0; i < path.getLength(); i++) {
      const marker = this._createVertexMarker(shape, i)
      vertices.push(marker)
    }

    // Create midpoint markers
    const edgeCount = shape.type === 'polygon' ? path.getLength() : path.getLength() - 1
    for (let i = 0; i < edgeCount; i++) {
      const marker = this._createMidpointMarker(shape, i)
      midpoints.push(marker)
    }

    this._vertexMarkers.set(shape.id, vertices)
    this._midpointMarkers.set(shape.id, midpoints)
  }

  _createVertexMarker(shape, index) {
    const path = shape.obj.getPath()
    const position = path.getAt(index)

    const marker = new google.maps.Marker({
      position,
      map: this.map,
      draggable: true,
      visible: false,
      cursor: 'move',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#ffffff',
        fillOpacity: 1,
        strokeColor: this.options.styles.completed.strokeColor,
        strokeWeight: 2
      },
      zIndex: 1000
    })

    marker.addListener('mousedown', (e) => {
      e.stop = true // Prevent map click
    })

    marker.addListener('drag', (e) => {
      const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() }
      const snap = this.options.snapping.enabled ? this.snapEngine.findSnapPoint(pt, shape.id) : null
      
      if (snap) {
        marker.setPosition(snap.point)
        path.setAt(index, new google.maps.LatLng(snap.point.lat, snap.point.lng))
        this.events.emit('snap:active', { active: true, point: snap.point })
      } else {
        path.setAt(index, e.latLng)
        this.snapEngine.hideIndicator()
        this.events.emit('snap:active', { active: false })
      }
      
      this._updateMidpointPositions(shape)
    })

    marker.addListener('dragend', () => {
      this._updateShapeData(shape)
      this.snapEngine.hideIndicator()
      this.events.emit('snap:active', { active: false })
    })

    return marker
  }

  _createMidpointMarker(shape, edgeIndex) {
    const path = shape.obj.getPath()
    const p1 = path.getAt(edgeIndex)
    const p2 = path.getAt((edgeIndex + 1) % path.getLength())
    
    const marker = new google.maps.Marker({
      position: { lat: (p1.lat() + p2.lat()) / 2, lng: (p1.lng() + p2.lng()) / 2 },
      map: this.map,
      draggable: true,
      visible: false,
      cursor: 'pointer',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: this.options.styles.completed.strokeColor,
        fillOpacity: 0.7,
        strokeColor: '#ffffff',
        strokeWeight: 2
      },
      zIndex: 999
    })

    let insertedIndex = null

    marker.addListener('mousedown', (e) => {
      e.stop = true // Prevent map click
    })

    marker.addListener('dragstart', () => {
      // Insert new vertex at the start of drag
      insertedIndex = edgeIndex + 1
      path.insertAt(insertedIndex, marker.getPosition())
    })

    marker.addListener('drag', (e) => {
      if (insertedIndex === null) return
      
      const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() }
      const snap = this.options.snapping.enabled ? this.snapEngine.findSnapPoint(pt, shape.id) : null
      
      if (snap) {
        marker.setPosition(snap.point)
        path.setAt(insertedIndex, new google.maps.LatLng(snap.point.lat, snap.point.lng))
        this.events.emit('snap:active', { active: true, point: snap.point })
      } else {
        path.setAt(insertedIndex, e.latLng)
        this.snapEngine.hideIndicator()
        this.events.emit('snap:active', { active: false })
      }
    })

    marker.addListener('dragend', () => {
      // Rebuild markers after drag is complete
      this._rebuildMarkers(shape)
      insertedIndex = null
      this.snapEngine.hideIndicator()
      this.events.emit('snap:active', { active: false })
    })

    return marker
  }

  _updateMidpointPositions(shape) {
    const path = shape.obj.getPath()
    const midpoints = this._midpointMarkers.get(shape.id)
    if (!midpoints) return

    for (let i = 0; i < midpoints.length; i++) {
      const p1 = path.getAt(i)
      const p2 = path.getAt((i + 1) % path.getLength())
      midpoints[i].setPosition({ lat: (p1.lat() + p2.lat()) / 2, lng: (p1.lng() + p2.lng()) / 2 })
    }
  }

  _rebuildMarkers(shape) {
    const wasSelected = this.selectedShapeId === shape.id
    this._removeMarkers(shape.id)
    this._createVertexMarkers(shape)
    if (wasSelected) {
      this._showMarkers(shape.id)
    }
    this._updateShapeData(shape)
  }

  _updateShapeData(shape) {
    const path = shape.obj.getPath()
    shape.path = path.getArray().map(p => ({ lat: p.lat(), lng: p.lng() }))
    if (shape.type === 'polygon') {
      shape.area = calculatePolygonArea(shape.path)
    }
    this.snapEngine.removeShape(shape.id)
    this.snapEngine.addShape(shape.id, shape.type, shape.obj)
    this._updateLabel(shape)
    this.events.emit('shape:updated', { shape: this._serialize(shape) })
  }

  _showMarkers(shapeId) {
    this._vertexMarkers.get(shapeId)?.forEach(m => m.setVisible(true))
    this._midpointMarkers.get(shapeId)?.forEach(m => m.setVisible(true))
  }

  _hideMarkers(shapeId) {
    this._vertexMarkers.get(shapeId)?.forEach(m => m.setVisible(false))
    this._midpointMarkers.get(shapeId)?.forEach(m => m.setVisible(false))
  }

  _removeMarkers(shapeId) {
    this._vertexMarkers.get(shapeId)?.forEach(m => m.setMap(null))
    this._midpointMarkers.get(shapeId)?.forEach(m => m.setMap(null))
    this._vertexMarkers.delete(shapeId)
    this._midpointMarkers.delete(shapeId)
  }

  // ==================== PREVIEW ====================

  _addPreviewMarker(pt) {
    const m = new google.maps.Marker({
      position: pt,
      map: this.map,
      clickable: false,
      zIndex: 1000,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: this.options.styles.drawing.strokeColor,
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2
      }
    })
    this._previewMarkers.push(m)
  }

  _updatePreviewLine(path) {
    if (!this._previewLine) {
      this._previewLine = new google.maps.Polyline({
        map: this.map,
        clickable: false,
        zIndex: 999,
        strokeColor: this.options.styles.drawing.strokeColor,
        strokeWeight: this.options.styles.drawing.strokeWeight,
        strokeOpacity: 0.8
      })
    }
    this._previewLine.setPath(path)
  }

  _cleanupDrawing() {
    this._drawingListeners.forEach(l => google.maps.event.removeListener(l))
    this._drawingListeners = []
    if (this._previewLine) {
      this._previewLine.setMap(null)
      this._previewLine = null
    }
    this._previewMarkers.forEach(m => m.setMap(null))
    this._previewMarkers = []
    this.snapEngine.hideIndicator()
    this.lastSnapPoint = null
  }

  // ==================== MAP LISTENERS ====================

  _setupMapClickListener() {
    this._mapClickListener = this.map.addListener('click', (e) => {
      // If shape was clicked, don't deselect
      if (!this.isDrawing && !e.stop) {
        this.deselectShape()
      }
    })
  }

  _removeMapClickListener() {
    if (this._mapClickListener) {
      google.maps.event.removeListener(this._mapClickListener)
      this._mapClickListener = null
    }
  }

  // ==================== KEYBOARD ====================

  _setupKeyboardShortcuts() {
    this._keyHandler = (e) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo() }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); this.redo() }
      if (e.key === 'Escape' && this.isDrawing) this.stopDrawing()
      if (e.key === 'Enter' && this.isDrawing) this.completeDrawing()
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedShapeId) { 
        e.preventDefault()
        this.deleteShape(this.selectedShapeId)
      }
    }
    document.addEventListener('keydown', this._keyHandler)
  }

  _removeKeyboardShortcuts() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler)
    }
  }

  // ==================== LABELS ====================

  _createLabel(shape) {
    const position = this._getShapeCenter(shape)
    
    const label = new google.maps.Marker({
      position,
      map: this.map,
      clickable: false,
      zIndex: 10000,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0, // Invisible icon
      },
      label: {
        text: shape.name || '',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: 'bold',
        className: 'shape-label'
      }
    })

    this._labels.set(shape.id, label)
  }

  _updateLabel(shape) {
    const label = this._labels.get(shape.id)
    if (!label) return

    const position = this._getShapeCenter(shape)
    label.setPosition(position)
    
    if (shape.name !== undefined) {
      label.setLabel({
        text: shape.name || '',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: 'bold',
        className: 'shape-label'
      })
    }
  }

  _removeLabel(id) {
    const label = this._labels.get(id)
    if (label) {
      label.setMap(null)
      this._labels.delete(id)
    }
  }

  _getShapeCenter(shape) {
    if (shape.type === 'circle') {
      return shape.center
    } else if (shape.type === 'rectangle') {
      const { north, south, east, west } = shape.bounds
      return {
        lat: (north + south) / 2,
        lng: (east + west) / 2
      }
    } else if (shape.type === 'polygon' || shape.type === 'polyline') {
      // Calculate centroid
      const path = shape.path || shape.obj.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }))
      if (path.length === 0) return { lat: 0, lng: 0 }
      
      let latSum = 0, lngSum = 0
      path.forEach(p => {
        latSum += p.lat
        lngSum += p.lng
      })
      
      return {
        lat: latSum / path.length,
        lng: lngSum / path.length
      }
    }
    
    return { lat: 0, lng: 0 }
  }
}

export default DrawingManager
