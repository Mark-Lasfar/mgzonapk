// /home/mark/Music/my-nextjs-project-clean/components/craft/Navigation.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface NavItem {
  label: string;
  href: string;
}

interface NavigationProps {
  items?: NavItem[];
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Navigation = ({
  items = [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    { label: 'Contact', href: '/contact' },
  ],
  style = {},
  settings = {},
}: NavigationProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLElement>(null);

  return (
    <nav
      ref={(element) => {
        ref.current = element;
        if (ref.current) {
          connect(ref);
          drag(ref);
        }
      }}
      style={{
        display: 'flex',
        gap: '20px',
        padding: '10px',
        backgroundColor: '#f8f8f8',
        ...style,
        ...settings.style,
      }}
    >
      {items.map((item, index) => (
        <a key={index} href={item.href} style={{ textDecoration: 'none', color: '#333' }}>
          {item.label}
        </a>
      ))}
    </nav>
  );
};

Navigation.craft = {
  displayName: 'Navigation',
  props: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Products', href: '/products' },
      { label: 'Contact', href: '/contact' },
    ],
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};