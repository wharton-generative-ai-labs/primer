import { ToolResponse } from '@/app/lib/tools/types';

interface ConfettiPiece {
  x: number;
  y: number;
  rotation: number;
  rotationSpeed: number;
  speed: number;
  size: number;
  color: string;
  shape: 'circle' | 'square' | 'star';
}

/**
 * Create a festive confetti celebration animation
 */
export async function celebrate(args: {
  colors?: string;
  size?: number;
  duration?: number;
  shapes?: string;
}): Promise<ToolResponse> {
  const colors = (args.colors || 'red,blue,green,yellow,purple').split(',').map(c => c.trim());
  const size = args.size || 10;
  const duration = (args.duration || 5) * 1000; // Convert to milliseconds
  const shapes = (args.shapes || 'circle,square,star').split(',').map(s => s.trim()) as ('circle' | 'square' | 'star')[];

  // Create container for confetti
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  // Create confetti pieces
  const pieces: ConfettiPiece[] = [];
  const numPieces = 100;

  for (let i = 0; i < numPieces; i++) {
    pieces.push({
      x: Math.random() * window.innerWidth,
      y: -size,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      speed: 1 + Math.random() * 2,
      size: size * (0.5 + Math.random() * 0.5),
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)]
    });
  }

  // Animation function
  const startTime = Date.now();
  function animate() {
    const elapsed = Date.now() - startTime;
    if (elapsed > duration) {
      document.body.removeChild(container);
      return;
    }

    // Clear previous frame
    container.innerHTML = '';

    // Update and draw each piece
    pieces.forEach(piece => {
      piece.y += piece.speed;
      piece.rotation += piece.rotationSpeed;

      const element = document.createElement('div');
      element.style.position = 'absolute';
      element.style.left = `${piece.x}px`;
      element.style.top = `${piece.y}px`;
      element.style.transform = `rotate(${piece.rotation}deg)`;
      element.style.width = `${piece.size}px`;
      element.style.height = `${piece.size}px`;
      element.style.backgroundColor = piece.color;

      // Draw different shapes
      switch (piece.shape) {
        case 'circle':
          element.style.borderRadius = '50%';
          break;
        case 'star':
          element.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
          break;
      }

      container.appendChild(element);
    });

    requestAnimationFrame(animate);
  }

  // Start animation
  animate();

  return {
    status: 'success',
    data: { message: 'Celebration started!' }
  };
}

