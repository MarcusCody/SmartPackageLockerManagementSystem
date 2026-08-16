import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative w-full rounded-lg border px-4 py-3 text-sm', {
  variants: {
    variant: {
      default: 'bg-card text-card-foreground',
      success: 'border-green-200 bg-green-50 text-green-900',
      destructive: 'border-red-200 bg-red-50 text-red-900',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function Alert({
  className,
  variant,
  role = 'alert',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div role={role} className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<'h5'>) {
  return <h5 className={cn('mb-1 font-semibold leading-none', className)} {...props} />;
}

export { Alert, AlertTitle };
