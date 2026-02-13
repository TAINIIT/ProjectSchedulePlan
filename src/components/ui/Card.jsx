import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export const Card = ({ children, className, ...props }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "glass shadow-glass text-slate-800 dark:text-slate-100 p-6",
                "hover:shadow-float transition-all duration-300",
                className
            )}
            {...props}
        >
            {children}
        </motion.div>
    );
};
