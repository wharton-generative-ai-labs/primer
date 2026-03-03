# Custom Components Demo - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER EXPERIENCE                          │
│                    /play/component-demo                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    COORDINATOR AGENT (Main)                      │
│                                                                  │
│  "Welcome! Choose a demo:                                        │
│   1. Trigonometry    3. Chemistry                               │
│   2. Biology         4. Physics"                                 │
│                                                                  │
│  Tools: builtin (includes agent transfer)                        │
└────────┬────────────┬────────────┬────────────┬─────────────────┘
         │            │            │            │
         │ transfer   │ transfer   │ transfer   │ transfer
         ▼            ▼            ▼            ▼
    ┌────────┐   ┌─────────┐  ┌──────────┐  ┌─────────┐
    │ Demo   │   │ Biology │  │Chemistry │  │ Physics │
    │ Agent  │   │  Tutor  │  │  Tutor   │  │  Tutor  │
    └────┬───┘   └────┬────┘  └────┬─────┘  └────┬────┘
         │            │            │              │
         │ customComponent tool    │              │
         ▼            ▼            ▼              ▼
    ┌────────────────────────────────────────────────┐
    │        CUSTOM COMPONENT RUNTIME                │
    │                                                │
    │  • Babel JSX Compilation                       │
    │  • React Component Execution                   │
    │  • Bidirectional State Sync                    │
    │  • Event System                                │
    └────────────────────────────────────────────────┘
                       │
                       ▼
    ┌────────────────────────────────────────────────┐
    │           RENDERED COMPONENTS                  │
    │                                                │
    │  ┌──────────────┐  ┌──────────────┐          │
    │  │ Trig         │  │ Cell Biology │          │
    │  │ Triangle     │  │ Labeling     │          │
    │  │ [SVG]        │  │ [SVG + D&D]  │          │
    │  └──────────────┘  └──────────────┘          │
    │                                                │
    │  ┌──────────────┐  ┌──────────────┐          │
    │  │ Chemistry    │  │ Physics      │          │
    │  │ 3D Molecule  │  │ 3D Simulation│          │
    │  │ [Three.js]   │  │ [Three.js]   │          │
    │  └──────────────┘  └──────────────┘          │
    └────────────────────────────────────────────────┘
```

## Component Communication Flow

```
┌──────────────────────────────────────────────────────────────┐
│                       STUDENT                                 │
│         (Interacts with component)                           │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ User Action (click, drag, input)
                   ▼
┌──────────────────────────────────────────────────────────────┐
│                  COMPONENT (React)                            │
│                                                               │
│  const [state, setState] = useState(...)                     │
│                                                               │
│  • Updates local state                                       │
│  • Filters out external changes                              │
│  • Calls onEvent() for significant actions                   │
└──────┬────────────────────────────────────────────┬──────────┘
       │                                            │
       │ onEvent('answer-checked', data)            │ onStateChange(changes)
       ▼                                            ▼
┌──────────────────────────────────────────────────────────────┐
│              COMPONENT MANAGER                                │
│                                                               │
│  • Tracks all component instances                            │
│  • Routes events to agents                                   │
│  • Applies state updates from agents                         │
└──────┬────────────────────────────────────────────┬──────────┘
       │                                            │
       │ Component Event                            │ Agent can update
       ▼                                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    AI AGENT                                   │
│                                                               │
│  • Receives event notification                               │
│  • Analyzes student action                                   │
│  • Decides on response                                       │
│  • Calls customComponent({ action: 'updateState', ... })     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ updateState({ showHint: true })
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              COMPONENT (React)                                │
│                                                               │
│  useEffect(() => {                                            │
│    if (externalState) {                                       │
│      setState(prev => ({ ...prev, ...externalState }))       │
│    }                                                          │
│  }, [externalState])                                          │
│                                                               │
│  • Renders with new state                                    │
│  • Shows hint/feedback to student                            │
└──────────────────────────────────────────────────────────────┘
```

## Three.js Integration (Chemistry & Physics)

```
┌──────────────────────────────────────────────────────────────┐
│                  COMPONENT (React)                            │
│                                                               │
│  useEffect(() => {                                            │
│    const scene = new THREE.Scene()                           │
│    const camera = new THREE.PerspectiveCamera(...)           │
│    const renderer = new THREE.WebGLRenderer(...)             │
│                                                               │
│    const animate = () => {                                   │
│      requestAnimationFrame(animate)                          │
│      // Update physics (if physics sim)                      │
│      // Rotate scene (if chemistry)                          │
│      renderer.render(scene, camera)                          │
│    }                                                          │
│    animate() // 60 FPS loop                                  │
│  }, [])                                                       │
└──────────────────────────────────────────────────────────────┘
         │
         │ Creates DOM element
         ▼
┌──────────────────────────────────────────────────────────────┐
│              <canvas> in Browser                              │
│                                                               │
│  ┌────────────────────────────────────────────────┐          │
│  │                                                │          │
│  │        3D RENDERED SCENE                       │          │
│  │                                                │          │
│  │  • Molecules OR Physics Simulation             │          │
│  │  • Lighting & Shadows                          │          │
│  │  • Real-time Animation @ 60 FPS                │          │
│  │                                                │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

## State Synchronization Pattern

```
                    COMPONENT STATE
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   User Changes    External Changes    Previous State
        │                 │                 │
        │                 │                 │
        ▼                 ▼                 ▼
    ┌────────────────────────────────────────┐
    │   Track Source of Changes              │
    │                                        │
    │   externallySetKeys = Set()            │
    │   previousState = ref(state)           │
    └────────────────────────────────────────┘
                          │
                          ▼
    ┌────────────────────────────────────────┐
    │   Filter and Route Changes             │
    │                                        │
    │   • User changes → notify agent        │
    │   • Agent changes → update UI only     │
    │   • Prevent circular updates           │
    └────────────────────────────────────────┘
```

## Component Lifecycle

```
1. SHOW COMPONENT
   ┌───────────────────────────────────────┐
   │ Agent calls customComponent({         │
   │   action: 'show',                     │
   │   componentId: 'physics-simulation',  │
   │   initialState: { ... }               │
   │ })                                    │
   └────────────────┬──────────────────────┘
                    │
                    ▼
   ┌───────────────────────────────────────┐
   │ ComponentManager                      │
   │ • Loads JSX from file                 │
   │ • Compiles with Babel                 │
   │ • Executes in sandboxed scope         │
   │ • Wraps in ComponentWrapper           │
   │ • Returns instanceId                  │
   └────────────────┬──────────────────────┘
                    │
                    ▼
   ┌───────────────────────────────────────┐
   │ Component Rendered on Screen          │
   │ • Shows in draggable/resizable card   │
   │ • Initial state from agent            │
   │ • Ready for interaction               │
   └───────────────────────────────────────┘

2. USER INTERACTION
   ┌───────────────────────────────────────┐
   │ Student interacts with component      │
   │ (clicks, drags, types, adjusts)       │
   └────────────────┬──────────────────────┘
                    │
                    ▼
   ┌───────────────────────────────────────┐
   │ Component emits event                 │
   │ onEvent('label-placed', { ... })      │
   └────────────────┬──────────────────────┘
                    │
                    ▼
   ┌───────────────────────────────────────┐
   │ Agent receives event                  │
   │ • Analyzes action                     │
   │ • Generates response                  │
   │ • Speaks to student                   │
   │ • May update component state          │
   └───────────────────────────────────────┘

3. AGENT UPDATE
   ┌───────────────────────────────────────┐
   │ Agent calls customComponent({         │
   │   action: 'updateState',              │
   │   instanceId: '...',                  │
   │   stateUpdates: { showHint: true }    │
   │ })                                    │
   └────────────────┬──────────────────────┘
                    │
                    ▼
   ┌───────────────────────────────────────┐
   │ Component receives externalState      │
   │ • Marks keys as external              │
   │ • Updates state                       │
   │ • Re-renders with changes             │
   │ • Does NOT notify agent (prevent loop)│
   └───────────────────────────────────────┘

4. COMPLETION
   ┌───────────────────────────────────────┐
   │ Student completes task                │
   │ onSubmit({ completed: true, ... })    │
   └────────────────┬──────────────────────┘
                    │
                    ▼
   ┌───────────────────────────────────────┐
   │ Agent celebrates success              │
   │ • Speaks congratulations              │
   │ • May show summary                    │
   │ • Calls customComponent({             │
   │     action: 'hide',                   │
   │     instanceId: '...'                 │
   │   })                                  │
   └────────────────┬──────────────────────┘
                    │
                    ▼
   ┌───────────────────────────────────────┐
   │ Component unmounts with animation     │
   │ • Framer Motion exit animation        │
   │ • Cleanup Three.js (if 3D)            │
   │ • Remove from DOM                     │
   └───────────────────────────────────────┘
```

## Data Flow Example: Physics Simulation

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Student changes mass slider to 3kg                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Component state updates:                                         │
│   setState({ ...prev, mass: 3 })                                │
│                                                                  │
│ Physics calculations update:                                     │
│   acceleration = force / mass = 10N / 3kg = 3.33 m/s²          │
│   predicted range = (v₀² × sin(2θ)) / g = ...                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ onStateChange({ mass: 3 }) → Agent notified                     │
│ (Optional: Agent can comment on the change)                     │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Student clicks "Launch"                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Component:                                                       │
│ • Sets isRunning = true                                         │
│ • Initializes physics state (position, velocity)                │
│ • Starts 60 FPS animation loop                                  │
│ • Shows loading state                                           │
│ • Calls onEvent('simulation-started', { mass: 3, ... })         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Agent receives event:                                            │
│ "Great! Let's see how a 3kg mass behaves..."                    │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Component animation loop (60 FPS):                               │
│ Every frame:                                                     │
│   1. Calculate acceleration: a = F/m - g                         │
│   2. Update velocity: v = v + a×dt                              │
│   3. Update position: p = p + v×dt                              │
│   4. Check ground collision                                     │
│   5. Update Three.js sphere position                             │
│   6. Add trail particle                                         │
│   7. Render scene                                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ (1-3 seconds of real-time simulation)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Projectile hits ground and stops:                               │
│ • setState({ isRunning: false })                                │
│ • Calls onEvent('simulation-completed', {                       │
│     finalPosition: { x: 5.2, y: 0, z: 0 },                      │
│     time: 1.8                                                   │
│   })                                                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Agent analyzes results:                                          │
│ "With 3kg mass, the projectile traveled 5.2 meters.            │
│  Notice how the heavier mass resulted in lower initial          │
│  velocity, so it didn't go as far. That's F=ma in action!"     │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
│  React 19 Components • shadcn/ui • Tailwind CSS                 │
└─────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                    GRAPHICS & ANIMATION                          │
│  Three.js r128 • Framer Motion • SVG • Canvas                   │
└─────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                   COMPONENT RUNTIME                              │
│  Babel JSX Compilation • Component Manager • State Sync         │
└─────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                      AI AGENT LAYER                              │
│  OpenAI Realtime API • Agent Instructions • Tool Execution      │
└─────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                   PRIMER PLATFORM                                │
│  Next.js 15 • Socket.IO • Tool Registry • Experience Loader     │
└─────────────────────────────────────────────────────────────────┘
```

---

**Last Updated**: January 6, 2025  
**Status**: Phase 0 Complete

