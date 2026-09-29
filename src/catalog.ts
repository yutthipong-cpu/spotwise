import type { BuildingKind } from './city';
import { SITE_BUILDINGS } from './site-roiet';

export type Layer = 'ground' | 'object' | 'building';

export const KIND_ICON: Record<BuildingKind, string> = {
  classroom: '🏫',
  auditorium: '🎪',
  dome: '⛺',
  canteen: '🍽️',
  library: '📚',
  service: '🏢',
  toilet: '🚻',
  carport: '🚙',
  guard: '🛡️',
};

export interface BuildingSpec {
  no: number;
  name: string;
  kind: BuildingKind;
  w: number;
  h: number;
  floors: number;
}

export interface CatalogItem {
  id: string;
  label: string;
  icon: string;
  category: CategoryId;
  layer: Layer;
  /** searchable keywords, so ผู้ใช้พิมพ์ไทยหรืออังกฤษก็เจอ */
  tags: string[];
  /** buildings only — ข้อมูลตั้งต้นเมื่อวางอาคารนี้ลงผัง */
  building?: BuildingSpec;
}

export type CategoryId = 'ground' | 'school' | 'nature' | 'prop';

export const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'school', label: 'โรงเรียน', icon: '🏫' },
  { id: 'ground', label: 'พื้นที่', icon: '🟩' },
  { id: 'nature', label: 'ธรรมชาติ', icon: '🌳' },
  { id: 'prop', label: 'ของตกแต่ง', icon: '🚩' },
];

const item = (
  id: string,
  label: string,
  icon: string,
  category: CategoryId,
  layer: Layer,
  tags: string[],
): CatalogItem => ({ id, label, icon, category, layer, tags });

/** ทุกอาคารในผังวิทยาลัยกลายเป็นไอเท็มที่หยิบมาวางซ้ำได้ */
const SCHOOL_ITEMS: CatalogItem[] = SITE_BUILDINGS.map((b) => ({
  id: `b${b.no}`,
  label: `${b.no}. ${b.short}`,
  icon: KIND_ICON[b.kind],
  category: 'school',
  layer: 'building',
  tags: [b.name, b.short, String(b.no), b.kind],
  building: { no: b.no, name: b.name, kind: b.kind, w: b.w, h: b.h, floors: b.floors },
}));

export const CATALOG: CatalogItem[] = [
  ...SCHOOL_ITEMS,

  // พื้นที่
  item('grass', 'สนามหญ้า', '🌱', 'ground', 'ground', ['grass', 'หญ้า', 'สนาม']),
  item('concrete', 'ลานคอนกรีต', '⬜', 'ground', 'ground', ['concrete', 'ลาน', 'ปูน', 'พื้น']),
  item('road', 'ถนน', '🛣️', 'ground', 'ground', ['road', 'ถนน', 'ทาง']),
  item('path', 'ทางเดิน', '🚶', 'ground', 'ground', ['path', 'ทางเดิน', 'ฟุตบาท']),
  item('parking', 'ที่จอดรถ', '🅿️', 'ground', 'ground', ['parking', 'จอดรถ', 'ลานจอด']),
  item('field', 'สนามหญ้ากีฬา', '⚽', 'ground', 'ground', ['field', 'สนาม', 'ฟุตบอล', 'บอล']),
  item('court', 'สนามบาส', '🏀', 'ground', 'ground', ['court', 'สนาม', 'บาส', 'กีฬา']),
  item('water', 'สระน้ำ', '💧', 'ground', 'ground', ['water', 'น้ำ', 'สระ', 'บ่อ']),

  // ธรรมชาติ
  item('tree', 'ต้นไม้', '🌳', 'nature', 'object', ['tree', 'ต้นไม้', 'ไม้']),
  item('palm', 'ต้นปาล์ม', '🌴', 'nature', 'object', ['palm', 'ปาล์ม', 'ต้นไม้']),
  item('bush', 'พุ่มไม้', '🌿', 'nature', 'object', ['bush', 'พุ่ม', 'ไม้']),
  item('flower', 'แปลงดอกไม้', '🌸', 'nature', 'object', ['flower', 'ดอกไม้', 'สวน']),
  item('rock', 'สวนหิน', '🪨', 'nature', 'object', ['rock', 'หิน', 'สวนหิน']),

  // ของตกแต่ง
  item('flagpole', 'เสาธง', '🚩', 'prop', 'object', ['flag', 'เสาธง', 'ธง']),
  item('statue', 'พระพุทธรูป', '🙏', 'prop', 'object', ['statue', 'พระ', 'พระพุทธรูป']),
  item('sala', 'ศาลา', '⛩️', 'prop', 'object', ['sala', 'ศาลา', 'ที่นั่ง']),
  item('gate', 'ประตูโรงเรียน', '🚪', 'prop', 'object', ['gate', 'ประตู', 'ทางเข้า']),
  item('fence', 'รั้ว', '🧱', 'prop', 'object', ['fence', 'รั้ว', 'กำแพง']),
  item('sign', 'ป้ายชื่อ', '🪧', 'prop', 'object', ['sign', 'ป้าย', 'ชื่อ']),
  item('bench', 'ม้านั่ง', '🪑', 'prop', 'object', ['bench', 'ม้านั่ง', 'เก้าอี้']),
  item('lamp', 'เสาไฟ', '💡', 'prop', 'object', ['lamp', 'ไฟ', 'เสา']),
  item('bin', 'ถังขยะ', '🗑️', 'prop', 'object', ['bin', 'ถังขยะ', 'ขยะ']),
  item('schoolbus', 'รถรับส่ง', '🚌', 'prop', 'object', ['bus', 'รถ', 'รับส่ง']),
  item('car', 'รถยนต์', '🚗', 'prop', 'object', ['car', 'รถ', 'รถยนต์']),
];

export const CATALOG_BY_ID = new Map(CATALOG.map((i) => [i.id, i]));

export function searchCatalog(query: string, category: CategoryId | 'all') {
  const q = query.trim().toLowerCase();
  return CATALOG.filter((i) => {
    if (category !== 'all' && i.category !== category) return false;
    if (!q) return true;
    return i.label.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q));
  });
}
