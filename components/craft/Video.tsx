// /home/mark/Music/my-nextjs-project-clean/components/craft/Video.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface VideoProps {
  src?: string;
  width?: string;
  height?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  style?: React.CSSProperties;
  settings?: Record<string, any>;
}

export const Video = ({
  src = 'https://www.example.com/sample-video.mp4',
  width = '100%',
  height = 'auto',
  autoPlay = false,
  loop = false,
  muted = true,
  style = {},
  settings = {},
}: VideoProps) => {
  const { connectors: { connect, drag } } = useNode();
  const ref = useRef<HTMLVideoElement>(null);

  return (
    <video
      ref={(element) => {
        ref.current = element;
        if (ref.current) {
          connect(ref);
          drag(ref);
        }
      }}
      src={src}
      width={width}
      height={height}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      controls
      style={{
        ...style,
        ...settings.style,
      }}
    />
  );
};

Video.craft = {
  displayName: 'Video',
  props: {
    src: 'https://www.example.com/sample-video.mp4',
    width: '100%',
    height: 'auto',
    autoPlay: false,
    loop: false,
    muted: true,
    style: {},
    settings: {},
  },
  rules: {
    canDrag: () => true,
    canDrop: () => true,
  },
};