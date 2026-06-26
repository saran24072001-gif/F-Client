import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateToDDMMYYYY, parseDDMMYYYYToDate } from './dateUtils';
import { getRequestDisplayStatus } from './statusUtils';
import { getSyncedDate } from './timeSync';
import nipponLogoUrl from '../assets/Nippon Logo.png';

const drawFooter = (doc, pageText, confidentialText) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  // Confidentiality and Page text in previous slate color
  doc.setTextColor(148, 163, 184);
  
  // 2nd: Confidential text centered in the middle
  const confidentialWidth = doc.getTextWidth(confidentialText);
  const centerX = (doc.internal.pageSize.width - confidentialWidth) / 2;
  doc.text(confidentialText, centerX, doc.internal.pageSize.height - 20);
  
  // 3rd: Page text on the right (x = width - 80)
  doc.text(pageText, doc.internal.pageSize.width - 80, doc.internal.pageSize.height - 20);
  
  // DOC NO specifically in black color
  doc.setTextColor(0, 0, 0);
  
  // 1st: DOC NO on the left (x = 40)
  doc.text('DOC NO: PRD/FR/156 R1', 40, doc.internal.pageSize.height - 20);
};

// Premium Theme Colors
const PRIMARY_COLOR = [30, 58, 138]; // Deep Royal Navy #1e3a8a
const SECONDARY_COLOR = [71, 85, 105]; // Cool Slate #475569

// Status cell styling helper for PDF exports
const applyCellStatusColors = (data, minColIndex, maxColIndex = minColIndex) => {
  if (data.row.section !== 'body') return;
  if (data.column.index >= minColIndex && data.column.index <= maxColIndex) {
    const val = data.cell.text[0];
    const cleanVal = val ? val.trim().toLowerCase() : '';
    if (cleanVal.includes('approve') || cleanVal.includes('accept') || cleanVal.includes('completed') || cleanVal.includes('complete') || cleanVal.includes('closed') || cleanVal.includes('active') || (cleanVal.includes('ok') && !cleanVal.includes('not ok'))) {
      data.cell.styles.textColor = [16, 124, 65]; // Premium Green (dark emerald)
      data.cell.styles.fontStyle = 'bold';
    } else if (cleanVal.includes('reject') || cleanVal.includes('not ok')) {
      data.cell.styles.textColor = [220, 38, 38]; // Premium Red (rose-600)
      data.cell.styles.fontStyle = 'bold';
    } else if (cleanVal.includes('pending') || cleanVal.includes('evaluat')) {
      data.cell.styles.textColor = [217, 119, 6]; // Premium Amber (amber-600)
      data.cell.styles.fontStyle = 'bold';
    } else if (cleanVal.includes('need') || cleanVal.includes('qa')) {
      data.cell.styles.textColor = [79, 70, 229]; // Indigo/Blue
      data.cell.styles.fontStyle = 'bold';
    }
  }
};

/**
 * Adds the Nippon logo to the top-right corner of the current page.
 * Call once per doc right after creation; didDrawPage will re-apply on new pages.
 */
const addLogoToDoc = (doc) => {
  try {
    const pw = doc.internal.pageSize.width;
    // Logo placed top-right: 50×50 pt (square) to preserve the circular shape
    doc.addImage(nipponLogoUrl, 'PNG', pw - 70, 5, 50, 50);
  } catch {
    // Silently skip if image fails to load (e.g. offline/test)
  }
};

/**
 * Exports the filtered requests list to a landscape A4 PDF.
 * @param {Array} filteredData 
 * @param {Object} filtersInfo 
 * @param {Function} setToastMsg 
 */
export const exportRequestsListPDF = (filteredData, filtersInfo = {}, setToastMsg) => {
  try {
    if (!filteredData || filteredData.length === 0) {
      setToastMsg?.('No data available to export.');
      return;
    }

    const {
      searchQuery = '',
      selectedMonth = 'All',
      selectedPerson = 'All',
      selectedProcess = 'All',
      selectedMachine = 'All',
      fromDate = '',
      toDate = ''
    } = filtersInfo;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    // Headers for A4 Landscape Table
    const headers = [[
      { content: 'SL.\nNO.', styles: { halign: 'center' } },
      '4M CHANGE\nNO',
      'MACHINE\nNO.',
      'DEPARTMENT',
      'PROCESS\nNAME',
      'REQUESTED\nBY',
      'REQUEST\nDATE',
      'HOD\nAPPROVAL',
      'L2\nSTATUS',
      'L3\nSTATUS',
      'OVERALL STATUS'
    ]];

    // Format row values from filteredData
    const tableData = filteredData.map((item, idx) => [
      idx + 1,
      item.id,
      item.machineNo || '-',
      item.department || '-',
      item.processName || '-',
      item.requester ? item.requester.split('@')[0] : '-',
      item.date || '-',
      item.hodStatus || 'Pending',
      item.l2Status || 'Pending',
      item.isL3Complete ? 'Completed' : item.hasL3Rejection ? 'Rejected' : 'Pending',
      item.status || '-'
    ]);

    // Title & Branding (Blue theme)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]); // Premium primary color
    doc.text('4M Change Management System - All Change Requests', 40, 45);

    // Metadata details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);

    const filterParts = [];
    if (searchQuery) filterParts.push(`Keyword Search: "${searchQuery}"`);
    if (selectedMonth !== 'All') filterParts.push(`Month: "${selectedMonth}"`);
    if (fromDate) filterParts.push(`From: "${fromDate}"`);
    if (toDate) filterParts.push(`To: "${toDate}"`);
    if (selectedPerson !== 'All') filterParts.push(`Requested By: "${selectedPerson.split('@')[0]}"`);
    if (selectedProcess !== 'All') filterParts.push(`Process: "${selectedProcess}"`);
    if (selectedMachine !== 'All') filterParts.push(`Machine: "${selectedMachine}"`);

    const filterText = filterParts.length > 0
      ? `Applied Filters: ${filterParts.join('  |  ')}`
      : 'Report Scope: All Change Requests (No filters applied)';

    doc.text(filterText, 40, 75);

    // AutoTable generator
    autoTable(doc, {
      startY: 90,
      head: headers,
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: PRIMARY_COLOR,
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 4, right: 3, bottom: 4, left: 3 }
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 }
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' },          // SL. NO.
        1: { cellWidth: 70, fontStyle: 'bold' },          // 4M CHANGE NO
        2: { cellWidth: 65, halign: 'center' },           // MACHINE NO.
        3: { cellWidth: 85 },                             // DEPARTMENT
        4: { cellWidth: 90 },                             // PROCESS NAME
        5: { cellWidth: 85 },                             // REQUESTED BY
        6: { cellWidth: 60, halign: 'center' },           // REQUEST DATE
        7: { cellWidth: 62, halign: 'center' },           // HOD APPROVAL
        8: { cellWidth: 55, halign: 'center' },           // L2 STATUS
        9: { cellWidth: 55, halign: 'center' },           // L3 STATUS
        10: { cellWidth: 90, halign: 'center' }            // OVERALL STATUS
      },
      margin: { top: 40, bottom: 40, left: 40, right: 40 },
      didDrawPage: (data) => {
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        drawFooter(doc, `Page ${data.pageNumber} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL CHANGE REQUESTS');
      },
      didParseCell: (data) => {
        applyCellStatusColors(data, 7, 10);
      }
    });

    doc.save(`4M_Change_Requests_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('PDF exported successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setToastMsg?.('Error generating PDF export.');
  }
};

// Month-Wise mapping function shared across exports
const formatMonthWise = (val) => {
  if (!val) return "-";
  if (val.includes('/')) {
    const parts = val.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month - 1, 1);
      if (!isNaN(date.getTime())) {
        const monthName = date.toLocaleDateString("en-US", { month: "short" });
        const yearShort = String(year).slice(-2);
        return `${monthName}-${yearShort}`;
      }
    }
  }
  if (val.includes('-')) {
    const parts = val.split("-");
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const date = new Date(year, month - 1, 1);
      if (!isNaN(date.getTime())) {
        const monthName = date.toLocaleDateString("en-US", { month: "short" });
        const yearShort = String(year).slice(-2);
        return `${monthName}-${yearShort}`;
      }
    }
  }
  return val;
};

/**
 * Exports a single request's complete L1, L2, L3 details to a portrait A4 PDF.
 * @param {Object} selectedL1Details 
 * @param {Object} selectedL2Details 
 * @param {Object} selectedLog 
 * @param {Function} setToastMsg 
 */
export const exportRequestDetailsPDF = (selectedL1Details, selectedL2Details, selectedLog, activeTab = 'all', setToastMsg, selectedEffDetails = null) => {
  let targetTab = activeTab;
  let toastFn = setToastMsg;
  let effDetails = selectedEffDetails;
  if (typeof targetTab === 'function') {
    toastFn = targetTab;
    targetTab = 'all';
    effDetails = setToastMsg;
  }

  try {
    if (!selectedL1Details) {
      toastFn?.('Level 1 request details are not loaded.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    const primaryColor = [0, 102, 204]; // #0066cc
    const textColor = [51, 65, 85];    // Slate-700
    const lightBg = [248, 250, 252];    // Slate-50

    // Title & Header Branding
    let titleSuffix = '';
    let docFilename = `CMS_Detail_Report_${selectedL1Details.change_no}`;
    if (targetTab === 'l1') {
      titleSuffix = ' - Level 1 Details';
      docFilename = `CMS_L1_Details_${selectedL1Details.change_no}`;
    } else if (targetTab === 'l2') {
      titleSuffix = ' - Level 2 Validation';
      docFilename = `CMS_L2_Validation_${selectedL1Details.change_no}`;
    } else if (targetTab === 'l3') {
      titleSuffix = ' - Level 3 Approvals';
      docFilename = `CMS_L3_Approvals_${selectedL1Details.change_no}`;
    } else if (targetTab === 'effectiveness') {
      titleSuffix = ' - Effectiveness Details';
      docFilename = `CMS_Effectiveness_Details_${selectedL1Details.change_no}`;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 102, 204); // Blue #0066cc for main title
    doc.text('4M Change Request Detail Report', 40, 45);

    if (titleSuffix) {
      const mainTitleWidth = doc.getTextWidth('4M Change Request Detail Report');
      let suffixColor = [0, 102, 204]; // Blue default
      if (targetTab === 'l2') {
        suffixColor = [217, 119, 6]; // Orange
      } else if (targetTab === 'l3') {
        suffixColor = [124, 58, 237]; // Purple
      } else if (targetTab === 'effectiveness') {
        suffixColor = [16, 124, 65]; // Green
      }
      doc.setTextColor(suffixColor[0], suffixColor[1], suffixColor[2]);
      doc.text(titleSuffix, 40 + mainTitleWidth, 45);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(`Generated on: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);

    // Section 1: General Info (11-field layout aligned with the L1 tab General Information)
    const l1Status = selectedL1Details.hodStatus === 'Rejected'
      ? 'L1 Rejected'
      : (selectedL1Details.hodStatus === 'Approved' || selectedL1Details.crStatus !== 'Pending')
        ? 'L1 Approved'
        : 'L1 Pending';

    const generalInfoData = [
      [
        { content: 'Change No', fontStyle: 'bold' }, selectedL1Details.change_no || '-',
        { content: 'Requested Date', fontStyle: 'bold' }, selectedL1Details.crDate ? formatDateToDDMMYYYY(selectedL1Details.crDate) : '-',
      ],
      [
        { content: 'Requested Time', fontStyle: 'bold' }, selectedL1Details.requested_time || '-',
        { content: 'Status', fontStyle: 'bold' }, l1Status,
      ],
      [
        { content: 'Unit', fontStyle: 'bold' }, selectedL1Details.unit || '-',
        { content: 'Change In', fontStyle: 'bold' }, selectedL1Details.change_in || '-',
      ],
      [
        { content: 'Requested By', fontStyle: 'bold' }, `${selectedL1Details.request_by || '-'}${selectedL1Details.crRequester && selectedL1Details.crRequester.toLowerCase() !== selectedL1Details.request_by?.toLowerCase() ? '\n' + selectedL1Details.crRequester : ''}`,
        { content: 'Department', fontStyle: 'bold' }, selectedL1Details.dept || '-',
      ],
      [
        { content: 'Process Name', fontStyle: 'bold' }, selectedL1Details.process_name || '-',
        { content: 'Process Line', fontStyle: 'bold' }, selectedL1Details.process_line || '-',
      ],
      [
        { content: 'Machine No', fontStyle: 'bold' }, selectedL1Details.machine_no || '-',
        { content: '', fontStyle: 'bold' }, ''
      ]
    ];

    autoTable(doc, {
      startY: 75,
      head: [[{ content: '1. GENERAL INFORMATION', colSpan: 4 }]],
      body: generalInfoData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: textColor
      },
      columnStyles: {
        0: { cellWidth: 90, fillColor: lightBg, fontStyle: 'bold' },
        1: { cellWidth: 165 },
        2: { cellWidth: 95, fillColor: lightBg, fontStyle: 'bold' },
        3: { cellWidth: 165 }
      },
      margin: { left: 40, right: 40 }
    });

    // Section 2: Details & Justification — always included in every export variant
    // (L1 details are the foundation for all L2/L3/Effectiveness exports)
    if (selectedL1Details) {
      const detailsData = [
        [
          { content: 'Context of Change', fontStyle: 'bold' },
          selectedL1Details.title ? selectedL1Details.title.replace(/^\[L1 Request - [^\]]*\]\s*/, '') : '-'
        ],
        [
          { content: 'Detailed Change Description', fontStyle: 'bold' },
          selectedL1Details.description || '-'
        ]
      ];

      if (selectedL1Details.file_desc && selectedL1Details.file_desc !== '-') {
        detailsData.push([
          { content: 'Supporting Files', fontStyle: 'bold' },
          selectedL1Details.file_desc
        ]);
      }

      detailsData.push(
        [
          { content: 'Change Improvement Area', fontStyle: 'bold' },
          selectedL1Details.improvement_area || '-'
        ]
      );

      if (selectedL1Details.file_improvement && selectedL1Details.file_improvement !== '-') {
        detailsData.push([
          { content: 'Supporting Files (Improvement)', fontStyle: 'bold' },
          selectedL1Details.file_improvement
        ]);
      }

      detailsData.push(
        [
          { content: 'Permanent / Temporary Change', fontStyle: 'bold' },
          selectedL1Details.change_type || '-'
        ],
        [
          { content: 'Implement / Change Date Start', fontStyle: 'bold' },
          selectedL1Details.date_start ? formatDateToDDMMYYYY(selectedL1Details.date_start) : '-'
        ],
        [
          { content: 'Part Traceability Details (From Changes)', fontStyle: 'bold' },
          selectedL1Details.trace_from || '-'
        ]
      );

      if (selectedL1Details.file_trace_from && selectedL1Details.file_trace_from !== '-') {
        detailsData.push([
          { content: 'Supporting Files (Traceability From)', fontStyle: 'bold' },
          selectedL1Details.file_trace_from
        ]);
      }

      detailsData.push(
        [
          { content: 'Change Date Close', fontStyle: 'bold' },
          selectedL1Details.date_close ? formatDateToDDMMYYYY(selectedL1Details.date_close) : 'N/A'
        ],
        [
          { content: 'Part Traceability Details (To Changes)', fontStyle: 'bold' },
          selectedL1Details.trace_to || '-'
        ]
      );

      if (selectedL1Details.file_trace_to && selectedL1Details.file_trace_to !== '-') {
        detailsData.push([
          { content: 'Supporting Files (Traceability To)', fontStyle: 'bold' },
          selectedL1Details.file_trace_to
        ]);
      }

      detailsData.push(
        [
          { content: 'Risk Analysis', fontStyle: 'bold' },
          selectedL1Details.risk_analysis || '-'
        ]
      );

      if (selectedL1Details.file_risk && selectedL1Details.file_risk !== '-') {
        detailsData.push([
          { content: 'Supporting Files (Risk Analysis)', fontStyle: 'bold' },
          selectedL1Details.file_risk
        ]);
      }

      detailsData.push(
        [
          { content: 'Update in SOP / WI / Control Plan / FMEA', fontStyle: 'bold' },
          selectedL1Details.sop_update || '-'
        ]
      );

      if (selectedL1Details.file_sop && selectedL1Details.file_sop !== '-') {
        detailsData.push([
          { content: 'Supporting Files (SOP, WI, Control Plan, FMEA)', fontStyle: 'bold' },
          selectedL1Details.file_sop
        ]);
      }

      detailsData.push(
        [
          { content: 'User Dept HOD Approval', fontStyle: 'bold' },
          selectedL1Details.hod_approval || '-'
        ],
        [
          { content: 'Customer Approval Required / Clearance Details', fontStyle: 'bold' },
          selectedL1Details.customer_approval || '-'
        ]
      );

      if (selectedL1Details.hodStatus) {
        detailsData.push([
          { content: `HOD ${selectedL1Details.hodStatus} Remarks / Comments (${selectedL1Details.hodDept || 'HOD'})`, fontStyle: 'bold' },
          selectedL1Details.hodRemarks || 'No remarks provided.'
        ]);
      }

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 15,
        head: [[{ content: '2. CHANGE DETAILS & JUSTIFICATION', colSpan: 2 }]],
        body: detailsData,
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: textColor
        },
        columnStyles: {
          0: { cellWidth: 140, fillColor: lightBg, fontStyle: 'bold' },
          1: { cellWidth: 375 }
        },
        margin: { left: 40, right: 40 }
      });
    }

    // Section 3: Level 2 Validation Details (aligned with L2 modal tab fields)
    if (targetTab === 'l2' || targetTab === 'l3' || targetTab === 'all') {
      const l2Data = [];
      if (selectedL2Details) {
        const l2Status = selectedL2Details.status === 'Accepted'
          ? 'L2 Approved'
          : selectedL2Details.status === 'Rejected'
            ? 'L2 Rejected'
            : selectedL2Details.status || 'L2 Pending';

        l2Data.push(
          [
            { content: 'Validation Date', fontStyle: 'bold' }, selectedL2Details.date || '-',
            { content: 'Validated By', fontStyle: 'bold' }, selectedL2Details.requester || '-'
          ],
          [
            { content: 'Validation Status', fontStyle: 'bold' }, l2Status,
            { content: 'PED Validation Attachment', fontStyle: 'bold' }, selectedL2Details.weldTest || '-'
          ],
          [
            { content: 'QAD Setup Verification Attachment', fontStyle: 'bold' }, selectedL2Details.qaTest || '-',
            { content: 'Validator Remarks / Comments', fontStyle: 'bold' }, selectedL2Details.remarks || '-'
          ]
        );
      } else {
        l2Data.push([
          { content: 'Status', fontStyle: 'bold' }, { content: 'Level 2 Validation details are currently pending or not submitted.', colSpan: 3 }
        ]);
      }

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 15,
        head: [[{ content: '3. LEVEL 2 VALIDATION DETAILS', colSpan: 4 }]],
        body: l2Data,
        theme: 'grid',
        headStyles: {
          fillColor: [217, 119, 6], // Orange
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: textColor
        },
        columnStyles: {
          0: { cellWidth: 100, fillColor: lightBg, fontStyle: 'bold' },
          1: { cellWidth: 155 },
          2: { cellWidth: 105, fillColor: lightBg, fontStyle: 'bold' },
          3: { cellWidth: 155 }
        },
        margin: { left: 40, right: 40 }
      });
    }

    // Section 4: Level 3 Approval Matrix (short dept labels from modal)
    if ((targetTab === 'l3' || targetTab === 'all') && selectedLog) {
      const l3Headers = [['DEPARTMENT', 'APPROVAL STATUS']];
      const l3Rows = [
        ['PED', selectedLog.ped || 'Pending'],
        ['QAD', selectedLog.qad || 'Pending'],
        ['Production', selectedLog.production || 'Pending'],
        ['Maintenance', selectedLog.maintenance || 'Pending'],
        ['PC & L', selectedLog.pcl || 'Pending'],
        ['Materials', selectedLog.materials || 'Pending'],
        ['Marketing', selectedLog.marketing || 'Pending'],
        ['HR', selectedLog.hr || 'Pending'],
        ['Safety', selectedLog.safety || 'Pending'],
        ['Unit Head', selectedLog.unitHead || selectedLog.unit_head || 'Pending']
      ];

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 15,
        head: [[{ content: '4. LEVEL 3 FINAL APPROVAL MATRIX', colSpan: 2 }]],
        body: [
          ...l3Headers,
          ...l3Rows
        ],
        theme: 'grid',
        headStyles: {
          fillColor: [124, 58, 237], // Purple
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: textColor
        },
        columnStyles: {
          0: { cellWidth: 255, fillColor: lightBg, fontStyle: 'bold' },
          1: { cellWidth: 260 }
        },
        margin: { left: 40, right: 40 },
        didParseCell: (data) => {
          if (data.row.section === 'body' && data.row.index === 0) {
            data.cell.styles.fillColor = [226, 232, 240]; // Slate-200
            data.cell.styles.textColor = [15, 23, 42];    // Slate-900
            data.cell.styles.fontStyle = 'bold';
          } else if (data.column.index === 1 && data.row.index > 0) {
            const val = data.cell.text[0];
            const cleanVal = val ? val.trim().toLowerCase() : '';
            if (cleanVal.includes('accept') || cleanVal.includes('approve') || cleanVal.includes('completed')) {
              data.cell.styles.textColor = [16, 124, 65]; // Green text
              data.cell.styles.fontStyle = 'bold';
            } else if (cleanVal.includes('reject')) {
              data.cell.styles.textColor = [220, 38, 38]; // Red text
              data.cell.styles.fontStyle = 'bold';
            } else if (cleanVal.includes('pending')) {
              data.cell.styles.textColor = [217, 119, 6]; // Yellow text
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });
    }

    // Section 5: Effectiveness Monitoring Details (aligned with 4. Effectiveness tab)
    if ((targetTab === 'effectiveness' || targetTab === 'all') && effDetails) {
      const effData = [
        [
          { content: 'Change No', fontStyle: 'bold' }, effDetails.changeNo || '-',
          { content: 'Requested Date', fontStyle: 'bold' }, effDetails.reqDate ? formatDateToDDMMYYYY(effDetails.reqDate) : '-'
        ],
        [
          { content: 'Change Date Start', fontStyle: 'bold' }, effDetails.startDate ? formatDateToDDMMYYYY(effDetails.startDate) : '-',
          { content: 'Month Wise', fontStyle: 'bold' }, effDetails.monthWise ? formatMonthWise(effDetails.monthWise) : '-'
        ],
        [
          { content: 'Effectiveness Status', fontStyle: 'bold' }, effDetails.status || '-',
          { content: 'QAD Approval', fontStyle: 'bold' }, effDetails.qaApproval || '-'
        ],
        [
          { content: 'Attachments', fontStyle: 'bold' }, { content: effDetails.attachment || '-', colSpan: 3 }
        ],
        [
          { content: 'Remarks / Comments', fontStyle: 'bold' }, { content: effDetails.remarks || '-', colSpan: 3 }
        ]
      ];

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 15,
        head: [[{ content: '5. EFFECTIVENESS MONITORING DETAILS', colSpan: 4 }]],
        body: effData,
        theme: 'grid',
        headStyles: {
          fillColor: [16, 124, 65], // Green
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: textColor
        },
        columnStyles: {
          0: { cellWidth: 110, fillColor: lightBg, fontStyle: 'bold' },
          1: { cellWidth: 145 },
          2: { cellWidth: 115, fillColor: lightBg, fontStyle: 'bold' },
          3: { cellWidth: 145 }
        },
        margin: { left: 40, right: 40 },
        didParseCell: (data) => {
          if (data.row.section === 'body' && data.row.index === 2) {
            // Color-code Effectiveness Status & QAD Approval
            if (data.column.index === 1 || data.column.index === 3) {
              const val = data.cell.text[0];
              const cleanVal = val ? val.trim().toLowerCase() : '';
              if (cleanVal.includes('ok') || cleanVal.includes('approve')) {
                data.cell.styles.textColor = [16, 124, 65]; // Green
                data.cell.styles.fontStyle = 'bold';
              } else if (cleanVal.includes('not ok') || cleanVal.includes('reject')) {
                data.cell.styles.textColor = [220, 38, 38]; // Red
                data.cell.styles.fontStyle = 'bold';
              } else if (cleanVal.includes('pending')) {
                data.cell.styles.textColor = [217, 119, 6]; // Amber
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        }
      });
    }

    // Add Footer & Pages count
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawFooter(doc, `Page ${i} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL CHANGE REQUEST REPORT');
    }

    doc.save(`${docFilename}.pdf`);
    toastFn?.('Request details exported successfully!');
  } catch (error) {
    console.error('Error generating detailed PDF:', error);
    toastFn?.('Error generating detailed PDF export.');
  }
};

/**
 * Exports the L2 Validation Logs to a landscape A4 PDF.
 * @param {Array} filteredLogs 
 * @param {Object} filtersInfo 
 * @param {Function} setToastMsg 
 */
export const exportL2ValidationLogsPDF = (filteredLogs, filtersInfo = {}, setToastMsg) => {
  try {
    if (!filteredLogs || filteredLogs.length === 0) {
      setToastMsg?.('No data available to export.');
      return;
    }

    const { searchQuery = '', decisionFilter = 'All' } = filtersInfo;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    const headers = [[
      { content: 'SL.\nNO.', styles: { halign: 'center' } },
      '4M CHANGE\nNO',
      'REQUESTED\nDATE',
      'CHANGE\nREQUEST BY',
      'REQUESTER\nVALIDATION',
      'APPROVER SET UP\nVERIFICATION (QA)',
      'APPROVER\nVALIDATION STATUS',
      'REMARKS'
    ]];

    const tableData = filteredLogs.map((item, idx) => [
      idx + 1,
      item.changeNo,
      item.date ? formatDateToDDMMYYYY(item.date) : '-',
      item.requester,
      item.weldTest || '-',
      item.qaTest || '-',
      item.status === 'Accepted'
        ? 'Approved'
        : item.status === 'Pending'
          ? (item.weldTest && item.weldTest !== '-' ? 'QAD Approval Needed' : 'Pending Requester Validation')
          : item.status,
      item.remarks || '-'
    ]);

    // Branding & Title (Orange theme)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(217, 119, 6); // Orange
    doc.text('4M Change Management System - L2 Validation Logs', 40, 45);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);
    const l2FilterParts = [];
    if (searchQuery) l2FilterParts.push(`Keyword Search: "${searchQuery}"`);
    if (decisionFilter && decisionFilter !== 'All') l2FilterParts.push(`Validation Decision: "${decisionFilter}"`);
    const l2FilterText = l2FilterParts.length > 0
      ? `Applied Filters: ${l2FilterParts.join('  |  ')}`
      : 'Report Scope: All Validation Records (No filters applied)';
    doc.text(l2FilterText, 40, 75);

    autoTable(doc, {
      startY: 90,
      head: headers,
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [217, 119, 6], // Orange
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 4, right: 3, bottom: 4, left: 3 }
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 }
      },
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },          // SL. NO.
        1: { cellWidth: 75, fontStyle: 'bold' },          // 4M CHANGE NO
        2: { cellWidth: 65, halign: 'center' },           // REQUESTED DATE
        3: { cellWidth: 105 },                            // CHANGE REQUEST BY
        4: { cellWidth: 110 },                            // REQUESTER VALIDATION
        5: { cellWidth: 138 },                            // APPROVER SET UP VERIFICATION (QA)
        6: { cellWidth: 110, halign: 'center' },          // APPROVER VALIDATION STATUS
        7: { cellWidth: 131 }                             // REMARKS
      },
      margin: { top: 40, bottom: 40, left: 40, right: 40 },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        drawFooter(doc, `Page ${data.pageNumber} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL L2 LOGS');
      },
      didParseCell: (data) => {
        if (data.column.index === 6 && data.row.section === 'body') {
          const val = data.cell.text[0];
          const cleanVal = val ? val.trim().toLowerCase() : '';
          if (cleanVal.includes('accept') || cleanVal.includes('approve') || cleanVal.includes('completed')) {
            data.cell.styles.textColor = [16, 124, 65]; // Green
            data.cell.styles.fontStyle = 'bold';
          } else if (cleanVal.includes('reject')) {
            data.cell.styles.textColor = [220, 38, 38]; // Red
            data.cell.styles.fontStyle = 'bold';
          } else if (cleanVal.includes('need') || cleanVal.includes('qa')) {
            data.cell.styles.textColor = [79, 70, 229]; // Indigo/Blue
            data.cell.styles.fontStyle = 'bold';
          } else if (cleanVal.includes('pending')) {
            data.cell.styles.textColor = [217, 119, 6]; // Yellow
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    doc.save(`4M_L2_Validation_Logs_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('L2 validation logs exported successfully!');
  } catch (error) {
    console.error('Error generating L2 PDF:', error);
    setToastMsg?.('Error generating L2 PDF export.');
  }
};

/**
 * Exports the L3 Approval Matrix to a landscape A4 PDF.
 * @param {Array} filteredLogs 
 * @param {Object} filtersInfo 
 * @param {Function} setToastMsg 
 */
export const exportL3ApprovalsPDF = (filteredLogs, filtersInfo = {}, setToastMsg) => {
  try {
    if (!filteredLogs || filteredLogs.length === 0) {
      setToastMsg?.('No data available to export.');
      return;
    }

    const { searchQuery = '', statusFilter = 'All' } = filtersInfo;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    // 14 columns to fit A4 landscape (842pt width)
    const headers = [[
      { content: 'SL.\nNO.', styles: { halign: 'center' } },
      '4M CHANGE\nNO',
      'REQUESTED\nDATE',
      'CHANGE\nREQUEST BY',
      'PED',
      'QAD',
      'PRODUC-\nTION',
      'MAINTE-\nNANCE',
      'PC & L',
      'MATE-\nRIALS',
      'MARKE-\nTING',
      'HR',
      'SAFETY',
      'UNIT\nHEAD'
    ]];

    const tableData = filteredLogs.map((item, idx) => [
      idx + 1,
      item.changeNo,
      item.date ? formatDateToDDMMYYYY(item.date) : '-',
      item.requester ? item.requester.split('@')[0] : '-',
      item.ped || 'Pending',
      item.qad || 'Pending',
      item.production || 'Pending',
      item.maintenance || 'Pending',
      item.pcl || 'Pending',
      item.materials || 'Pending',
      item.marketing || 'Pending',
      item.hr || 'Pending',
      item.safety || 'Pending',
      item.unitHead || 'Pending'
    ]);

    // Branding & Title (Purple theme)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(124, 58, 237); // #7c3aed (Purple)
    doc.text('4M Change Management System - L3 Approval Tracker Matrix', 40, 45);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);
    const l3FilterParts = [];
    if (searchQuery) l3FilterParts.push(`Keyword Search: "${searchQuery}"`);
    if (statusFilter && statusFilter !== 'All') l3FilterParts.push(`Approval Status: "${statusFilter}"`);
    const l3FilterText = l3FilterParts.length > 0
      ? `Applied Filters: ${l3FilterParts.join('  |  ')}`
      : 'Report Scope: All Approval Records (No filters applied)';
    doc.text(l3FilterText, 40, 75);

    autoTable(doc, {
      startY: 90,
      head: headers,
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [124, 58, 237], // Purple
        textColor: [255, 255, 255],
        fontSize: 6.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 4, right: 3, bottom: 4, left: 3 }
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [51, 65, 85],
        halign: 'center',
        cellPadding: { top: 3, right: 3, bottom: 3, left: 3 }
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' },         // SL. NO.
        1: { cellWidth: 62, fontStyle: 'bold', halign: 'left' },  // 4M CHANGE NO
        2: { cellWidth: 58, halign: 'center' },          // REQUESTED DATE
        3: { cellWidth: 70, halign: 'left' },            // CHANGE REQUEST BY
        4: { cellWidth: 52, halign: 'center' },          // PED
        5: { cellWidth: 45, halign: 'center' },          // QAD
        6: { cellWidth: 62, halign: 'center' },          // PRODUCTION
        7: { cellWidth: 65, halign: 'center' },          // MAINTENANCE
        8: { cellWidth: 45, halign: 'center' },          // PC & L
        9: { cellWidth: 57, halign: 'center' },          // MATERIALS
        10: { cellWidth: 57, halign: 'center' },         // MARKETING
        11: { cellWidth: 35, halign: 'center' },         // HR
        12: { cellWidth: 48, halign: 'center' },         // SAFETY
        13: { cellWidth: 62, halign: 'center' }          // UNIT HEAD
      },
      margin: { top: 40, bottom: 40, left: 40, right: 40 },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        drawFooter(doc, `Page ${data.pageNumber} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL L3 APPROVAL MATRIX');
      },
      didParseCell: (data) => {
        // Highlight status cells
        if (data.column.index >= 4 && data.column.index <= 13 && data.row.section === 'body') {
          const val = data.cell.text[0];
          const cleanVal = val ? val.trim().toLowerCase() : '';
          if (cleanVal.includes('accept') || cleanVal.includes('approve') || cleanVal.includes('completed')) {
            data.cell.styles.textColor = [16, 124, 65]; // Green
            data.cell.styles.fontStyle = 'bold';
          } else if (cleanVal.includes('reject')) {
            data.cell.styles.textColor = [220, 38, 38]; // Red
            data.cell.styles.fontStyle = 'bold';
          } else if (cleanVal.includes('pending')) {
            data.cell.styles.textColor = [217, 119, 6]; // Yellow
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    doc.save(`4M_L3_Approval_Matrix_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('L3 matrix approvals exported successfully!');
  } catch (error) {
    console.error('Error generating L3 PDF:', error);
    setToastMsg?.('Error generating L3 PDF export.');
  }
};

/**
 * Exports the Approvals list to a landscape A4 PDF.
 * @param {Array} filteredApprovals 
 * @param {Object} filtersInfo 
 * @param {Function} setToastMsg 
 */
export const exportApprovalsListPDF = (filteredApprovals, filtersInfo = {}, setToastMsg) => {
  try {
    if (!filteredApprovals || filteredApprovals.length === 0) {
      setToastMsg?.('No data available to export.');
      return;
    }

    const {
      searchQuery = '',
      statusFilter = 'All',
      actingDept = ''
    } = filtersInfo;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    const headers = [[
      { content: 'SL.\nNO.', styles: { halign: 'center' } },
      '4M CHANGE\nNO',
      'REQUEST\nDATE',
      'REQUESTED BY',
      'DEPARTMENT',
      'WORKFLOW\nSTAGE',
      'HOD\nDECISION',
      'HOD REMARKS'
    ]];

    const tableData = filteredApprovals.map((item, idx) => {
      const crStatus = item.crStatus || '';
      const stageLabel =
        crStatus.toLowerCase() === 'pending' ? 'L1 - HOD Review' :
          crStatus.toLowerCase() === 'evaluating' ? 'L2 - Validation' :
            crStatus.toLowerCase() === 'approved' ? 'L3 - Approval' :
              crStatus.toLowerCase() === 'completed' ? 'Completed' :
                crStatus || 'Pending';

      return [
        idx + 1,
        item.changeNo,
        item.date || '-',
        item.requestBy || item.requesterEmail || '-',
        item.dept || '-',
        stageLabel,
        item.hodStatus || 'Pending',
        item.hodRemarks || '-'
      ];
    });

    // Title & Branding (Blue theme)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 102, 204); // #0066cc
    doc.text('4M Change Management System - L1 HOD Approvals Log', 40, 45);

    // Metadata details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);

    const filterParts = [];
    if (searchQuery) filterParts.push(`Keyword Search: "${searchQuery}"`);
    if (statusFilter !== 'All') filterParts.push(`HOD Decision: "${statusFilter}"`);
    if (actingDept) filterParts.push(`Acting Department: "${actingDept}"`);

    const filterText = filterParts.length > 0
      ? `Applied Filters: ${filterParts.join('  |  ')}`
      : 'Report Scope: All HOD Approval Records (No filters applied)';

    doc.text(filterText, 40, 75);

    // AutoTable generator
    autoTable(doc, {
      startY: 90,
      head: headers,
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 102, 204],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 4, right: 3, bottom: 4, left: 3 }
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 }
      },
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },   // SL. NO.
        1: { cellWidth: 75, fontStyle: 'bold' },   // 4M CHANGE NO
        2: { cellWidth: 65, halign: 'center' },    // REQUEST DATE
        3: { cellWidth: 140 },                     // REQUESTED BY
        4: { cellWidth: 95 },                      // DEPARTMENT
        5: { cellWidth: 100, halign: 'center' },   // WORKFLOW STAGE
        6: { cellWidth: 78, halign: 'center' },    // HOD DECISION
        7: { cellWidth: 181 }                      // HOD REMARKS
      },
      margin: { top: 40, bottom: 40, left: 40, right: 40 },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        drawFooter(doc, `Page ${data.pageNumber} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL APPROVAL LOGS');
      },
      didParseCell: (data) => {
        if (data.row.section !== 'body') return;
        const val = data.cell.text[0];
        const cleanVal = val ? val.trim().toLowerCase() : '';
        // HOD DECISION (col 6) and WORKFLOW STAGE (col 5)
        if (data.column.index === 6) {
          if (cleanVal.includes('approve') || cleanVal.includes('accept')) {
            data.cell.styles.textColor = [16, 124, 65]; // Green
            data.cell.styles.fontStyle = 'bold';
          } else if (cleanVal.includes('reject')) {
            data.cell.styles.textColor = [220, 38, 38]; // Red
            data.cell.styles.fontStyle = 'bold';
          } else if (cleanVal.includes('pending')) {
            data.cell.styles.textColor = [217, 119, 6]; // Amber
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.column.index === 5) {
          if (cleanVal.includes('completed')) {
            data.cell.styles.textColor = [16, 124, 65]; // Green
            data.cell.styles.fontStyle = 'bold';
          } else if (cleanVal.includes('l3')) {
            data.cell.styles.textColor = [37, 99, 235]; // Blue
            data.cell.styles.fontStyle = 'bold';
          } else if (cleanVal.includes('l2')) {
            data.cell.styles.textColor = [124, 58, 237]; // Purple
            data.cell.styles.fontStyle = 'bold';
          } else if (cleanVal.includes('l1')) {
            data.cell.styles.textColor = [217, 119, 6]; // Amber
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    doc.save(`4M_HOD_Approvals_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('PDF exported successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setToastMsg?.('Error generating PDF export.');
  }
};

/**
 * Exports the Users list to a landscape A4 PDF.
 * @param {Array} filteredUsers 
 * @param {Object} filtersInfo 
 * @param {Function} setToastMsg 
 */
export const exportUsersListPDF = (filteredUsers, filtersInfo = {}, setToastMsg) => {
  try {
    if (!filteredUsers || filteredUsers.length === 0) {
      setToastMsg?.('No data available to export.');
      return;
    }

    const {
      searchQuery = '',
      roleFilter = 'All'
    } = filtersInfo;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    const headers = [['SL. NO.', 'USER ID', 'NAME', 'EMAIL', 'ROLE', 'DEPARTMENT', 'STATUS']];

    const tableData = filteredUsers.map((item, idx) => [
      idx + 1,
      `USR-${String(item.id).padStart(3, '0')}`,
      item.name || 'Unnamed User',
      item.email || '-',
      item.role || '-',
      item.department || '-',
      item.status || 'Active'
    ]);

    // Title & Branding (Blue theme)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 102, 204); // #0066cc
    doc.text('4M Change Management System - User Directory', 40, 45);

    // Metadata details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);

    const filterParts = [];
    if (searchQuery) filterParts.push(`Search: "${searchQuery}"`);
    if (roleFilter !== 'All') filterParts.push(`Role: "${roleFilter}"`);

    const filterText = filterParts.length > 0
      ? `Applied Filters: ${filterParts.join('  |  ')}`
      : 'Report Scope: All User Records (No filters applied)';

    doc.text(filterText, 40, 75);

    // AutoTable generator
    autoTable(doc, {
      startY: 90,
      head: headers,
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 102, 204],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [51, 65, 85] // Slate-700
      },
      columnStyles: {
        0: { cellWidth: 50 },  // SL. NO.
        1: { cellWidth: 80, fontStyle: 'bold' },  // USER ID
        2: { cellWidth: 130 }, // NAME
        3: { cellWidth: 180 }, // EMAIL
        4: { cellWidth: 100 }, // ROLE
        5: { cellWidth: 120 }, // DEPARTMENT
        6: { cellWidth: 100 }  // STATUS
      },
      margin: { top: 40, bottom: 40, left: 40, right: 40 },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        drawFooter(doc, `Page ${data.pageNumber} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL USER DIRECTORY');
      },
      didParseCell: (data) => {
        if (data.column.index === 6 && data.row.index > 0) {
          const val = data.cell.text[0];
          if (val === 'Active') {
            data.cell.styles.textColor = [16, 124, 65]; // Green
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'Inactive') {
            data.cell.styles.textColor = [220, 38, 38]; // Red
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    doc.save(`4M_User_Directory_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('PDF exported successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setToastMsg?.('Error generating PDF export.');
  }
};

/**
 * Exports the Dashboard's filtered change requests to a landscape A4 PDF.
 * @param {Array} filteredChanges 
 * @param {Object} filtersInfo 
 * @param {Function} setToastMsg 
 */
export const exportDashboardRequestsPDF = (filteredChanges, filtersInfo = {}, setToastMsg) => {
  try {
    if (!filteredChanges || filteredChanges.length === 0) {
      setToastMsg?.('No data available to export.');
      return;
    }

    const {
      month = 'All',
      fromDate = '',
      toDate = '',
      person = 'All',
      process = 'All',
      machine = 'All',
      status = 'All'
    } = filtersInfo;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    const headers = [[
      { content: 'SL.\nNO.', styles: { halign: 'center' } },
      '4M CHANGE\nNO',
      'MACHINE\nNO.',
      'DEPARTMENT',
      'PROCESS\nNAME',
      'REQUESTED\nBY',
      'REQUEST\nDATE',
      'HOD\nAPPROVAL',
      'L2\nSTATUS',
      'L3\nSTATUS',
      'OVERALL\nSTATUS'
    ]];

    const tableData = filteredChanges.map((item, idx) => {
      const displayStatus = getRequestDisplayStatus(item);
      return [
        idx + 1,
        item.id,
        item.machineNo || '-',
        item.dept || item.department || '-',
        item.processName || '-',
        item.requester ? item.requester.split('@')[0] : '-',
        item.date ? formatDateToDDMMYYYY(item.date) : '-',
        item.hodStatus || 'Pending',
        item.l2Status || 'Pending',
        item.isL3Complete ? 'Completed' : item.hasL3Rejection ? 'Rejected' : 'Pending',
        displayStatus
      ];
    });

    // Title & Branding (Blue theme)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]); // Premium primary color
    doc.text('4M Change Management System - Dashboard Overview', 40, 45);

    // Metadata details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);

    const filterParts = [];
    if (month !== 'All') filterParts.push(`Month: "${month}"`);
    if (fromDate) filterParts.push(`From: "${fromDate}"`);
    if (toDate) filterParts.push(`To: "${toDate}"`);
    if (person !== 'All') filterParts.push(`Requested By: "${person.split('@')[0]}"`);
    if (process !== 'All') filterParts.push(`Process: "${process}"`);
    if (machine !== 'All') filterParts.push(`Machine: "${machine}"`);
    if (status !== 'All') filterParts.push(`Status: "${status}"`);

    const filterText = filterParts.length > 0
      ? `Applied Filters: ${filterParts.join('  |  ')}`
      : 'Report Scope: All Change Requests (No filters applied)';

    doc.text(filterText, 40, 75);

    // AutoTable generator
    autoTable(doc, {
      startY: 90,
      head: headers,
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: PRIMARY_COLOR,
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 4, right: 3, bottom: 4, left: 3 }
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85],
        cellPadding: { top: 3, right: 3, bottom: 3, left: 3 }
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' },          // SL. NO.
        1: { cellWidth: 68, fontStyle: 'bold' },          // 4M CHANGE NO
        2: { cellWidth: 62, halign: 'center' },           // MACHINE NO.
        3: { cellWidth: 85 },                             // DEPARTMENT
        4: { cellWidth: 88 },                             // PROCESS NAME
        5: { cellWidth: 80 },                             // REQUESTED BY
        6: { cellWidth: 58, halign: 'center' },           // REQUEST DATE
        7: { cellWidth: 60, halign: 'center' },           // HOD APPROVAL
        8: { cellWidth: 52, halign: 'center' },           // L2 STATUS
        9: { cellWidth: 52, halign: 'center' },           // L3 STATUS
        10: { cellWidth: 82, halign: 'center' }            // OVERALL STATUS
      },
      margin: { top: 40, bottom: 40, left: 40, right: 40 },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        drawFooter(doc, `Page ${data.pageNumber} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL DASHBOARD OVERVIEW');
      },
      didParseCell: (data) => {
        applyCellStatusColors(data, 7, 10);
      }
    });

    doc.save(`4M_Dashboard_Requests_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('PDF exported successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setToastMsg?.('Error generating PDF export.');
  }
};

/**
 * Exports the Effectiveness Monitoring Logs to a landscape A4 PDF.
 * @param {Array} filteredLogs 
 * @param {Object} filtersInfo 
 * @param {Function} setToastMsg 
 */
export const exportEffectivenessLogsPDF = (filteredLogs, filtersInfo = {}, setToastMsg) => {
  try {
    if (!filteredLogs || filteredLogs.length === 0) {
      setToastMsg?.('No data available to export.');
      return;
    }

    const { searchQuery = '', monthFilter = 'All', fromDate = '', toDate = '', tabLabel = 'Ongoing Monitoring' } = filtersInfo;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    const headers = [[
      { content: 'SL.\nNO.', styles: { halign: 'center' } },
      '4M CHANGE NO',
      'REQUESTED\nDATE',
      'CONTEXT OF CHANGE',
      'CHANGE\nDATE START',
      'MONTH\nWISE',
      'EFFECTIVENESS\nSTATUS',
      'QA\nAPPROVAL',
      'REMARKS'
    ]];

    const tableData = filteredLogs.map((item, idx) => {
      return [
        idx + 1,
        item.changeNo,
        item.reqDate ? formatDateToDDMMYYYY(item.reqDate) : '-',
        item.context || '-',
        item.startDate ? formatDateToDDMMYYYY(item.startDate) : '-',
        item.monthWise ? formatMonthWise(item.monthWise) : '-',
        item.status || '-',
        item.qaApproval || '-',
        item.remarks || '-'
      ];
    });

    // Title & Branding (Green theme)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(16, 124, 65); // #107c41 (Green)
    doc.text('4M Change Management System - Effectiveness Monitoring Logs', 40, 45);

    // Metadata details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}   |   View: ${tabLabel}`, 40, 60);

    const filterParts = [];
    if (searchQuery) filterParts.push(`Keyword Search: "${searchQuery}"`);
    if (monthFilter !== 'All') filterParts.push(`Month: "${monthFilter}"`);
    if (fromDate) filterParts.push(`From: "${fromDate}"`);
    if (toDate) filterParts.push(`To: "${toDate}"`);

    const filterText = filterParts.length > 0
      ? `Applied Filters: ${filterParts.join('  |  ')}`
      : 'Report Scope: All Effectiveness Records (No filters applied)';

    doc.text(filterText, 40, 75);

    // AutoTable generator
    autoTable(doc, {
      startY: 90,
      head: headers,
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [16, 124, 65], // Green
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 4, right: 3, bottom: 4, left: 3 }
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 }
      },
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },   // SL. NO.
        1: { cellWidth: 75, fontStyle: 'bold' },   // 4M CHANGE NO
        2: { cellWidth: 65, halign: 'center' },    // REQUESTED DATE
        3: { cellWidth: 118 },                     // CONTEXT OF CHANGE
        4: { cellWidth: 65, halign: 'center' },    // CHANGE DATE START
        5: { cellWidth: 55, halign: 'center' },    // MONTH WISE
        6: { cellWidth: 110 },                     // EFFECTIVENESS STATUS
        7: { cellWidth: 72, halign: 'center' },    // QAD APPROVAL
        8: { cellWidth: 118 }                      // REMARKS
      },
      margin: { top: 40, bottom: 40, left: 40, right: 40 },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        drawFooter(doc, `Page ${data.pageNumber} of ${pageCount}`, 'NIPPON QAD - CONFIDENTIAL EFFECTIVENESS OBSERVATIONS');
      },
      didParseCell: (data) => {
        // Highlight Status
        if (data.column.index === 6 && data.row.section === 'body') {
          const val = data.cell.text[0];
          if (val === 'Effectiveness Ok') {
            data.cell.styles.textColor = [16, 124, 65]; // Green
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'Effectiveness Not Ok') {
            data.cell.styles.textColor = [220, 38, 38]; // Red
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Highlight QAD Approval Decision
        if (data.column.index === 7 && data.row.section === 'body') {
          const val = data.cell.text[0];
          if (val === 'Approved') {
            data.cell.styles.textColor = [16, 124, 65]; // Green
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'Rejected') {
            data.cell.styles.textColor = [220, 38, 38]; // Red
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    doc.save(`4M_Effectiveness_Logs_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('PDF exported successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setToastMsg?.('Error generating PDF export.');
  }
};

/**
 * Formats a summary of current filters.
 */
const getFilterSummaryText = (filtersInfo) => {
  const {
    month = 'All',
    fromDate = '',
    toDate = '',
    person = 'All',
    process = 'All',
    machine = 'All',
    status = 'All'
  } = filtersInfo;

  const filterParts = [];
  if (month !== 'All') filterParts.push(`Month: "${month}"`);
  if (fromDate) filterParts.push(`From: "${fromDate}"`);
  if (toDate) filterParts.push(`To: "${toDate}"`);
  if (person !== 'All') filterParts.push(`Person: "${person.split('@')[0]}"`);
  if (process !== 'All') filterParts.push(`Process: "${process}"`);
  if (machine !== 'All') filterParts.push(`Machine: "${machine}"`);
  if (status !== 'All') filterParts.push(`Status: "${status}"`);

  return filterParts.length > 0
    ? `Applied Filters: ${filterParts.join('  |  ')}`
    : 'Report Scope: All Records (No filters applied)';
};

/**
 * Export Department Analytics
 */
export const exportDepartmentAnalyticsPDF = (filteredChanges, filtersInfo = {}, setToastMsg, dbDepartments = []) => {
  try {
    if (!filteredChanges || filteredChanges.length === 0) {
      setToastMsg?.({ text: 'No data available to export.', isError: true });
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    // Calculate counts dynamically from DB departments
    const departmentNames = dbDepartments && dbDepartments.length > 0
      ? dbDepartments
      : ['PED', 'QAD', 'PRODUCTION', 'MAINTENANCE', 'PC & L', 'MATERIALS', 'MARKETING', 'HR', 'SAFETY'];

    const counts = {};
    departmentNames.forEach(d => {
      counts[d] = 0;
    });

    filteredChanges.forEach(c => {
      const rawDept = (c.dept || c.department || '').trim().toUpperCase();
      if (!rawDept) return;

      const matchedDept = departmentNames.find(d => d.toUpperCase() === rawDept);
      if (matchedDept) {
        counts[matchedDept]++;
      } else {
        let mapped = null;
        if (rawDept.includes('PED')) mapped = 'PED';
        else if (rawDept.includes('QA') || rawDept.includes('QUALITY')) mapped = 'QAD';
        else if (rawDept.includes('PROD')) mapped = 'PRODUCTION';
        else if (rawDept.includes('MAINT')) mapped = 'MAINTENANCE';
        else if (rawDept.includes('PC')) mapped = 'PC & L';
        else if (rawDept.includes('MATER')) mapped = 'MATERIALS';
        else if (rawDept.includes('MARKET')) mapped = 'MARKETING';
        else if (rawDept.includes('HR')) mapped = 'HR';
        else if (rawDept.includes('SAFE')) mapped = 'SAFETY';

        if (mapped) {
          const dbMapped = departmentNames.find(d => d.toUpperCase().includes(mapped.toUpperCase()) || mapped.toUpperCase().includes(d.toUpperCase()));
          if (dbMapped) {
            counts[dbMapped]++;
            return;
          }
        }

        const substringMatch = departmentNames.find(d =>
          rawDept.includes(d.toUpperCase()) || d.toUpperCase().includes(rawDept)
        );
        if (substringMatch) {
          counts[substringMatch]++;
        }
      }
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const summaryHeaders = [['DEPARTMENT', 'NO. OF CHANGE REQUESTS', 'PERCENTAGE']];
    const summaryRows = Object.keys(counts).map(dept => {
      const count = counts[dept];
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0.0%';
      return [dept, count, pct];
    });
    summaryRows.push([
      { content: 'TOTAL', fontStyle: 'bold' },
      { content: total, fontStyle: 'bold' },
      { content: '100%', fontStyle: 'bold' }
    ]);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text('4M Change Management - Department Analytics', 40, 45);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);

    const filterText = getFilterSummaryText(filtersInfo);
    doc.text(filterText, 40, 72);

    // Summary table
    autoTable(doc, {
      startY: 85,
      head: summaryHeaders,
      body: summaryRows,
      theme: 'grid',
      headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 220 },
        1: { cellWidth: 160, halign: 'center' },
        2: { cellWidth: 135, halign: 'center' }
      },
      margin: { left: 40, right: 40 }
    });

    // Detail header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('Detailed Change Requests by Department', 40, doc.lastAutoTable.finalY + 25);

    const detailedHeaders = [['SL. NO.', 'CHANGE NO.', 'DEPARTMENT', 'MACHINE NO.', 'DATE', 'STATUS']];
    const detailedRows = filteredChanges.map((c, idx) => {
      const displayDate = c.date ? formatDateToDDMMYYYY(c.date) : '-';
      const displayStatus = getRequestDisplayStatus(c);

      return [
        idx + 1,
        c.id,
        c.dept || c.department || 'PRODUCTION',
        c.machineNo || '-',
        displayDate,
        displayStatus
      ];
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 35,
      head: detailedHeaders,
      body: detailedRows,
      theme: 'striped',
      headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 100, fontStyle: 'bold' },
        2: { cellWidth: 110 },
        3: { cellWidth: 90 },
        4: { cellWidth: 80 },
        5: { cellWidth: 85 }
      },
      margin: { left: 40, right: 40, bottom: 40 },
      didParseCell: (data) => {
        applyCellStatusColors(data, 5);
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        drawFooter(doc, `Page ${data.pageNumber} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL');
      }
    });

    doc.save(`4M_Department_Analytics_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('PDF exported successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setToastMsg?.('Error exporting Department Analytics.');
  }
};

/**
 * Export Process Analytics
 */
export const exportProcessAnalyticsPDF = (filteredChanges, filtersInfo = {}, setToastMsg, dbProcesses = []) => {
  try {
    if (!filteredChanges || filteredChanges.length === 0) {
      setToastMsg?.('No data available to export.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    // Calculate process counts
    const processNames = dbProcesses && dbProcesses.length > 0
      ? dbProcesses
      : ['Wind', 'Gold', 'EOL', 'Pott', 'Load'];

    const counts = {};
    processNames.forEach(p => {
      counts[p] = 0;
    });

    filteredChanges.forEach(c => {
      if (!c.processName) return;
      const pNameNormalized = c.processName.trim().toLowerCase();
      const matchedProcess = processNames.find(p => p.toLowerCase() === pNameNormalized);
      if (matchedProcess) {
        counts[matchedProcess]++;
      } else {
        const substringMatch = processNames.find(p => pNameNormalized.includes(p.toLowerCase()) || p.toLowerCase().includes(pNameNormalized));
        if (substringMatch) {
          counts[substringMatch]++;
        }
      }
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const summaryHeaders = [['PROCESS', 'NO. OF CHANGE REQUESTS', 'PERCENTAGE']];
    const summaryRows = Object.keys(counts).map(proc => {
      const count = counts[proc];
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0.0%';
      return [proc, count, pct];
    });
    summaryRows.push([
      { content: 'TOTAL', fontStyle: 'bold' },
      { content: total, fontStyle: 'bold' },
      { content: '100%', fontStyle: 'bold' }
    ]);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text('4M Change Management - Process Analytics', 40, 45);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);

    const filterText = getFilterSummaryText(filtersInfo);
    doc.text(filterText, 40, 72);

    // Summary table
    autoTable(doc, {
      startY: 85,
      head: summaryHeaders,
      body: summaryRows,
      theme: 'grid',
      headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 220 },
        1: { cellWidth: 160, halign: 'center' },
        2: { cellWidth: 135, halign: 'center' }
      },
      margin: { left: 40, right: 40 }
    });

    // Detail header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('Detailed Change Requests by Process', 40, doc.lastAutoTable.finalY + 25);

    const detailedHeaders = [['SL. NO.', 'CHANGE NO.', 'PROCESS NAME', 'MACHINE NO.', 'DATE', 'STATUS']];
    const detailedRows = filteredChanges.map((c, idx) => {
      const displayDate = c.date ? formatDateToDDMMYYYY(c.date) : '-';
      const displayStatus = getRequestDisplayStatus(c);

      return [
        idx + 1,
        c.id,
        c.processName || '-',
        c.machineNo || '-',
        displayDate,
        displayStatus
      ];
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 35,
      head: detailedHeaders,
      body: detailedRows,
      theme: 'striped',
      headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 100, fontStyle: 'bold' },
        2: { cellWidth: 110 },
        3: { cellWidth: 90 },
        4: { cellWidth: 80 },
        5: { cellWidth: 85 }
      },
      margin: { left: 40, right: 40, bottom: 40 },
      didParseCell: (data) => {
        applyCellStatusColors(data, 5);
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        drawFooter(doc, `Page ${data.pageNumber} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL');
      }
    });

    doc.save(`4M_Process_Analytics_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('PDF exported successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setToastMsg?.('Error exporting Process Analytics.');
  }
};

/**
 * Export 6M Category Analytics
 */
export const exportCategoryAnalyticsPDF = (filteredChanges, filtersInfo = {}, setToastMsg) => {
  try {
    if (!filteredChanges || filteredChanges.length === 0) {
      setToastMsg?.('No data available to export.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    // Calculate category counts
    const counts = { 'Man': 0, 'Mac': 0, 'Met': 0, 'Mat': 0, 'Mea': 0, 'Mot': 0 };

    filteredChanges.forEach(c => {
      const catStr = (c.changeIn || c.title || c.id || '').trim().toLowerCase();
      let matchedAny = false;
      if (catStr.includes('man') || catStr.includes('train')) { counts['Man']++; matchedAny = true; }
      if (catStr.includes('mac') || catStr.includes('machin') || catStr.includes('weld')) { counts['Mac']++; matchedAny = true; }
      if (catStr.includes('met') || catStr.includes('calib') || catStr.includes('sso') || catStr.includes('db') || catStr.includes('api') || catStr.includes('vulner')) { counts['Met']++; matchedAny = true; }
      if (catStr.includes('mat') || catStr.includes('spec') || catStr.includes('cool')) { counts['Mat']++; matchedAny = true; }
      if (catStr.includes('mea') || catStr.includes('gauge') || catStr.includes('check') || catStr.includes('repeat')) { counts['Mea']++; matchedAny = true; }
      if (catStr.includes('mot') || catStr.includes('nature') || catStr.includes('env')) { counts['Mot']++; matchedAny = true; }
      if (!matchedAny) counts['Met']++; // fallback
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const summaryHeaders = [['6M CATEGORY', 'NO. OF CHANGE REQUESTS', 'PERCENTAGE']];
    const summaryRows = Object.keys(counts).map(cat => {
      const count = counts[cat];
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0.0%';
      return [cat, count, pct];
    });
    summaryRows.push([
      { content: 'TOTAL', fontStyle: 'bold' },
      { content: total, fontStyle: 'bold' },
      { content: '100%', fontStyle: 'bold' }
    ]);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text('4M Change Management - 6M Category Analytics', 40, 45);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);

    const filterText = getFilterSummaryText(filtersInfo);
    doc.text(filterText, 40, 72);

    // Summary table
    autoTable(doc, {
      startY: 85,
      head: summaryHeaders,
      body: summaryRows,
      theme: 'grid',
      headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 220 },
        1: { cellWidth: 160, halign: 'center' },
        2: { cellWidth: 135, halign: 'center' }
      },
      margin: { left: 40, right: 40 }
    });

    // Detail header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('Detailed Change Requests by 6M Category', 40, doc.lastAutoTable.finalY + 25);

    const detailedHeaders = [['SL. NO.', 'CHANGE NO.', 'CHANGE IN / TITLE', 'MACHINE NO.', 'DATE', 'STATUS']];
    const detailedRows = filteredChanges.map((c, idx) => {
      const displayDate = c.date ? formatDateToDDMMYYYY(c.date) : '-';
      const displayStatus = getRequestDisplayStatus(c);

      return [
        idx + 1,
        c.id,
        c.changeIn || c.title || '-',
        c.machineNo || '-',
        displayDate,
        displayStatus
      ];
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 35,
      head: detailedHeaders,
      body: detailedRows,
      theme: 'striped',
      headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 90, fontStyle: 'bold' },
        2: { cellWidth: 155 },
        3: { cellWidth: 80 },
        4: { cellWidth: 75 },
        5: { cellWidth: 75 }
      },
      margin: { left: 40, right: 40, bottom: 40 },
      didParseCell: (data) => {
        applyCellStatusColors(data, 5);
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        drawFooter(doc, `Page ${data.pageNumber} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL');
      }
    });

    doc.save(`4M_6M_Category_Analytics_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('PDF exported successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setToastMsg?.('Error exporting 6M Category Analytics.');
  }
};

/**
 * Export Monthly Analytics
 */
export const exportMonthlyAnalyticsPDF = (filteredChanges, filtersInfo = {}, setToastMsg) => {
  try {
    if (!filteredChanges || filteredChanges.length === 0) {
      setToastMsg?.('No data available to export.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    // Calculate monthly counts
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const counts = Array(12).fill(0);

    filteredChanges.forEach(c => {
      const dVal = c.rawDate || c.date;
      if (!dVal) return;
      try {
        const d = parseDDMMYYYYToDate(dVal);
        if (d && !isNaN(d.getTime())) {
          counts[d.getMonth()]++;
        }
      } catch {
        // Ignore date parsing errors
      }
    });

    const total = counts.reduce((a, b) => a + b, 0);

    const summaryHeaders = [['MONTH', 'NO. OF CHANGE REQUESTS', 'PERCENTAGE']];
    const summaryRows = months.map((m, idx) => {
      const count = counts[idx];
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0.0%';
      return [m, count, pct];
    });
    summaryRows.push([
      { content: 'TOTAL', fontStyle: 'bold' },
      { content: total, fontStyle: 'bold' },
      { content: '100%', fontStyle: 'bold' }
    ]);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text('4M Change Management - Monthly Analytics', 40, 45);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);

    const filterText = getFilterSummaryText(filtersInfo);
    doc.text(filterText, 40, 72);

    // Summary table
    autoTable(doc, {
      startY: 85,
      head: summaryHeaders,
      body: summaryRows,
      theme: 'grid',
      headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 220 },
        1: { cellWidth: 160, halign: 'center' },
        2: { cellWidth: 135, halign: 'center' }
      },
      margin: { left: 40, right: 40 }
    });

    // Detail header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('Detailed Change Requests List', 40, doc.lastAutoTable.finalY + 25);

    const detailedHeaders = [['SL. NO.', 'CHANGE NO.', 'DEPARTMENT', 'MACHINE NO.', 'DATE', 'STATUS']];
    const detailedRows = filteredChanges.map((c, idx) => {
      const displayDate = c.date ? formatDateToDDMMYYYY(c.date) : '-';
      const displayStatus = getRequestDisplayStatus(c);

      return [
        idx + 1,
        c.id,
        c.dept || c.department || 'PRODUCTION',
        c.machineNo || '-',
        displayDate,
        displayStatus
      ];
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 35,
      head: detailedHeaders,
      body: detailedRows,
      theme: 'striped',
      headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 100, fontStyle: 'bold' },
        2: { cellWidth: 110 },
        3: { cellWidth: 90 },
        4: { cellWidth: 80 },
        5: { cellWidth: 85 }
      },
      margin: { left: 40, right: 40, bottom: 40 },
      didParseCell: (data) => {
        applyCellStatusColors(data, 5);
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        drawFooter(doc, `Page ${data.pageNumber} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL');
      }
    });

    doc.save(`4M_Monthly_Analytics_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('PDF exported successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setToastMsg?.('Error exporting Monthly Analytics.');
  }
};

/**
 * Export Approval Status Analytics
 */
export const exportApprovalStatusAnalyticsPDF = (filteredChanges, filtersInfo = {}, setToastMsg) => {
  try {
    if (!filteredChanges || filteredChanges.length === 0) {
      setToastMsg?.('No data available to export.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dataMap = months.map(m => ({ label: m, appr: 0, closed: 0, rej: 0, pend: 0 }));

    filteredChanges.forEach(c => {
      const dVal = c.rawDate || c.date;
      if (!dVal) return;
      try {
        const d = parseDDMMYYYYToDate(dVal);
        if (d && !isNaN(d.getTime())) {
          const monthIdx = d.getMonth();
          const dispStatus = getRequestDisplayStatus(c);
          if (dispStatus === 'Approved' || dispStatus === 'L3 Approved') {
            dataMap[monthIdx].appr++;
          } else if (dispStatus === 'Closed') {
            dataMap[monthIdx].closed++;
          } else if (dispStatus === 'Rejected') {
            dataMap[monthIdx].rej++;
          } else {
            dataMap[monthIdx].pend++;
          }
        }
      } catch {
        // Ignore date parsing errors
      }
    });

    const summaryHeaders = [['MONTH', 'L3 APPROVED', 'CLOSED', 'REJECTED', 'PENDING', 'TOTAL']];
    const summaryRows = dataMap.map(item => {
      const monthTotal = item.appr + item.closed + item.rej + item.pend;
      return [item.label, item.appr, item.closed, item.rej, item.pend, monthTotal];
    });

    const totalAppr = dataMap.reduce((a, b) => a + b.appr, 0);
    const totalClosed = dataMap.reduce((a, b) => a + b.closed, 0);
    const totalRej = dataMap.reduce((a, b) => a + b.rej, 0);
    const totalPend = dataMap.reduce((a, b) => a + b.pend, 0);
    const totalAll = totalAppr + totalClosed + totalRej + totalPend;

    summaryRows.push([
      { content: 'TOTAL', fontStyle: 'bold' },
      { content: totalAppr, fontStyle: 'bold' },
      { content: totalClosed, fontStyle: 'bold' },
      { content: totalRej, fontStyle: 'bold' },
      { content: totalPend, fontStyle: 'bold' },
      { content: totalAll, fontStyle: 'bold' }
    ]);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text('4M Change Management - Approval Status Analytics', 40, 45);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);

    const filterText = getFilterSummaryText(filtersInfo);
    doc.text(filterText, 40, 72);

    // Summary table
    autoTable(doc, {
      startY: 85,
      head: summaryHeaders,
      body: summaryRows,
      theme: 'grid',
      headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 115 },
        1: { cellWidth: 80, halign: 'center' },
        2: { cellWidth: 80, halign: 'center' },
        3: { cellWidth: 80, halign: 'center' },
        4: { cellWidth: 80, halign: 'center' },
        5: { cellWidth: 80, halign: 'center' }
      },
      margin: { left: 40, right: 40 }
    });

    // Detail header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('Detailed Change Requests List with Status', 40, doc.lastAutoTable.finalY + 25);

    const detailedHeaders = [['SL. NO.', 'CHANGE NO.', 'DEPARTMENT', 'MACHINE NO.', 'DATE', 'STATUS']];
    const detailedRows = filteredChanges.map((c, idx) => {
      const displayDate = c.date ? formatDateToDDMMYYYY(c.date) : '-';
      const displayStatus = getRequestDisplayStatus(c);

      return [
        idx + 1,
        c.id,
        c.dept || c.department || 'PRODUCTION',
        c.machineNo || '-',
        displayDate,
        displayStatus
      ];
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 35,
      head: detailedHeaders,
      body: detailedRows,
      theme: 'striped',
      headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 100, fontStyle: 'bold' },
        2: { cellWidth: 110 },
        3: { cellWidth: 90 },
        4: { cellWidth: 80 },
        5: { cellWidth: 85 }
      },
      margin: { left: 40, right: 40, bottom: 40 },
      didParseCell: (data) => {
        applyCellStatusColors(data, 5);
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        drawFooter(doc, `Page ${data.pageNumber} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL');
      }
    });

    doc.save(`4M_Approval_Status_Analytics_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('PDF exported successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setToastMsg?.('Error exporting Approval Status Analytics.');
  }
};

/**
 * Export Improvement Benefits Analytics
 */
export const exportImprovementBenefitsPDF = (costSavingRows, productivityRows, qualityRows, filtersInfo = {}, setToastMsg) => {
  try {
    const {
      type = 'All',
      month = 'All',
      search = ''
    } = filtersInfo;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    addLogoToDoc(doc);

    // Title & Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 102, 204);
    doc.text('4M Change Management - Improvement Benefits Report', 40, 45);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Exported Date: ${formatDateToDDMMYYYY(getSyncedDate())}`, 40, 60);

    const filterParts = [];
    if (type !== 'All') filterParts.push(`Type: "${type}"`);
    if (month !== 'All') filterParts.push(`Month: "${month}"`);
    if (search) filterParts.push(`Search: "${search}"`);
    const filterText = filterParts.length > 0
      ? `Applied Filters: ${filterParts.join('  |  ')}`
      : 'Report Scope: All Improvement Benefit Records (No filters applied)';
    doc.text(filterText, 40, 72);

    let startY = 90;

    const showCost = type === 'All' || type === 'Cost';
    const showProductivity = type === 'All' || type === 'Productivity';
    const showQuality = type === 'All' || type === 'Quality';

    if (showCost) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 96, 170); // #1e60aa
      doc.text('1. Cost Saving Benefits', 40, startY);

      const costHeaders = [['4M CHANGE NO.', 'IMPLEMENTATION DATE', 'TOTAL COST SAVED / MONTH (RS)', 'TOTAL COST SAVED / ANNUM (RS)', 'ROI']];
      const costTableData = costSavingRows.map(row => [
        row.changeNo,
        row.date || '-',
        `Rs. ${row.monthlySave || '0'}`,
        `Rs. ${row.annualSave || '0'}`,
        row.roi || '-'
      ]);

      autoTable(doc, {
        startY: startY + 10,
        head: costHeaders,
        body: costTableData.length > 0 ? costTableData : [['-', '-', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [30, 96, 170], textColor: [255, 255, 255] },
        bodyStyles: { textColor: [51, 65, 85], fontSize: 8.5 },
        margin: { left: 40, right: 40 }
      });

      startY = doc.lastAutoTable.finalY + 25;
    }

    if (showProductivity) {
      if (startY > doc.internal.pageSize.height - 150) {
        doc.addPage();
        addLogoToDoc(doc);
        startY = 50;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 96, 170);
      doc.text(showCost ? '2. Productivity Improvement Benefits' : '1. Productivity Improvement Benefits', 40, startY);

      const prodHeaders = [['4M CHANGE NO.', 'IMPLEMENTATION DATE', 'CURRENT PRODUCTIVITY (NOS)', 'PRODUCTIVITY IMPROVED (NOS)']];
      const prodTableData = productivityRows.map(row => [
        row.changeNo,
        row.date || '-',
        `${row.currentProd || '0'} nos`,
        `${row.improvedProd || '0'} nos`
      ]);

      autoTable(doc, {
        startY: startY + 10,
        head: prodHeaders,
        body: prodTableData.length > 0 ? prodTableData : [['-', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [30, 96, 170], textColor: [255, 255, 255] },
        bodyStyles: { textColor: [51, 65, 85], fontSize: 8.5 },
        margin: { left: 40, right: 40 }
      });

      startY = doc.lastAutoTable.finalY + 25;
    }

    if (showQuality) {
      if (startY > doc.internal.pageSize.height - 150) {
        doc.addPage();
        addLogoToDoc(doc);
        startY = 50;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 96, 170);
      let secNum = 1;
      if (showCost && showProductivity) secNum = 3;
      else if (showCost || showProductivity) secNum = 2;
      doc.text(`${secNum}. Quality Improvement Benefits`, 40, startY);

      const qualityHeaders = [['4M CHANGE NO.', 'IMPLEMENTATION DATE', 'CURRENT PPM', 'REDUCED PPM']];
      const qualityTableData = qualityRows.map(row => [
        row.changeNo,
        row.date || '-',
        row.currentPpm || '0',
        row.reducedPpm || '0'
      ]);

      autoTable(doc, {
        startY: startY + 10,
        head: qualityHeaders,
        body: qualityTableData.length > 0 ? qualityTableData : [['-', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [30, 96, 170], textColor: [255, 255, 255] },
        bodyStyles: { textColor: [51, 65, 85], fontSize: 8.5 },
        margin: { left: 40, right: 40 }
      });
    }

    // Add Footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawFooter(doc, `Page ${i} of ${pageCount}`, 'NIPPON QUALITY ASSURANCE - CONFIDENTIAL');
    }

    doc.save(`4M_Improvement_Benefits_${formatDateToDDMMYYYY(getSyncedDate()).replace(/\//g, '-')}.pdf`);
    setToastMsg?.('PDF exported successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setToastMsg?.('Error exporting Improvement Benefits.');
  }
};




