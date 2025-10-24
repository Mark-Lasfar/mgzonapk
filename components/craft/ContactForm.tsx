'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface ContactFormProps {
  endpoint?: string;
  backgroundColor?: string;
  padding?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const ContactForm = ({
  endpoint,
  backgroundColor = '#fff',
  padding = '20px',
  style = {},
  settings = {},
}: ContactFormProps) => {
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
        padding,
        border: '1px solid #ccc',
        borderRadius: '4px',
        ...style,
        ...settings.style,
      }}
    >
      <form action={endpoint || '#'} method="POST">
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="name">Name</label>
          <input type="text" id="name" name="name" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="email">Email</label>
          <input type="email" id="email" name="email" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="message">Message</label>
          <textarea id="message" name="message" style={{ width: '100%', padding: '8px' }} />
        </div>
        <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#ff6600', color: 'white', border: 'none' }}>
          Submit
        </button>
      </form>
    </div>
  );
};

ContactForm.craft = {
  displayName: 'ContactForm',
  props: {
    endpoint: '',
    backgroundColor: '#fff',
    padding: '20px',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};