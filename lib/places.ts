export type PlaceStatus = "wantToGo" | "visited";

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
  createdAt: string;
  updatedAt: string;
};

export const STATUS_LABELS: Record<PlaceStatus, string> = {
  wantToGo: "想一起去",
  visited: "我們完成了",
};

export const STATUS_OPTIONS = [
  { value: "wantToGo", label: STATUS_LABELS.wantToGo },
  { value: "visited", label: STATUS_LABELS.visited },
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
    createdAt: now,
    updatedAt: now,
  },
];
