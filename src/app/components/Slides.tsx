import React from 'react';
import { getActiveSlides } from '@/app/lib/tools/ui/slides/index';

export default function Slides() {
  const slides = getActiveSlides();

  if (!slides || slides.length === 0) {
    return null;
  }

  return (
    <>
      {slides.map((slide, index) => (
        <React.Fragment key={`slide-${index}`}>
          {slide}
        </React.Fragment>
      ))}
    </>
  );
} 