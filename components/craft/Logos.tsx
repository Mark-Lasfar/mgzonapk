// /home/mark/Music/my-nextjs-project-clean/components/craft/Logos.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface Logo {
  src: string;
  alt: string;
}

interface LogosProps {
  logos?: Logo[];
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Logos = ({
  logos = [
    { src: 'https://via.placeholder.com/100x50', alt: 'Logo 1' },
    { src: 'https://via.placeholder.com/100x50', alt: 'Logo 2' },
    { src: 'https://via.placeholder.com/100x50', alt: 'Logo 3' },
  ],
  style = {},
  settings = {},
}: LogosProps) => {
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
        justifyContent: 'center',
        alignItems: 'center',
        ...style,
        ...settings.style,
      }}
    >
      {logos.map((logo, index) => (
        <img
          key={index}
          src={logo.src}
          alt={logo.alt}
          style={{ maxWidth: '100px', height: 'auto' }}
        />
      ))}
    </div>
  );
};

Logos.craft = {
  displayName: 'Logos',
  props: {
    logos: [
      { src: 'https://via.placeholder.com/100x50', alt: 'Logo 1' },
      { src: 'https://via.placeholder.com/100x50', alt: 'Logo 2' },
      { src: 'https://via.placeholder.com/100x50', alt: 'Logo 3' },
    ],
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};