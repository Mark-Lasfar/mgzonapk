// /home/mark/Music/my-nextjs-project-clean/types/craft.d.ts
declare module '@craftjs/core' {
  import React from 'react';

  export * from '@craftjs/core';

  export interface CraftComponentProps {
    children?: React.ReactNode;
    text?: string;
    src?: string;
    onClick?: () => void;
    style?: React.CSSProperties;
    settings?: Record<string, any>;
  }

  export class Editor<P = {}> extends React.Component<P> {}
  export class Frame<P = {}> extends React.Component<P> {}
  export class Element<P = {}> extends React.Component<P> {}

  export function useNode<T = any>(): {
    id: string;
    connectors: {
      connect: (ref: React.MutableRefObject<HTMLElement | null>) => void;
      drag: (ref: React.MutableRefObject<HTMLElement | null>) => void;
    };
    actions: T;
    isHovered: boolean;
    isSelected: boolean;
    isDragging: boolean;
    name: string;
    draggable: boolean;
    droppable: boolean;
    canDrag: () => boolean;
    canDrop: () => boolean;
  };
}

declare module 'craftjs-components' {
  export const Text: React.FC<any>;
  export const Image: React.FC<any>;
  export const Button: React.FC<any>;
  export const Hero: React.FC<any>;
  export const Footer: React.FC<any>;
  export const ContactForm: React.FC<any>;
  export const FeaturesGrid: React.FC<any>;
  export const PricingTable: React.FC<any>;
  export const Carousel: React.FC<any>;
  export const Heading: React.FC<any>;
  export const Divider: React.FC<any>;
  export const Spacer: React.FC<any>;
  export const Cta: React.FC<any>;
  export const Faq: React.FC<any>;
  export const Video: React.FC<any>;
  export const Slider: React.FC<any>;
  export const Gallery: React.FC<any>;
  export const Columns: React.FC<any>;
  export const Accordion: React.FC<any>;
  export const Tabs: React.FC<any>;
  export const Testimonials: React.FC<any>;
  export const TestimonialCarousel: React.FC<any>;
  export const Logos: React.FC<any>;
  export const Timeline: React.FC<any>;
  export const Steps: React.FC<any>;
  export const Animation: React.FC<any>;
  export const CountUp: React.FC<any>;
  export const Popup: React.FC<any>;
  export const Newsletter: React.FC<any>;
  export const Map: React.FC<any>;
  export const Products: React.FC<any>;
  export const ProductCard: React.FC<any>;
  export const CollectionBanner: React.FC<any>;
  export const Upsell: React.FC<any>;
  export const RelatedProducts: React.FC<any>;
  export const QuickView: React.FC<any>;
  export const CarouselProducts: React.FC<any>;
  export const Reviews: React.FC<any>;
  export const Breadcrumbs: React.FC<any>;
  export const Navigation: React.FC<any>;
  export const Sidebar: React.FC<any>;
  export const BlogPosts: React.FC<any>;
  export const Article: React.FC<any>;
  export const BackgroundVideo: React.FC<any>;
  export const IconGrid: React.FC<any>;
  export const ImageGrid: React.FC<any>;
  export const ShapeDivider: React.FC<any>;
}