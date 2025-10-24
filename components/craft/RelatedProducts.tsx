// /home/mark/Music/my-nextjs-project-clean/components/craft/RelatedProducts.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface Product {
  image: string;
  title: string;
  price: string;
}

interface RelatedProductsProps {
  products?: Product[];
  title?: string;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const RelatedProducts = ({
  products = [
    { image: 'https://via.placeholder.com/150', title: 'Product 1', price: '$39.99' },
    { image: 'https://via.placeholder.com/150', title: 'Product 2', price: '$49.99' },
    { image: 'https://via.placeholder.com/150', title: 'Product 3', price: '$59.99' },
  ],
  title = 'Related Products',
  style = {},
  settings = {},
}: RelatedProductsProps) => {
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
      <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>{title}</h3>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {products.map((product, index) => (
          <div
            key={index}
            style={{
              border: '1px solid #ddd',
              padding: '10px',
              textAlign: 'center',
              width: '200px',
              borderRadius: '5px',
            }}
          >
            <img src={product.image} alt={product.title} style={{ width: '100%', height: 'auto' }} />
            <h4>{product.title}</h4>
            <p>{product.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

RelatedProducts.craft = {
  displayName: 'RelatedProducts',
  props: {
    products: [
      { image: 'https://via.placeholder.com/150', title: 'Product 1', price: '$39.99' },
      { image: 'https://via.placeholder.com/150', title: 'Product 2', price: '$49.99' },
      { image: 'https://via.placeholder.com/150', title: 'Product 3', price: '$59.99' },
    ],
    title: 'Related Products',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};