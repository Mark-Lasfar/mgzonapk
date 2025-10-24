'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface SpacerProps {
  height?: string;
  width?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Spacer = ({
  height = '20px',
  width = '100%',
  style = {},
  settings = {},
}: SpacerProps) => {
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
        width,
        ...style,
        ...settings.style,
      }}
    />
  );
};

Spacer.craft = {
  displayName: 'Spacer',
  props: {
    height: '20px',
    width: '100%',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};