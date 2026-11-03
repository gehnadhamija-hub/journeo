import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  // Base classes with interactive micro-animations and accessibility focus rings
  const baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 select-none outline-none focus-visible:ring-2 focus-visible:ring-deep-green focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]';

  // Variant classes
  const variantClasses = {
    primary:
      'bg-deep-green hover:bg-deep-green-dark text-white border border-transparent shadow-soft-sm hover:shadow-soft-md hover:-translate-y-0.5',
    secondary:
      'bg-ivory hover:bg-ivory-dark text-text border border-border shadow-soft-sm hover:border-sandstone hover:-translate-y-0.5',
    outline:
      'bg-transparent hover:bg-sage/10 text-deep-green border border-sage/40 hover:border-deep-green shadow-none',
    ghost:
      'bg-transparent hover:bg-ivory-dark/60 text-text-muted hover:text-text border border-transparent shadow-none',
    destructive:
      'bg-terracotta/10 hover:bg-terracotta text-terracotta hover:text-white border border-terracotta/30 hover:border-transparent',
    icon:
      'bg-ivory hover:bg-ivory-dark text-text-subtle hover:text-text border border-border p-2 rounded-xl shadow-soft-sm'
  };

  // Size classes
  const sizeClasses = {
    sm: variant === 'icon' ? 'p-1.5 text-xs' : 'px-3 py-1.5 text-xs gap-1.5',
    md: variant === 'icon' ? 'p-2.5 text-sm' : 'px-5 py-2.5 text-xs gap-2',
    lg: variant === 'icon' ? 'p-3.5 text-base' : 'px-7 py-3.5 text-sm gap-2.5'
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
};

