/**
 * HistoryManager - Manages undo/redo operations using command pattern
 */
export class HistoryManager {
  constructor(options = {}) {
    this.maxSteps = options.maxSteps || 50
    this.history = []
    this.currentIndex = -1
    this.onChange = options.onChange || null
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  get canUndo() {
    return this.currentIndex >= 0
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  get canRedo() {
    return this.currentIndex < this.history.length - 1
  }

  /**
   * Add an action to history
   * @param {Object} action - Action object with undo and redo functions
   * @param {Function} action.undo - Function to undo the action
   * @param {Function} action.redo - Function to redo the action
   * @param {string} action.type - Action type for debugging
   * @param {*} [action.data] - Optional data associated with the action
   */
  push(action) {
    // Remove any future history if we're not at the end
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1)
    }

    // Add the new action
    this.history.push(action)
    this.currentIndex++

    // Limit history size
    if (this.history.length > this.maxSteps) {
      this.history.shift()
      this.currentIndex--
    }

    this._notifyChange()
  }

  /**
   * Undo the last action
   * @returns {boolean} Whether undo was successful
   */
  undo() {
    if (!this.canUndo) {
      return false
    }

    const action = this.history[this.currentIndex]
    
    try {
      action.undo()
      this.currentIndex--
      this._notifyChange()
      return true
    } catch (error) {
      console.error('Error during undo:', error)
      return false
    }
  }

  /**
   * Redo the last undone action
   * @returns {boolean} Whether redo was successful
   */
  redo() {
    if (!this.canRedo) {
      return false
    }

    this.currentIndex++
    const action = this.history[this.currentIndex]

    try {
      action.redo()
      this._notifyChange()
      return true
    } catch (error) {
      console.error('Error during redo:', error)
      this.currentIndex--
      return false
    }
  }

  /**
   * Clear all history
   */
  clear() {
    this.history = []
    this.currentIndex = -1
    this._notifyChange()
  }

  /**
   * Get current history state
   * @returns {Object}
   */
  getState() {
    return {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      historyLength: this.history.length,
      currentIndex: this.currentIndex
    }
  }

  /**
   * Notify change callback
   * @private
   */
  _notifyChange() {
    if (this.onChange) {
      this.onChange(this.getState())
    }
  }
}

export default HistoryManager
