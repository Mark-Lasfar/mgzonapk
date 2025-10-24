'use client';

import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeProps {
  children: string;
  language: string;
}

export function Code({ children, language }: CodeProps) {
  return (
    <div className="relative">
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        customStyle={{
          padding: '1rem',
          borderRadius: '0.5rem',
          fontSize: '0.9rem',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}