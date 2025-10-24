// /home/mark/Music/my-nextjs-project-clean/components/craft/CountUp.tsx
'use client';
import React, { useRef, useState, useEffect } from 'react';
import { useNode } from '@craftjs/core';

interface CountUpProps {
  end?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const CountUp = ({
  end = 100,
  duration = 2,
  prefix = '',
  suffix = '',
  style = {},
  settings = {},
}: CountUpProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = end / (duration * 60); // 60 frames per second
    const timer = setInterval(() => {
      start += increment;
      setCount(Math.min(Math.floor(start), end));
      if (start >= end) clearInterval(timer);
    }, 1000 / 60);

    return () => clearInterval(timer);
  }, [end, duration]);

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
        fontSize: '2rem',
        fontWeight: 'bold',
        textAlign: 'center',
        ...style,
        ...settings.style,
      }}
    >
      {prefix}{count}{suffix}
    </div>
  );
};

CountUp.craft = {
  displayName: 'CountUp',
  props: {
    end: 100,
    duration: 2,
    prefix: '',
    suffix: '',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};