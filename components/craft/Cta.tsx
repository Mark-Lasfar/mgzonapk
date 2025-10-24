'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface CtaProps {
  text?: string;
  buttonText?: string;
  buttonLink?: string;
  backgroundColor?: string;
  color?: string;
  padding?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Cta = ({
  text = 'Call to Action',
  buttonText = 'Click Here',
  buttonLink = '#',
  backgroundColor = '#007bff',
  color = 'white',
  padding = '20px',
  style = {},
  settings = {},
}: CtaProps) => {
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
        backgroundColor,
        color,
        padding,
        textAlign: 'center',
        ...style,
        ...settings.style,
      }}
    >
      <h3>{text}</h3>
      <a
        href={buttonLink}
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          backgroundColor: '#fff',
          color: backgroundColor,
          textDecoration: 'none',
          borderRadius: '5px',
        }}
      >
        {buttonText}
      </a>
    </div>
  );
};

Cta.craft = {
  displayName: 'CTA',
  props: {
    text: 'Call to Action',
    buttonText: 'Click Here',
    buttonLink: '#',
    backgroundColor: '#007bff',
    color: 'white',
    padding: '20px',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};