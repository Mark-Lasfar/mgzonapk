// /home/mark/Music/my-nextjs-project-clean/components/craft/Carousel.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface CarouselProps {
  images?: string[];
  height?: string;
  autoPlay?: boolean;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Carousel = ({
  images = ['https://via.placeholder.com/600x300'],
  height = '300px',
  autoPlay = false,
  style = {},
  settings = {},
}: CarouselProps) => {
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
        height,
        overflow: 'hidden',
        ...style,
        ...settings.style,
      }}
    >
      {images.map((src, index) => (
        <img
          key={index}
          src={src}
          alt={`Carousel slide ${index + 1}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ))}
      {autoPlay && <p>AutoPlay: Enabled</p> /* Placeholder for carousel logic */}
    </div>
  );
};

Carousel.craft = {
  displayName: 'Carousel',
  props: {
    images: ['https://via.placeholder.com/600x300'],
    height: '300px',
    autoPlay: false,
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};