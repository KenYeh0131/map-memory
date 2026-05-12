# Map Memory 資料結構

更新日期：2026-05-13

## PlaceStatus

```ts
export type PlaceStatus =
  | "wantToGo"
  | "wantToReturn"
  | "memory";
```

狀態說明：

```ts
wantToGo      // 想去：尚未去過
wantToReturn  // 還想去：去過，仍推薦或想再去
memory        // 回憶中：去過，但不推薦或不想再去
```

---

## PlaceItem

```ts
export type PlaceItem = {
  id: string;
  name: string;
  status: PlaceStatus;
  address: string;
  rating: number;
  photos: string[];
  coverPhotoIndex?: number;
  tags: string[];
  navigationTarget: string;
  notes: string;
  lat?: number;
  lng?: number;

  bestTiming?: BestTiming;

  visits: VisitItem[];
  visitCount: number;
  firstVisitedAt?: string;
  lastVisitedAt?: string;

  createdAt: string;
  updatedAt: string;
};
```

---

## VisitItem

```ts
export type VisitItem = {
  id: string;
  visitDate: string;
  note: string;
  photos: string[];
  rating: number;
  createdAt: string;
  updatedAt?: string;
};
```

---

## BestTiming

用來記錄某地點適合拜訪的時間或季節。

```ts
export type BestTiming = {
  enabled: boolean;
  months?: number[];
  startDate?: string;
  endDate?: string;
  note?: string;
};
```

規則：

- 若目前時間符合設定時間，地標需有明顯提示
- 若目前時間不符合設定時間，點開卡片需顯示「未達建議時間」
- 後續可依月份、季節、日期區間擴充

---

## Firebase 結構

目前資料結構：

```txt
groups
  └─ {groupId}
      ├─ info
      │   └─ meta
      ├─ places
      │   └─ {placeId}
      └─ joinRequests
          └─ {deviceId}
```

---

## groups/{groupId}/info/meta

```ts
type GroupMeta = {
  name: string;
  inviteCode: string;
  ownerDeviceId: string;
  createdAt: string;
};
```

---

## groups/{groupId}/places/{placeId}

儲存 PlaceItem。

重要欄位：

```ts
visits: VisitItem[];
visitCount: number;
firstVisitedAt?: string;
lastVisitedAt?: string;
```

### visitCount 計算

```ts
visitCount = visits.length;
```

### firstVisitedAt 計算

```ts
firstVisitedAt = visits 中最早的 visitDate;
```

### lastVisitedAt 計算

```ts
lastVisitedAt = visits 中最新的 visitDate;
```

若 visits 為空：

```ts
firstVisitedAt = deleteField();
lastVisitedAt = deleteField();
visitCount = 0;
```

---

## Storage 路徑

### 地點照片

```txt
places/{fileName}.webp
```

目前限制：

- 每個地點最多 1 張
- 上傳前壓縮
- WebP
- 長邊最大 1600px
- 品質 0.75

### 回憶照片

```txt
visits/{fileName}
```

目前規則：

- 每筆回憶最多 10 張
- 後續建議同樣導入壓縮
- 建議轉成 WebP
- 建議長邊最大 1600px
- 品質 0.7～0.8

---

## 前端狀態注意事項

### 避免 React Minified error #185

不要在 useEffect 裡反覆 setState。

錯誤風險：

```ts
useEffect(() => {
  setState(newObject);
}, [newObject]);
```

建議：

- filteredPlaces 用 useMemo
- sortedVisits 用 useMemo
- handlers 用 useCallback
- detailPlace 用 detailPlaceId + useMemo 從 places 找最新資料
- 不要同步 props 到 state，除非非常必要

---

## 回憶編輯資料流

### 新增回憶

```ts
nextVisits = [newVisit, ...currentVisits];
updateDoc(placeRef, buildVisitSummaryUpdate(nextVisits));
```

若地點原本是 wantToGo：

```ts
status = "wantToReturn";
```

### 編輯回憶

```ts
nextVisits = currentVisits.map((visit) =>
  visit.id === editingVisitId
    ? updatedVisit
    : visit
);
updateDoc(placeRef, buildVisitSummaryUpdate(nextVisits));
```

### 刪除回憶

```ts
nextVisits = currentVisits.filter((visit) => visit.id !== visitId);
updateDoc(placeRef, buildVisitSummaryUpdate(nextVisits));
```
