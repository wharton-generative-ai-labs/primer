import React, { useEffect, useState } from 'react';
import { useScene } from '@/app/hooks/useScene';
import { getUIElementManager, subscribeToUIElements } from '@/app/lib/ui/UIElementManager';
import { HEADER_HEIGHT_MOBILE, HEADER_HEIGHT_DESKTOP, FOOTER_HEIGHT_MOBILE, FOOTER_HEIGHT_DESKTOP, CHROME_GAP } from '@/config/layout';

const Scene = () => {
    const { currentScene, getScenePath } = useScene();
    const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
    const [containerOffset, setContainerOffset] = useState({ left: 0, top: 0 });

    useEffect(() => {
        const updateDimensions = () => {
            // Use visualViewport for more accurate mobile dimensions
            const viewportHeight = (window.visualViewport?.height || window.innerHeight);
            const viewportWidth = (window.visualViewport?.width || window.innerWidth);
            
            // Determine if we're on mobile or desktop based on viewport width
            const isMobile = viewportWidth < 768; // md breakpoint
            const headerHeight = isMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT_DESKTOP;
            const footerHeight = isMobile ? FOOTER_HEIGHT_MOBILE : FOOTER_HEIGHT_DESKTOP;
            const padding = CHROME_GAP * 2; // gaps on both sides

            // Get insets from anchored windows
            const uiManager = getUIElementManager();
            const insets = uiManager.getAnchoredInsets();

            // Calculate available space accounting for anchored windows
            const availableHeight = viewportHeight - headerHeight - footerHeight - padding - insets.top - insets.bottom;
            const availableWidth = viewportWidth - padding - insets.left - insets.right;

            // Calculate offset to center the scene in the available space
            const offsetLeft = insets.left / 2 - insets.right / 2;
            const offsetTop = insets.top / 2 - insets.bottom / 2;

            // Only update if values changed to prevent infinite loops
            setContainerDimensions(prev => {
                if (Math.abs(prev.width - availableWidth) > 0.5 || Math.abs(prev.height - availableHeight) > 0.5) {
                    return { width: availableWidth, height: availableHeight };
                }
                return prev;
            });

            setContainerOffset(prev => {
                if (Math.abs(prev.left - offsetLeft) > 0.5 || Math.abs(prev.top - offsetTop) > 0.5) {
                    return { left: offsetLeft, top: offsetTop };
                }
                return prev;
            });
        };

        // Initial update
        updateDimensions();

        // Add event listeners for both regular resize and mobile viewport changes
        window.addEventListener('resize', updateDimensions);
        window.visualViewport?.addEventListener('resize', updateDimensions);

        // Subscribe to UI element changes (for anchored window updates)
        const unsubscribe = subscribeToUIElements(updateDimensions);

        return () => {
            window.removeEventListener('resize', updateDimensions);
            window.visualViewport?.removeEventListener('resize', updateDimensions);
            unsubscribe();
        };
    }, []);

    if (!currentScene) {
        return null;
    }

    const imagePath = getScenePath(currentScene);

    return (
        <div className="relative w-full h-full z-background">
            {/* Scene content container */}
            <div 
                className="absolute inset-0 flex items-center justify-center p-1 md:p-2 transition-all duration-300 ease-in-out"
                style={{
                    transform: `translate(${containerOffset.left}px, ${containerOffset.top}px)`
                }}
            >
                <div
                    className="relative w-full h-full z-10 transition-all duration-300 ease-in-out"
                    style={{
                        maxWidth: `${containerDimensions.width}px`,
                        maxHeight: `${containerDimensions.height}px`
                    }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={imagePath}
                        alt={`Scene: ${currentScene}`}
                        className="w-full h-full object-contain select-none pointer-events-none"
                    />
                </div>
            </div>
        </div>
    );
};

export default Scene;