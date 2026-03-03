/**
 * Tests for component validation utilities
 */

import { validateComponentCode } from '../componentValidation';

describe('componentValidation', () => {
  describe('external library imports', () => {
    it('should detect THREE.js import', () => {
      const code = `
        import * as THREE from 'three';
        export default function MyComponent() {
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          category: 'import',
          message: expect.stringContaining('Cannot import \'three\''),
          suggestion: expect.stringContaining('window.THREE')
        })
      );
    });

    it('should detect mathjs import', () => {
      const code = `
        import * as math from 'mathjs';
        export default function MyComponent() {
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('mathjs'))).toBe(true);
    });

    it('should detect lodash import', () => {
      const code = `
        import _ from 'lodash';
        export default function MyComponent() {
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('lodash'))).toBe(true);
    });
  });

  describe('library availability checks', () => {
    it('should warn when THREE is used without availability check', () => {
      const code = `
        export default function MyComponent() {
          const scene = new THREE.Scene();
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          category: 'library-check',
          message: expect.stringContaining('Using THREE without checking availability')
        })
      );
    });

    it('should not warn when window.THREE check is present', () => {
      const code = `
        export default function MyComponent() {
          if (!window.THREE) return null;
          const THREE = window.THREE;
          const scene = new THREE.Scene();
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      const libraryWarnings = result.warnings.filter(w => w.category === 'library-check');
      expect(libraryWarnings).toHaveLength(0);
    });
  });

  describe('state mutations', () => {
    it('should detect direct state mutation', () => {
      const code = `
        export default function MyComponent({ initialState }) {
          const [state, setState] = useState(initialState);
          
          const handleClick = () => {
            state.count = 5; // Direct mutation
          };
          
          return <button onClick={handleClick}>Click</button>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          category: 'react-pattern',
          message: expect.stringContaining('Direct state mutation detected')
        })
      );
    });

    it('should not flag setState calls', () => {
      const code = `
        export default function MyComponent({ initialState }) {
          const [state, setState] = useState(initialState);
          
          const handleClick = () => {
            setState(prev => ({ ...prev, count: 5 }));
          };
          
          return <button onClick={handleClick}>Click</button>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      const stateMutationErrors = result.errors.filter(e => e.category === 'react-pattern');
      expect(stateMutationErrors).toHaveLength(0);
    });
  });

  describe('animation frame cleanup', () => {
    it('should warn when requestAnimationFrame lacks cleanup', () => {
      const code = `
        export default function MyComponent() {
          useEffect(() => {
            const animate = () => {
              requestAnimationFrame(animate);
            };
            animate();
          }, []);
          
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          category: 'memory-leak',
          message: expect.stringContaining('requestAnimationFrame used without cleanup')
        })
      );
    });

    it('should not warn when cancelAnimationFrame is present', () => {
      const code = `
        export default function MyComponent() {
          useEffect(() => {
            let animationId;
            const animate = () => {
              animationId = requestAnimationFrame(animate);
            };
            animate();
            
            return () => cancelAnimationFrame(animationId);
          }, []);
          
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      const animationWarnings = result.warnings.filter(w => 
        w.message.includes('requestAnimationFrame')
      );
      expect(animationWarnings).toHaveLength(0);
    });
  });

  describe('Three.js resource disposal', () => {
    it('should warn when Three.js resources are not disposed', () => {
      const code = `
        export default function MyComponent() {
          useEffect(() => {
            const THREE = window.THREE;
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshBasicMaterial();
            const renderer = new THREE.WebGLRenderer();
          }, []);
          
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          category: 'memory-leak',
          message: expect.stringContaining('Three.js resources should be disposed')
        })
      );
    });

    it('should not warn when dispose is present', () => {
      const code = `
        export default function MyComponent() {
          useEffect(() => {
            const THREE = window.THREE;
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            
            return () => {
              geometry.dispose();
            };
          }, []);
          
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      const disposeWarnings = result.warnings.filter(w => 
        w.message.includes('Three.js resources')
      );
      expect(disposeWarnings).toHaveLength(0);
    });
  });

  describe('security checks', () => {
    it('should reject eval', () => {
      const code = `
        export default function MyComponent() {
          eval('alert("bad")');
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('eval'))).toBe(true);
    });

    it('should reject new Function', () => {
      const code = `
        export default function MyComponent() {
          const fn = new Function('return 1');
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Function'))).toBe(true);
    });

    it('should reject localStorage', () => {
      const code = `
        export default function MyComponent() {
          localStorage.setItem('key', 'value');
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('localStorage'))).toBe(true);
    });

    it('should reject fetch', () => {
      const code = `
        export default function MyComponent() {
          fetch('/api/data');
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('fetch'))).toBe(true);
    });
  });

  describe('syntax checks', () => {
    it('should detect unbalanced braces', () => {
      const code = `
        export default function MyComponent() {
          return <div>{test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Unbalanced braces'))).toBe(true);
    });

    it('should detect unbalanced parentheses', () => {
      const code = `
        export default function MyComponent() {
          const x = (1 + 2;
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Unbalanced parentheses'))).toBe(true);
    });

    it('should detect unbalanced brackets', () => {
      const code = `
        export default function MyComponent() {
          const arr = [1, 2, 3;
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Unbalanced brackets'))).toBe(true);
    });
  });

  describe('React hook typos', () => {
    it('should detect useState typo', () => {
      const code = `
        export default function MyComponent() {
          const [count, setCount] = usestate(0);
          return <div>{count}</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('usestate'))).toBe(true);
    });

    it('should detect useEffect typo', () => {
      const code = `
        export default function MyComponent() {
          useeffect(() => {}, []);
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('useeffect'))).toBe(true);
    });
  });

  describe('window event listeners', () => {
    it('should warn when resize listener lacks cleanup', () => {
      const code = `
        export default function MyComponent() {
          useEffect(() => {
            window.addEventListener('resize', handleResize);
          }, []);
          
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          category: 'memory-leak',
          message: expect.stringContaining('Window resize listener')
        })
      );
    });

    it('should not warn when removeEventListener is present', () => {
      const code = `
        export default function MyComponent() {
          useEffect(() => {
            const handleResize = () => {};
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
          }, []);
          
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      const resizeWarnings = result.warnings.filter(w => 
        w.message.includes('resize listener')
      );
      expect(resizeWarnings).toHaveLength(0);
    });
  });

  describe('Three.js addons', () => {
    it('should warn when OrbitControls is used without availability check', () => {
      const code = `
        export default function MyComponent() {
          useEffect(() => {
            const THREE = window.THREE;
            const controls = new THREE.OrbitControls(camera, renderer.domElement);
          }, []);
          
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          category: 'library-check',
          message: expect.stringContaining('THREE.OrbitControls without checking availability')
        })
      );
    });

    it('should not warn when OrbitControls availability is checked', () => {
      const code = `
        export default function MyComponent() {
          useEffect(() => {
            const THREE = window.THREE;
            if (!THREE.OrbitControls) return;
            const controls = new THREE.OrbitControls(camera, renderer.domElement);
          }, []);
          
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      const orbitWarnings = result.warnings.filter(w => 
        w.message.includes('OrbitControls')
      );
      expect(orbitWarnings).toHaveLength(0);
    });

    it('should error when unavailable Three.js addon is used', () => {
      const code = `
        export default function MyComponent() {
          useEffect(() => {
            const THREE = window.THREE;
            const loader = new THREE.FBXLoader(); // Not available
          }, []);
          
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          category: 'library-availability',
          message: expect.stringContaining('THREE.FBXLoader is not available')
        })
      );
    });

    it('should allow available Three.js addons', () => {
      const code = `
        export default function MyComponent() {
          useEffect(() => {
            const THREE = window.THREE;
            if (!THREE.OrbitControls) return;
            const controls = new THREE.OrbitControls(camera, renderer.domElement);
            
            if (!THREE.GLTFLoader) return;
            const loader = new THREE.GLTFLoader();
          }, []);
          
          return <div>Test</div>;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      const addonErrors = result.errors.filter(e => 
        e.category === 'library-availability'
      );
      expect(addonErrors).toHaveLength(0);
    });
  });

  describe('valid components', () => {
    it('should pass a well-formed component', () => {
      const code = `
        export default function MyComponent({ 
          initialState = {},
          externalState,
          onStateChange,
          onEvent 
        }) {
          const [state, setState] = useState({
            count: 0,
            ...initialState
          });
          
          const handleClick = () => {
            setState(prev => ({ ...prev, count: prev.count + 1 }));
          };
          
          return (
            <div>
              <p>Count: {state.count}</p>
              <button onClick={handleClick}>Increment</button>
            </div>
          );
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.hasPrimerProps).toBe(true);
    });

    it('should pass a Three.js component with proper patterns', () => {
      const code = `
        export default function MyComponent({ initialState = {} }) {
          const [state, setState] = useState(initialState);
          const mountRef = useRef(null);
          
          useEffect(() => {
            if (!window.THREE || !mountRef.current) return;
            
            const THREE = window.THREE;
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshBasicMaterial();
            const renderer = new THREE.WebGLRenderer();
            
            let animationId;
            const animate = () => {
              animationId = requestAnimationFrame(animate);
              renderer.render(scene, camera);
            };
            animate();
            
            return () => {
              cancelAnimationFrame(animationId);
              geometry.dispose();
              material.dispose();
              renderer.dispose();
            };
          }, []);
          
          return <div ref={mountRef} className="w-full h-full" />;
        }
      `;
      
      const result = validateComponentCode(code, 'test-component');
      expect(result.valid).toBe(true);
      expect(result.stats.usesExternalLibraries).toContain('THREE');
      
      // Should have no critical warnings
      const criticalWarnings = result.warnings.filter(w => 
        w.message.includes('without checking availability') ||
        w.message.includes('should be disposed') ||
        w.message.includes('without cleanup')
      );
      expect(criticalWarnings).toHaveLength(0);
    });
  });
});
