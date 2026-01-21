# Vue Map Drawing

A Vue 3 library for drawing polygons, circles, rectangles, and custom shapes on Google Maps with edge snapping and undo/redo support.

## Features

- **Vue 3 Composition API**: Full integration with reactive composables
- **Shape Drawing**: Polygon, Circle, Rectangle, Polyline and custom shapes
- **Edge Snapping**: Automatic snapping to edges of other shapes
- **Editing**: Edit drawn shapes by dragging vertices
- **Shape Labels**: Display and edit custom names on shapes
- **Deletion**: Delete shapes with a single click or keyboard
- **Undo/Redo**: Undo and redo all operations (Ctrl+Z / Ctrl+Y)
- **TypeScript Ready**: Full type support

## Installation

```bash
npm install vue-map-drawing
```

## Requirements

- Vue 3.3+
- Google Maps JavaScript API

## Quick Start

### 1. Google Maps API Setup (Async Loading - Best Practice)

```html
<!-- index.html -->
<script>
  (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
    key: "YOUR_API_KEY",
    v: "weekly",
  });
</script>
```

Or use the Dynamic Library Import (recommended for Vue):

```javascript
// main.js
import { createApp } from 'vue'
import App from './App.vue'

// Load Google Maps API asynchronously
async function loadGoogleMaps() {
  const { Map } = await google.maps.importLibrary("maps")
  const { Polygon, Circle, Rectangle, Polyline, Marker } = await google.maps.importLibrary("marker")
  return { Map, Polygon, Circle, Rectangle, Polyline, Marker }
}

createApp(App).mount('#app')
```

### 2. Basic Usage

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { useMapDrawing } from 'vue-map-drawing'

const mapContainer = ref(null)
const map = ref(null)

// Initialize drawing after map is ready
onMounted(() => {
  map.value = new google.maps.Map(mapContainer.value, {
    center: { lat: 41.0082, lng: 28.9784 },
    zoom: 12
  })
})

const {
  // State
  shapes,
  activeShape,
  isDrawing,
  canUndo,
  canRedo,
  
  // Methods
  startDrawing,
  stopDrawing,
  undo,
  redo,
  deleteShape,
  clearAll
} = useMapDrawing(map, {
  snapping: {
    enabled: true,
    threshold: 10
  }
})
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map"></div>
    
    <div class="toolbar">
      <button @click="startDrawing('polygon')" :disabled="isDrawing">
        Polygon
      </button>
      <button @click="startDrawing('circle')" :disabled="isDrawing">
        Circle
      </button>
      <button @click="startDrawing('rectangle')" :disabled="isDrawing">
        Rectangle
      </button>
      <button @click="stopDrawing" :disabled="!isDrawing">
        Cancel
      </button>
      
      <div class="divider"></div>
      
      <button @click="undo" :disabled="!canUndo">Undo</button>
      <button @click="redo" :disabled="!canRedo">Redo</button>
      <button @click="clearAll" :disabled="shapes.length === 0">
        Clear All
      </button>
    </div>
    
    <div class="shape-list">
      <div 
        v-for="shape in shapes" 
        :key="shape.id"
        class="shape-item"
        :class="{ active: activeShape?.id === shape.id }"
      >
        {{ shape.type }} - {{ shape.id }}
        <button @click="deleteShape(shape.id)">Delete</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100vh;
}

.map {
  width: 100%;
  height: 100%;
}

.toolbar {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 8px;
  padding: 10px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

.divider {
  width: 1px;
  background: #ddd;
  margin: 0 4px;
}

.shape-list {
  position: absolute;
  top: 70px;
  left: 10px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  max-height: 300px;
  overflow-y: auto;
}

.shape-item {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.shape-item.active {
  background: #e3f2fd;
}
</style>
```

## API Reference

### useMapDrawing(map, options)

Main composable. Used with a Google Maps instance.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `map` | `Ref<google.maps.Map>` | Google Maps instance ref |
| `options` | `DrawingOptions` | Configuration options |

#### Options

```typescript
interface DrawingOptions {
  snapping?: {
    enabled?: boolean       // Default: true
    threshold?: number      // Default: 10 (pixels)
    showIndicator?: boolean // Default: true
  }
  history?: {
    enabled?: boolean       // Default: true
    maxSteps?: number       // Default: 50
  }
  styles?: {
    drawing?: ShapeStyle    // While drawing
    completed?: ShapeStyle  // Completed shape
    hover?: ShapeStyle      // Hover state
    selected?: ShapeStyle   // Selected state
  }
}

interface ShapeStyle {
  strokeColor?: string
  strokeWeight?: number
  strokeOpacity?: number
  fillColor?: string
  fillOpacity?: number
}
```

#### Return Values (Reactive)

```javascript
// Reactive State
shapes              // All shapes array
activeShape         // Active/selected shape or null
isDrawing           // Is drawing mode active
drawingType         // Active drawing type ('polygon', 'circle', etc.)
drawingHint         // Helper text for current drawing mode
pointCount          // Number of points drawn
canUndo             // Can undo
canRedo             // Can redo
snapActive          // Is snap point detected
snappingEnabled     // Is snapping enabled

// Drawing Methods
startDrawing(type)  // Start drawing ('polygon', 'circle', 'rectangle', 'polyline')
stopDrawing()       // Cancel current drawing
completeDrawing()   // Complete current drawing

// Shape Methods
deleteShape(id)     // Delete shape by ID
deleteActiveShape() // Delete currently active shape
clearAll()          // Delete all shapes
selectShape(id)     // Select a shape
deselectShape()     // Deselect current shape
getShapeById(id)    // Get shape data by ID
updateShapeName(id, name) // Update shape label

// History
undo()              // Undo last action
redo()              // Redo last undone action

// Snapping
setSnapping({ enabled, threshold }) // Configure snapping
toggleSnapping()    // Toggle snapping on/off

// Event Callbacks
onShapeCreated(callback)  // Called when shape is created
onShapeUpdated(callback)  // Called when shape is modified
onShapeDeleted(callback)  // Called when shape is deleted
onSnapDetected(callback)  // Called when snap point is detected
```

### Shape Object

```javascript
// Shape object structure
{
  id: 'shape_1',           // Unique identifier
  name: 'Shape 1',         // Custom label (editable)
  type: 'polygon',         // 'polygon' | 'circle' | 'rectangle' | 'polyline'
  path: [...],             // Array of {lat, lng} for polygon/polyline
  center: { lat, lng },    // Center point for circle
  radius: 1000,            // Radius in meters for circle
  bounds: { north, south, east, west }, // Bounds for rectangle
  area: 50000              // Area in square meters
}
```

## Composables

### useMapDrawing

Main composable - detailed above.

### useShapeStyle

Helper composable for shape styling.

```vue
<script setup>
import { useMapDrawing, useShapeStyle } from 'vue-map-drawing'

const { shapes, activeShape } = useMapDrawing(map)

const { 
  currentStyle,
  setStrokeColor,
  setFillColor,
  setStrokeWeight,
  resetStyle
} = useShapeStyle(activeShape)
</script>

<template>
  <div v-if="activeShape" class="style-panel">
    <label>
      Stroke Color:
      <input type="color" :value="currentStyle.strokeColor" @input="setStrokeColor($event.target.value)">
    </label>
    <label>
      Fill Color:
      <input type="color" :value="currentStyle.fillColor" @input="setFillColor($event.target.value)">
    </label>
    <label>
      Stroke Weight:
      <input type="range" min="1" max="10" :value="currentStyle.strokeWeight" @input="setStrokeWeight(+$event.target.value)">
    </label>
    <button @click="resetStyle">Reset to Default</button>
  </div>
</template>
```

### useDrawingEvents

Composable for event handling.

```vue
<script setup>
import { useMapDrawing, useDrawingEvents } from 'vue-map-drawing'

const drawing = useMapDrawing(map)

useDrawingEvents(drawing, {
  onShapeCreated(shape) {
    console.log('New shape:', shape)
    // Save to API, etc.
  },
  onShapeUpdated(shape) {
    console.log('Shape updated:', shape)
  },
  onShapeDeleted(shape) {
    console.log('Shape deleted:', shape)
  }
})
</script>
```

## Edge Snapping

Edge snapping automatically snaps the cursor to edges of other shapes while drawing.

### How It Works

```
   ┌─────────────────┐
   │                 │
   │    Shape 1      │
   │                 │
   └────────●────────┘  ← Snap point
            │
            │ (snap indicator)
            │
            ○ ← Mouse cursor
```

1. When the mouse approaches an edge within threshold distance, snap activates
2. The point is automatically projected onto the edge
3. Visual indicator provides feedback to the user

### Monitoring Snap State

```vue
<script setup>
const { snapActive, onSnapDetected } = useMapDrawing(map, {
  snapping: { enabled: true, threshold: 15 }
})

onSnapDetected(({ point, edge, distance }) => {
  console.log(`Snap: ${distance.toFixed(1)}px away`)
})
</script>

<template>
  <div class="snap-indicator" v-if="snapActive">
    🎯 Snap active
  </div>
</template>
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Z` | Undo |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo |
| `Delete` / `Backspace` | Delete selected shape |
| `Escape` | Cancel active drawing |
| `Enter` | Complete polygon/polyline drawing |

## Examples

### Example 1: Simple Map Editor

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { useMapDrawing } from 'vue-map-drawing'

const mapRef = ref(null)
const map = ref(null)

onMounted(() => {
  map.value = new google.maps.Map(mapRef.value, {
    center: { lat: 41.0082, lng: 28.9784 },
    zoom: 14
  })
})

const { shapes, startDrawing, clearAll } = useMapDrawing(map)
</script>

<template>
  <div ref="mapRef" style="width: 100%; height: 500px;"></div>
  <button @click="startDrawing('polygon')">Draw Polygon</button>
  <p>Total shapes: {{ shapes.length }}</p>
</template>
```

### Example 2: Area Selector

```vue
<script setup>
import { computed } from 'vue'
import { useMapDrawing } from 'vue-map-drawing'

const { shapes, startDrawing, activeShape } = useMapDrawing(map, {
  styles: {
    completed: {
      strokeColor: '#2196F3',
      fillColor: '#2196F3',
      fillOpacity: 0.2
    }
  }
})

const totalArea = computed(() => {
  return shapes.value.reduce((sum, s) => sum + s.area, 0)
})

const selectedArea = computed(() => {
  return activeShape.value?.area || 0
})
</script>

<template>
  <div class="info-panel">
    <p>Total Area: {{ (totalArea / 1000000).toFixed(2) }} km²</p>
    <p v-if="activeShape">Selected Area: {{ (selectedArea / 1000000).toFixed(4) }} km²</p>
  </div>
</template>
```

### Example 3: Shape Labels

```vue
<script setup>
import { ref } from 'vue'
import { useMapDrawing } from 'vue-map-drawing'

const { shapes, activeShape, selectShape, updateShapeName } = useMapDrawing(map)

const showNameEditor = ref(false)
const editingName = ref('')

function editName(shape) {
  editingName.value = shape.name
  showNameEditor.value = true
  selectShape(shape.id)
}

function saveName() {
  if (activeShape.value && editingName.value.trim()) {
    updateShapeName(activeShape.value.id, editingName.value.trim())
    showNameEditor.value = false
  }
}
</script>

<template>
  <!-- Shape list with labels displayed on map -->
  <div class="shapes-panel">
    <div 
      v-for="shape in shapes" 
      :key="shape.id"
      class="shape-item"
    >
      <span>{{ shape.name }}</span>
      <span>{{ shape.type }}</span>
      <button @click="editName(shape)">✏️ Edit Name</button>
    </div>
  </div>

  <!-- Name editor modal -->
  <div v-if="showNameEditor" class="modal">
    <input v-model="editingName" placeholder="Enter shape name" @keyup.enter="saveName" />
    <button @click="saveName">Save</button>
    <button @click="showNameEditor = false">Cancel</button>
  </div>
</template>
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
# vue-map-drawing
