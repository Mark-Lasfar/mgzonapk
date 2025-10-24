// /home/mark/Music/my-nextjs-project-clean/components/craft/Testimonials.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface Testimonial {
  name: string;
  quote: string;
  image?: string;
}

interface TestimonialsProps {
  testimonials?: Testimonial[];
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Testimonials = ({
  testimonials = [
    { name: 'John Doe', quote: 'Great product!', image: 'https://via.placeholder.com/50' },
    { name: 'Jane Smith', quote: 'Amazing service!', image: 'https://via.placeholder.com/50' },
  ],
  style = {},
  settings = {},
}: TestimonialsProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLDivElement>(null);

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
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        ...style,
        ...settings.style,
      }}
    >
      {testimonials.map((testimonial, index) => (
        <div
          key={index}
          style={{
            border: '1px solid #ddd',
            padding: '20px',
            maxWidth: '300px',
            textAlign: 'center',
          }}
        >
          {testimonial.image && (
            <img
              src={testimonial.image}
              alt={testimonial.name}
              style={{ width: '50px', height: '50px', borderRadius: '50%' }}
            />
          )}
          <p>{testimonial.quote}</p>
          <h4>{testimonial.name}</h4>
        </div>
      ))}
    </div>
  );
};

Testimonials.craft = {
  displayName: 'Testimonials',
  props: {
    testimonials: [
      { name: 'John Doe', quote: 'Great product!', image: 'https://via.placeholder.com/50' },
      { name: 'Jane Smith', quote: 'Amazing service!', image: 'https://via.placeholder.com/50' },
    ],
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};