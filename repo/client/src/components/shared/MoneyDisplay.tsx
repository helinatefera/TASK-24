import React from 'react';
import { formatCents } from '../../utils/formatters';

interface MoneyDisplayProps {
  cents: number;
  className?: string;
  showSign?: boolean;
}

export default function MoneyDisplay({ cents, className = '', showSign = false }: MoneyDisplayProps) {
  const isNegative = cents < 0;
  const colorClass = isNegative ? 'text-red-600' : showSign && cents > 0 ? 'text-green-600' : '';

  return (
    <span className={`font-mono ${colorClass} ${className}`}>
      {showSign && cents > 0 ? '+' : ''}
      {formatCents(cents)}
    </span>
  );
}
