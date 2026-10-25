'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

const MAX_SHOWN = 200; // แสดงในรายการได้สูงสุดเท่านี้ — ที่เหลือให้พิมพ์กรองเพิ่ม

// ตัดช่องว่าง + ตัวพิมพ์เล็ก ให้ค้น "ขมิ้น ชัน" เจอ "ขมิ้นชัน"
const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, '');

/**
 * dropdown ที่พิมพ์เพื่อกรองรายการได้ — ใช้แทน <select> ที่มีตัวเลือกเยอะ
 * ส่งค่าในฟอร์มผ่าน hidden input ชื่อ name (ฟอร์ม GET เดิมทำงานเหมือนเดิม)
 * options = [{ value, label }] หรือ ['ข้อความ'] · allLabel = ตัวเลือกค่าว่าง (ไม่ใส่ = ไม่มีให้เลือก)
 * ใช้ได้ทั้งแบบควบคุมเอง (value + onChange) และแบบ defaultValue
 */
export default function ComboBox({
  name,
  options,
  value: controlled,
  defaultValue = '',
  onChange,
  allLabel,
  placeholder,
  required = false,
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
}) {
  const id = useId();
  const items = useMemo(
    () => options.map((o) => (typeof o === 'object' ? { value: String(o.value), label: o.label } : { value: o, label: o })),
    [options]
  );
  const [own, setOwn] = useState(String(defaultValue ?? ''));
  const value = controlled !== undefined ? String(controlled ?? '') : own;
  const selected = items.find((o) => o.value === value);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(selected?.label ?? '');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // ค่าเปลี่ยนจากข้างนอก (เช่น เลือกจังหวัดใหม่ → ล้างอำเภอ) → อัปเดตข้อความที่แสดง
  useEffect(() => {
    if (!open) setText(selected?.label ?? '');
  }, [selected, open]);

  // ช่องที่ต้องเลือก: พิมพ์ค้างไว้แต่ยังไม่ได้เลือกจากรายการ = ยังไม่ผ่าน
  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !value ? 'กรุณาเลือกจากรายการ' : '');
  }, [required, value]);

  const query = open && text !== (selected?.label ?? '') ? norm(text) : '';
  const matches = useMemo(() => (query ? items.filter((o) => norm(o.label).includes(query)) : items), [items, query]);
  const shown = matches.slice(0, MAX_SHOWN);
  // แถวในรายการ: ค่าว่าง (ถ้ามี) + ตัวเลือกที่ตรงคำค้น
  const rows = allLabel !== undefined && !query ? [{ value: '', label: allLabel, all: true }, ...shown] : shown;

  const choose = (v) => {
    if (controlled === undefined) setOwn(v);
    onChange?.(v);
    setText(items.find((o) => o.value === v)?.label ?? '');
    setOpen(false);
  };

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setActive(Math.max(rows.findIndex((r) => r.value === value), 0));
  };

  // ออกจากช่อง: ลบข้อความหมด = ล้างค่า (ถ้าไม่บังคับ) ไม่งั้นกลับไปแสดงค่าที่เลือกไว้
  const onBlur = () => {
    setOpen(false);
    if (!text.trim() && value && !required) choose('');
    else setText(selected?.label ?? '');
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      const n = rows.length;
      if (n) setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault(); // Enter ตอนรายการเปิด = เลือก ไม่ส่งฟอร์ม
      if (rows[active]) choose(rows[active].value);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      setText(selected?.label ?? '');
    }
  };

  // เลื่อนรายการให้เห็นแถวที่เลือกอยู่
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  return (
    <div className={`relative min-w-0 ${className}`}>
      <input type="hidden" name={name} value={value} />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        value={text}
        placeholder={placeholder ?? allLabel}
        required={required}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={(e) => {
          e.target.select();
          openList();
        }}
        onClick={() => !open && openList()}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="input min-w-0 pr-10 disabled:bg-gray-100"
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">▼</span>
      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
          {rows.map((r, i) => (
            <li
              key={r.all ? '__all' : r.value}
              role="option"
              aria-selected={r.value === value}
              // mousedown ก่อน blur — ไม่งั้นรายการปิดก่อนคลิกติด
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r.value);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-2 ${i === active ? 'bg-emerald-50 text-emerald-800' : 'text-gray-700'} ${
                r.value === value ? 'font-semibold' : ''
              } ${r.all ? 'text-gray-500' : ''}`}
            >
              {r.label}
            </li>
          ))}
          {!rows.length && <li className="px-4 py-2 text-gray-400">ไม่พบ “{text}”</li>}
          {matches.length > MAX_SHOWN && (
            <li className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
              แสดง {MAX_SHOWN.toLocaleString('th-TH')} จาก {matches.length.toLocaleString('th-TH')} รายการ — พิมพ์เพื่อกรองเพิ่ม
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
