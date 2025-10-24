// /home/mark/Music/my-nextjs-project-clean/components/craft/Upsell.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface UpsellProps {
  title?: string;
  description?: string;
  productImage?: string;
  productName?: string;
  productPrice?: string;
  buttonText?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Upsell = ({
  title = 'Complete Your Purchase',
  description = 'Add this item to your cart for a better experience!',
  productImage = 'https://via.placeholder.com/150',
  productName = 'Upsell Product',
  productPrice = '$29.99',
  buttonText = 'Add to Cart',
  style = {},
  settings = {},
}: UpsellProps) => {
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
        border: '1px solid #ddd',
        padding: '20px',
        textAlign: 'center',
        borderRadius: '5px',
        ...style,
        ...settings.style,
      }}
    >
      <h3>{title}</h3>
      <p>{description}</p>
      <img src={productImage} alt={productName} style={{ width: '100px', height: 'auto' }} />
      <h4>{productName}</h4>
      <p>{productPrice}</p>
      <button
        style={{
          padding: '10px 20px',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
        }}
      >
        {buttonText}
      </button>
    </div>
  );
};

Upsell.craft = {
  displayName: 'Upsell',
  props: {
    title: 'Complete Your Purchase',
    description: 'Add this item to your cart for a better experience!',
    productImage: 'https://via.placeholder.com/150',
    productName: 'Upsell Product',
    productPrice: '$29.99',
    buttonText: 'Add to Cart',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};