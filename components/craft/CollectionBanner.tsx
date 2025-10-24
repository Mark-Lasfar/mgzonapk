// /home/mark/Music/my-nextjs-project-clean/components/craft/CollectionBanner.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface CollectionBannerProps {
  image?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const CollectionBanner = ({
  image = 'https://via.placeholder.com/1200x400',
  title = 'New Collection',
  subtitle = 'Discover our latest products',
  buttonText = 'Shop Now',
  buttonLink = '/shop',
  style = {},
  settings = {},
}: CollectionBannerProps) => {
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
        position: 'relative',
        textAlign: 'center',
        color: 'white',
        ...style,
        ...settings.style,
      }}
    >
      <img
        src={image}
        alt={title}
        style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <a
          href={buttonLink}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '5px',
          }}
        >
          {buttonText}
        </a>
      </div>
    </div>
  );
};

CollectionBanner.craft = {
  displayName: 'CollectionBanner',
  props: {
    image: 'https://via.placeholder.com/1200x400',
    title: 'New Collection',
    subtitle: 'Discover our latest products',
    buttonText: 'Shop Now',
    buttonLink: '/shop',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};