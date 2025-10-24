'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface PricingTableProps {
  plans?: Array<{ title: string; price: number; features: string[] }>;
  backgroundColor?: string;
  textColor?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const PricingTable = ({
  plans = [
    { title: 'Basic', price: 10, features: ['Feature 1', 'Feature 2'] },
    { title: 'Pro', price: 20, features: ['Feature 1', 'Feature 2', 'Feature 3'] },
  ],
  backgroundColor = '#f9f9f9',
  textColor = '#333',
  style = {},
  settings = {},
}: PricingTableProps) => {
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
        color: textColor,
        padding: '20px',
        display: 'flex',
        gap: '20px',
        ...style,
        ...settings.style,
      }}
    >
      {plans.map((plan, index) => (
        <div key={index} style={{ border: '1px solid #ddd', padding: '15px', flex: 1 }}>
          <h3>{plan.title}</h3>
          <p>${plan.price}/month</p>
          <ul>
            {plan.features.map((feature, i) => (
              <li key={i}>{feature}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

PricingTable.craft = {
  displayName: 'Pricing Table',
  props: {
    plans: [
      { title: 'Basic', price: 10, features: ['Feature 1', 'Feature 2'] },
      { title: 'Pro', price: 20, features: ['Feature 1', 'Feature 2', 'Feature 3'] },
    ],
    backgroundColor: '#f9f9f9',
    textColor: '#333',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};