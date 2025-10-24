// /home/mark/Music/my-nextjs-project-clean/components/craft/Accordion.tsx
'use client';
import React, { useRef, useState } from 'react';
import { useNode } from '@craftjs/core';

interface AccordionItem {
  title: string;
  content: string;
}

interface AccordionProps {
  items?: AccordionItem[];
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Accordion = ({
  items = [
    { title: 'Section 1', content: 'Content for section 1' },
    { title: 'Section 2', content: 'Content for section 2' },
  ],
  style = {},
  settings = {},
}: AccordionProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggleAccordion = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
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
        ...style,
        ...settings.style,
      }}
    >
      {items.map((item, index) => (
        <div key={index} style={{ borderBottom: '1px solid #ddd' }}>
          <button
            onClick={() => toggleAccordion(index)}
            style={{ width: '100%', padding: '10px', textAlign: 'left' }}
          >
            {item.title}
          </button>
          {activeIndex === index && (
            <div style={{ padding: '10px' }}>{item.content}</div>
          )}
        </div>
      ))}
    </div>
  );
};

Accordion.craft = {
  displayName: 'Accordion',
  props: {
    items: [
      { title: 'Section 1', content: 'Content for section 1' },
      { title: 'Section 2', content: 'Content for section 2' },
    ],
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};