import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { Card } from './Card';
import { ChevronRight, Check, X, LampDesk, Activity, MousePointerClick } from 'lucide-react';

const STEPS = [
    {
        title: "Welcome to Project Schedule",
        desc: "A powerful, intuitive Gantt chart for modern project management. Track tasks, payments, and timelines in one place.",
        icon: <LampDesk size={48} className="text-primary" />
    },
    {
        title: "Smart Interaction",
        desc: "• Drag tasks to move them\n• Drag edges to resize\n• Right-click to edit details\n• Ctrl+Z to Undo",
        icon: <MousePointerClick size={48} className="text-blue-500" />
    },
    {
        title: "Track Finance",
        desc: "Add 'Payment Milestones' to track cash flow (marked with ◆). View the financial dashboard for quick insights.",
        icon: <Activity size={48} className="text-emerald-500" />
    }
];

export const OnboardingTour = ({ show, onClose }) => {
    const [step, setStep] = useState(0);

    const handleNext = () => {
        if (step < STEPS.length - 1) setStep(step + 1);
        else onClose();
    };

    if (!show) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            >
                <Card className="max-w-md w-full relative overflow-hidden bg-white/90 dark:bg-slate-800/90 shadow-2xl border-primary/20">
                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 h-1 bg-slate-100 w-full">
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                        />
                    </div>

                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X size={20} />
                    </button>

                    <div className="pt-6 pb-2 text-center flex flex-col items-center">
                        <motion.div
                            key={step}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', bounce: 0.5 }}
                            className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center mb-6 shadow-float"
                        >
                            {STEPS[step].icon}
                        </motion.div>

                        <motion.h2
                            key={`t-${step}`}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="text-2xl font-heading font-black text-slate-800 dark:text-slate-100 mb-3"
                        >
                            {STEPS[step].title}
                        </motion.h2>

                        <motion.div
                            key={`d-${step}`}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-line px-4"
                        >
                            {STEPS[step].desc}
                        </motion.div>
                    </div>

                    <div className="mt-8 flex items-center justify-between">
                        <div className="flex gap-1.5 ml-2">
                            {STEPS.map((_, i) => (
                                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} />
                            ))}
                        </div>
                        <Button onClick={handleNext} className="gap-2 shadow-lg shadow-primary/20">
                            {step === STEPS.length - 1 ? 'Get Started' : 'Next'}
                            {step === STEPS.length - 1 ? <Check size={16} /> : <ChevronRight size={16} />}
                        </Button>
                    </div>
                </Card>
            </motion.div>
        </AnimatePresence>
    );
};
