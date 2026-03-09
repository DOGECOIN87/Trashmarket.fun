import React from 'react';

interface TicketIconProps {
  size?: number;
  className?: string;
}

export const TicketIcon: React.FC<TicketIconProps> = ({ size = 24, className = "" }) => {
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width: size * 2, height: size }}>
      <img
        src="/assets/raffle-ticket.svg"
        alt="Raffle Ticket"
        style={{ width: size * 2, height: size }}
        className="object-contain"
      />
    </div>
  );
};
