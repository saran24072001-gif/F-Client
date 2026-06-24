import { getSyncedDate } from './timeSync';

/**
 * Formats a date string or object consistently to DD/MM/YY format.
 * This is timezone-safe and locale-safe.
 * 
 * @param {any} dateValue - The date to format (Date object, timestamp, ISO string, etc.)
 * @returns {string} The formatted date string (DD/MM/YY)
 */
export const formatDateToDDMMYY = (dateValue) => {
  if (!dateValue) return "-";
  
  const dateStr = String(dateValue).trim();
  
  // 1. If it's already in DD/MM/YY format (e.g. 03/06/26), return it directly
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // 2. If it's in YYYY-MM-DD format (e.g. 2026-06-03)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('-');
    const y = parts[0].slice(-2);
    const m = parts[1];
    const d = parts[2];
    return `${d}/${m}/${y}`;
  }

  // 3. If it's in DD/MM/YYYY format (e.g. 03/06/2026)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    const y = parts[2].slice(-2);
    const m = parts[1];
    const d = parts[0];
    return `${d}/${m}/${y}`;
  }

  // 4. Try parsing using a month mapping (e.g. "Jun 03, 2026", "03 June", "3 Jun")
  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  // Tokenize the string
  const tokens = dateStr.toLowerCase().replace(/,/g, '').split(/\s+/).filter(Boolean);
  if (tokens.length === 3) {
    // case A: ["jun", "03", "2026"]
    if (months[tokens[0]] && /^\d+$/.test(tokens[1]) && /^\d+$/.test(tokens[2])) {
      const d = tokens[1].padStart(2, '0');
      const m = months[tokens[0]];
      const y = tokens[2].slice(-2);
      return `${d}/${m}/${y}`;
    }
    // case B: ["03", "jun", "2026"]
    if (/^\d+$/.test(tokens[0]) && months[tokens[1]] && /^\d+$/.test(tokens[2])) {
      const d = tokens[0].padStart(2, '0');
      const m = months[tokens[1]];
      const y = tokens[2].slice(-2);
      return `${d}/${m}/${y}`;
    }
  } else if (tokens.length === 2) {
    // case C: ["03", "jun"] or ["3", "jun"] or ["jun", "3"]
    const currentYear = String(getSyncedDate().getFullYear()).slice(-2);
    if (/^\d+$/.test(tokens[0]) && months[tokens[1]]) {
      const d = tokens[0].padStart(2, '0');
      const m = months[tokens[1]];
      return `${d}/${m}/${currentYear}`;
    }
    if (months[tokens[0]] && /^\d+$/.test(tokens[1])) {
      const d = tokens[1].padStart(2, '0');
      const m = months[tokens[0]];
      return `${d}/${m}/${currentYear}`;
    }
  }

  // 5. Fallback: JavaScript Date parsing
  const d = new Date(dateValue);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }

  return dateValue;
};

/**
 * Parses a DD/MM/YYYY or DD/MM/YY string safely into a JS Date object.
 * Also parses standard YYYY-MM-DD strings.
 * 
 * @param {string} dateStr - The input date string
 * @returns {Date|null} Parsed Date object or null if invalid
 */
export const parseDDMMYYYYToDate = (dateStr) => {
  if (!dateStr) return null;
  const cleanStr = String(dateStr).trim();
  
  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    const parts = cleanStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (year < 1900 || year > 2100) return null;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        return d;
      }
    }
    return null;
  }
  
  // Format: DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY or DD-MM-YY
  const parts = cleanStr.split(/[-/]/);
  if (parts.length === 3) {
    let day, month, year;
    let yearStr;
    if (parts[0].length === 4) {
      // YYYY/MM/DD
      yearStr = parts[0];
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      // DD/MM/YYYY or DD/MM/YY
      yearStr = parts[2];
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
      if (year < 100) {
        year += 2000;
      }
    }
    
    // Ensure the year component is exactly 2 or 4 digits
    if (yearStr.length !== 2 && yearStr.length !== 4) {
      return null;
    }
    
    // Validate year range
    if (year < 1900 || year > 2100) {
      return null;
    }
    
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        return d;
      }
    }
    return null;
  }
  
  // Fallback parsing (e.g. Month names)
  if (/^\d+$/.test(cleanStr)) {
    return null;
  }
  const d = new Date(cleanStr);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  if (year < 1900 || year > 2100) return null;
  return d;
};

/**
 * Formats a date string or object consistently to DD/MM/YYYY format.
 * This is timezone-safe and locale-safe.
 * 
 * @param {any} dateValue - The date to format (Date object, timestamp, ISO string, etc.)
 * @returns {string} The formatted date string (DD/MM/YYYY)
 */
export const formatDateToDDMMYYYY = (dateValue) => {
  if (!dateValue) return "-";
  
  const dateStr = String(dateValue).trim();
  
  // 1. If it's already in DD/MM/YYYY format (e.g. 03/06/2026), return it directly
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  // 2. If it's in YYYY-MM-DD format (e.g. 2026-06-03)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('-');
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    return `${d}/${m}/${y}`;
  }

  // 3. If it's in DD/MM/YY format (e.g. 03/06/26)
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    const y = parseInt(parts[2], 10);
    const fullYear = y < 100 ? 2000 + y : y;
    const m = parts[1];
    const d = parts[0];
    return `${d}/${m}/${fullYear}`;
  }

  // 4. Try parsing using a month mapping (e.g. "Jun 03, 2026", "03 June", "3 Jun")
  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  // Tokenize the string
  const tokens = dateStr.toLowerCase().replace(/,/g, '').split(/\s+/).filter(Boolean);
  if (tokens.length === 3) {
    // case A: ["jun", "03", "2026"]
    if (months[tokens[0]] && /^\d+$/.test(tokens[1]) && /^\d+$/.test(tokens[2])) {
      const d = tokens[1].padStart(2, '0');
      const m = months[tokens[0]];
      const y = tokens[2];
      const fullYear = y.length === 2 ? `20${y}` : y;
      return `${d}/${m}/${fullYear}`;
    }
    // case B: ["03", "jun", "2026"]
    if (/^\d+$/.test(tokens[0]) && months[tokens[1]] && /^\d+$/.test(tokens[2])) {
      const d = tokens[0].padStart(2, '0');
      const m = months[tokens[1]];
      const y = tokens[2];
      const fullYear = y.length === 2 ? `20${y}` : y;
      return `${d}/${m}/${fullYear}`;
    }
  } else if (tokens.length === 2) {
    // case C: ["03", "jun"] or ["3", "jun"] or ["jun", "3"]
    const currentYear = String(getSyncedDate().getFullYear());
    if (/^\d+$/.test(tokens[0]) && months[tokens[1]]) {
      const d = tokens[0].padStart(2, '0');
      const m = months[tokens[1]];
      return `${d}/${m}/${currentYear}`;
    }
    if (months[tokens[0]] && /^\d+$/.test(tokens[1])) {
      const d = tokens[1].padStart(2, '0');
      const m = months[tokens[0]];
      return `${d}/${m}/${currentYear}`;
    }
  }

  // 5. Fallback: JavaScript Date parsing
  const d = new Date(dateValue);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());
    return `${day}/${month}/${year}`;
  }

  return dateValue;
};
