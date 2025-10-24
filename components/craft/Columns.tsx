'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface ColumnsProps {
  columns?: number;
  gap?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Columns = ({
  columns = 2,
  gap = '20px',
  children,
  style = {},
  settings = {},
}: ColumnsProps) => {
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
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
        ...style,
        ...settings?.style,
      }}
    >
      {children ? (
        // عرض المحتوى الديناميكي إذا كان موجودًا
        React.Children.map(children, (child, index) => (
          <div key={index} style={{ padding: '10px', border: '1px solid #ddd' }}>
            {child}
          </div>
        ))
      ) : (
        // عرض الأعمدة الافتراضية إذا مفيش محتوى ديناميكي
        Array.from({ length: columns }).map((_, index) => (
          <div key={index} style={{ padding: '10px', border: '1px solid #ddd' }}>
            Column {index + 1}
          </div>
        ))
      )}
    </div>
  );
};

Columns.craft = {
  displayName: 'Columns',
  props: {
    columns: 2,
    gap: '20px',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};