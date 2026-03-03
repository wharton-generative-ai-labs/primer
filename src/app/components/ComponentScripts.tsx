"use client";

/**
 * ComponentScripts - Load CDN dependencies for custom components
 * 
 * Phase 0: Runtime Validation
 * 
 * Loads:
 * - Babel standalone (for JSX compilation)
 * - MathJS (for math calculations)
 * - Recharts (for charts/graphs)
 * - Lodash (utilities)
 * - Three.js (ES modules via import map)
 */

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ComponentScripts');

// Extend Window interface for CDN-loaded libraries
declare global {
  interface Window {
    THREE?: any;
    __THREE_MODULES_LOADED__?: boolean;
  }
}

interface ComponentScriptsProps {
  experienceId: string;
  sessionId: string;
  hasComponents?: boolean;
}

export function ComponentScripts({ 
  experienceId: _experienceId, 
  sessionId: _sessionId, 
  hasComponents = false 
}: ComponentScriptsProps) {
  const [_scriptsLoaded, setScriptsLoaded] = useState(false);

  // Load Three.js ES modules into window.THREE for backward compatibility
  useEffect(() => {
    if (!hasComponents || typeof window === 'undefined' || window.__THREE_MODULES_LOADED__) return;
    
    const loadThreeModules = async () => {
      try {
        // Dynamically import Three.js core
        const THREE = await import('three');
        
        // Dynamically import addons
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        const { TrackballControls } = await import('three/examples/jsm/controls/TrackballControls.js');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
        
        // Expose on window for component compatibility
        window.THREE = {
          ...THREE,
          OrbitControls,
          TrackballControls,
          GLTFLoader,
          OBJLoader,
        };
        
        window.__THREE_MODULES_LOADED__ = true;
        
        logger.info('Three.js ES modules loaded', {
          version: THREE.REVISION,
          addons: ['OrbitControls', 'TrackballControls', 'GLTFLoader', 'OBJLoader']
        });
      } catch (error) {
        logger.warn('Three.js not available (optional)', { error });
      }
    };
    
    loadThreeModules();
  }, [hasComponents]);

  // Only render scripts if experience has components
  if (!hasComponents) {
    return null;
  }

  return (
    <>
      {/* Babel Standalone - Required for JSX compilation */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          logger.info('Babel standalone loaded');
          setScriptsLoaded(true);
        }}
        onError={(e) => {
          logger.error(e, 'Failed to load Babel standalone');
        }}
      />

      {/* MathJS - For mathematical calculations (optional) */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.4.1/math.min.js"
        strategy="lazyOnload"
        onLoad={() => logger.info('MathJS loaded')}
        onError={() => logger.warn('MathJS not available (optional)')}
      />

      {/* Lodash - Utility functions (optional) */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"
        strategy="lazyOnload"
        onLoad={() => logger.info('Lodash loaded')}
        onError={() => logger.warn('Lodash not available (optional)')}
      />
      
      {/* Recharts - Charting library (CDN version) */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/recharts/2.5.0/Recharts.min.js"
        strategy="lazyOnload"
        onLoad={() => logger.info('Recharts loaded')}
        onError={() => logger.warn('Recharts not available (optional)')}
      />
      
      {/* Note: Three.js is loaded via ES modules in useEffect above.
          Lucide icons are not available via CDN but shadcn/ui components 
          (which include lucide-react) are already available in the scope. */}
    </>
  );
}

