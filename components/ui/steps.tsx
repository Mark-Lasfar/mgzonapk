// master/components/ui/steps.tsx
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface StepProps {
  title: string;
  key: string;
}

interface StepsProps {
  children: React.ReactElement<StepProps>[];
  current: number;
  onChange?: (index: number) => void;
}

export function Steps({ children, current, onChange }: StepsProps) {
  return (
    <nav className="flex justify-between mb-6">
      {children.map((child, index) => (
        <div
          key={child.props.key}
          className={cn(
            'flex-1 text-center p-4 cursor-pointer rounded-md',
            current === index ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
          )}
          onClick={() => onChange && onChange(index)}
        >
          {child.props.title}
        </div>
      ))}
    </nav>
  );
}

export function Step({ title }: StepProps) {
  return null; // Step is just a marker component
}