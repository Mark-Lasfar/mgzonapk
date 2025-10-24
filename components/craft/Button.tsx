'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface ButtonProps {
  text?: string;
  backgroundColor?: string;
  color?: string;
  padding?: string;
  borderRadius?: string;
  fontSize?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const CraftButton = ({
  text,
  backgroundColor = '#ff6600',
  color = 'white',
  padding = '10px 20px',
  borderRadius = '4px',
  fontSize = '16px',
  onClick,
  style = {},
  settings = {},
}: ButtonProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={(element) => {
        ref.current = element;
        if (ref.current) {
          connect(ref);
          drag(ref);
        }
      }}
      onClick={onClick}
      style={{
        backgroundColor,
        color,
        padding,
        borderRadius,
        fontSize,
        border: 'none',
        cursor: 'pointer',
        ...style,
        ...settings.style,
      }}
    >
      {text || 'Click me'}
    </button>
  );
};

CraftButton.craft = {
  displayName: 'Button',
  props: {
    text: 'Click me',
    backgroundColor: '#ff6600',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '4px',
    fontSize: '16px',
    onClick: () => {},
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};