# 回憶地圖 0.2.0 改版

狀態：本機完成；尚未提交、部署，正式 Firebase 規則及手機實機尚待驗證。

## 功能

- 地圖點選地點時收起搜尋；展開搜尋時關閉地點卡片。
- 地圖、清單共用 PlaceCard，外層留白統一為 12 px，按鈕不斷行。
- 時間軸提供「立即出發」和「新增回憶」，使用既有地點；舊回憶不變。
- 切換頁面保留篩選與捲動位置；重新載入保留目前頁籤及篩選。
- 地圖、清單支援「現在適合去」，無適合期間的地點不會入選。
- Google Maps / Places 語言設定為 zh-TW、地區 TW；地址選擇不自動填入導航目標，舊有純句點目標顯示空白。
- 回憶日期改採本機日期，修正台灣凌晨被 UTC 日期阻擋的問題。
- 新舊身分可用 10 分鐘有效、一次性的移轉碼合併。透過別名保留原群主／作者 ID；不搬移、不改寫舊回憶。
- 合併保留雙方全部群組，暱稱採用新裝置；雙方繼續可用。暫不做失機復原。
- ExcelJS 動態載入，固定 xlsx 範本，匯入目前群組，不含照片。包含月份及日期區間。
- 同檔同名稱＋同地址視為錯誤；不檢查群組既有地點重複。任一錯誤整批不寫入。
- 無座標時使用 Google Geocoder 查詢，模糊或查不到時失敗，請使用者補座標。
- 每批最多 400 筆、檔案最多 5 MB，單一 Firestore batch 原子寫入，不分批寫入。
- /api/version 禁止快取；開啟、回前景、恢復連線及每分鐘檢查版本。使用者確認後才重新載入。
- 新增／編輯表單與 Excel／身分合併未完成時暫停更新。

## 新增資料集合

- identities/{deviceId}: deviceIds（可操作的身分別名）、groupIds、nickname、updatedAt。
- identityTransfers/{code}: 來源 deviceId、groupIds、nickname、expiresAt、used。

部署前須確認現行 Firestore 規則允許這兩個集合的必要讀寫，以及 transaction / batch 的權限。
沿用既有裝置 ID 身分模型，非帳號驗證系統；家庭使用移轉碼請僅交給自己的裝置。

## 部署

優先沿用既有 Vercel 專案與固定網址，維持原 origin 的 localStorage。
不要使用每次變動的部署預覽網址取代固定網址，否則瀏覽器本機身分不共用。
Vercel 自動提供 VERCEL_GIT_COMMIT_SHA 作為 build ID；本機使用 0.2.0-local。
保留既有 NEXT_PUBLIC_FIREBASE_*、NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 環境變數。
先前版本尚無更新檢查：第一次升級仍須手動重新載入原頁面，毋須移除主畫面圖示。

## 驗證

- npm test：12 項規則測試（含身分 transaction 的讀寫順序與別名保留）。
- npm run lint：歷史一次性 patch 腳本與 scripts 排除，應用程式無 error；既存 img 等 warning 保留。
- npm run build：編譯、TypeScript、靜態頁面及動態版本 API。
- 未使用正式資料做寫入測試，未驗證 Google API／Firebase 雲端規則或兩手機實機操作。

手機驗收：320/375/430 px 卡片、搜尋互斥、時間軸導航／新增、凌晨日期、移轉兩台權限、Excel 一錯全拒、更新中不遺失輸入、切換瀏覽位置。

身分對照使用 `groups/map-memory-identity-profiles/info/{deviceId}`，移轉碼使用 `groups/map-memory-identity-transfers/info/{code}`，沿用現有 info 路徑規則，不建立父群組文件。原群主與作者 ID 保留，由對照陣列承接操作資格。
