import React from 'react'
import { cva } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export const cn = (...inputs) => twMerge(clsx(inputs))
const variants = cva('button', {
  variants: {
    variant: {
      default: 'button-default',
      outline: 'button-outline',
      ghost: 'button-ghost',
    },
    size: { default: 'button-md', sm: 'button-sm', icon: 'button-icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})
export const Button = React.forwardRef(
  ({ className, variant, size, ...props }, ref) => (
    <button
      type="button"
      ref={ref}
      className={cn(variants({ variant, size }), className)}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
