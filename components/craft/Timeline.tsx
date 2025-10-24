// /home/mark/Music/my-nextjs-project-clean/components/craft/Timeline.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface TimelineItem {
  title: string;
  date: string;
  description: string;
}

interface TimelineProps {
  items?: TimelineItem[];
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Timeline = ({
  items = [
    { title: 'Event 1', date: '2023-01-01', description: 'Description for event 1' },
    { title: 'Event 2', date: '2023-06-01', description: 'Description for event 2' },
  ],
  style = {},
  settings = {},
}: TimelineProps) => {
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
        ...style,
        ...settings.style,
      }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            marginBottom: '20px',
            position: 'relative',
            paddingLeft: '30px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '0',
              width: '10px',
              height: '10px',
              background: '#007bff',
              borderRadius: '50%',
              top: '5px',
            }}
          />
          <div>
            <h4>{item.title}</h4>
            <p style={{ color: '#666' }}>{item.date}</p>
            <p>{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

Timeline.craft = {
  displayName: 'Timeline',
  props: {
    items: [
      { title: 'Event 1', date: '2023-01-01', description: 'Description for event 1' },
      { title: 'Event 2', date: '2023-06-01', description: 'Description for event 2' },
    ],
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};