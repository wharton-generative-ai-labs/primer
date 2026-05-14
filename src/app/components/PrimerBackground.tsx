'use client'

import Image from 'next/image'
import { signOut, useSession } from "next-auth/react";
import packageJson from '../../../package.json';
import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Button } from "@/components/ui/button"
import { HEADER_CLASSES, FOOTER_CLASSES } from "@/config/layout"

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
}

export default function PrimerBackground({ 
  children, 
  className = '',
  darkOverlay = false,
  showOverlays = true,
  useInitialBackdrop = false,
  triggerTransition = false,
  loadingPhase = null
}: PrimerBackgroundProps) {
  const { data: session } = useSession();
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

  return (
    <div className="text-base flex flex-col h-screen text-white relative">
      {showOverlays && (
        <div className={`${HEADER_CLASSES} z-chrome`}>
          <div className="flex items-center w-full h-full">
            {/* Left - Logo */}
            <div className="flex-shrink-0 absolute left-1.5 md:left-2">
              <Image
                src="/images/gail_logo_vert_rev.png"
                alt="Wharton Generative AI Labs"
                width={1}
                height={1}
                sizes="250px"
                className="w-[60px] md:w-[80px] h-auto"
                placeholder="empty"
              />
            </div>

            {/* Center - Title and Version */}
            <div className="flex-1 flex justify-center items-center">
              <div className="flex flex-col items-center">
                <h1 className="text-base md:text-2xl font-minion">Primer</h1>
                <span className="text-xs text-gray-300">{packageJson.version}</span>
              </div>
            </div>

            {/* Right - Empty space for balance */}
            <div className="text-xs text-white/50 absolute right-1.5 md:right-2 invisible">
              {/* Maintains layout balance */}
            </div>
          </div>
        </div>
      )}

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
      <div className={`flex-1 bg-black ${!showOverlays ? 'h-full' : ''} ${darkOverlay ? 'background-container-desaturate' : ''}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full">
            {/* Initial backdrop - the paper book (static base layer) */}
            {useInitialBackdrop && (
              <div 
                className="absolute inset-0"
                style={{ zIndex: 1 }}
              >
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
            
            {/* Main backdrop - the Primer comes alive (soft feathered circular reveal) */}
            <motion.div 
              className="absolute inset-0"
              style={{ 
                zIndex: 2,
                WebkitMaskImage: maskImage,
                maskImage: maskImage
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
            
            <div className={`relative z-content h-full ${className}`}>
              {children}
            </div>
          </div>
        </div>
      </div>

      {showOverlays && (
        <div className={`${FOOTER_CLASSES} relative z-chrome`}>
          <div className="flex flex-row items-center justify-between gap-1.5 min-[460px]:gap-1">
            {/* Left side - User info */}
            <div className="flex-1">
              {session && (
                <div className="flex items-center ml-2">
                  <span className="text-xs text-white/90">
                    {session.user?.email}
                  </span>
                </div>
              )}
              {!session && (
                <div className="h-[32px]"></div>
              )}
            </div>
            
            {/* Right side - Sign Out */}
            <div className="flex items-center justify-end">
              {session && (
                <Button
                  onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                  variant="customDestructive"
                  size="sm"
                >
                  Sign Out
                </Button>
              )}
              {!session && (
                <div className="h-[32px]"></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 