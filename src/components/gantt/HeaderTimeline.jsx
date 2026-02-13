import React from 'react';

export const HeaderTimeline = ({ timeline, paddingCols, lang, cellWidth, showTaskCol = true, todayIndex, collapsedMonths = new Set(), onToggleMonth }) => {
    const activeWeeks = timeline.activeWeeks || timeline.weeks.filter(w => !w.isPadding);
    const noColW = showTaskCol ? 50 : 0;
    const nameColW = showTaskCol ? 350 : 0;

    // Build a map: weekIndex → monthIndex
    const weekToMonth = [];
    let weekOffset = 0;
    timeline.months.forEach((m, mi) => {
        for (let w = 0; w < m.count; w++) {
            weekToMonth[weekOffset + w] = mi;
        }
        weekOffset += m.count;
    });

    return (
        <div className="sticky top-0 z-40 bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
            {/* Month Row */}
            <div className="flex relative">
                {showTaskCol && (
                    <>
                        <div style={{ minWidth: noColW }} className="sticky left-0 z-50 bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 shrink-0" />
                        <div style={{ minWidth: nameColW }} className="sticky left-[50px] z-50 bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 shrink-0" />
                    </>
                )}
                {Array.from({ length: paddingCols }).map((_, i) => (
                    <div key={`mpad-${i}`} style={{ width: cellWidth, minWidth: cellWidth }} className="h-10 bg-slate-50 dark:bg-slate-700/50 border-r border-slate-200 dark:border-slate-600 shrink-0" />
                ))}
                {timeline.months.map((m, i) => {
                    const isCollapsed = collapsedMonths.has(i);
                    return (
                        <div key={i}
                            style={{
                                width: isCollapsed ? 8 : m.count * cellWidth,
                                minWidth: isCollapsed ? 8 : m.count * cellWidth,
                                transition: 'width 0.3s ease, min-width 0.3s ease'
                            }}
                            className={`h-10 flex items-center justify-center font-heading font-bold text-xs uppercase tracking-widest shrink-0 cursor-pointer select-none ${isCollapsed ? 'bg-indigo-200 dark:bg-indigo-800 border-r border-indigo-300 dark:border-indigo-600' : 'text-primary dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/30 border-r-2 border-indigo-200 dark:border-indigo-700 last:border-r-0'}`}
                            onDoubleClick={() => onToggleMonth?.(i)}
                            title={isCollapsed ? (lang === 'vi' ? 'Double-click để mở rộng' : 'Double-click to expand') : (lang === 'vi' ? 'Double-click để thu gọn' : 'Double-click to collapse')}>
                            {isCollapsed ? '⋯' : (cellWidth >= 28 ? m.label : m.label.split(' ')[0])}
                        </div>
                    );
                })}
            </div>

            {/* Date Row */}
            <div className="flex mt-px relative">
                {showTaskCol && (
                    <>
                        <div style={{ minWidth: noColW }} className="h-8 flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500 border-r border-slate-100 dark:border-slate-700 sticky left-0 z-50 bg-white dark:bg-slate-800 shrink-0">#</div>
                        <div style={{ minWidth: nameColW }} className="h-8 flex items-center px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-r border-slate-100 dark:border-slate-700 sticky left-[50px] z-50 bg-white dark:bg-slate-800 shrink-0">
                            {lang === 'vi' ? 'Nội dung công việc' : 'WBS / Task Name'}
                        </div>
                    </>
                )}
                {Array.from({ length: paddingCols }).map((_, i) => (
                    <div key={`dpad-${i}`} style={{ width: cellWidth, minWidth: cellWidth }} className="h-8 bg-slate-50 dark:bg-slate-700/50 border-r border-slate-200 dark:border-slate-600 shrink-0" />
                ))}
                {activeWeeks.map((w, i) => {
                    const date = new Date(w.date);
                    const isToday = todayIndex === i;
                    const monthIdx = weekToMonth[i];
                    const isMonthCollapsed = monthIdx !== undefined && collapsedMonths.has(monthIdx);

                    if (isMonthCollapsed) return null;

                    return (
                        <div key={i} style={{ width: cellWidth, minWidth: cellWidth }}
                            className={`h-8 flex items-center justify-center text-[10px] font-bold shrink-0 relative ${isToday ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' : 'text-slate-500 dark:text-slate-400'} ${w.isMonthEnd ? 'border-r-2 border-indigo-200 dark:border-indigo-700' : 'border-r border-slate-100 dark:border-slate-700'}`}>
                            {cellWidth >= 28 ? `${date.getDate()}/${date.getMonth() + 1}` : date.getDate()}
                            {isToday && (
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
