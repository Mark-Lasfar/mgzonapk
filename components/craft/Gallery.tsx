// /home/mark/Music/my-nextjs-project-clean/components/craft/Gallery.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface GalleryProps {
  images?: string[];
  columns?: number;
  gap?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Gallery = ({
  images = [
    'https://via.placeholder.com/200',
    'https://via.placeholder.com/200',
    'https://via.placeholder.com/200',
  ],
  columns = 3,
  gap = '10px',
  style = {},
  settings = {},
}: GalleryProps) => {
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
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
        ...style,
        ...settings.style,
      }}
    >
      {images.map((img, index) => (
        <img
          key={index}
          src={img}
          alt={`Gallery image ${index + 1}`}
          style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
        />
      ))}
    </div>
  );
};

Gallery.craft = {
  displayName: 'Gallery',
  props: {
    images: [
      'https://via.placeholder.com/200',
      'https://via.placeholder.com/200',
      'https://via.placeholder.com/200',
    ],
    columns: 3,
    gap: '10px',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};