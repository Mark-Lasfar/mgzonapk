'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface FaqProps {
  items?: { question: string; answer: string }[];
  backgroundColor?: string;
  color?: string;
  padding?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Faq = ({
  items = [
    { question: 'What is this?', answer: 'This is an FAQ item.' },
    { question: 'How does it work?', answer: 'It works great!' },
  ],
  backgroundColor = '#f9f9f9',
  color = '#333',
  padding = '20px',
  style = {},
  settings = {},
}: FaqProps) => {
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
        backgroundColor,
        color,
        padding,
        ...style,
        ...settings.style,
      }}
    >
      <h2>FAQ</h2>
      {items.map((item, index) => (
        <div key={index} style={{ marginBottom: '15px' }}>
          <h4>{item.question}</h4>
          <p>{item.answer}</p>
        </div>
      ))}
    </div>
  );
};

Faq.craft = {
  displayName: 'FAQ',
  props: {
    items: [
      { question: 'What is this?', answer: 'This is an FAQ item.' },
      { question: 'How does it work?', answer: 'It works great!' },
    ],
    backgroundColor: '#f9f9f9',
    color: '#333',
    padding: '20px',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};