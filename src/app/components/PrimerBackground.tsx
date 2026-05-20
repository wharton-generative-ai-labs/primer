'use client'

import Image from 'next/image'
import React, { useState, useEffect, useContext, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Footer, type FooterType } from "./Footer"
import { Header } from "./Header"
import { SceneContext } from "@/app/contexts/SceneContext";

interface SceneLayer {
  key: number;
  src: string;
  opacity: number;
}

const SCENE_FADE_MS = 500;

interface PrimerBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  // If true, adds a semi-transparent black overlay
  darkOverlay?: boolean;
  // If false, hides the overlays (used for main app view)
  showOverlays?: boolean;
  // If true, uses the initial backdrop image (for homepage)
  useInitialBackdrop?: boolean;
  // If true, triggers transition from initial to main backdrop
  triggerTransition?: boolean;
  // Current loading phase (optional, used to delay animation start)
  loadingPhase?: string | null;
  /** Footer variant. Catalog routes use the route-derived value from `CatalogShell`; everywhere else passes its own. */
  footerType?: FooterType;
  /** Used by `builder` / `lesson` footers (route-based variants navigate via `<Link />` internally). */
  onFooterBack?: () => void;
  runningSubject?: string;
  onInfo?: () => void;
  onBug?: () => void;
  bugActive?: boolean;
  onTranscript?: () => void;
  transcriptActive?: boolean;
  onEvents?: () => void;
  eventsActive?: boolean;
}

export default function PrimerBackground({ 
  children, 
  className = '',
  darkOverlay = false,
  showOverlays = true,
  useInitialBackdrop = false,
  triggerTransition = false,
  loadingPhase = null,
  footerType = 'home',
  onFooterBack,
  runningSubject,
  onInfo,
  onBug,
  bugActive,
  onTranscript,
  transcriptActive,
  onEvents,
  eventsActive,
}: PrimerBackgroundProps) {
  const [startAnimation, setStartAnimation] = useState(false);
  
  // Motion value for the reveal radius (0 = hidden, 150 = fully revealed)
  const revealRadius = useMotionValue(useInitialBackdrop ? 0 : 150);
  
  // Create mask-image with soft feathered edge (15% feather width)
  const maskImage = useTransform(revealRadius, (r) => 
    `radial-gradient(circle at 50% 75%, black ${Math.max(0, r - 8)}%, transparent ${r + 8}%)`
  );
  
  useEffect(() => {
    if (startAnimation) return;
    if (!triggerTransition || !useInitialBackdrop) return;
    
    const shouldStartImmediately = loadingPhase && loadingPhase !== 'loading';
    
    const timer = setTimeout(() => {
      setStartAnimation(true);
    }, shouldStartImmediately ? 10 : 1000);
    
    return () => clearTimeout(timer);
  }, [triggerTransition, useInitialBackdrop, loadingPhase, startAnimation]);
  
  // Animate the reveal when startAnimation becomes true
  useEffect(() => {
    if (startAnimation && useInitialBackdrop) {
      animate(revealRadius, 150, {
        duration: 4,
        ease: [0.4, 0, 0.2, 1]
      });
    }
  }, [startAnimation, useInitialBackdrop, revealRadius]);

  // Scene-layer state. When `SceneContext` provides a current scene we render
  // the scene image on top of the static backdrop and crossfade between scenes
  // by stacking two layers. When no scene is available (or the context is
  // absent), the static `primer_backdrop.png` below remains the visible
  // background — that's the fallback path.
  const sceneCtx = useContext(SceneContext);
  const nextSceneKeyRef = useRef(0);
  const [sceneLayers, setSceneLayers] = useState<SceneLayer[]>([]);
  const sceneLayersRef = useRef(sceneLayers);
  sceneLayersRef.current = sceneLayers;

  const currentScene = sceneCtx?.currentScene ?? null;
  const isSceneVisible = sceneCtx?.isSceneVisible ?? false;
  const getScenePath = sceneCtx?.getScenePath;

  useEffect(() => {
    if (loadingPhase === 'loading') return;
    if (!currentScene || !getScenePath) return;

    const src = getScenePath(currentScene);
    const key = nextSceneKeyRef.current++;

    setSceneLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.src === src) return prev;

      const incoming: SceneLayer = { key, src, opacity: 0 };
      const trimmed = prev.length > 0 ? [prev[prev.length - 1]] : [];
      return [...trimmed, incoming];
    });
  }, [currentScene, getScenePath, loadingPhase]);

  const topSceneKey = sceneLayers.length > 0 ? sceneLayers[sceneLayers.length - 1].key : null;
  const topSceneOpacity = sceneLayers.length > 0 ? sceneLayers[sceneLayers.length - 1].opacity : 0;

  useEffect(() => {
    if (topSceneKey === null) return;
    if (topSceneOpacity === 1) return;

    const outgoingKeys = sceneLayersRef.current.slice(0, -1).map((l) => l.key);

    const raf = requestAnimationFrame(() => {
      setSceneLayers((prev) =>
        prev.map((l) => (l.key === topSceneKey ? { ...l, opacity: 1 } : l)),
      );
    });
    const drop = setTimeout(() => {
      setSceneLayers((prev) => prev.filter((l) => !outgoingKeys.includes(l.key)));
    }, SCENE_FADE_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(drop);
    };
  }, [topSceneKey]);

  const showSceneLayers =
    loadingPhase !== 'loading' &&
    sceneCtx !== null &&
    currentScene !== null &&
    sceneLayers.length > 0;

  return (
    <div className="flex h-[100dvh] flex-col text-base">
      {showOverlays && <Header />}

      {darkOverlay && (
        <style jsx>{`
          @keyframes desaturate {
            from { filter: saturate(100%); }
            to { filter: saturate(0%); }
          }
          
          .background-container-desaturate {
            animation: desaturate 5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
          }
        `}</style>
      )}

      <div
        className={`relative flex-1 min-h-0 bg-black pb-[68px] ${darkOverlay ? 'background-container-desaturate' : ''}`}
      >
        {/* Decorative backdrop layer — fills the area between header and footer,
            sits behind the scrolling content, and ignores pointer events. */}
        <div className="pointer-events-none absolute inset-0 z-0">
          {useInitialBackdrop && (
            <div className="absolute inset-0" style={{ zIndex: 1 }}>
              <Image
                src="/images/primer_backdrop_initial.png"
                alt=""
                sizes="100vw"
                placeholder="empty"
                fill
                priority
                className="object-cover"
              />
            </div>
          )}

          <motion.div
            className="absolute inset-0"
            style={{
              zIndex: 2,
              WebkitMaskImage: maskImage,
              maskImage: maskImage,
            }}
          >
            <Image
              src="/images/primer_backdrop.png"
              alt=""
              sizes="100vw"
              placeholder="empty"
              fill
              priority={!useInitialBackdrop}
              className="object-cover"
            />
          </motion.div>

          {showSceneLayers && (
            <div
              className="absolute inset-0 select-none transition-opacity duration-500"
              style={{ zIndex: 3, opacity: isSceneVisible ? 1 : 0 }}
              aria-hidden="true"
            >
              {sceneLayers.map((layer) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={layer.key}
                  src={layer.src}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
                  style={{ opacity: layer.opacity }}
                />
              ))}
            </div>
          )}

          <div className="absolute inset-0" style={{ zIndex: 4 }}>
            <div className="h-full w-full bg-gradient-to-b from-background via-background/80 to-transparent" />
          </div>
        </div>

        {/* Scrolling content viewport */}
        <main className={`relative z-content h-full overflow-y-auto ${className}`}>
          {children}
        </main>
      </div>

      {showOverlays && (
        <Footer
          type={footerType}
          runningSubject={runningSubject}
          onBack={onFooterBack}
          onInfo={onInfo}
          onBug={onBug}
          bugActive={bugActive}
          onTranscript={onTranscript}
          transcriptActive={transcriptActive}
          onEvents={onEvents}
          eventsActive={eventsActive}
        />
      )}
    </div>
  )
} 
