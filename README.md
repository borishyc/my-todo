# My To-Do PWA

## 檔案清單
- `index.html`：App 主頁
- `styles.css`：介面樣式與手機響應式設計
- `app.js`：日期辨識、右滑完成、完成時間、本機儲存與安裝提示
- `manifest.webmanifest`：PWA 名稱、顏色、啟動方式與圖示
- `service-worker.js`：離線快取
- `icons/icon-192.png`：192 x 192 App 圖示
- `icons/icon-512.png`：512 x 512 App 圖示

## 使用規則
- 輸入 `1029下蓋試模`，App 會辨識成 `10/29｜下蓋試模`。
- 前 4 碼不足、不是數字、日期不存在或沒有事項時會顯示錯誤。
- 若輸入的月日今年已經過去，會自動排到下一年度。
- 事項向右滑後按「完成」，會記錄目前日期與時間並移到已完成區。
- 資料儲存在手機或瀏覽器的 `localStorage`。

## 本機測試
Service Worker 不能直接從 `file://` 啟動。請在此資料夾執行：

```bash
python3 -m http.server 8080
```

再用瀏覽器開啟 `http://localhost:8080`。

## 正式部署
將整個資料夾內容上傳至支援 HTTPS 的靜態網站服務，例如 GitHub Pages、Cloudflare Pages、Netlify 或公司內部 HTTPS Web Server。不可只上傳 `index.html`。

## 安裝到 iPhone
1. 使用 Safari 開啟已部署的 HTTPS 網址。
2. 點「分享」。
3. 選擇「加入主畫面」。
4. 確認名稱後點「加入」。

## 安裝到 Android
1. 使用 Chrome 開啟已部署的 HTTPS 網址。
2. 點右上角選單。
3. 選擇「安裝應用程式」或「新增至主畫面」。
