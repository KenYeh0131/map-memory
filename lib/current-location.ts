export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("此瀏覽器不支援定位，請改用地址搜尋或手動輸入經緯度"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, error => {
      const messages: Record<number, string> = {
        1: "定位權限未開放，請允許此網站使用位置後再試",
        2: "無法取得目前位置，請確認手機定位已開啟後再試",
        3: "定位逾時，請移至訊號較好的位置後再試",
      };
      reject(new Error(messages[error.code] || "定位失敗，請稍後再試"));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });
}

export function coordinateAddress(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error("定位座標無效，請重新取得位置");
  }
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}
