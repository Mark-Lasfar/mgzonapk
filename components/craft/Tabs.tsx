// /home/mark/Music/my-nextjs-project-clean/components/craft/Tabs.tsx
'use client';
import React, { useRef, useState } from 'react';
import { useNode } from '@craftjs/core';

interface Tab {
  label: string;
  content: string;
}

interface TabsProps {
  tabs?: Tab[];
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Tabs = ({
  tabs = [
    { label: 'Tab 1', content: 'Content for Tab 1' },
    { label: 'Tab 2', content: 'Content for Tab 2' },
    { label: 'Tab 3', content: 'Content for Tab 3' },
  ],
  style = {},
  settings = {},
}: TabsProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState(0);

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
      <div style={{ display: 'flex', borderBottom: '1px solid #ddd' }}>
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === index ? '#007bff' : 'transparent',
              color: activeTab === index ? 'white' : '#333',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ padding: '20px', border: '1px solid #ddd', borderTop: 'none' }}>
        {tabs[activeTab]?.content}
      </div>
    </div>
  );
};

Tabs.craft = {
  displayName: 'Tabs',
  props: {
    tabs: [
      { label: 'Tab 1', content: 'Content for Tab 1' },
      { label: 'Tab 2', content: 'Content for Tab 2' },
      { label: 'Tab 3', content: 'Content for Tab 3' },
    ],
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};