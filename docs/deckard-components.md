# Deckard Experience - Component Catalog

## Overview
The Deckard experience now includes 5 custom React components for testing and debugging the custom component system.

## Available Components

### 1. planetary-orbits
**File:** `resources/components/planetary-orbits.jsx`  
**Description:** A simple physics demonstration that shows the planets rotating around the sun with labels and orbits.  
**Features:**
- Canvas-based 2D rendering
- 8 planets with accurate relative orbital distances
- Animated orbital motion
- Planet labels
- Pause/Play controls

**Usage:**
```javascript
customComponent({
  action: 'show',
  componentId: 'planetary-orbits'
})
```

---

### 2. planetary-orbits-with-controls
**File:** `resources/components/planetary-orbits-with-controls.jsx`  
**Description:** An enhanced version of the planetary orbits simulation with speed controls and date display.  
**Features:**
- Speed multiplier slider (0.1x - 10x)
- Simulated date tracking
- Pause/Play animation controls

**Usage:**
```javascript
customComponent({
  action: 'show',
  componentId: 'planetary-orbits-with-controls'
})
```

**Note:** This component uses the Slider component which is now properly available in the ComponentManager scope.

---

### 3. bouncing-ball-3d
**File:** `resources/components/bouncing-ball-3d.jsx`  
**CSS:** `resources/components/bouncing-ball-3d.css`  
**Description:** A 3D physics simulation of a bouncing ball with gravity and collision detection using Three.js.  
**Features:**
- Full 3D rendering with Three.js
- Realistic physics (gravity, restitution)
- Ground plane visualization
- Bounce counter tracking
- Interactive controls for gravity and restitution

**State Management:**
- `gravity`: Gravity value (default: -9.8)
- `restitution`: Coefficient of restitution/bounciness (default: 0.7)
- `bounceCount`: Number of bounces tracked

**Usage:**
```javascript
customComponent({
  action: 'show',
  componentId: 'bouncing-ball-3d',
  initialState: {
    gravity: -9.8,
    restitution: 0.7
  }
})
```

---

### 4. simple-counter
**File:** `resources/components/simple-counter.jsx`  
**CSS:** `resources/components/simple-counter.css`  
**Description:** A basic counter component with increment and decrement buttons for testing component state management.  
**Features:**
- Simple increment/decrement buttons
- Display current count
- State synchronization testing
- Uses shadcn/ui components (Button, Card)

**State Management:**
- `count`: Current counter value

**Usage:**
```javascript
customComponent({
  action: 'show',
  componentId: 'simple-counter',
  initialState: {
    count: 0
  }
})
```

**Perfect for:**
- Testing state management
- Verifying component mounting/unmounting
- Debugging component communication

---

### 5. quiz-component
**File:** `resources/components/quiz-component.jsx`  
**CSS:** `resources/components/quiz-component.css`  
**Description:** A multiple choice quiz component with 3 questions, immediate feedback, and score tracking.  
**Features:**
- 3 pre-configured multiple choice questions
- Immediate feedback (correct/incorrect)
- Total score tracking
- Submit button for completion

**State Management:**
- `questions`: Array of question objects with user answers and feedback
- `totalCorrect`: Number of correctly answered questions

**Usage:**
```javascript
customComponent({
  action: 'show',
  componentId: 'quiz-component'
})
```

**Events:**
- Fires `onSubmit` event when user completes the quiz
- Tracks state changes for each answer selection

---

## Component System Architecture

### ComponentManager Enhancements
All components now have access to the following shadcn/ui components in their scope:
- Basic: Button, Input, Textarea, Label
- Layout: Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription
- Forms: Select, Slider, Toggle, Progress
- Dialogs: Dialog, AlertDialog, Tooltip
- Menus: DropdownMenu, ContextMenu
- Advanced: Chart components, HoverCard, ScrollArea, Toast
- **Total: 105 UI components available**

### External Libraries Available
- **React**: Full React library with all standard hooks
- **Three.js**: For 3D graphics (used by bouncing-ball-3d)
- **math.js**: For mathematical operations
- **lodash**: For utility functions
- **Recharts**: For charts and graphs

### State Management Pattern
All components follow the standard Primer component pattern:
```javascript
export default function MyComponent({ 
  initialState = {},      // Initial state from agent
  externalState,          // External updates from agent
  onStateChange,          // Callback for state changes
  onEvent,                // Callback for custom events
  onSubmit,               // Callback for submission
  instanceId              // Unique instance identifier
}) {
  // Component implementation
}
```

---

## Testing the Components

### Using the customComponent Tool

1. **Show a component:**
```javascript
customComponent({
  action: 'show',
  componentId: 'simple-counter'
})
```

2. **Update component state:**
```javascript
customComponent({
  action: 'update',
  instanceId: 'component-abc123',
  state: { count: 5 }
})
```

3. **Hide a component:**
```javascript
customComponent({
  action: 'hide',
  instanceId: 'component-abc123'
})
```

4. **List available components:**
```javascript
customComponent({
  action: 'list'
})
```

---

## Files Modified

### Primary Changes
1. **ComponentManager.tsx** - Added 62+ new shadcn/ui components to scope
2. **types.ts** - Updated ComponentScope interface with all new component types
3. **slider.tsx** - Installed shadcn Slider component
4. **deckard/experience.json** - Fixed validation issues and added all 5 components

### Component Files
All component files are located in: `/storage/deckard/resources/components/`
- `planetary-orbits.jsx`
- `planetary-orbits-with-controls.jsx`
- `bouncing-ball-3d.jsx` + `.css`
- `simple-counter.jsx` + `.css`
- `quiz-component.jsx` + `.css`

---

## Next Steps

1. ✅ All components are registered in experience.json
2. ✅ All required UI components are in ComponentManager scope
3. ✅ Experience validation is passing
4. 🔄 Test each component in the Deckard experience
5. 🔄 Fix any runtime issues (e.g., Slider API in planetary-orbits-with-controls)

---

## Known Issues

### planetary-orbits-with-controls
The Slider component usage needs to be updated to match the correct API:
- Current: `value={speed}` and `onChange={setSpeed}`
- Should be: `value={[speed]}` and `onValueChange={(val) => setSpeed(val[0])}`

This will cause a runtime error when the component is displayed, but the component will load without the "Slider is not defined" error.
