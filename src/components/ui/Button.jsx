import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
    primary: "bg-primary text-white hover:bg-primary-dark shadow-md hover:shadow-lg",
    secondary: "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 hover:border-slate-300 shadow-sm",
    ghost: "bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200",
    danger: "bg-danger/10 text-danger hover:bg-danger/20",
};

export const Button = ({ variant = 'primary', size = 'md', className, children, ...props }) => {
    const sizeClasses = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
    };

    return (
        <button
            className={cn(
                "rounded-xl font-heading font-bold transition-all duration-200 flex items-center gap-2 justify-center active:scale-95",
                variants[variant],
                sizeClasses[size],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
};
