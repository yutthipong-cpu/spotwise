export type Layer = 'ground' | 'object' | 'building';

export interface CatalogItem {
  id: string;
  label: string;
  icon: string;
  category: CategoryId;
  layer: Layer;
  /** searchable keywords, so ผู้ใช้พิมพ์ไทยหรืออังกฤษก็เจอ */
  tags: string[];
  /** buildings only — ชั้นเริ่มต้นเมื่อวางใหม่ */
  floors?: number;
}

export type CategoryId = 'ground' | 'building' | 'nature' | 'prop';

export const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'ground', label: 'พื้นที่', icon: '🟩' },
  { id: 'building', label: 'อาคาร', icon: '🏫' },
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
  floors?: number,
): CatalogItem => ({ id, label, icon, category, layer, tags, floors });

export const CATALOG: CatalogItem[] = [
  // พื้นที่
  item('grass', 'สนามหญ้า', '🌱', 'ground', 'ground', ['grass', 'หญ้า', 'สนาม']),
  item('concrete', 'ลานคอนกรีต', '⬜', 'ground', 'ground', ['concrete', 'ลาน', 'ปูน', 'พื้น']),
  item('road', 'ถนน', '🛣️', 'ground', 'ground', ['road', 'ถนน', 'ทาง']),
  item('path', 'ทางเดิน', '🚶', 'ground', 'ground', ['path', 'ทางเดิน', 'ฟุตบาท']),
  item('parking', 'ที่จอดรถ', '🅿️', 'ground', 'ground', ['parking', 'จอดรถ', 'ลานจอด']),
  item('field', 'สนามหญ้ากีฬา', '⚽', 'ground', 'ground', ['field', 'สนาม', 'ฟุตบอล', 'บอล']),
  item('court', 'สนามบาส', '🏀', 'ground', 'ground', ['court', 'สนาม', 'บาส', 'กีฬา']),
  item('water', 'สระน้ำ', '💧', 'ground', 'ground', ['water', 'น้ำ', 'สระ', 'บ่อ']),

  // อาคาร — ลากคลุมพื้นที่เพื่อกำหนดขนาด
  item('classroom', 'อาคารเรียน', '🏫', 'building', 'building', ['classroom', 'อาคารเรียน', 'ตึกเรียน', 'ห้องเรียน'], 4),
  item('auditorium', 'หอประชุม', '🎪', 'building', 'building', ['auditorium', 'หอประชุม', 'ประชุม'], 1),
  item('dome', 'โดม', '⛺', 'building', 'building', ['dome', 'โดม', 'ลานโดม'], 1),
  item('canteen', 'โรงอาหาร', '🍽️', 'building', 'building', ['canteen', 'โรงอาหาร', 'อาหาร'], 1),
  item('library', 'ห้องสมุด', '📚', 'building', 'building', ['library', 'ห้องสมุด', 'หนังสือ'], 1),
  item('service', 'อาคารบริการ', '🏢', 'building', 'building', ['service', 'อาคาร', 'ห้อง', 'สำนักงาน'], 1),
  item('toilet', 'ห้องน้ำ', '🚻', 'building', 'building', ['toilet', 'ห้องน้ำ', 'สุขา'], 1),
  item('carport', 'โรงรถ', '🚗', 'building', 'building', ['carport', 'โรงรถ', 'จอดรถ'], 1),
  item('guard', 'ป้อมยาม', '🛡️', 'building', 'building', ['guard', 'ป้อมยาม', 'ยาม', 'รปภ'], 1),

  // ธรรมชาติ
  item('tree', 'ต้นไม้', '🌳', 'nature', 'object', ['tree', 'ต้นไม้', 'ไม้']),
  item('palm', 'ต้นปาล์ม', '🌴', 'nature', 'object', ['palm', 'ปาล์ม', 'ต้นไม้']),
  item('bush', 'พุ่มไม้', '🌿', 'nature', 'object', ['bush', 'พุ่ม', 'ไม้']),
  item('flower', 'แปลงดอกไม้', '🌸', 'nature', 'object', ['flower', 'ดอกไม้', 'สวน']),
  item('rock', 'สวนหิน', '🪨', 'nature', 'object', ['rock', 'หิน', 'สวนหิน']),

  // ของตกแต่ง
  item('flagpole', 'เสาธง', '🚩', 'prop', 'object', ['flag', 'เสาธง', 'ธง']),
  item('statue', 'พระพุทธรูป', '🙏', 'prop', 'object', ['statue', 'พระ', 'พระพุทธรูป', 'ศาล']),
  item('sala', 'ศาลา', '⛩️', 'prop', 'object', ['sala', 'ศาลา', 'ที่นั่ง', 'พักผ่อน']),
  item('gate', 'ประตูโรงเรียน', '🚪', 'prop', 'object', ['gate', 'ประตู', 'ทางเข้า']),
  item('fence', 'รั้ว', '🧱', 'prop', 'object', ['fence', 'รั้ว', 'กำแพง']),
  item('sign', 'ป้ายชื่อ', '🪧', 'prop', 'object', ['sign', 'ป้าย', 'ชื่อ']),
  item('bench', 'ม้านั่ง', '🪑', 'prop', 'object', ['bench', 'ม้านั่ง', 'เก้าอี้']),
  item('lamp', 'เสาไฟ', '💡', 'prop', 'object', ['lamp', 'ไฟ', 'เสา']),
  item('bin', 'ถังขยะ', '🗑️', 'prop', 'object', ['bin', 'ถังขยะ', 'ขยะ']),
  item('schoolbus', 'รถรับส่ง', '🚌', 'prop', 'object', ['bus', 'รถ', 'รับส่ง', 'รถบัส']),
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
