'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface HeadingProps {
  text?: string;
  level?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  fontSize?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Heading = ({
  text,
  level = 'h2',
  fontSize = '24px',
  color = '#333',
  textAlign = 'left',
  style = {},
  settings = {},
}: HeadingProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLHeadingElement>(null);

  const Tag = level;

  return (
    <Tag
      ref={(element) => {
        ref.current = element;
        if (ref.current) {
          connect(ref);
          drag(ref);
        }
      }}

      style={{
        fontSize,
        color,
        textAlign,
        ...style,
        ...settings.style,
      }}
    >
      {text || `Heading ${level.toUpperCase()}`}
    </Tag>
  );
};

Heading.craft = {
  displayName: 'Heading',
  props: {
    text: 'Heading Text',
    level: 'h2',
    fontSize: '24px',
    color: '#333',
    textAlign: 'left',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};