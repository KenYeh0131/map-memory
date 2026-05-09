"use client";

import type { JoinRequest } from "@/app/page";

type SettingsViewProps = {
  currentGroupName: string;
  currentInviteCode: string;
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
  currentGroupName,
  currentInviteCode,
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
        <h2 className="text-base font-semibold text-slate-900">
          我的 / 設定
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          這裡管理地圖群、邀請碼與加入審核。
        </p>
      </div>

      <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-orange-900">
          目前地圖群
        </h3>

        <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
          <div>
            <span className="font-medium text-slate-500">名稱：</span>

            <span className="font-semibold text-slate-900">
              {currentGroupName}
            </span>
          </div>

          {currentInviteCode ? (
            <div className="mt-1">
              <span className="font-medium text-slate-500">
                邀請碼：
              </span>

              <span className="font-mono font-semibold tracking-wide text-orange-700">
                {currentInviteCode}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-slate-400">
              尚未設定邀請碼
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          我的暱稱
        </h3>

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
        <h3 className="text-sm font-semibold text-slate-900">
          建立新的地圖群
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          建立後會自動產生邀請碼。
        </p>

        <div className="mt-3 flex gap-2">
          <input
            value={newGroupName}
            onChange={(event) =>
              onNewGroupNameChange(event.target.value)
            }
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
        <h3 className="text-sm font-semibold text-slate-900">
          申請加入地圖群
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          輸入邀請碼後，需等待對方同意。
        </p>

        <div className="mt-3 flex gap-2">
          <input
            value={joinInviteCode}
            onChange={(event) =>
              onJoinInviteCodeChange(
                event.target.value.toUpperCase()
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isBusy) {
                onRequestJoinGroup();
              }
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
        <h3 className="text-sm font-semibold text-slate-900">
          待審核加入申請
        </h3>

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
                  申請時間：
                  {new Date(request.createdAt).toLocaleString()}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onApproveJoinRequest(request.id)
                    }
                    disabled={isBusy}
                    className="flex-1 rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isApprovingRequestId === request.id
                      ? "同意中..."
                      : "同意"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onRejectJoinRequest(request.id)
                    }
                    disabled={isBusy}
                    className="flex-1 rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {isRejectingRequestId === request.id
                      ? "拒絕中..."
                      : "拒絕"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          退出地圖群
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          退出不會刪除資料。
        </p>

        <button
          type="button"
          onClick={onLeaveGroup}
          disabled={isBusy}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {isLeavingGroup
            ? "退出中..."
            : `退出「${currentGroupName}」`}
        </button>
      </div>

      <div className="rounded-2xl border border-red-100 bg-red-50 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-red-900">
          刪除地圖群
        </h3>

        <p className="mt-1 text-xs text-red-700">
          這會刪除目前地圖群與所有地點資料。
        </p>

        <button
          type="button"
          onClick={onDeleteGroup}
          disabled={isBusy}
          className="mt-3 w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isDeletingGroup
            ? "刪除中..."
            : `刪除「${currentGroupName}」`}
        </button>
      </div>
    </section>
  );
}