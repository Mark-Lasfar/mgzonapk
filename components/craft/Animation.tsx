// /home/mark/Music/my-nextjs-project-clean/components/craft/Animation.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface AnimationProps {
  children?: React.ReactNode;
  animationType?: 'fade' | 'slide' | 'scale';
  duration?: string;
  delay?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Animation = ({
  children,
  animationType = 'fade',
  duration = '1s',
  delay = '0s',
  style = {},
  settings = {},
}: AnimationProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLDivElement>(null);

  const animationStyles = {
    fade: { animation: `fadeIn ${duration} ease-in-out ${delay}` },
    slide: { animation: `slideIn ${duration} ease-in-out ${delay}` },
    scale: { animation: `scaleIn ${duration} ease-in-out ${delay}` },
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
        ...animationStyles[animationType],
        ...style,
        ...settings.style,
      }}
    >
      {children || 'Add content here'}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

Animation.craft = {
  displayName: 'Animation',
  props: {
    animationType: 'fade',
    duration: '1s',
    delay: '0s',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};