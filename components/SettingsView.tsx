"use client";

type SettingsViewProps = {
  currentGroupName: string;
  currentInviteCode: string;
  newGroupName: string;
  joinInviteCode: string;
  isCreatingGroup: boolean;
  isJoiningGroup: boolean;
  isLeavingGroup: boolean;
  isDeletingGroup: boolean;
  onNewGroupNameChange: (value: string) => void;
  onJoinInviteCodeChange: (value: string) => void;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
  onLeaveGroup: () => void;
  onDeleteGroup: () => void;
};

export function SettingsView({
  currentGroupName,
  currentInviteCode,
  newGroupName,
  joinInviteCode,
  isCreatingGroup,
  isJoiningGroup,
  isLeavingGroup,
  isDeletingGroup,
  onNewGroupNameChange,
  onJoinInviteCodeChange,
  onCreateGroup,
  onJoinGroup,
  onLeaveGroup,
  onDeleteGroup,
}: SettingsViewProps) {
  const isBusy =
    isCreatingGroup || isJoiningGroup || isLeavingGroup || isDeletingGroup;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">我的 / 設定</h2>
        <p className="mt-2 text-sm text-slate-600">
          這裡管理地圖群，地圖瀏覽與地點清單只負責查看與切換。
        </p>
      </div>

      <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-orange-900">目前地圖群</h3>

        <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
          <div>
            <span className="font-medium text-slate-500">名稱：</span>
            <span className="font-semibold text-slate-900">{currentGroupName}</span>
          </div>

          {currentInviteCode ? (
            <div className="mt-1">
              <span className="font-medium text-slate-500">邀請碼：</span>
              <span className="font-mono font-semibold tracking-wide text-orange-700">
                {currentInviteCode}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-slate-400">尚未設定邀請碼</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">建立新的地圖群</h3>
        <p className="mt-1 text-xs text-slate-500">
          例如：大阪旅行、親子景點、朋友美食。建立後會自動產生邀請碼。
        </p>

        <div className="mt-3 flex gap-2">
          <input
            value={newGroupName}
            onChange={(event) => onNewGroupNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isBusy) {
                onCreateGroup();
              }
            }}
            placeholder="輸入地圖群名稱"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
            disabled={isBusy}
          />

          <button
            type="button"
            onClick={onCreateGroup}
            disabled={isBusy}
            className="shrink-0 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isCreatingGroup ? "建立中..." : "建立"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">加入地圖群</h3>
        <p className="mt-1 text-xs text-slate-500">
          輸入家人或朋友提供的邀請碼，即可加入對方的地圖群。
        </p>

        <div className="mt-3 flex gap-2">
          <input
            value={joinInviteCode}
            onChange={(event) =>
              onJoinInviteCodeChange(event.target.value.toUpperCase())
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isBusy) {
                onJoinGroup();
              }
            }}
            placeholder="輸入邀請碼"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-orange-400"
            disabled={isBusy}
          />

          <button
            type="button"
            onClick={onJoinGroup}
            disabled={isBusy}
            className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isJoiningGroup ? "加入中..." : "加入"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">退出地圖群</h3>
        <p className="mt-1 text-xs text-slate-500">
          退出只會讓這個地圖群不再顯示，不會刪除裡面的地點資料。
        </p>

        <button
          type="button"
          onClick={onLeaveGroup}
          disabled={isBusy}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {isLeavingGroup ? "退出中..." : `退出「${currentGroupName}」`}
        </button>
      </div>

      <div className="rounded-2xl border border-red-100 bg-red-50 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-red-900">刪除地圖群</h3>
        <p className="mt-1 text-xs text-red-700">
          這會刪除目前地圖群與裡面的所有地點資料，無法復原。請只在確定不要這個群組時使用。
        </p>

        <button
          type="button"
          onClick={onDeleteGroup}
          disabled={isBusy}
          className="mt-3 w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isDeletingGroup ? "刪除中..." : `刪除「${currentGroupName}」`}
        </button>
      </div>
    </section>
  );
}
