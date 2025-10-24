// /home/mark/Music/my-nextjs-project-clean/components/craft/TestimonialCarousel.tsx
'use client';
import React, { useRef, useState } from 'react';
import { useNode } from '@craftjs/core';

interface Testimonial {
  name: string;
  quote: string;
  image?: string;
}

interface TestimonialCarouselProps {
  testimonials?: Testimonial[];
  autoPlay?: boolean;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const TestimonialCarousel = ({
  testimonials = [
    { name: 'John Doe', quote: 'Amazing experience!', image: 'https://via.placeholder.com/50' },
    { name: 'Jane Smith', quote: 'Highly recommend!', image: 'https://via.placeholder.com/50' },
  ],
  autoPlay = true,
  style = {},
  settings = {},
}: TestimonialCarouselProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const nextSlide = () => {
    setCurrent((prev) => (prev + 1) % testimonials.length);
  };

  React.useEffect(() => {
    if (autoPlay) {
      const interval = setInterval(nextSlide, 3000);
      return () => clearInterval(interval);
    }
  }, [autoPlay]);

  return (
    <div
      ref={(element) => {
        ref.current = element;
        if (ref.current) {
          connect(ref);
          drag(ref);
        }
      }}
      style={{
        textAlign: 'center',
        padding: '20px',
        ...style,
        ...settings.style,
      }}
    >
      <div>
        {testimonials[current] && (
          <div>
            {testimonials[current].image && (
              <img
                src={testimonials[current].image}
                alt={testimonials[current].name}
                style={{ width: '50px', height: '50px', borderRadius: '50%', margin: '0 auto' }}
              />
            )}
            <p style={{ fontStyle: 'italic' }}>{testimonials[current].quote}</p>
            <h4>{testimonials[current].name}</h4>
          </div>
        )}
      </div>
      <button onClick={nextSlide} style={{ marginTop: '10px', padding: '5px 10px' }}>
        Next
      </button>
    </div>
  );
};

TestimonialCarousel.craft = {
  displayName: 'TestimonialCarousel',
  props: {
    testimonials: [
      { name: 'John Doe', quote: 'Amazing experience!', image: 'https://via.placeholder.com/50' },
      { name: 'Jane Smith', quote: 'Highly recommend!', image: 'https://via.placeholder.com/50' },
    ],
    autoPlay: true,
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};