'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface HeroProps {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  backgroundColor?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Hero = ({
  title,
  subtitle,
  backgroundImage,
  backgroundColor = '#f0f0f0',
  style = {},
  settings = {},
}: HeroProps) => {
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
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundColor,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '40px',
        textAlign: 'center',
        minHeight: '200px',
        ...style,
        ...settings.style,
      }}
    >
      <h1 style={{ fontSize: '2rem', margin: '0 0 10px' }}>{title || 'Hero Title'}</h1>
      <p style={{ fontSize: '1.2rem' }}>{subtitle || 'Hero Subtitle'}</p>
    </div>
  );
};

Hero.craft = {
  displayName: 'Hero',
  props: {
    title: 'Hero Title',
    subtitle: 'Hero Subtitle',
    backgroundImage: '',
    backgroundColor: '#f0f0f0',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};