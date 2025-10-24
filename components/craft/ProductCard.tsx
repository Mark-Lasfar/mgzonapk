// /home/mark/Music/my-nextjs-project-clean/components/craft/ProductCard.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface ProductCardProps {
  image?: string;
  title?: string;
  price?: string;
  description?: string;
  buttonText?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const ProductCard = ({
  image = 'https://via.placeholder.com/200',
  title = 'Product Name',
  price = '$99.99',
  description = 'Product description goes here.',
  buttonText = 'Add to Cart',
  onClick,
  style = {},
  settings = {},
}: ProductCardProps) => {
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
        maxWidth: '300px',
        ...style,
        ...settings.style,
      }}
    >
      <img src={image} alt={title} style={{ width: '100%', height: 'auto' }} />
      <h3>{title}</h3>
      <p>{price}</p>
      <p>{description}</p>
      <button onClick={onClick}>{buttonText}</button>
    </div>
  );
};

ProductCard.craft = {
  displayName: 'ProductCard',
  props: {
    image: 'https://via.placeholder.com/200',
    title: 'Product Name',
    price: '$99.99',
    description: 'Product description goes here.',
    buttonText: 'Add to Cart',
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};