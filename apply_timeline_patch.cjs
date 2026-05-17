const fs = require('fs');
const path = require('path');

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`找不到檔案：${filePath}`);
    process.exit(1);
  }
}

const pagePath = path.join(process.cwd(), 'app', 'page.tsx');
const bottomNavPath = path.join(process.cwd(), 'components', 'BottomNav.tsx');
const timelineSourcePath = path.join(process.cwd(), 'components', 'TimelineView.tsx');

assertFile(pagePath);
assertFile(timelineSourcePath);

let page = fs.readFileSync(pagePath, 'utf8');

if (!page.includes('import { TimelineView } from "@/components/TimelineView";')) {
  page = page.replace(
    'import { SettingsView } from "@/components/SettingsView";\n',
    'import { SettingsView } from "@/components/SettingsView";\nimport { TimelineView } from "@/components/TimelineView";\n'
  );
}

page = page.replace(
  'type TabId = "map" | "list" | "settings";',
  'type TabId = "map" | "list" | "timeline" | "settings";'
);

const timelineBlock = `\n      {!isLoadingPlaces && activeTab === "timeline" && (\n        <TimelineView\n          places={places}\n          availableTags={availableTags}\n          onAddVisit={openVisitModal}\n          onEditVisit={openEditVisitModal}\n          onDeleteVisit={handleDeleteVisit}\n        />\n      )}\n`;

if (!page.includes('activeTab === "timeline"')) {
  const marker = '      {!isLoadingPlaces && activeTab === "settings" && (';
  if (!page.includes(marker)) {
    console.error('找不到 settings 區塊，無法自動插入 TimelineView。');
    process.exit(1);
  }
  page = page.replace(marker, timelineBlock + '\n' + marker);
}

fs.writeFileSync(pagePath, page, 'utf8');

const bottomNav = `"use client";\n\nexport type BottomTabId = "map" | "list" | "timeline" | "settings";\n\ntype BottomNavProps = {\n  activeTab: BottomTabId;\n  onChange: (tab: BottomTabId) => void;\n};\n\nconst tabs: Array<{ id: BottomTabId; label: string; icon: string }> = [\n  { id: "map", label: "地圖", icon: "🗺️" },\n  { id: "list", label: "清單", icon: "📍" },\n  { id: "timeline", label: "時間軸", icon: "🕘" },\n  { id: "settings", label: "我的", icon: "⚙️" },\n];\n\nexport function BottomNav({ activeTab, onChange }: BottomNavProps) {\n  return (\n    <nav className="fixed bottom-0 left-1/2 z-[100] w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md">\n      <div className="grid grid-cols-4 gap-2">\n        {tabs.map((tab) => {\n          const active = activeTab === tab.id;\n\n          return (\n            <button\n              key={tab.id}\n              type="button"\n              onClick={() => onChange(tab.id)}\n              className={\`flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-xs font-bold transition \${\n                active\n                  ? "bg-orange-100 text-orange-600"\n                  : "text-slate-400 hover:bg-slate-100"\n              }\`}\n            >\n              <span className="text-lg leading-none">{tab.icon}</span>\n              <span className="mt-1">{tab.label}</span>\n            </button>\n          );\n        })}\n      </div>\n    </nav>\n  );\n}\n`;

fs.writeFileSync(bottomNavPath, bottomNav, 'utf8');

console.log('完成：已接上時間軸頁面，並更新底部導覽。');
