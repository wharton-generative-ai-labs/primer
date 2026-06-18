/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('framer-motion', () => {
  const FRAMER_PROPS = new Set([
    'initial', 'animate', 'exit', 'transition', 'layout', 'layoutId',
    'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'whileInView',
    'variants', 'custom', 'drag', 'onAnimationStart', 'onAnimationComplete',
  ]);
  return {
    motion: new Proxy(
      {},
      {
        get:
          (_target, key: string) =>
          ({
            children,
            ...rest
          }: { children?: React.ReactNode } & Record<string, unknown>) => {
            const domProps: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(rest)) {
              if (!FRAMER_PROPS.has(k)) domProps[k] = v;
            }
            return React.createElement(key, domProps, children);
          },
      },
    ),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    useMotionValue: (v: number) => ({ get: () => v, set: () => {} }),
    useTransform: () => '',
    animate: () => {},
  };
});

jest.mock('../Header', () => ({ Header: () => null }));
jest.mock('../Footer', () => ({ Footer: () => null }));

import PrimerBackground from '../PrimerBackground';
import { SceneContext, SceneContextType } from '@/app/contexts/SceneContext';

function makeSceneCtx(overrides: Partial<SceneContextType> = {}): SceneContextType {
  return {
    currentScene: null,
    isSceneVisible: false,
    setScene: () => ({ result: true }),
    showScene: () => ({ result: true }),
    hideScene: () => ({ result: true }),
    setSceneVisible: () => ({ result: true }),
    getScenePath: (name) => (name ? `/scenes/${name}.jpg` : ''),
    addCustomScene: () => ({ result: true }),
    removeCustomScene: () => ({ result: true }),
    getAvailableScenes: () => [],
    ...overrides,
  };
}

function renderWithScene(
  ctx: SceneContextType,
  loadingPhase: string | null = 'ready',
) {
  return render(
    <SceneContext.Provider value={ctx}>
      <PrimerBackground loadingPhase={loadingPhase}>
        <div data-testid="children" />
      </PrimerBackground>
    </SceneContext.Provider>,
  );
}

describe('PrimerBackground scene layer', () => {
  it('does not render a scene img when currentScene is null', () => {
    const { container } = renderWithScene(
      makeSceneCtx({ currentScene: null, isSceneVisible: true }),
    );
    const sceneImgs = container.querySelectorAll('img[src^="/scenes/"]');
    expect(sceneImgs.length).toBe(0);
  });

  it('does not render a scene img while loadingPhase === "loading"', () => {
    const { container } = renderWithScene(
      makeSceneCtx({ currentScene: 'beach', isSceneVisible: true }),
      'loading',
    );
    const sceneImgs = container.querySelectorAll('img[src^="/scenes/"]');
    expect(sceneImgs.length).toBe(0);
  });

  it('renders the scene img when currentScene is set and loadingPhase is ready', async () => {
    const { container } = renderWithScene(
      makeSceneCtx({ currentScene: 'beach', isSceneVisible: true }),
    );
    await waitFor(() => {
      const sceneImg = container.querySelector('img[src="/scenes/beach.jpg"]');
      expect(sceneImg).not.toBeNull();
    });
  });

  it('places the scene wrapper above the static backdrop but below the gradient (zIndex 3)', async () => {
    const { container } = renderWithScene(
      makeSceneCtx({ currentScene: 'beach', isSceneVisible: true }),
    );
    await waitFor(() => {
      const sceneImg = container.querySelector('img[src="/scenes/beach.jpg"]');
      expect(sceneImg).not.toBeNull();
    });
    const sceneImg = container.querySelector('img[src="/scenes/beach.jpg"]') as HTMLElement;
    const wrapper = sceneImg.parentElement!;
    expect(wrapper.style.zIndex).toBe('3');
  });

  it('reflects isSceneVisible via the wrapper opacity', async () => {
    const { container: visible } = renderWithScene(
      makeSceneCtx({ currentScene: 'beach', isSceneVisible: true }),
    );
    await waitFor(() => {
      expect(visible.querySelector('img[src="/scenes/beach.jpg"]')).not.toBeNull();
    });
    const visibleWrapper = (visible.querySelector(
      'img[src="/scenes/beach.jpg"]',
    ) as HTMLElement).parentElement!;
    expect(visibleWrapper.style.opacity).toBe('1');

    const { container: hidden } = renderWithScene(
      makeSceneCtx({ currentScene: 'beach', isSceneVisible: false }),
    );
    await waitFor(() => {
      expect(hidden.querySelector('img[src="/scenes/beach.jpg"]')).not.toBeNull();
    });
    const hiddenWrapper = (hidden.querySelector(
      'img[src="/scenes/beach.jpg"]',
    ) as HTMLElement).parentElement!;
    expect(hiddenWrapper.style.opacity).toBe('0');
  });

  it('animates the scene img opacity from 0 to 1 once mounted', async () => {
    const { container } = renderWithScene(
      makeSceneCtx({ currentScene: 'beach', isSceneVisible: true }),
    );
    await waitFor(() => {
      const img = container.querySelector('img[src="/scenes/beach.jpg"]') as HTMLElement;
      expect(img).not.toBeNull();
      expect(img.style.opacity).toBe('1');
    });
  });

  it('crossfades by stacking two img layers when currentScene changes', async () => {
    const ctx1 = makeSceneCtx({ currentScene: 'beach', isSceneVisible: true });
    const { container, rerender } = render(
      <SceneContext.Provider value={ctx1}>
        <PrimerBackground loadingPhase="ready">
          <div />
        </PrimerBackground>
      </SceneContext.Provider>,
    );
    await waitFor(() => {
      expect(container.querySelectorAll('img[src^="/scenes/"]').length).toBe(1);
    });

    const ctx2 = makeSceneCtx({ currentScene: 'forest', isSceneVisible: true });
    rerender(
      <SceneContext.Provider value={ctx2}>
        <PrimerBackground loadingPhase="ready">
          <div />
        </PrimerBackground>
      </SceneContext.Provider>,
    );

    await waitFor(() => {
      const imgs = container.querySelectorAll('img[src^="/scenes/"]');
      expect(imgs.length).toBe(2);
      const srcs = Array.from(imgs).map((i) => i.getAttribute('src'));
      expect(srcs).toContain('/scenes/beach.jpg');
      expect(srcs).toContain('/scenes/forest.jpg');
    });
  });
});
