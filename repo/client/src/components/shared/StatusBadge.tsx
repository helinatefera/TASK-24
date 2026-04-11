import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const colorMap: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  approved: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  verified: 'bg-green-100 text-green-800',
  paid: 'bg-green-100 text-green-800',
  resolved: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  open: 'bg-blue-100 text-blue-800',
  draft: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
  denied: 'bg-red-100 text-red-800',
  suspended: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  disputed: 'bg-orange-100 text-orange-800',
  investigating: 'bg-purple-100 text-purple-800',
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  const colors = colorMap[normalized] || 'bg-gray-100 text-gray-800';
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${colors} ${sizeClasses}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}
