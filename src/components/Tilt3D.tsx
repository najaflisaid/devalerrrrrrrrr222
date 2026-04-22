import React, { useRef } from 'react';

interface Tilt3DProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number; // degrees
  onClick?: () => void;
  testId?: string;
}

/**
 * Lightweight 3D tilt on mouse move. No dependencies.
 * Disabled automatically on coarse-pointer devices.
 */
const Tilt3D: React.FC<Tilt3DProps> = ({
  children,
  className = '',
  maxTilt = 8,
  onClick,
  testId,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--ry', `${x * maxTilt}deg`);
    el.style.setProperty('--rx', `${-y * maxTilt}deg`);
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  return (
    <div
      ref={ref}
      className={`dv-tilt ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
    </div>
  );
};

export default Tilt3D;
