// /home/mark/Music/my-nextjs-project-clean/components/craft/Newsletter.tsx
'use client';
import React, { useRef, useState } from 'react';
import { useNode } from '@craftjs/core';

interface NewsletterProps {
  title?: string;
  placeholder?: string;
  buttonText?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Newsletter = ({
  title = 'Subscribe to our Newsletter',
  placeholder = 'Enter your email',
  buttonText = 'Subscribe',
  style = {},
  settings = {},
}: NewsletterProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate newsletter subscription
    alert(`Subscribed with: ${email}`);
    setEmail('');
  };

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
        padding: '20px',
        textAlign: 'center',
        background: '#f8f8f8',
        borderRadius: '5px',
        ...style,
        ...settings.style,
      }}
    >
      <h3>{title}</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          style={{ padding: '10px', width: '200px', marginRight: '10px', borderRadius: '5px', border: '1px solid #ddd' }}
        />
        <button
          type="submit"
          style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          {buttonText}
        </button>
      </form>
    </div>
  );
};

Newsletter.craft = {
  displayName: 'Newsletter',
  props: {
    title: 'Subscribe to our Newsletter',
    placeholder: 'Enter your email',
    buttonText: 'Subscribe',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};