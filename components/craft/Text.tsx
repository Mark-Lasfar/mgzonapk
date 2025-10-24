// /home/mark/Music/my-nextjs-project-clean/components/craft/Text.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface TextProps {
  text?: string;
  fontSize?: string;
  color?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  margin?: string;
  padding?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Text = ({
  text,
  fontSize = '16px',
  color = '#333',
  fontWeight = 'normal',
  textAlign = 'left',
  margin = '0',
  padding = '0',
  style = {},
  settings = {},
}: TextProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLParagraphElement>(null);

  return (
    <p
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
        fontWeight,
        textAlign,
        margin,
        padding,
        ...style,
        ...settings.style,
      }}
    >
      {text || 'Edit text here...'}
    </p>
  );
};

Text.craft = {
  displayName: 'Text',
  props: {
    text: 'Hello World',
    fontSize: '16px',
    color: '#333',
    fontWeight: 'normal',
    textAlign: 'left',
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