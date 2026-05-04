"use client";

type TabId = "map" | "list" | "settings";

const tabItems: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "map", label: "地圖瀏覽", icon: "🗺️" },
  { id: "list", label: "地點清單", icon: "📋" },
  { id: "settings", label: "我的 / 設定", icon: "⚙️" },
];

type BottomNavProps = {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
};

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-slate-200 bg-white/95 pb-safe shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="grid grid-cols-3">
        {tabItems.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center gap-1 px-2 py-3 text-xs ${
                isActive ? "text-orange-500" : "text-slate-500"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
