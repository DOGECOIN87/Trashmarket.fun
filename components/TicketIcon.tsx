import React from 'react';
import { Ticket } from 'lucide-react';

interface TicketIconProps {
  size?: number;
  className?: string;
}

export const TicketIcon: React.FC<TicketIconProps> = ({ size = 24, className = "" }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Ticket size={size} className="text-magic-green" />
    </div>
  );
};
