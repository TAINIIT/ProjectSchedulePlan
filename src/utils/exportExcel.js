import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/* ─── Color palettes ──────────────────────────────────────── */
const COLORS = {
    header: '4472C4',
    headerTxt: 'FFFFFF',
    subHead: 'D9E2F3',
    title: '008B8B',
    subtitle: 'E0F0F0',
    payment: 'FFF2CC',
    payIcon: 'BF8F00',
    border: 'D0D0D0',
};

const GROUP_BG = [
    'FFD966', 'F4B183', '92D050', 'A9D18E',
    '8DB4E2', '00B0F0', 'FF6666', '00CED1',
];
const GROUP_BG_LIGHT = [
    'FFF2CC', 'FCE4D6', 'C6EFCE', 'D5E8D4',
    'D6E4F0', 'BDD7EE', 'FFCCCC', 'CCFFFF',
];

/* Darker palettes for export — more saturated & visible in print */
const EXPORT_GROUP_BG = [
    'E6B800', 'D98040', '5CB338', '78B85A',
    '5A8FC2', '0090D0', 'E04040', '00A8A8',
];
const EXPORT_GROUP_BG_LIGHT = [
    'FFE680', 'F5C4A1', '8FD98F', 'A8D4A0',
    'A8C8E8', '8FC8E8', 'FF9999', '99EDED',
];

function barColor(group, isSub) {
    const pal = isSub ? EXPORT_GROUP_BG_LIGHT : EXPORT_GROUP_BG;
    return pal[group % pal.length];
}

/* ─── Thin border helper ──────────────────────────────────── */
const BORDER = {
    top: { style: 'thin', color: { argb: `FF${COLORS.border}` } },
    left: { style: 'thin', color: { argb: `FF${COLORS.border}` } },
    bottom: { style: 'thin', color: { argb: `FF${COLORS.border}` } },
    right: { style: 'thin', color: { argb: `FF${COLORS.border}` } },
};

/* ════════════════════════════════════════════════════════════
 *  PUBLIC: exportExcel
 * ════════════════════════════════════════════════════════════ */
export async function exportExcel(tasks, timeline, lang, startDate, durationMonths) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Schedule');

    const allWeeks = timeline.weeks;
    const paddingCols = allWeeks.filter(w => w.isPadding).length;
    const activeWeeks = allWeeks.filter(w => !w.isPadding);
    const lastCol = 2 + allWeeks.length;

    // ── Column widths — task‑name column is wide so text is readable ──
    ws.getColumn(1).width = 7;   // No.
    ws.getColumn(2).width = 52;  // Task name — WIDER so content is visible
    for (let c = 3; c <= lastCol; c++) ws.getColumn(c).width = 5;

    /* ─────────────── Row 1: Title ─────────────── */
    ws.mergeCells(1, 1, 1, lastCol);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = lang === 'vi'
        ? 'KẾ HOẠCH TIẾN ĐỘ DỰ ÁN MOST'
        : 'MOST PROJECT SCHEDULE';
    titleCell.font = { bold: true, size: 16, color: { argb: `FF${COLORS.headerTxt}` } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.title}` } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 36;

    /* ─────────────── Row 2: Subtitle ─────────────── */
    ws.mergeCells(2, 1, 2, lastCol);
    const subCell = ws.getCell(2, 1);
    subCell.value = `${lang === 'vi' ? 'Ngày bắt đầu' : 'Start'}: ${startDate} | ${durationMonths} ${lang === 'vi' ? 'tháng' : 'months'}`;
    subCell.font = { size: 10, italic: true, color: { argb: 'FF555555' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.subtitle}` } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 22;

    /* ─────────────── Row 3–4: Header row (No. + Name + Months/Weeks) ─────────────── */
    // No. header
    ws.mergeCells(3, 1, 4, 1);
    const noH = ws.getCell(3, 1);
    noH.value = '#';
    noH.font = { bold: true, size: 11, color: { argb: `FF${COLORS.headerTxt}` } };
    noH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.header}` } };
    noH.alignment = { horizontal: 'center', vertical: 'middle' };
    noH.border = BORDER;

    // Task‑name header
    ws.mergeCells(3, 2, 4, 2);
    const nameH = ws.getCell(3, 2);
    nameH.value = lang === 'vi' ? 'NỘI DUNG CÔNG VIỆC' : 'TASK NAME';
    nameH.font = { bold: true, size: 11, color: { argb: `FF${COLORS.headerTxt}` } };
    nameH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.header}` } };
    nameH.alignment = { horizontal: 'center', vertical: 'middle' };
    nameH.border = BORDER;

    // ── Month headers (row 3) ──
    const monthNames = lang === 'vi'
        ? ['Thg 1', 'Thg 2', 'Thg 3', 'Thg 4', 'Thg 5', 'Thg 6', 'Thg 7', 'Thg 8', 'Thg 9', 'Thg 10', 'Thg 11', 'Thg 12']
        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Padding month area
    if (paddingCols > 0) {
        ws.mergeCells(3, 3, 3, 2 + paddingCols);
        const pc = ws.getCell(3, 3);
        pc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.header}` } };
        pc.border = BORDER;
    }

    let col = 3 + paddingCols;
    timeline.months.forEach(m => {
        if (m.count > 1) ws.mergeCells(3, col, 3, col + m.count - 1);
        const mc = ws.getCell(3, col);
        const parts = m.label.split(' ');
        const mi = monthNames.indexOf(parts[0]) !== -1 ? monthNames.indexOf(parts[0])
            : ['Thg 1', 'Thg 2', 'Thg 3', 'Thg 4', 'Thg 5', 'Thg 6', 'Thg 7', 'Thg 8', 'Thg 9', 'Thg 10', 'Thg 11', 'Thg 12'].indexOf(parts[0]);
        const shortY = parts[1] ? "'" + parts[1].slice(-2) : '';
        mc.value = `${shortY} ${monthNames[mi] || parts[0]}`.trim();
        mc.font = { bold: true, size: 9, color: { argb: `FF${COLORS.headerTxt}` } };
        mc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.header}` } };
        mc.alignment = { horizontal: 'center', vertical: 'middle' };
        mc.border = BORDER;
        col += m.count;
    });

    // ── Week‑date headers (row 4) ──
    allWeeks.forEach((w, i) => {
        const c = ws.getCell(4, 3 + i);
        if (w.date) c.value = `${new Date(w.date).getDate()}`;
        c.font = { size: 8, bold: true, color: { argb: 'FF333333' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.subHead}` } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.border = BORDER;
    });

    ws.getRow(3).height = 24;
    ws.getRow(4).height = 18;

    /* ─────────────── Data rows ─────────────── */
    tasks.forEach((task, idx) => {
        const r = 5 + idx;
        const name = lang === 'vi' ? task.nameVi : task.nameEn;
        const isPayment = task.type === 'payment';
        const isSub = task.level > 0;
        const prefix = isSub ? '     ' : '';
        const row = ws.getRow(r);
        row.height = 24;

        // No. cell
        const noC = ws.getCell(r, 1);
        noC.value = task.no;
        noC.font = { bold: !isSub, size: isSub ? 9 : 10 };
        noC.alignment = { horizontal: 'center', vertical: 'middle' };
        noC.border = BORDER;
        if (isPayment) {
            noC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.payment}` } };
        }

        // Name cell — **bold for parent tasks**, readable indent for subs
        const nc = ws.getCell(r, 2);
        nc.value = `${prefix}${name}`;
        nc.alignment = { vertical: 'middle', wrapText: true };
        nc.border = BORDER;
        if (isPayment) {
            nc.font = { bold: true, size: 10, color: { argb: `FF${COLORS.payIcon}` } };
            nc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.payment}` } };
        } else if (!isSub) {
            // PARENT TASK → bold + dark blue + slight bg tint
            nc.font = { bold: true, size: 11, color: { argb: 'FF1F4E79' } };
        } else {
            nc.font = { size: 10 };
        }

        // Timeline cells
        allWeeks.forEach((w, wi) => {
            const ec = 3 + wi;
            const cell = ws.getCell(r, ec);
            cell.border = BORDER;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };

            const li = wi - paddingCols; // logic index

            if (isPayment) {
                if (li === task.startWeek) {
                    cell.value = '◆';
                    cell.font = { bold: true, size: 14, color: { argb: `FF${COLORS.payIcon}` } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.payment}` } };
                }
            } else {
                const inRange = li >= task.startWeek && li < task.startWeek + (task.duration || 0);
                if (inRange) {
                    const bg = barColor(task.group, isSub);
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bg}` } };
                    if (task.isOnsite) {
                        cell.value = 'O';
                        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
                    }
                }
            }
        });
    });

    /* ─────────────── Legend row ─────────────── */
    const lr = 5 + tasks.length + 1;
    ws.mergeCells(lr, 1, lr, lastCol);
    const lc = ws.getCell(lr, 1);
    lc.value = lang === 'vi' ? 'Chú thích: O = Onsite  |  ◆ = Mốc thanh toán' : 'Legend: O = Onsite  |  ◆ = Payment Milestone';
    lc.font = { italic: true, size: 9, color: { argb: 'FF555555' } };
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.subtitle}` } };
    lc.alignment = { horizontal: 'center' };

    /* ─────────────── Save ─────────────── */
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const filename = `MOST_Schedule_${new Date().toISOString().slice(0, 10)}.xlsx`;
    saveAs(blob, filename);
}
