import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

const variants = {
    primary: "bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20",
    secondary: "bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:border-primary/40 transition-all",
    ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20",
};

export const Button = ({ variant = 'primary', size = 'md', className, children, ...props }) => {
    const sizeClasses = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
    };

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
                "rounded-xl font-heading font-bold transition-colors duration-200 flex items-center gap-2 justify-center",
                variants[variant],
                sizeClasses[size],
                className
            )}
            {...props}
        >
            {children}
        </motion.button>
    );
};
