import React from 'react';
import { type VariantProps } from 'tailwind-variants';
import { tv } from './utils';

type ButtonVariants = VariantProps<typeof button>;

export interface ButtonProps
  extends ButtonVariants, React.ButtonHTMLAttributes<HTMLButtonElement> {}

const button = tv({
  base: 'group relative inline-flex cursor-pointer items-center justify-center gap-space-200 rounded-(--border-radius) leading-none whitespace-nowrap inset-ring-(length:--default-border-width) [--border-radius:var(--radius-200)] focus-visible:outline-none',
  variants: {
    variant: {
      primary: 'bg-brand-default text-brand-on-brand inset-ring-brand-default hover:bg-brand-hover',
      neutral:
        'bg-default-secondary text-default-default inset-ring-default-default hover:bg-default-secondary-hover',
      subtle:
        'bg-transparent text-brand-default inset-ring-transparent hover:bg-default-default-hover',
      'danger-primary':
        'bg-danger-default text-danger-on-danger inset-ring-danger-secondary hover:bg-danger-hover hover:inset-ring-danger-default',
      'danger-subtle':
        'bg-transparent text-danger-default inset-ring-transparent hover:bg-danger-tertiary-hover',
    },
    size: {
      small: 'p-space-200 typography-body-small',
      medium: 'p-space-300 typography-body-base',
    },
    disabled: {
      true: 'pointer-events-none cursor-default bg-disabled-default text-disabled-default inset-ring-disabled-default',
    },
  },
});

export function Button({ variant = 'primary', size = 'medium', ...props }: ButtonProps) {
  return (
    <button type="button" {...props} className={button({ variant, size, ...props })}>
      <span className="absolute inset-[calc(var(--offset)*-1)] rounded-[calc(var(--border-radius)+var(--offset))] ring [--offset:calc(var(--default-border-width)*2)] not-group-focus-visible:hidden" />
      {props.children}
    </button>
  );
}
