// /home/mark/Music/my-nextjs-project-clean/components/craft/Products.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface Product {
  image: string;
  title: string;
  price: string;
}

interface ProductsProps {
  products?: Product[];
  columns?: number;
  gap?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Products = ({
  products = [
    { image: 'https://via.placeholder.com/200', title: 'Product 1', price: '$49.99' },
    { image: 'https://via.placeholder.com/200', title: 'Product 2', price: '$59.99' },
    { image: 'https://via.placeholder.com/200', title: 'Product 3', price: '$69.99' },
  ],
  columns = 3,
  gap = '20px',
  style = {},
  settings = {},
}: ProductsProps) => {
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
        ...settings.style,
      }}
    >
      {products.map((product, index) => (
        <div
          key={index}
          style={{
            border: '1px solid #ddd',
            padding: '10px',
            textAlign: 'center',
            borderRadius: '5px',
          }}
        >
          <img src={product.image} alt={product.title} style={{ width: '100%', height: 'auto' }} />
          <h4>{product.title}</h4>
          <p>{product.price}</p>
        </div>
      ))}
    </div>
  );
};

Products.craft = {
  displayName: 'Products',
  props: {
    products: [
      { image: 'https://via.placeholder.com/200', title: 'Product 1', price: '$49.99' },
      { image: 'https://via.placeholder.com/200', title: 'Product 2', price: '$59.99' },
      { image: 'https://via.placeholder.com/200', title: 'Product 3', price: '$69.99' },
    ],
    columns: 3,
    gap: '20px',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};