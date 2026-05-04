export type PlaceStatus = "wantToGo" | "visited";

export type PlaceItem = {
  id: string;
  name: string;
  status: PlaceStatus;
  address: string;
  rating: number;
  tags: string[];
  navigationTarget: string;
  notes: string;
  markerX: number;
  markerY: number;
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
    tags: ["海景", "散步"],
    navigationTarget: "淡水漁人碼頭",
    notes: "傍晚去看夕陽，拍照應該很棒。",
    markerX: 18,
    markerY: 28,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p-2",
    name: "象山步道",
    status: "visited",
    address: "台北市信義區信義路五段150巷",
    rating: 5,
    tags: ["夜景", "健行"],
    navigationTarget: "象山步道登山口",
    notes: "晚餐後去剛好，山頂風景真的值得。",
    markerX: 71,
    markerY: 36,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p-3",
    name: "九份老街",
    status: "wantToGo",
    address: "新北市瑞芳區基山街",
    rating: 4,
    tags: ["老街", "美食"],
    navigationTarget: "九份老街",
    notes: "想吃芋圓，順便看山城夜景。",
    markerX: 84,
    markerY: 20,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p-4",
    name: "台中審計新村",
    status: "wantToGo",
    address: "台中市西區民生路368巷",
    rating: 3,
    tags: ["文創", "市集"],
    navigationTarget: "審計新村",
    notes: "假日可能人多，先安排早一點。",
    markerX: 40,
    markerY: 55,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p-5",
    name: "台南神農街",
    status: "visited",
    address: "台南市中西區神農街",
    rating: 5,
    tags: ["老屋", "散步"],
    navigationTarget: "神農街",
    notes: "晚上燈光很有氣氛，想再訪。",
    markerX: 25,
    markerY: 78,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p-6",
    name: "高雄駁二藝術特區",
    status: "visited",
    address: "高雄市鹽埕區大勇路1號",
    rating: 4,
    tags: ["藝術", "港景"],
    navigationTarget: "駁二藝術特區",
    notes: "白天拍照超好看，附近也很多展。",
    markerX: 38,
    markerY: 88,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p-7",
    name: "花蓮七星潭",
    status: "wantToGo",
    address: "花蓮縣新城鄉七星街",
    rating: 5,
    tags: ["海邊", "放空"],
    navigationTarget: "七星潭風景區",
    notes: "想帶野餐墊去坐一下午。",
    markerX: 91,
    markerY: 61,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p-8",
    name: "宜蘭梅花湖",
    status: "wantToGo",
    address: "宜蘭縣冬山鄉大埤二路75號",
    rating: 3,
    tags: ["湖景", "單車"],
    navigationTarget: "梅花湖風景區",
    notes: "可以租腳踏車繞湖。",
    markerX: 79,
    markerY: 40,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p-9",
    name: "阿里山森林遊樂區",
    status: "visited",
    address: "嘉義縣阿里山鄉59號",
    rating: 5,
    tags: ["山景", "日出"],
    navigationTarget: "阿里山森林遊樂區",
    notes: "日出行程很早，但很值得。",
    markerX: 32,
    markerY: 68,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p-10",
    name: "墾丁南灣",
    status: "wantToGo",
    address: "屏東縣恆春鎮南灣路",
    rating: 4,
    tags: ["海灘", "夏天"],
    navigationTarget: "南灣遊憩區",
    notes: "想排兩天一夜。",
    markerX: 53,
    markerY: 95,
    createdAt: now,
    updatedAt: now,
  },
];
