import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Plus, Trash2, MapPin, CornerDownRight, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

const COLOR_PALETTE = [
    '#4F46E5', '#059669', '#0891B2', '#D97706',
    '#7C3AED', '#DC2626', '#DB2777', '#EA580C',
    '#065F46', '#1E40AF', '#92400E', '#6D28D9',
];

/**
 * Convert hex color to rgba with specified alpha
 */
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const GanttRow = ({
    task, timeline, paddingCols, lang, cellWidth,
    onUpdate, onAddSub, onDelete, onDragStart, onResizeStart, onColorChange,
    isSelected, onSelect, showTaskCol = true,
    isCollapsed, onToggleCollapse, todayIndex,
    collapsedMonths = new Set(),
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
    const [tooltip, setTooltip] = useState(null);
    const [tooltipPos, setTooltipPos] = useState(null);
    const progressDragging = useRef(false);
    const barRef = useRef(null);
    const colorDotRef = useRef(null);
    const isTask = task.type === 'task';
    const isPayment = task.type === 'payment';
    const isSub = task.level > 0;
    const activeWeeks = timeline.activeWeeks || timeline.weeks.filter(w => !w.isPadding);
    const barColor = task.color || '#4F46E5';
    const progress = task.progress || 0;

    // Close picker on outside click / scroll
    useEffect(() => {
        if (!showPicker) return;
        const close = () => setShowPicker(false);
        window.addEventListener('scroll', close, true);
        const onClick = (e) => {
            if (colorDotRef.current && !colorDotRef.current.contains(e.target)) {
                setShowPicker(false);
            }
        };
        window.addEventListener('mousedown', onClick);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('mousedown', onClick);
        };
    }, [showPicker]);

    const handleColorDotClick = (e) => {
        e.stopPropagation();
        if (showPicker) { setShowPicker(false); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        setPickerPos({ top: rect.bottom + 4, left: rect.left });
        setShowPicker(true);
    };

    const handleRowClick = (e) => {
        if (onSelect && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSelect(task.id);
        }
    };

    // ─── PROGRESS DRAG ───────────────────────────────────────
    const handleProgressMouseDown = useCallback((e) => {
        e.stopPropagation();
        e.preventDefault();
        progressDragging.current = true;
        const barEl = e.currentTarget.closest('[data-taskbar]');
        if (!barEl) return;
        const barRect = barEl.getBoundingClientRect();
        const barWidth = barRect.width;

        const onMove = (ev) => {
            if (!progressDragging.current) return;
            const x = ev.clientX - barRect.left;
            const pct = Math.max(0, Math.min(100, Math.round((x / barWidth) * 100)));
            onUpdate(task.id, 'progress', pct);
        };
        const onUp = () => {
            progressDragging.current = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [task.id, onUpdate]);

    // ─── TOOLTIP HELPERS ─────────────────────────────────────
    const getDateForWeek = (weekIndex) => {
        const w = activeWeeks[weekIndex];
        if (w && w.date) return new Date(w.date);
        return null;
    };

    const formatDate = (d) => {
        if (!d) return '—';
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    const handleBarMouseEnter = (e) => {
        const startDate = getDateForWeek(task.startWeek);
        const endWeek = task.startWeek + (task.duration || 1) - 1;
        const endDate = getDateForWeek(endWeek);
        setTooltip({
            name: lang === 'vi' ? task.nameVi : task.nameEn,
            start: formatDate(startDate),
            end: formatDate(endDate),
            duration: `${task.duration || 0} ${lang === 'vi' ? 'tuần' : 'weeks'}`,
            progress: `${progress}%`,
        });
        // Calculate position from bar's bounding rect
        const bar = e.currentTarget;
        if (bar) {
            const rect = bar.getBoundingClientRect();
            const tooltipH = 80; // approximate tooltip height
            const showBelow = rect.top < tooltipH + 20; // flip if too close to viewport top
            setTooltipPos({
                left: rect.left + rect.width / 2,
                top: showBelow ? rect.bottom + 8 : rect.top - tooltipH - 4,
                below: showBelow,
            });
        }
    };

    const handleBarMouseLeave = () => {
        setTooltip(null);
        setTooltipPos(null);
    };

    return (
        <motion.div layout
            onClick={handleRowClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "flex group border-b border-slate-50 dark:border-slate-700/50 transition-colors h-12 relative",
                isPayment ? "bg-amber-50/20 hover:bg-amber-50/40 dark:bg-amber-900/10 dark:hover:bg-amber-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/30",
                isSelected && "bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500"
            )}
        >
            {showTaskCol && (
                <>
                    {/* Col 1: No + Collapse toggle */}
                    <div style={{ minWidth: 50 }} className="sticky left-0 z-30 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 border-r border-slate-100 dark:border-slate-700 flex items-center justify-center shrink-0">
                        {task.level === 0 && isTask && onToggleCollapse ? (
                            <button onClick={(e) => { e.stopPropagation(); onToggleCollapse(task.id); }}
                                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 transition-colors">
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                        ) : (
                            <>
                                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:hidden">{task.no}</div>
                                <div className="hidden group-hover:flex cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-500 hover:text-indigo-500"><GripVertical size={16} /></div>
                            </>
                        )}
                    </div>

                    {/* Col 2: Task Name — overflow-visible so color picker isn't clipped */}
                    <div style={{ minWidth: 350 }} className="sticky left-[50px] z-30 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 border-r border-slate-100 dark:border-slate-700 px-3 flex flex-col justify-center shrink-0 overflow-visible">
                        <div className={cn("flex items-center gap-2", task.level > 0 && "pl-6")}>
                            {task.level > 0 ? (
                                <CornerDownRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
                            ) : isTask ? (
                                <div className="relative shrink-0" ref={colorDotRef}>
                                    <div className="w-3.5 h-3.5 rounded-full cursor-pointer border-2 border-white dark:border-slate-800 shadow-sm hover:scale-125 transition-transform"
                                        style={{ backgroundColor: barColor }}
                                        onClick={handleColorDotClick}
                                    />
                                    {showPicker && createPortal(
                                        <div className="fixed z-[9999] bg-white dark:bg-slate-700 rounded-xl shadow-2xl p-2 flex flex-wrap gap-1.5 w-[120px] border border-slate-200 dark:border-slate-600 animate-in fade-in duration-150"
                                            style={{ top: pickerPos.top, left: pickerPos.left }}
                                            onClick={e => e.stopPropagation()}
                                            onMouseDown={e => e.stopPropagation()}>
                                            {COLOR_PALETTE.map(c => (
                                                <div key={c} className={cn("w-5 h-5 rounded-full cursor-pointer hover:scale-125 transition-transform border-2", c === barColor ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent')}
                                                    style={{ backgroundColor: c }}
                                                    onClick={() => { onColorChange(task.id, c); setShowPicker(false); }}
                                                />
                                            ))}
                                        </div>,
                                        document.body
                                    )}
                                </div>
                            ) : (
                                <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            )}
                            <input
                                className="flex-1 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:text-primary focus:font-bold transition-all truncate"
                                value={lang === 'vi' ? task.nameVi : task.nameEn}
                                onChange={e => onUpdate(task.id, lang === 'vi' ? 'nameVi' : 'nameEn', e.target.value)}
                            />
                            {/* Progress % label */}
                            {isTask && progress > 0 && (
                                <span className="text-[10px] font-bold text-primary/70 shrink-0">{progress}%</span>
                            )}
                        </div>
                        {/* Hover actions */}
                        <div className={cn("flex items-center gap-2 mt-0.5 ml-6 text-[10px] overflow-hidden transition-all duration-200", isHovered ? "h-auto opacity-100" : "h-0 opacity-0")}>
                            {isTask && (
                                <>
                                    <label className="flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1 rounded hover:border-primary/50">
                                        <span className="text-slate-400 dark:text-slate-500 font-bold">W:</span>
                                        <input type="number" className="w-7 outline-none bg-transparent font-bold text-slate-600 dark:text-slate-300" value={task.startWeek} onChange={e => onUpdate(task.id, 'startWeek', parseInt(e.target.value) || 0)} />
                                    </label>
                                    <label className="flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1 rounded hover:border-primary/50">
                                        <span className="text-slate-400 dark:text-slate-500 font-bold">D:</span>
                                        <input type="number" className="w-7 outline-none bg-transparent font-bold text-slate-600 dark:text-slate-300" value={task.duration} onChange={e => onUpdate(task.id, 'duration', parseInt(e.target.value) || 0)} />
                                    </label>
                                    <div onClick={() => onUpdate(task.id, 'isOnsite', !task.isOnsite)}
                                        className={cn("cursor-pointer px-1 rounded border flex items-center gap-0.5", task.isOnsite ? "bg-primary/10 border-primary/20 text-primary" : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500")}>
                                        <MapPin size={9} /> O
                                    </div>
                                </>
                            )}
                            {task.level === 0 && isTask && (
                                <button onClick={() => onAddSub(task.id)} className="text-primary hover:underline flex items-center gap-0.5"><Plus size={9} /> Sub</button>
                            )}
                            <button onClick={() => onDelete(task.id)} className="text-danger hover:underline flex items-center gap-0.5 ml-auto"><Trash2 size={9} /></button>
                        </div>
                    </div>
                </>
            )}

            {/* Unified Timeline (padding + active weeks in one container) */}
            {(() => {
                // Build weekToMonth map
                const weekToMonth = [];
                let weekOffset = 0;
                timeline.months.forEach((m, mi) => {
                    for (let w = 0; w < m.count; w++) {
                        weekToMonth[weekOffset + w] = mi;
                    }
                    weekOffset += m.count;
                });

                const isWeekVisible = (i) => {
                    const mi = weekToMonth[i];
                    return mi === undefined || !collapsedMonths.has(mi);
                };

                const visibleWeekCount = activeWeeks.filter((_, i) => isWeekVisible(i)).length;
                const totalContainerWidth = paddingCols * cellWidth + visibleWeekCount * cellWidth;

                // Cumulative visible offset for each active week (relative to active area start)
                const visibleOffset = [];
                let cumOffset = 0;
                for (let i = 0; i < activeWeeks.length; i++) {
                    visibleOffset[i] = cumOffset;
                    if (isWeekVisible(i)) cumOffset += cellWidth;
                }

                const padPx = paddingCols * cellWidth;

                // Bar left: accounts for padding offset
                const getBarLeft = (sw) => {
                    if (sw < 0) return padPx + sw * cellWidth;
                    return padPx + (visibleOffset[sw] ?? 0);
                };

                // Bar width: count visible weeks within the bar range
                const getBarWidth = (sw, dur) => {
                    let w = 0;
                    for (let i = sw; i < sw + dur; i++) {
                        if (i < 0) { w += cellWidth; continue; }
                        if (i >= activeWeeks.length) break;
                        if (isWeekVisible(i)) w += cellWidth;
                    }
                    return w;
                };

                return (
                    <div className="relative shrink-0" style={{ width: totalContainerWidth }}>
                        {/* Background cells */}
                        <div className="flex h-full">
                            {/* Padding cells */}
                            {Array.from({ length: paddingCols }).map((_, i) => (
                                <div key={`pad-${i}`} style={{ width: cellWidth, minWidth: cellWidth }}
                                    className="h-full border-r border-slate-50 dark:border-slate-700/30 bg-slate-50/30 dark:bg-slate-800/30 shrink-0" />
                            ))}
                            {/* Active week cells */}
                            {activeWeeks.map((w, i) => {
                                if (!isWeekVisible(i)) return null;
                                return (
                                    <div key={i} style={{ width: cellWidth, minWidth: cellWidth }}
                                        className={`h-full shrink-0 ${w.isMonthEnd ? 'border-r-2 border-indigo-200 dark:border-indigo-700' : 'border-r border-slate-50 dark:border-slate-700/30'}`} />
                                );
                            })}
                        </div>

                        {/* Today line */}
                        {todayIndex !== null && todayIndex >= 0 && todayIndex < activeWeeks.length && isWeekVisible(todayIndex) && (
                            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                                style={{ left: padPx + visibleOffset[todayIndex] + cellWidth / 2 }} />
                        )}

                        {/* Task bar with progress */}
                        {isTask && task.duration > 0 && (
                            <div
                                data-taskbar="true"
                                onMouseDown={e => {
                                    if (!e.target.closest('[data-progress-handle]')) {
                                        onDragStart(e, task.id);
                                    }
                                }}
                                onMouseEnter={handleBarMouseEnter}
                                onMouseLeave={handleBarMouseLeave}
                                className={cn(
                                    "absolute top-2 bottom-2 rounded-md shadow-sm cursor-move flex items-center z-10 hover:shadow-lg transition-shadow group/bar",
                                    isSub && "border-l-[3px]"
                                )}
                                style={{
                                    left: getBarLeft(task.startWeek),
                                    width: getBarWidth(task.startWeek, task.duration),
                                    backgroundColor: hexToRgba(barColor, isSub ? 0.55 : 0.85),
                                    borderLeftColor: isSub ? barColor : undefined,
                                }}
                            >
                                {progress > 0 && (
                                    <div className="absolute inset-0 rounded-md pointer-events-none"
                                        style={{
                                            width: `${progress}%`,
                                            backgroundColor: hexToRgba(barColor, 1),
                                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)',
                                        }}
                                    />
                                )}
                                {progress > 0 && progress < 100 && (
                                    <div className="absolute top-0 right-0 bottom-0 rounded-r-md pointer-events-none"
                                        style={{
                                            width: `${100 - progress}%`,
                                            backgroundColor: hexToRgba(barColor, 0.4),
                                        }}
                                    />
                                )}

                                {task.isOnsite && Array.from({ length: task.duration }).map((_, i) => {
                                    const weekIdx = task.startWeek + i;
                                    if (weekIdx >= 0 && !isWeekVisible(weekIdx)) return null;
                                    return (
                                        <span key={i} className="text-[10px] font-black text-white/90 shrink-0 text-center relative z-[5]" style={{ width: cellWidth }}>O</span>
                                    );
                                })}

                                {progress > 0 && (
                                    <div data-progress-handle="true"
                                        onMouseDown={handleProgressMouseDown}
                                        className="absolute top-0 bottom-0 w-3 cursor-ew-resize z-[15] flex items-center justify-center opacity-0 group-hover/bar:opacity-100 transition-opacity"
                                        style={{ left: `calc(${progress}% - 6px)` }}
                                    >
                                        <div className="w-1.5 h-5 bg-white/80 rounded-full shadow border border-black/20" />
                                    </div>
                                )}

                                <div onMouseDown={e => onResizeStart(e, task.id)}
                                    className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize rounded-r-md opacity-0 group-hover/bar:opacity-100 transition-opacity bg-white/20 hover:bg-white/40 flex items-center justify-center z-[15]">
                                    <div className="w-0.5 h-3 bg-white/60 rounded-full" />
                                </div>

                                {tooltip && tooltipPos && createPortal(
                                    <div className="fixed z-[9999] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11px] rounded-lg shadow-xl px-3 py-2 pointer-events-none whitespace-nowrap min-w-[180px]"
                                        style={{
                                            top: tooltipPos.top,
                                            left: tooltipPos.left,
                                            transform: 'translateX(-50%)',
                                            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))',
                                        }}>
                                        <div className="font-bold text-xs mb-1 truncate max-w-[200px]">{tooltip.name}</div>
                                        <div className="flex items-center gap-3 text-[10px] opacity-80">
                                            <span>📅 {tooltip.start} → {tooltip.end}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] opacity-80 mt-0.5">
                                            <span>⏱ {tooltip.duration}</span>
                                            <span>📊 {tooltip.progress}</span>
                                        </div>
                                        <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-100 rotate-45 ${tooltipPos.below ? '-top-1' : '-bottom-1'}`} />
                                    </div>,
                                    document.body
                                )}
                            </div>
                        )}

                        {/* Payment diamond */}
                        {isPayment && (
                            <motion.div onMouseDown={e => onDragStart(e, task.id)}
                                className="absolute top-1/2 -translate-y-1/2 z-20 cursor-move flex items-center justify-center"
                                style={{ left: getBarLeft(task.startWeek), width: cellWidth }}>
                                <div className="w-4 h-4 bg-amber-500 rotate-45 border-2 border-white dark:border-slate-800 shadow-md flex items-center justify-center">
                                    <div className="w-1 h-1 bg-white rounded-full" />
                                </div>
                            </motion.div>
                        )}
                    </div>
                );
            })()}
        </motion.div>
    );
};

