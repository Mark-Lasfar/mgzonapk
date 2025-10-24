// /home/mark/Music/my-nextjs-project-clean/components/craft/QuickView.tsx
'use client';
import React, { useRef, useState } from 'react';
import { useNode } from '@craftjs/core';

interface QuickViewProps {
  productImage?: string;
  productName?: string;
  productPrice?: string;
  productDescription?: string;
  buttonText?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const QuickView = ({
  productImage = 'https://via.placeholder.com/200',
  productName = 'Product Name',
  productPrice = '$99.99',
  productDescription = 'Quick view of the product details.',
  buttonText = 'View Details',
  style = {},
  settings = {},
}: QuickViewProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

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
      <button
        onClick={() => setIsOpen(true)}
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
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            padding: '20px',
            border: '1px solid #ddd',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            zIndex: 1000,
            maxWidth: '400px',
            textAlign: 'center',
          }}
        >
          <img src={productImage} alt={productName} style={{ width: '100%', height: 'auto' }} />
          <h3>{productName}</h3>
          <p>{productPrice}</p>
          <p>{productDescription}</p>
          <button
            onClick={() => setIsOpen(false)}
            style={{ padding: '5px 10px', background: '#ff4d4f', color: 'white', border: 'none' }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

QuickView.craft = {
  displayName: 'QuickView',
  props: {
    productImage: 'https://via.placeholder.com/200',
    productName: 'Product Name',
    productPrice: '$99.99',
    productDescription: 'Quick view of the product details.',
    buttonText: 'View Details',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};