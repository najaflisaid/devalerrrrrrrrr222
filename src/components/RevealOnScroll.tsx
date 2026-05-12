import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * RevealOnScroll — istənilən elementi/komponenti scroll-trigger fade-up animasiyası ilə göstərir.
 * `useReveal` hook-undan istifadə edir.
 *
 * <RevealOnScroll variant="up" delay={120}>
 *   <YourComponent />
 * </RevealOnScroll>
 */
interface RevealOnScrollProps {
  children: React.ReactNode;
  variant?: 'up' | 'left' | 'right' | 'fade' | 'scale';
  /** ms — animasiya başlamadan əvvəl gecikmə */
  delay?: number;
  /** IntersectionObserver threshold */
  threshold?: number;
  /** Bir dəfə görünsün, yoxsa hər dəfə? */
  once?: boolean;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

const RevealOnScroll: React.FC<RevealOnScrollProps> = ({
  children,
  variant = 'up',
  delay = 0,
  threshold = 0.1,
  once = true,
  className = '',
  as: Tag = 'div',
}) => {
  const { ref, revealed } = useReveal<HTMLElement>({ threshold, once });

  const variantClass =
    variant === 'left'
      ? 'dv-reveal-left'
      : variant === 'right'
      ? 'dv-reveal-right'
      : variant === 'fade'
      ? 'dv-reveal-fade'
      : variant === 'scale'
      ? 'dv-reveal-scale'
      : 'dv-reveal-up';

  return React.createElement(
    Tag as any,
    {
      ref: ref as any,
      className: `dv-reveal ${variantClass} ${revealed ? 'dv-reveal-in' : ''} ${className}`.trim(),
      style: delay ? { transitionDelay: `${delay}ms` } : undefined,
    },
    children
  );
};

export default RevealOnScroll;
