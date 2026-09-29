export type Layer = 'ground' | 'object';

export interface CatalogItem {
  id: string;
  label: string;
  icon: string;
  category: CategoryId;
  layer: Layer;
  /** searchable keywords, so ผู้ใช้พิมพ์ไทยหรืออังกฤษก็เจอ */
  tags: string[];
  floors?: number;
}

export type CategoryId = 'ground' | 'building' | 'nature' | 'prop';

export const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'ground', label: 'พื้นที่', icon: '🟩' },
  { id: 'building', label: 'อาคาร', icon: '🏠' },
  { id: 'nature', label: 'ธรรมชาติ', icon: '🌳' },
  { id: 'prop', label: 'ของตกแต่ง', icon: '🚗' },
];

const item = (
  id: string,
  label: string,
  icon: string,
  category: CategoryId,
  layer: Layer,
  tags: string[],
  floors?: number,
): CatalogItem => ({ id, label, icon, category, layer, tags, floors });

export const CATALOG: CatalogItem[] = [
  // พื้นที่
  item('grass', 'สนามหญ้า', '🌱', 'ground', 'ground', ['grass', 'หญ้า', 'สนาม']),
  item('road', 'ถนน', '🛣️', 'ground', 'ground', ['road', 'ถนน', 'ทาง']),
  item('path', 'ทางเดิน', '🚶', 'ground', 'ground', ['path', 'ทางเดิน', 'ฟุตบาท']),
  item('plaza', 'ลานกว้าง', '⬜', 'ground', 'ground', ['plaza', 'ลาน', 'จตุรัส']),
  item('water', 'น้ำ', '💧', 'ground', 'ground', ['water', 'น้ำ', 'ทะเล', 'สระ']),
  item('sand', 'หาดทราย', '🏖️', 'ground', 'ground', ['sand', 'ทราย', 'หาด']),

  // อาคาร
  item('house', 'บ้าน', '🏠', 'building', 'object', ['house', 'บ้าน'], 1),
  item('house2', 'บ้านสองชั้น', '🏡', 'building', 'object', ['house', 'บ้าน', 'สองชั้น'], 2),
  item('tower', 'คอนโด', '🏢', 'building', 'object', ['tower', 'คอนโด', 'ตึก', 'อพาร์ทเมนท์'], 8),
  item('shop', 'ร้านค้า', '🏪', 'building', 'object', ['shop', 'ร้าน', 'ค้า', 'มินิมาร์ท'], 1),
  item('cafe', 'คาเฟ่', '☕', 'building', 'object', ['cafe', 'คาเฟ่', 'กาแฟ', 'ร้าน'], 1),
  item('school', 'โรงเรียน', '🏫', 'building', 'object', ['school', 'โรงเรียน', 'เรียน'], 3),
  item('hospital', 'โรงพยาบาล', '🏥', 'building', 'object', ['hospital', 'โรงพยาบาล', 'หมอ'], 4),
  item('factory', 'โรงงาน', '🏭', 'building', 'object', ['factory', 'โรงงาน'], 2),

  // ธรรมชาติ
  item('tree', 'ต้นไม้', '🌳', 'nature', 'object', ['tree', 'ต้นไม้', 'ไม้']),
  item('pine', 'ต้นสน', '🌲', 'nature', 'object', ['pine', 'สน', 'ต้นไม้']),
  item('bush', 'พุ่มไม้', '🌿', 'nature', 'object', ['bush', 'พุ่ม', 'ไม้']),
  item('flower', 'แปลงดอกไม้', '🌸', 'nature', 'object', ['flower', 'ดอกไม้', 'สวน']),
  item('rock', 'ก้อนหิน', '🪨', 'nature', 'object', ['rock', 'หิน']),

  // ของตกแต่ง
  item('car', 'รถยนต์', '🚗', 'prop', 'object', ['car', 'รถ', 'รถยนต์']),
  item('bus', 'รถบัส', '🚌', 'prop', 'object', ['bus', 'รถบัส', 'รถเมล์']),
  item('lamp', 'เสาไฟ', '💡', 'prop', 'object', ['lamp', 'ไฟ', 'เสา']),
  item('bench', 'ม้านั่ง', '🪑', 'prop', 'object', ['bench', 'ม้านั่ง', 'เก้าอี้']),
  item('fountain', 'น้ำพุ', '⛲', 'prop', 'object', ['fountain', 'น้ำพุ']),
  item('sign', 'ป้าย', '🪧', 'prop', 'object', ['sign', 'ป้าย']),
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
