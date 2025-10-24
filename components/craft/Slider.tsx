// /home/mark/Music/my-nextjs-project-clean/components/craft/Slider.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface SliderProps {
  images?: string[];
  width?: string;
  height?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Slider = ({
  images = ['https://via.placeholder.com/600x300', 'https://via.placeholder.com/600x300'],
  width = '100%',
  height = '300px',
  style = {},
  settings = {},
}: SliderProps) => {
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
        width,
        height,
        overflow: 'hidden',
        ...style,
        ...settings.style,
      }}
    >
      {images.map((img, index) => (
        <img
          key={index}
          src={img}
          alt={`Slide ${index + 1}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ))}
    </div>
  );
};

Slider.craft = {
  displayName: 'Slider',
  props: {
    images: ['https://via.placeholder.com/600x300', 'https://via.placeholder.com/600x300'],
    width: '100%',
    height: '300px',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};