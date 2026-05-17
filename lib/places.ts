export type PlaceStatus = "wantToGo" | "wantToReturn" | "memory";

export type VisitItem = {
  id: string;
  visitDate: string;
  note: string;
  photos: string[];
  rating?: number;
  companions?: string[];
  createdAt: string;
  updatedAt?: string;
};

export type BestTimingKind = "months" | "dateRange";

export type BestTimingItem = {
  id: string;
  kind: BestTimingKind;
  title: string;
  note?: string;
  months?: number[];
  startDate?: string;
  endDate?: string;
};

export type BestTiming = {
  months?: number[];
  timeRanges?: {
    start: string;
    end: string;
  }[];
};

export type PlaceItem = {
  id: string;
  name: string;
  status: PlaceStatus;
  address: string;
  rating: number;
  photos: string[];
  coverPhotoIndex?: number;
  completedDate?: string;
  tags: string[];
  navigationTarget: string;
  notes: string;
  lat?: number;
  lng?: number;
  visits: VisitItem[];
  visitCount: number;
  firstVisitedAt?: string;
  lastVisitedAt?: string;

  /**
   * 舊版單一適合期間欄位。
   * 保留是為了相容舊資料，後續主要使用 bestTimings。
   */
  bestTiming?: BestTiming;

  /**
   * 新版多筆適合期間提醒。
   * 可同時設定多個月份提醒或日期區間提醒。
   */
  bestTimings?: BestTimingItem[];

  createdAt: string;
  updatedAt: string;
};

export const STATUS_LABELS: Record<PlaceStatus, string> = {
  wantToGo: "想去",
  wantToReturn: "還想去",
  memory: "打卡完成",
};

export const STATUS_OPTIONS = [
  { value: "wantToGo", label: STATUS_LABELS.wantToGo },
  { value: "wantToReturn", label: STATUS_LABELS.wantToReturn },
  { value: "memory", label: STATUS_LABELS.memory },
] as const;

export const RATING_OPTIONS = [0, 1, 2, 3, 4, 5] as const;

const now = new Date().toISOString();

export const defaultPlacesSeed: PlaceItem[] = [
  {
    id: "p-1",
    name: "淡水漁人碼頭",
    status: "wantToGo",
    address: "新北市淡水區觀海路",
    rating: 4,
    photos: [],
    tags: ["海景", "散步"],
    navigationTarget: "淡水漁人碼頭",
    notes: "傍晚去看夕陽，拍照應該很棒。",
    lat: 25.1826,
    lng: 121.4104,
    visits: [],
    visitCount: 0,
    bestTimings: [],
    createdAt: now,
    updatedAt: now,
  },
];