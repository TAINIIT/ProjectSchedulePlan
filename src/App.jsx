import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Upload, Save, Globe, Calendar, Clock,
    ChevronDown, ChevronUp, CreditCard, Info, Layers,
    FileSpreadsheet, HelpCircle, X, ZoomIn, ZoomOut, Maximize2, Minimize2,
    Eye, EyeOff, Moon, Sun, Undo2, Redo2, FileImage, FileText,
    CheckSquare, XSquare, Paintbrush, Move, PanelLeftClose, PanelLeft
} from 'lucide-react';
import { HeaderTimeline } from './components/gantt/HeaderTimeline';
import { GanttRow } from './components/gantt/GanttRow';
import { Button } from './components/ui/Button';
import { OnboardingTour } from './components/ui/OnboardingTour';
import { Card } from './components/ui/Card';
import { TRANSLATIONS, INITIAL_DATA } from './constants/data';
import { cn } from './lib/utils';
import { exportExcel } from './utils/exportExcel';
import { exportPdf, exportImage } from './utils/exportPdf';
import { useHistory } from './hooks/useHistory';
import { saveToFirestore, loadFromFirestore, auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from './utils/firebase';
import { LogIn, LogOut, User } from 'lucide-react';

const PADDING_COLS = 2;
const DEFAULT_CELL_WIDTH = 48;

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_VI = ['Thg 1', 'Thg 2', 'Thg 3', 'Thg 4', 'Thg 5', 'Thg 6', 'Thg 7', 'Thg 8', 'Thg 9', 'Thg 10', 'Thg 11', 'Thg 12'];

const DEFAULT_COLORS = [
    '#4F46E5', '#059669', '#0891B2', '#D97706',
    '#7C3AED', '#DC2626', '#DB2777', '#EA580C',
];

// ─── TIMELINE ENGINE ───────────────────────────────────────
function generateTimeline(startDate, durationMonths, lang) {
    const start = new Date(startDate);
    const weeks = [];
    const months = [];
    const monthNames = lang === 'vi' ? MONTHS_VI : MONTHS_EN;

    for (let i = 0; i < PADDING_COLS; i++) {
        weeks.push({ date: null, isPadding: true });
    }

    const endDate = new Date(start.getFullYear(), start.getMonth() + durationMonths, 1);
    let currentDate = new Date(start);
    let weekIndex = 0;

    while (currentDate < endDate) {
        weeks.push({ date: new Date(currentDate).toISOString(), weekIndex: weekIndex++, isPadding: false });
        currentDate.setDate(currentDate.getDate() + 7);
    }
    const totalWeeks = weekIndex;

    const activeWeeks = weeks.filter(w => !w.isPadding);
    let currentMonth = null;
    let monthCount = 0;

    activeWeeks.forEach((w, i) => {
        const d = new Date(w.date);
        const monthKey = `${d.getFullYear()}-${d.getMonth()}`;

        if (i < activeWeeks.length - 1) {
            const nextD = new Date(activeWeeks[i + 1].date);
            w.isMonthEnd = d.getMonth() !== nextD.getMonth();
        } else {
            w.isMonthEnd = true;
        }

        if (monthKey !== currentMonth) {
            if (currentMonth !== null) months[months.length - 1].count = monthCount;
            months.push({ label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`, count: 0 });
            currentMonth = monthKey;
            monthCount = 0;
        }
        monthCount++;
    });
    if (months.length > 0) months[months.length - 1].count = monthCount;

    return { weeks, months, totalWeeks, activeWeeks };
}

// ─── RENUMBER (start from 0, assign colors) ────────────────
function renumberTasks(tasks) {
    let mainNo = -1, subCounters = {}, currentGroup = 0, currentColor = DEFAULT_COLORS[0];
    return tasks.map(t => {
        if (t.type === 'payment') return { ...t, no: '💰', group: currentGroup };
        if (t.level === 0) {
            mainNo++;
            currentGroup = mainNo;
            subCounters[mainNo] = 0;
            currentColor = t.color || DEFAULT_COLORS[mainNo % DEFAULT_COLORS.length];
            return { ...t, no: `${mainNo}`, group: mainNo, color: currentColor };
        } else {
            subCounters[mainNo] = (subCounters[mainNo] || 0) + 1;
            return { ...t, no: `${mainNo}.${subCounters[mainNo]}`, group: currentGroup, color: t.color || currentColor };
        }
    });
}

function saveJSON(tasks, startDate, durationMonths, lang, projectTitle) {
    const data = { version: '1.2', savedAt: new Date().toISOString(), config: { startDate, durationMonths, lang, projectTitle }, tasks };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MOST_Schedule_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// (localStorage loading removed -- using Firebase only)

// ═══════════════════════════════════════════════════════════
export default function App() {
    const [lang, setLang] = useState('vi');
    const [startDate, setStartDate] = useState('2025-01-06');
    const [durationMonths, setDurationMonths] = useState(9);
    const { state: tasks, setState: setTasks, undo, redo, canUndo, canRedo } = useHistory(renumberTasks(INITIAL_DATA));
    const [showGuide, setShowGuide] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [showDashboard, setShowDashboard] = useState(true);
    const [density, setDensity] = useState('comfort'); // 'comfort' | 'compact'
    const [showTour, setShowTour] = useState(false); // Onboarding tour
    const [toast, setToast] = useState(null);
    const [projectTitle, setProjectTitle] = useState('');
    const [cellWidth, setCellWidth] = useState(DEFAULT_CELL_WIDTH);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('gantt-dark') === 'true');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [showTaskCol, setShowTaskCol] = useState(true);
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());

    const [collapsedMonths, setCollapsedMonths] = useState(new Set());
    const [user, setUser] = useState(null); // Auth state

    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error(error);
            showToast('Login failed', 'danger');
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            showToast('Logged out');
            // Optionally reset state to default
        } catch (error) {
            console.error(error);
        }
    };

    // ─── AUTH LISTENER ───────────────────────────────────────
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Load user data
                const data = await loadFromFirestore(currentUser.uid);
                if (data) {
                    // Restore data logic with safety checks
                    if (data.config) {
                        if (data.config.startDate) setStartDate(data.config.startDate);
                        if (data.config.durationMonths) setDurationMonths(data.config.durationMonths);
                        if (data.config.lang) setLang(data.config.lang);
                        if (data.config.projectTitle !== undefined) setProjectTitle(data.config.projectTitle);
                    }
                    if (data.tasks && Array.from(data.tasks).length > 0) {
                        setTasks(renumberTasks(data.tasks));
                    }
                    showToast(lang === 'vi' ? `Xin chào ${currentUser.displayName}!` : `Welcome ${currentUser.displayName}!`);
                }
            } else {
                // Handle logout or initial load (maybe load default demo data?)
                const data = await loadFromFirestore(null); // Load 'default' doc
                if (data && data.tasks) {
                    setTasks(renumberTasks(data.tasks));
                }
            }
        });
        return () => unsubscribe();
    }, [lang, showToast, setTasks]);

    const dragRef = useRef(null);
    const fileInputRef = useRef(null);
    const ganttRef = useRef(null);
    const t = TRANSLATIONS[lang];
    const displayTitle = projectTitle || t.title;
    const timeline = generateTimeline(startDate, durationMonths, lang);

    // ─── TODAY INDEX ─────────────────────────────────────────
    const todayIndex = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const active = timeline.activeWeeks || timeline.weeks.filter(w => !w.isPadding);
        for (let i = 0; i < active.length; i++) {
            const wd = new Date(active[i].date);
            const nextWd = i + 1 < active.length ? new Date(active[i + 1].date) : new Date(wd.getTime() + 7 * 86400000);
            if (today >= wd && today < nextWd) return i;
        }
        return null;
    }, [timeline]);

    // ─── DARK MODE persistence ───────────────────────────────
    useEffect(() => {
        localStorage.setItem('gantt-dark', darkMode);
    }, [darkMode]);

    // ─── AUTO-SAVE to Firestore ONLY (debounced 2s) ──────────
    const handleSaveCloud = useCallback(async () => {
        const success = await saveToFirestore({
            config: { startDate, durationMonths, lang, projectTitle },
            tasks
        }, user ? user.uid : null);

        if (success) showToast(lang === 'vi' ? 'Đã lưu lên Cloud!' : 'Saved to Cloud!');
        else showToast(lang === 'vi' ? 'Lỗi khi lưu!' : 'Save failed!', 'danger');
    }, [tasks, startDate, durationMonths, lang, projectTitle, showToast, user]);

    useEffect(() => {
        const fbTimer = setTimeout(() => {
            handleSaveCloud();
        }, 2000);

        return () => clearTimeout(fbTimer);
    }, [tasks, startDate, durationMonths, lang, projectTitle, handleSaveCloud]);

    useEffect(() => {
        // Clear local storage legacy data
        localStorage.removeItem('gantt-project');
    }, []);

    // ─── KEYBOARD SHORTCUTS ──────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo();
            }
            if (e.key === 'Escape') {
                setSelectedIds(new Set());
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [undo, redo]);

    // ─── SMART SCROLL (Shift+Scroll or Middle-button) ────────
    useEffect(() => {
        const el = ganttRef.current;
        if (!el) return;
        const handler = (e) => {
            if (e.shiftKey || e.deltaX !== 0) {
                // Shift+wheel → horizontal
                if (e.shiftKey && e.deltaX === 0) {
                    e.preventDefault();
                    el.scrollLeft += e.deltaY;
                }
            }
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);



    // ─── ONBOARDING CHECK ────────────────────────────────────
    useEffect(() => {
        const tourDone = localStorage.getItem('gantt-tour-done');
        if (!tourDone) {
            setTimeout(() => setShowTour(true), 1000);
        }
    }, []);

    // ─── CRUD ─────────────────────────────────────────────
    const handleUpdate = useCallback((id, field, value) => {
        setTasks(prev => prev.map(t => (t.id === id ? { ...t, [field]: value } : t)));
    }, [setTasks]);

    const handleAddTask = useCallback(() => {
        setTasks(prev => renumberTasks([...prev, { id: `t_${Date.now()}`, nameVi: 'Công việc mới', nameEn: 'New Task', startWeek: 0, duration: 2, type: 'task', level: 0, isOnsite: false }]));
        showToast(lang === 'vi' ? 'Đã thêm công việc' : 'Task added');
    }, [lang, showToast, setTasks]);

    const handleAddPayment = useCallback(() => {
        setTasks(prev => renumberTasks([...prev, { id: `p_${Date.now()}`, nameVi: 'Thanh toán mới', nameEn: 'New Payment', type: 'payment', startWeek: 0, level: 0 }]));
        showToast(lang === 'vi' ? 'Đã thêm mốc thanh toán' : 'Payment milestone added');
    }, [lang, showToast, setTasks]);

    const handleAddSub = useCallback((parentId) => {
        setTasks(prev => {
            const idx = prev.findIndex(t => t.id === parentId);
            if (idx === -1) return prev;
            const parent = prev[idx];
            let ins = idx + 1;
            while (ins < prev.length && prev[ins].level > 0) ins++;
            const newTasks = [...prev];
            newTasks.splice(ins, 0, { id: `sub_${Date.now()}`, nameVi: 'Mục con mới', nameEn: 'New Sub-item', startWeek: parent.startWeek, duration: 1, type: 'task', level: 1, isOnsite: false, color: parent.color });
            return renumberTasks(newTasks);
        });
        showToast(lang === 'vi' ? 'Đã thêm mục con' : 'Sub-item added');
    }, [lang, showToast, setTasks]);

    const handleDelete = useCallback((id) => {
        setTasks(prev => renumberTasks(prev.filter(t => t.id !== id)));
        setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        showToast(lang === 'vi' ? 'Đã xóa' : 'Deleted', 'danger');
    }, [lang, showToast, setTasks]);

    // ─── COLOR CHANGE (propagate to sub-tasks) ────────────
    const handleColorChange = useCallback((taskId, newColor) => {
        setTasks(prev => {
            const task = prev.find(t => t.id === taskId);
            if (!task) return prev;
            const group = task.group;
            return prev.map(t => {
                if (t.group === group && t.type !== 'payment') return { ...t, color: newColor };
                return t;
            });
        });
    }, [setTasks]);

    // ─── DRAG ─────────────────────────────────────────────
    const handleDragStart = useCallback((e, taskId) => {
        e.preventDefault();
        const startX = e.clientX;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        dragRef.current = { taskId, startX, origWeek: task.startWeek };
        const onMove = (me) => {
            if (!dragRef.current) return;
            const dx = me.clientX - dragRef.current.startX;
            const newWeek = Math.max(-PADDING_COLS, dragRef.current.origWeek + Math.round(dx / cellWidth));
            setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, startWeek: newWeek } : t)));
        };
        const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [tasks, cellWidth, setTasks]);

    const handleResizeStart = useCallback((e, taskId) => {
        e.preventDefault(); e.stopPropagation();
        const startX = e.clientX;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const origDur = task.duration || 1;
        const onMove = (me) => {
            const newDur = Math.max(1, origDur + Math.round((me.clientX - startX) / cellWidth));
            setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, duration: newDur } : t)));
        };
        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [tasks, cellWidth, setTasks]);

    // ─── MULTI-SELECT ─────────────────────────────────────
    const handleSelect = useCallback((taskId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        setSelectedIds(new Set(tasks.map(t => t.id)));
    }, [tasks]);

    const handleDeselectAll = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const handleBatchColor = useCallback((color) => {
        setTasks(prev => prev.map(t => selectedIds.has(t.id) && t.type !== 'payment' ? { ...t, color } : t));
        showToast(lang === 'vi' ? `Đã đổi màu ${selectedIds.size} mục` : `Changed color for ${selectedIds.size} items`);
    }, [selectedIds, setTasks, showToast, lang]);

    const handleBatchMove = useCallback((delta) => {
        setTasks(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, startWeek: Math.max(-PADDING_COLS, t.startWeek + delta) } : t));
        showToast(lang === 'vi' ? `Đã dời ${selectedIds.size} mục` : `Moved ${selectedIds.size} items`);
    }, [selectedIds, setTasks, showToast, lang]);

    const handleBatchDelete = useCallback(() => {
        setTasks(prev => renumberTasks(prev.filter(t => !selectedIds.has(t.id))));
        setSelectedIds(new Set());
        showToast(lang === 'vi' ? 'Đã xóa các mục đã chọn' : 'Deleted selected items', 'danger');
    }, [selectedIds, setTasks, showToast, lang]);

    // ─── GROUP COLLAPSE ──────────────────────────────────────
    const handleToggleCollapse = useCallback((taskId) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    }, []);

    const visibleTasks = useMemo(() => {
        const result = [];
        let currentParentId = null;
        let isParentCollapsed = false;
        for (const task of tasks) {
            if (task.type === 'task' && task.level === 0) {
                currentParentId = task.id;
                isParentCollapsed = collapsedGroups.has(task.id);
                result.push(task);
            } else if (task.type === 'payment') {
                result.push(task);
            } else {
                if (!isParentCollapsed) result.push(task);
            }
        }
        return result;
    }, [tasks, collapsedGroups]);

    // ─── ZOOM ─────────────────────────────────────────────
    const handleFitScreen = useCallback(() => {
        const available = window.innerWidth - 500;
        const fitted = Math.max(16, Math.min(48, Math.floor(available / timeline.totalWeeks)));
        setCellWidth(fitted);
    }, [timeline.totalWeeks]);

    // ─── EXPORT ───────────────────────────────────────────
    const handleExportPdf = useCallback(() => {
        if (ganttRef.current) {
            exportPdf(ganttRef.current, projectTitle || 'MOST_Schedule', displayTitle, lang);
            showToast(lang === 'vi' ? 'Đã xuất PDF' : 'PDF exported');
        }
    }, [projectTitle, displayTitle, lang, showToast]);

    const handleExportImage = useCallback(() => {
        if (ganttRef.current) {
            exportImage(ganttRef.current, projectTitle || 'MOST_Schedule', displayTitle, lang);
            showToast(lang === 'vi' ? 'Đã xuất hình ảnh' : 'Image exported');
        }
    }, [projectTitle, displayTitle, lang, showToast]);

    // ─── MONTH COLLAPSE ──────────────────────────────────────
    const handleToggleMonth = useCallback((monthIndex) => {
        setCollapsedMonths(prev => {
            const next = new Set(prev);
            if (next.has(monthIndex)) next.delete(monthIndex);
            else next.add(monthIndex);
            return next;
        });
    }, []);

    // ─── LOAD JSON ────────────────────────────────────────
    const handleLoadJSON = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                if (data.config) {
                    setStartDate(data.config.startDate || '2025-01-06');
                    setDurationMonths(data.config.durationMonths || 9);
                    if (data.config.lang) setLang(data.config.lang);
                    if (data.config.projectTitle) setProjectTitle(data.config.projectTitle);
                }
                if (data.tasks) setTasks(renumberTasks(data.tasks));
                showToast(lang === 'vi' ? 'Đã tải dự án' : 'Project loaded');
            } catch { showToast(lang === 'vi' ? 'Lỗi đọc file' : 'Error reading file', 'danger'); }
        };
        reader.readAsText(file);
        e.target.value = '';
    }, [lang, showToast, setTasks]);

    const handleExportXlsx = useCallback(() => {
        exportExcel(tasks, timeline, lang, startDate, durationMonths);
        showToast(lang === 'vi' ? 'Đã xuất Excel' : 'Excel exported');
    }, [tasks, timeline, lang, startDate, durationMonths, showToast]);

    const payments = tasks.filter(t => t.type === 'payment');
    const paymentCount = payments.length;
    const taskCount = tasks.filter(t => t.type === 'task' && t.level > 0).length;

    return (
        <div className={cn("min-h-screen flex flex-col transition-colors duration-300 relative", darkMode ? "dark" : "")}>
            {/* Onboarding Tour */}
            <OnboardingTour show={showTour} onClose={() => { setShowTour(false); localStorage.setItem('gantt-tour-done', 'true'); }} />

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -40, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -40, x: '-50%' }}
                        className={cn("fixed top-6 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-float font-heading font-bold text-sm glass border-none text-slate-800 dark:text-white", toast.type === 'danger' ? 'bg-red-500/10 text-red-600 border-red-200' : 'bg-primary/10 text-primary border-primary/20')}>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="shrink-0 z-50 bg-white/80 dark:bg-slate-800/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700 shadow-sm">
                <div className="max-w-[1800px] mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-md">
                            <Layers size={20} className="text-white" />
                        </div>
                        <div>
                            <input
                                className="text-lg font-heading font-black text-slate-800 dark:text-slate-100 tracking-tight bg-transparent outline-none border-b-2 border-transparent hover:border-slate-200 dark:hover:border-slate-600 focus:border-primary transition-all w-[400px]"
                                value={displayTitle}
                                onChange={(e) => setProjectTitle(e.target.value)}
                                placeholder={t.title}
                            />
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{t.subtitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Undo/Redo */}
                        <div className="flex items-center gap-0.5 mr-2">
                            <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
                                className={cn("p-2 rounded-lg transition-all", canUndo ? "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary" : "text-slate-200 dark:text-slate-600 cursor-not-allowed")}>
                                <Undo2 size={16} />
                            </button>
                            <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"
                                className={cn("p-2 rounded-lg transition-all", canRedo ? "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary" : "text-slate-200 dark:text-slate-600 cursor-not-allowed")}>
                                <Redo2 size={16} />
                            </button>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => setShowConfig(!showConfig)}>
                            <Calendar size={14} /> {t.config}
                            {showConfig ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </Button>
                        <div className="flex items-center gap-2">
                            {/* User Profile / Login */}
                            {user ? (
                                <div className="flex items-center gap-2 mr-2 bg-slate-100 dark:bg-slate-800 rounded-full pl-1 pr-3 py-1 border border-slate-200 dark:border-slate-700">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt="Avatar" className="w-6 h-6 rounded-full" />
                                    ) : <User size={16} />}
                                    <span className="text-xs font-bold truncate max-w-[100px]">{user.displayName}</span>
                                    <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 ml-1" title="Logout">
                                        <LogOut size={14} />
                                    </button>
                                </div>
                            ) : (
                                <Button onClick={handleLogin} className="mr-2 h-8 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200">
                                    <LogIn size={14} className="mr-1" />
                                    Sign In
                                </Button>
                            )}

                            <button onClick={() => setDensity(d => d === 'comfort' ? 'compact' : 'comfort')}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-primary/40 hover:text-primary active:scale-95"
                                title={density === 'comfort' ? "Switch to Compact Mode" : "Switch to Comfort Mode"}>
                                {density === 'comfort' ? <Maximize2 size={14} className="rotate-45" /> : <Minimize2 size={14} className="rotate-45" />}
                                {density === 'comfort' ? (lang === 'vi' ? 'Thoáng' : 'Comfort') : (lang === 'vi' ? 'Gọn' : 'Compact')}
                            </button>
                            <button onClick={() => setLang(l => l === 'vi' ? 'en' : 'vi')}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-primary/40 hover:text-primary active:scale-95">
                                <Globe size={14} /> {lang === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
                            </button>
                            {/* Dark Mode Toggle */}
                            <button onClick={() => setDarkMode(d => !d)}
                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-amber-400 hover:text-primary hover:border-primary/30 dark:hover:border-amber-500/30 transition-all active:scale-95" title="Dark Mode">
                                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                            <button onClick={() => setShowGuide(!showGuide)}
                                className={cn("p-2 rounded-xl border transition-all active:scale-95", showGuide ? "bg-primary/10 border-primary/30 text-primary" : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-400 hover:text-primary hover:border-primary/30")}>
                                <HelpCircle size={18} />
                            </button>
                        </div>
                    </div>
                </div>
                <AnimatePresence>
                    {showConfig && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-700">
                            <div className="max-w-[1800px] mx-auto px-6 py-3 flex items-center gap-6 bg-slate-50/50 dark:bg-slate-800/50">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                                    <Calendar size={14} className="text-primary" /> {t.startDate}
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="ml-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                                </label>
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                                    <Clock size={14} className="text-primary" /> {t.durationMonths}
                                    <input type="number" min={1} max={36} value={durationMonths} onChange={e => setDurationMonths(parseInt(e.target.value) || 9)} className="ml-1 w-20 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 text-center focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                                </label>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            {/* Main */}
            <main className="flex-1 flex flex-col min-h-0 max-w-[1800px] w-full mx-auto px-6 py-3 gap-3">
                {/* Guide */}
                <AnimatePresence>
                    {showGuide && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden shrink-0">
                            <Card className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/30 dark:to-violet-900/30 border-indigo-100 dark:border-indigo-800">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2"><Info size={18} className="text-primary" /><h3 className="font-heading font-bold text-primary text-lg">{t.howTo}</h3></div>
                                    <button onClick={() => setShowGuide(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={16} /></button>
                                </div>
                                {/* Category: Editing */}
                                <div className="mb-3">
                                    <div className="text-xs font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-2">{t.guideEditCat}</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                        {[t.guide1, t.guide2, t.guide3, t.guide4, t.guide5].map((g, i) => (
                                            <div key={i} className="flex items-start gap-2 p-2.5 bg-white/60 dark:bg-slate-800/60 rounded-xl text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                {g}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Category: View */}
                                <div className="mb-3">
                                    <div className="text-xs font-black text-cyan-500 dark:text-cyan-400 uppercase tracking-wider mb-2">{t.guideViewCat}</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                        {[t.guide6, t.guide7, t.guide8, t.guide9].map((g, i) => (
                                            <div key={i} className="flex items-start gap-2 p-2.5 bg-white/60 dark:bg-slate-800/60 rounded-xl text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                {g}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Category: Data */}
                                <div className="mb-3">
                                    <div className="text-xs font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-wider mb-2">{t.guideDataCat}</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                        {[t.guide10, t.guide11, t.guide12, t.guide13].map((g, i) => (
                                            <div key={i} className="flex items-start gap-2 p-2.5 bg-white/60 dark:bg-slate-800/60 rounded-xl text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                {g}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Category: Appearance */}
                                <div>
                                    <div className="text-xs font-black text-purple-500 dark:text-purple-400 uppercase tracking-wider mb-2">{t.guideStyleCat}</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                        {[t.guide14].map((g, i) => (
                                            <div key={i} className="flex items-start gap-2 p-2.5 bg-white/60 dark:bg-slate-800/60 rounded-xl text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                {g}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Dashboard Toggle */}
                <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setShowDashboard(v => !v)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-primary transition-colors">
                        {showDashboard ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showDashboard ? (lang === 'vi' ? 'Ẩn Dashboard' : 'Hide Dashboard') : (lang === 'vi' ? 'Hiện Dashboard' : 'Show Dashboard')}
                    </button>
                </div>
                <AnimatePresence>
                    {showDashboard && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden shrink-0">
                            <div className="grid grid-cols-3 gap-4">
                                <Card className="text-center py-4 px-3">
                                    <div className="text-3xl font-heading font-black text-primary">{timeline.totalWeeks}</div>
                                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">{t.totalWeeks}</div>
                                    <div className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">{t.weeks}</div>
                                </Card>
                                <Card className="text-center py-4 px-3">
                                    <div className="text-3xl font-heading font-black text-amber-500">{paymentCount}</div>
                                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">{t.milestones}</div>
                                    {payments.length > 0 && (
                                        <div className="mt-3 space-y-1.5 text-left">
                                            {payments.map((p, i) => (
                                                <div key={p.id} className="flex items-start gap-1.5 text-[10px] leading-tight">
                                                    <span className="text-amber-500 shrink-0 mt-0.5">◆</span>
                                                    <span className="text-slate-500 dark:text-slate-400 line-clamp-2">{lang === 'vi' ? p.nameVi : p.nameEn}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                                <Card className="text-center py-4 px-3">
                                    <div className="text-3xl font-heading font-black text-emerald-500">{taskCount}</div>
                                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">{lang === 'vi' ? 'Công việc con' : 'Sub-tasks'}</div>
                                </Card>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Multi-select toolbar */}
                <AnimatePresence>
                    {selectedIds.size > 0 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden shrink-0">
                            <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl border border-blue-200 dark:border-blue-800">
                                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                    {selectedIds.size} {lang === 'vi' ? 'đã chọn' : 'selected'}
                                </span>
                                <div className="w-px h-6 bg-blue-200 dark:bg-blue-700" />
                                <div className="flex items-center gap-1">
                                    {DEFAULT_COLORS.slice(0, 6).map(c => (
                                        <button key={c} onClick={() => handleBatchColor(c)}
                                            className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 shadow-sm hover:scale-125 transition-transform"
                                            style={{ backgroundColor: c }} title={lang === 'vi' ? 'Đổi màu' : 'Change color'} />
                                    ))}
                                </div>
                                <div className="w-px h-6 bg-blue-200 dark:bg-blue-700" />
                                <button onClick={() => handleBatchMove(-1)} className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-slate-600 text-xs font-bold" title="Move left">
                                    <Move size={12} className="rotate-180" /> ◁
                                </button>
                                <button onClick={() => handleBatchMove(1)} className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-slate-600 text-xs font-bold" title="Move right">
                                    <Move size={12} /> ▷
                                </button>
                                <div className="w-px h-6 bg-blue-200 dark:bg-blue-700" />
                                <Button variant="danger" size="sm" onClick={handleBatchDelete}>
                                    {lang === 'vi' ? 'Xóa đã chọn' : 'Delete selected'}
                                </Button>
                                <button onClick={handleDeselectAll} className="ml-auto text-xs font-bold text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1">
                                    <XSquare size={12} /> {lang === 'vi' ? 'Bỏ chọn' : 'Deselect'}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Actions + Zoom */}
                <div className="flex flex-wrap items-center gap-3 p-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-100 dark:border-slate-700 shadow-soft shrink-0">
                    <Button id="tour-add-task" onClick={handleAddTask} size="sm"><Plus size={14} /> {lang === 'vi' ? 'Thêm Công việc' : 'Add Task'}</Button>
                    <Button onClick={handleAddPayment} variant="secondary" size="sm"><CreditCard size={14} /> {lang === 'vi' ? 'Thêm Thanh toán' : 'Add Payment'}</Button>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-600 mx-1" />
                    <Button id="tour-export" variant="secondary" size="sm" onClick={handleExportXlsx}><FileSpreadsheet size={14} /> Excel</Button>
                    <Button variant="secondary" size="sm" onClick={handleExportPdf}><FileText size={14} /> PDF</Button>
                    <Button variant="secondary" size="sm" onClick={handleExportImage}><FileImage size={14} /> PNG</Button>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-600 mx-1" />
                    <Button variant="secondary" size="sm" onClick={() => saveJSON(tasks, startDate, durationMonths, lang, projectTitle)}><Save size={14} /> {t.saveJson}</Button>
                    <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> {t.loadJson}</Button>
                    <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadJSON} />
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-600 mx-1" />
                    {/* Multi-select buttons */}
                    <button onClick={handleSelectAll} title={lang === 'vi' ? 'Chọn tất cả' : 'Select All'}
                        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-primary transition-all">
                        <CheckSquare size={14} />
                    </button>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-600 mx-1" />
                    {/* Toggle task column */}
                    <button onClick={() => setShowTaskCol(v => !v)} title={showTaskCol ? (lang === 'vi' ? 'Ẩn cột công việc' : 'Hide task column') : (lang === 'vi' ? 'Hiện cột công việc' : 'Show task column')}
                        className={cn("p-1.5 rounded-md transition-all", showTaskCol ? "text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700" : "text-primary bg-primary/10")}>
                        {showTaskCol ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
                    </button>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-600 mx-1" />
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                        <button onClick={() => setCellWidth(w => Math.max(16, w - 8))} className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 hover:text-primary transition-all" title="Zoom out"><ZoomOut size={14} /></button>
                        <button onClick={handleFitScreen} className="px-2 py-1 rounded-md hover:bg-white dark:hover:bg-slate-600 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-primary transition-all" title="Fit to screen"><Maximize2 size={14} /></button>
                        <button onClick={() => setCellWidth(w => Math.min(64, w + 8))} className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 hover:text-primary transition-all" title="Zoom in"><ZoomIn size={14} /></button>
                        <button onClick={() => setCellWidth(DEFAULT_CELL_WIDTH)} className="px-2 py-1 rounded-md hover:bg-white dark:hover:bg-slate-600 text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-primary transition-all">100%</button>
                    </div>
                </div>

                {/* Gantt Chart */}
                <Card className="flex-1 min-h-0 p-0 overflow-hidden">
                    <div ref={ganttRef} className="h-full overflow-auto">
                        <HeaderTimeline timeline={timeline} paddingCols={PADDING_COLS} lang={lang} cellWidth={cellWidth} showTaskCol={showTaskCol} todayIndex={todayIndex} collapsedMonths={collapsedMonths} onToggleMonth={handleToggleMonth} />
                        <div>
                            <AnimatePresence>
                                {visibleTasks.map(task => (
                                    <GanttRow key={task.id} task={task} timeline={timeline} paddingCols={PADDING_COLS} lang={lang} cellWidth={cellWidth}
                                        onUpdate={handleUpdate} onAddSub={handleAddSub} onDelete={handleDelete}
                                        onDragStart={handleDragStart} onResizeStart={handleResizeStart} onColorChange={handleColorChange}
                                        isSelected={selectedIds.has(task.id)} onSelect={handleSelect} showTaskCol={showTaskCol}
                                        todayIndex={todayIndex}
                                        isCollapsed={collapsedGroups.has(task.id)}
                                        onToggleCollapse={handleToggleCollapse}
                                        collapsedMonths={collapsedMonths}
                                        density={density}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                        {tasks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-slate-600">
                                <Layers size={48} strokeWidth={1} />
                                <p className="mt-4 text-sm font-medium">{lang === 'vi' ? 'Chưa có công việc.' : 'No tasks yet.'}</p>
                            </div>
                        )}
                    </div>
                </Card>
            </main>
        </div>
    );
}
