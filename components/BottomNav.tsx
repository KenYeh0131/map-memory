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
    <nav className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-2xl border border-slate-200/80 border-b-0 bg-white/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_28px_rgba(15,23,42,0.08)] backdrop-blur-md">
      <div className="grid grid-cols-3 px-1">
        {tabItems.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-[11px] transition-colors ${
                isActive
                  ? "bg-orange-50 font-semibold text-orange-600"
                  : "font-medium text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
