// /home/mark/Music/my-nextjs-project-clean/components/craft/Footer.tsx
'use client';
import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';

interface FooterProps {
    text?: string;
    backgroundColor?: string;
    color?: string;
    padding?: string;
    style?: React.CSSProperties;
    settings?: Record<string, any>;
}

export const Footer = ({
    text,
    backgroundColor = '#333',
    color = 'white',
    padding = '20px',
    style = {},
    settings = {},
}: FooterProps) => {
    const { connectors: { connect, drag } } = useNode();
    const ref = useRef<HTMLElement>(null);


    return (
        <footer
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
                textAlign: 'center',
                ...style,
                ...settings.style,
            }}
        >
            <p>{text || 'Footer content'}</p>
        </footer>
    );
};

Footer.craft = {
    displayName: 'Footer',
    props: {
        text: 'Footer content',
        backgroundColor: '#333',
        color: 'white',
        padding: '20px',
        style: {},
        settings: {},
    },
    rules: {
        canDrag: () => true,
        canDrop: () => true,
    },
};