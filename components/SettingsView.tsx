"use client";

import type { JoinRequest } from "@/app/page";

type SettingsViewProps = {
  availableTags: string[];
  selectedTags: string[];
  isGroupOwner: boolean;
  onToggleDeleteTag: (tag: string) => void;
  onDeleteSelectedTags: () => void;
  currentGroupName: string;
  nickname: string;
  newGroupName: string;
  joinInviteCode: string;
  joinRequests: JoinRequest[];
  isCreatingGroup: boolean;
  isRequestingJoin: boolean;
  isApprovingRequestId: string | null;
  isRejectingRequestId: string | null;
  isLeavingGroup: boolean;
  isDeletingGroup: boolean;
  onNicknameChange: (value: string) => void;
  onNewGroupNameChange: (value: string) => void;
  onJoinInviteCodeChange: (value: string) => void;
  onCreateGroup: () => void;
  onRequestJoinGroup: () => void;
  onApproveJoinRequest: (requestId: string) => void;
  onRejectJoinRequest: (requestId: string) => void;
  onLeaveGroup: () => void;
  onDeleteGroup: () => void;
};

export function SettingsView({
  availableTags,
  selectedTags,
  isGroupOwner,
  onToggleDeleteTag,
  onDeleteSelectedTags,
  currentGroupName,
  nickname,
  newGroupName,
  joinInviteCode,
  joinRequests,
  isCreatingGroup,
  isRequestingJoin,
  isApprovingRequestId,
  isRejectingRequestId,
  isLeavingGroup,
  isDeletingGroup,
  onNicknameChange,
  onNewGroupNameChange,
  onJoinInviteCodeChange,
  onCreateGroup,
  onRequestJoinGroup,
  onApproveJoinRequest,
  onRejectJoinRequest,
  onLeaveGroup,
  onDeleteGroup,
}: SettingsViewProps) {
  const isBusy =
    isCreatingGroup ||
    isRequestingJoin ||
    Boolean(isApprovingRequestId) ||
    Boolean(isRejectingRequestId) ||
    isLeavingGroup ||
    isDeletingGroup;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">我的暱稱</h3>
        <p className="mt-1 text-xs text-slate-500">
          申請加入地圖群時，對方會看到這個名稱。
        </p>
        <input
          value={nickname}
          onChange={(event) => onNicknameChange(event.target.value)}
          placeholder="例如：Ken、太太、小王"
          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
          disabled={isBusy}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">建立新的地圖群</h3>
        <p className="mt-1 text-xs text-slate-500">建立後會自動產生邀請碼。</p>
        <div className="mt-3 flex gap-2">
          <input
            value={newGroupName}
            onChange={(event) => onNewGroupNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isBusy) onCreateGroup();
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
        <h3 className="text-sm font-semibold text-slate-900">申請加入地圖群</h3>
        <p className="mt-1 text-xs text-slate-500">
          輸入邀請碼後，需等待對方同意。
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={joinInviteCode}
            onChange={(event) =>
              onJoinInviteCodeChange(event.target.value.toUpperCase())
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isBusy) onRequestJoinGroup();
            }}
            placeholder="輸入邀請碼"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-orange-400"
            disabled={isBusy}
          />
          <button
            type="button"
            onClick={onRequestJoinGroup}
            disabled={isBusy}
            className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isRequestingJoin ? "送出中..." : "申請"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">待審核加入申請</h3>
        <p className="mt-1 text-xs text-slate-500">
          同意後，對方裝置會自動加入目前地圖群。
        </p>

        {joinRequests.length === 0 ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-400">
            目前沒有待審核申請
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {joinRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="text-sm font-semibold text-slate-900">
                  {request.nickname}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  申請時間：{new Date(request.createdAt).toLocaleString()}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onApproveJoinRequest(request.id)}
                    disabled={isBusy}
                    className="flex-1 rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isApprovingRequestId === request.id ? "同意中..." : "同意"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRejectJoinRequest(request.id)}
                    disabled={isBusy}
                    className="flex-1 rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {isRejectingRequestId === request.id ? "拒絕中..." : "拒絕"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">標籤管理</h3>
          <span className="text-xs font-medium text-slate-500">
            已選 {selectedTags.length}
          </span>
        </div>

        <p className="mt-1 text-xs text-slate-500">
          選取要刪除的標籤，刪除後會從目前地圖群所有地點移除。
        </p>

        {availableTags.length === 0 ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-400">
            目前沒有標籤
          </div>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {availableTags.map((tag) => {
                const checked = selectedTags.includes(tag);

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleDeleteTag(tag)}
                    disabled={isBusy}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      checked
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {checked ? "✓ " : ""}
                    #{tag}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onDeleteSelectedTags}
              disabled={isBusy || selectedTags.length === 0}
              className="mt-3 w-full rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              刪除選取標籤
            </button>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">退出地圖群</h3>
        <p className="mt-1 text-xs text-slate-500">退出不會刪除資料。</p>
        <button
          type="button"
          onClick={onLeaveGroup}
          disabled={isBusy}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {isLeavingGroup ? "退出中..." : `退出「${currentGroupName}」`}
        </button>
      </div>

      {isGroupOwner ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-red-900">刪除地圖群</h3>
          <p className="mt-1 text-xs text-red-700">
            這會刪除目前地圖群與所有地點資料。
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
      ) : null}
    </section>
  );
}