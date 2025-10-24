'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface DividerProps {
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderWidth?: string;
  borderColor?: string;
  margin?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Divider = ({
  borderStyle = 'solid',
  borderWidth = '1px',
  borderColor = '#ccc',
  margin = '20px 0',
  style = {},
  settings = {},
}: DividerProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLHRElement>(null);

  return (
    <hr
      ref={(element) => {
        ref.current = element;
        if (ref.current) {
          connect(ref);
          drag(ref);
        }
      }}

      style={{
        borderStyle,
        borderWidth,
        borderColor,
        margin,
        ...style,
        ...settings.style,
      }}
    />
  );
};

Divider.craft = {
  displayName: 'Divider',
  props: {
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: '#ccc',
    margin: '20px 0',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};