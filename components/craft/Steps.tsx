// /home/mark/Music/my-nextjs-project-clean/components/craft/Steps.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface Step {
  title: string;
  description: string;
}

interface StepsProps {
  steps?: Step[];
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Steps = ({
  steps = [
    { title: 'Step 1', description: 'Description for step 1' },
    { title: 'Step 2', description: 'Description for step 2' },
    { title: 'Step 3', description: 'Description for step 3' },
  ],
  style = {},
  settings = {},
}: StepsProps) => {
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
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        ...style,
        ...settings.style,
      }}
    >
      {steps.map((step, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
          }}
        >
          <div
            style={{
              width: '30px',
              height: '30px',
              background: '#007bff',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {index + 1}
          </div>
          <div>
            <h4>{step.title}</h4>
            <p>{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

Steps.craft = {
  displayName: 'Steps',
  props: {
    steps: [
      { title: 'Step 1', description: 'Description for step 1' },
      { title: 'Step 2', description: 'Description for step 2' },
      { title: 'Step 3', description: 'Description for step 3' },
    ],
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};