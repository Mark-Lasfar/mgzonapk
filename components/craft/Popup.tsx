// /home/mark/Music/my-nextjs-project-clean/components/craft/Popup.tsx
'use client';
import React, { useRef, useState } from 'react';
import { useNode } from '@craftjs/core';

interface PopupProps {
  triggerText?: string;
  content?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Popup = ({
  triggerText = 'Open Popup',
  content = 'This is the popup content.',
  style = {},
  settings = {},
}: PopupProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

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
        ...style,
        ...settings.style,
      }}
    >
      <button
        onClick={() => setIsOpen(true)}
        style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}
      >
        {triggerText}
      </button>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            padding: '20px',
            border: '1px solid #ddd',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            zIndex: 1000,
          }}
        >
          <p>{content}</p>
          <button
            onClick={() => setIsOpen(false)}
            style={{ padding: '5px 10px', background: '#ff4d4f', color: 'white', border: 'none' }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

Popup.craft = {
  displayName: 'Popup',
  props: {
    triggerText: 'Open Popup',
    content: 'This is the popup content.',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};