# Component Validation Examples

Real examples showing how the enhanced validation catches issues.

## Example 1: Three.js Import Error

### Component That Fails Validation

```javascript
/**
 * BouncingBall3D - Original Version (FAILS VALIDATION)
 */

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three'; // ❌ ERROR: Cannot import 'three'

export default function BouncingBall3D({ 
  initialState = {},
  externalState,
  onStateChange,
  onEvent
}) {
  const [state, setState] = useState({
    position: { x: 0, y: 10, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    gravity: -9.8,
    restitution: 0.7,
    ...initialState
  });

  const mountRef = useRef(null);

  useEffect(() => {
    const scene = new THREE.Scene(); // Uses imported THREE
    const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const ball = new THREE.Mesh(geometry, material);
    scene.add(ball);
    
    camera.position.z = 5;
    
    const animate = function () {
      requestAnimationFrame(animate); // ❌ WARNING: No cleanup
      
      // ❌ ERROR: Direct state mutation
      state.velocity.y += state.gravity * 0.016;
      state.position.y += state.velocity.y * 0.016;
      
      if (state.position.y < 1) {
        state.position.y = 1;
        state.velocity.y = -state.velocity.y * state.restitution;
      }
      
      ball.position.y = state.position.y;
      renderer.render(scene, camera);
    };
    
    animate();
    
    return () => {
      mountRef.current.removeChild(renderer.domElement);
      // ❌ WARNING: No Three.js resource disposal
    };
  }, [state]); // ❌ WARNING: Expensive ops with state dependency

  return <div ref={mountRef} className="w-full h-full" />;
}
```

### Validation Output

```json
{
  "valid": false,
  "errors": [
    "[import] Cannot import 'three' - external libraries are loaded via CDN - Access via window: const THREE = window.THREE; if (!THREE) return null;",
    "[react-pattern] Direct state mutation detected - Use setState instead: setState(prev => ({ ...prev, property: value }))"
  ],
  "warnings": [
    "[memory-leak] requestAnimationFrame used without cleanup - Store animation ID in ref and cancel in useEffect cleanup: return () => cancelAnimationFrame(animationId.current);",
    "[memory-leak] Three.js resources should be disposed in cleanup - In useEffect cleanup, call dispose() on geometries, materials, and renderer",
    "[performance] Expensive Three.js operations in useEffect with state dependency - Use empty dependency array [] for Three.js setup to run only once"
  ]
}
```

### Fixed Version (Passes Validation)

```javascript
/**
 * BouncingBall3D - Fixed Version (PASSES VALIDATION)
 */

export default function BouncingBall3D({ 
  initialState = {},
  externalState,
  onStateChange,
  onEvent
}) {
  const [state, setState] = useState({
    gravity: -9.8,
    restitution: 0.7,
    bounceCount: 0,
    ...initialState
  });

  const externallySetKeys = useRef(new Set());
  const previousState = useRef(state);

  useEffect(() => {
    if (externalState) {
      Object.keys(externalState).forEach(key => 
        externallySetKeys.current.add(key)
      );
      setState(prev => ({ ...prev, ...externalState }));
      setTimeout(() => externallySetKeys.current.clear(), 0);
    }
  }, [externalState]);

  useEffect(() => {
    const internalChanges = {};
    for (const [key, value] of Object.entries(state)) {
      if (!externallySetKeys.current.has(key) && 
          previousState.current[key] !== value) {
        internalChanges[key] = value;
      }
    }
    previousState.current = state;
    if (Object.keys(internalChanges).length > 0) {
      onStateChange?.(internalChanges);
    }
  }, [state, onStateChange]);

  const mountRef = useRef(null);
  const animationIdRef = useRef(null);

  useEffect(() => {
    // ✅ Check availability
    if (!mountRef.current || !window.THREE) return;

    const THREE = window.THREE; // ✅ Use window.THREE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0x4ade80 });
    const ball = new THREE.Mesh(geometry, material);
    scene.add(ball);

    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x94a3b8, 
      side: THREE.DoubleSide 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    camera.position.set(0, 5, 15);
    camera.lookAt(0, 3, 0);

    // ✅ Local physics state (not React state)
    let position = { x: 0, y: 10, z: 0 };
    let velocity = { x: 0, y: 0, z: 0 };
    let bounceCount = 0;
    const gravity = state.gravity;
    const restitution = state.restitution;

    const animate = function () {
      animationIdRef.current = requestAnimationFrame(animate);

      // ✅ Update local state (not React state)
      const delta = 0.016;
      velocity.y += gravity * delta;
      position.y += velocity.y * delta;

      if (position.y <= 1) {
        position.y = 1;
        velocity.y = -velocity.y * restitution;
        bounceCount++;

        onEvent?.('bounce', { 
          position: { ...position }, 
          velocity: { ...velocity },
          bounceCount 
        });
      }

      ball.position.set(position.x, position.y, position.z);
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      // ✅ Cleanup animation
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      // ✅ Cleanup event listener
      window.removeEventListener('resize', handleResize);
      
      // ✅ Cleanup DOM
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      // ✅ Dispose Three.js resources
      geometry.dispose();
      material.dispose();
      groundGeometry.dispose();
      groundMaterial.dispose();
      renderer.dispose();
    };
  }, []); // ✅ Empty array - only runs once

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="w-full h-full max-w-4xl max-h-[600px]">
        <div ref={mountRef} className="w-full h-full" />
      </div>
    </div>
  );
}
```

### Validation Output (Success)

```json
{
  "valid": true,
  "message": "Component \"bouncing-ball-3d\" passed validation",
  "stats": {
    "size": 3456,
    "lines": 112,
    "hasDefaultExport": true,
    "hasPrimerProps": true,
    "usesExternalLibraries": ["THREE"]
  }
}
```

## Example 2: State Mutation Error

### Before (Fails)

```javascript
export default function Counter({ initialState = {} }) {
  const [state, setState] = useState({
    count: 0,
    ...initialState
  });
  
  const increment = () => {
    state.count = state.count + 1; // ❌ Direct mutation
  };
  
  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={increment}>+</button>
    </div>
  );
}
```

**Validation Error**:
```
[react-pattern] Direct state mutation detected - Use setState instead: setState(prev => ({ ...prev, property: value }))
```

### After (Passes)

```javascript
export default function Counter({ initialState = {} }) {
  const [state, setState] = useState({
    count: 0,
    ...initialState
  });
  
  const increment = () => {
    setState(prev => ({ ...prev, count: prev.count + 1 })); // ✅ Use setState
  };
  
  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={increment}>+</button>
    </div>
  );
}
```

## Example 3: Security Violation

### Before (Fails)

```javascript
export default function DataDisplay() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // ❌ fetch is blocked
    fetch('/api/data')
      .then(res => res.json())
      .then(setData);
  }, []);
  
  return <div>{JSON.stringify(data)}</div>;
}
```

**Validation Error**:
```
[security] Security violation: fetch() is blocked - Components cannot make network requests
```

### After (Passes)

```javascript
export default function DataDisplay({ 
  initialState = {},
  onEvent 
}) {
  const [state, setState] = useState({
    data: null,
    loading: false,
    ...initialState
  });
  
  const requestData = async () => {
    setState(prev => ({ ...prev, loading: true }));
    
    // ✅ Request data via event - agent will provide it
    await onEvent?.('requestData', { type: 'userData' });
  };
  
  useEffect(() => {
    requestData();
  }, []);
  
  return (
    <div>
      {state.loading && <p>Loading...</p>}
      {state.data && <pre>{JSON.stringify(state.data, null, 2)}</pre>}
    </div>
  );
}
```

## Example 4: Hook Typo

### Before (Fails)

```javascript
export default function MyComponent() {
  const [count, setCount] = usestate(0); // ❌ Typo: usestate
  
  useeffect(() => { // ❌ Typo: useeffect
    console.log(count);
  }, [count]);
  
  return <div>{count}</div>;
}
```

**Validation Errors**:
```
[typo] Possible typo: "usestate" should be "useState" - Use: useState
[typo] Possible typo: "useeffect" should be "useEffect" - Use: useEffect
```

### After (Passes)

```javascript
export default function MyComponent() {
  const [count, setCount] = useState(0); // ✅ Correct
  
  useEffect(() => { // ✅ Correct
    console.log(count);
  }, [count]);
  
  return <div>{count}</div>;
}
```

## Summary of Fixed Issues

| Issue | Before | After | Severity |
|-------|--------|-------|----------|
| External imports | `import * as THREE from 'three'` | `const THREE = window.THREE` | Error |
| State mutation | `state.count = 5` | `setState(prev => ...)` | Error |
| Animation cleanup | Missing `cancelAnimationFrame` | Added cleanup | Warning |
| Resource disposal | Missing `.dispose()` | Added disposal | Warning |
| Library checks | No availability check | Added `if (!window.THREE)` | Warning |
| Event listeners | Missing `removeEventListener` | Added cleanup | Warning |
| Hook typos | `usestate` | `useState` | Error |
| Security | `fetch()`, `localStorage` | Removed/replaced | Error |

All these issues are now caught during validation before deployment!
