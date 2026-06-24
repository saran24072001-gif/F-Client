import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { parseDDMMYYYYToDate } from '../../utils/dateUtils';

export const CustomDatePicker = ({ value, onChange, placeholder = "dd/mm/yyyy", inputClassName = "", buttonClassName = "", containerClassName = "", id, disabled, readOnly, minDate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const parsedMinDate = minDate ? (minDate instanceof Date ? minDate : parseDDMMYYYYToDate(minDate)) : null;
  if (parsedMinDate) {
    parsedMinDate.setHours(0, 0, 0, 0);
  }

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen]);
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const parsed = parseDDMMYYYYToDate(value);
      if (parsed && !isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    const today = new Date();
    const initMinDate = minDate ? (minDate instanceof Date ? minDate : parseDDMMYYYYToDate(minDate)) : null;
    if (initMinDate) {
      initMinDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      if (today < initMinDate) {
        return initMinDate;
      }
    }
    return new Date();
  });

  useEffect(() => {
    if (value) {
      const parsed = parseDDMMYYYYToDate(value);
      if (parsed && !isNaN(parsed.getTime())) {
        setViewDate(parsed);
      }
    }
  }, [value]);

  const handleDayClick = (day) => {
    const d = String(day.getDate()).padStart(2, '0');
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const y = day.getFullYear();
    onChange(`${d}/${m}/${y}`);
    setIsOpen(false);
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const days = [];
  for (let i = startDay - 1; i >= 0; i--) {
    days.push(new Date(year, month - 1, prevMonthDays - i));
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i));
  }

  const handleInputChange = (e) => {
    let val = e.target.value;
    
    // Clean to only digits and slashes
    val = val.replace(/[^0-9/]/g, '');
    
    const prevVal = value || '';
    const cleanDigits = val.replace(/\D/g, '');
    
    // Auto-format pasted block of digits
    if (cleanDigits.length === 8 && !val.includes('/')) {
      val = `${cleanDigits.substring(0, 2)}/${cleanDigits.substring(2, 4)}/${cleanDigits.substring(4, 8)}`;
    } else if (cleanDigits.length === 6 && !val.includes('/')) {
      val = `${cleanDigits.substring(0, 2)}/${cleanDigits.substring(2, 4)}/${cleanDigits.substring(4, 6)}`;
    } else if (val.length > prevVal.length) {
      // Auto-append slash during typing
      if (val.length === 2 && !val.includes('/')) {
        val = val + '/';
      } else if (val.length === 5 && val.split('/').length - 1 === 1) {
        val = val + '/';
      }
    }
    
    onChange(val);
  };
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const isPrevMonthDisabled = () => {
    if (!parsedMinDate) return false;
    return (
      viewDate.getFullYear() < parsedMinDate.getFullYear() ||
      (viewDate.getFullYear() === parsedMinDate.getFullYear() && viewDate.getMonth() <= parsedMinDate.getMonth())
    );
  };

  return (
    <div ref={containerRef} className={`relative w-full ${containerClassName}`}>
      <input 
        id={id}
        type="text" 
        placeholder={placeholder}
        maxLength={10}
        readOnly={readOnly}
        onChange={handleInputChange}
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        disabled={disabled}
        onKeyDown={(e) => {
          if (readOnly) {
            if (e.key !== 'Tab' && e.key !== 'Escape' && e.key !== 'Enter') {
              e.preventDefault();
            }
            return;
          }
          if (e.key !== 'Tab' && e.key !== 'Escape' && e.key !== 'Enter' && e.key !== 'Backspace' && e.key !== 'Delete' && !e.key.startsWith('Arrow')) {
            if (!/[0-9/]/.test(e.key) && e.key.length === 1) {
              e.preventDefault();
            }
          }
        }}
        className={`w-full outline-none placeholder-slate-350 text-slate-700 cursor-pointer ${inputClassName}`}
        value={value}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        className={`absolute text-slate-450 hover:text-[#0066cc] cursor-pointer flex items-center justify-center z-10 ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''} ${buttonClassName}`}
      >
        <Calendar size={12} />
      </button>

      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[95]" onClick={() => setIsOpen(false)} />
          <div 
            style={{
              position: 'absolute',
              top: `${coords.top + 4}px`,
              left: `${coords.left}px`,
            }}
            className="bg-white border border-slate-200 shadow-xl rounded-[6px] p-[10px] z-[100] w-[210px] text-slate-800 font-sans select-none"
          >
            <div className="flex justify-between items-center mb-[8px]">
              <button 
                type="button" 
                onClick={prevMonth} 
                disabled={isPrevMonthDisabled() || disabled} 
                className={`p-[2px] rounded text-slate-550 ${
                  isPrevMonthDisabled() 
                    ? 'opacity-30 cursor-not-allowed pointer-events-none' 
                    : 'hover:bg-slate-100 cursor-pointer'
                }`}
              >
                <ChevronLeft size={12} />
              </button>
              <span className="font-bold text-[10px] text-slate-700">
                {monthNames[month]} {year}
              </span>
              <button type="button" onClick={nextMonth} className="p-[2px] hover:bg-slate-100 rounded text-slate-555 cursor-pointer">
                <ChevronRight size={12} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-[2px] mb-[4px] text-center font-bold text-[8px] text-slate-400 uppercase">
              <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
            </div>

            <div className="grid grid-cols-7 gap-[2px] text-center text-[9px]">
              {days.map((day, idx) => {
                const isCurrentMonth = day.getMonth() === month;
                const isSelected = value && parseDDMMYYYYToDate(value)?.toDateString() === day.toDateString();
                
                const dayCopy = new Date(day);
                dayCopy.setHours(0, 0, 0, 0);
                const isDisabled = parsedMinDate && dayCopy < parsedMinDate;

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isDisabled || disabled}
                    onClick={() => handleDayClick(day)}
                    className={`py-[3px] rounded transition-all ${
                      isDisabled 
                        ? "text-slate-200 cursor-not-allowed pointer-events-none" 
                        : isSelected 
                        ? "bg-[#0066cc] text-white font-bold" 
                        : isCurrentMonth
                        ? "text-slate-700 hover:bg-slate-100 font-medium cursor-pointer"
                        : "text-slate-300 hover:bg-slate-50 cursor-pointer"
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
