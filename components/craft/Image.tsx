'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface ImageProps {
  src?: string;
  width?: string;
  height?: string;
  borderRadius?: string;
  margin?: string;
  padding?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const CraftImage = ({
  src,
  width = '100%',
  height = 'auto',
  borderRadius = '0',
  margin = '0',
  padding = '0',
  style = {},
  settings = {},
}: ImageProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLImageElement>(null);

  return (
    <img
      ref={(element) => {
        ref.current = element;
        if (ref.current) {
          connect(ref);
          drag(ref);
        }
      }}
      src={src || 'https://via.placeholder.com/300'}
      alt="Craft Image"
      style={{
        width,
        height,
        borderRadius,
        margin,
        padding,
        maxWidth: '100%',
        ...style,
        ...settings.style,
      }}
    />
  );
};

CraftImage.craft = {
  displayName: 'Image',
  props: {
    src: 'https://via.placeholder.com/300',
    width: '100%',
    height: 'auto',
    borderRadius: '0',
    margin: '0',
    padding: '0',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};