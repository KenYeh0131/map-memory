"use client";

export type BottomTabId = "map" | "list" | "timeline" | "settings";

type BottomNavProps = {
  activeTab: BottomTabId;
  onChange: (tab: BottomTabId) => void;
};

const tabs: Array<{ id: BottomTabId; label: string; icon: string }> = [
  { id: "map", label: "地圖", icon: "🗺️" },
  { id: "list", label: "清單", icon: "📝" },
  { id: "timeline", label: "時間軸", icon: "🕘" },
  { id: "settings", label: "我的", icon: "⚙️" },
];

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-[100] w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md">
      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-xs font-bold transition ${
                active
                  ? "bg-orange-100 text-orange-600"
                  : "text-slate-400 hover:bg-slate-100"
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
