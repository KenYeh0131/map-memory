import { doc, runTransaction, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type IdentityProfile = { deviceIds: string[]; groupIds: string[]; nickname: string; updatedAt: string };
const profileRef = (id: string) => doc(db, "groups", "map-memory-identity-profiles", "info", id);
const unique = (ids: string[]) => [...new Set(ids.filter(Boolean))];

export async function createTransferCode(deviceId: string, groupIds: string[], nickname: string) {
  const code = Array.from(crypto.getRandomValues(new Uint8Array(12)), x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
  await setDoc(doc(db, "groups", "map-memory-identity-transfers", "info", code), {
    deviceId, groupIds, nickname, expiresAt: Date.now() + 10 * 60 * 1000, used: false,
  });
  return code;
}

export async function mergeIdentity(code: string, deviceId: string, groupIds: string[], nickname: string) {
  const transferRef = doc(db, "groups", "map-memory-identity-transfers", "info", code.trim().toUpperCase());
  return runTransaction(db, async transaction => {
    const transfer = await transaction.get(transferRef);
    if (!transfer.exists()) throw new Error("移轉碼不存在，請確認輸入內容");
    const source = transfer.data();
    if (source.used || source.expiresAt <= Date.now()) throw new Error("移轉碼已使用或超過 10 分鐘，請重新產生");
    if (source.deviceId === deviceId) throw new Error("請在另一支手機輸入移轉碼");
    const sourceProfile = await transaction.get(profileRef(source.deviceId));
    const currentProfile = await transaction.get(profileRef(deviceId));
    const deviceIds = unique([source.deviceId, deviceId, ...(sourceProfile.data()?.deviceIds ?? []), ...(currentProfile.data()?.deviceIds ?? [])]);
    if (deviceIds.length > 100) throw new Error("合併裝置過多，請聯絡協助處理");
    // Read every alias before any write: concurrent merges retry rather than losing an alias.
    const aliases = await Promise.all(deviceIds.map(id => transaction.get(profileRef(id))));
    const knownIds = unique(aliases.flatMap(alias => alias.data()?.deviceIds ?? []));
    if (knownIds.some(id => !deviceIds.includes(id))) throw new Error("身分剛被其他裝置合併，請重新產生移轉碼");
    const result: IdentityProfile = {
      deviceIds,
      groupIds: unique([...groupIds, ...(source.groupIds ?? []), ...aliases.flatMap(alias => alias.data()?.groupIds ?? [])]),
      nickname: nickname.trim() || source.nickname || "未命名",
      updatedAt: new Date().toISOString(),
    };
    deviceIds.forEach(id => transaction.set(profileRef(id), result));
    transaction.update(transferRef, { used: true });
    return result;
  });
}

export async function syncMergedIdentity(deviceIds: string[], groupIds: string[], nickname: string) {
  if (deviceIds.length < 2) return;
  await runTransaction(db, async transaction => {
    const snapshots = await Promise.all(deviceIds.map(id => transaction.get(profileRef(id))));
    const profiles = snapshots.map(snapshot => snapshot.data() as IdentityProfile | undefined);
    const aliases = unique([...deviceIds, ...profiles.flatMap(profile => profile?.deviceIds ?? [])]);
    // A concurrent merge is handled by the live identity subscription before the next sync.
    if (aliases.some(id => !deviceIds.includes(id))) return;
    const nextGroups = unique([...groupIds, ...profiles.flatMap(profile => profile?.groupIds ?? [])]);
    const nextName = nickname.trim() || "未命名";
    if (profiles.every(profile => profile?.nickname === nextName && JSON.stringify(profile.groupIds) === JSON.stringify(nextGroups))) return;
    const profile: IdentityProfile = { deviceIds: aliases, groupIds: nextGroups, nickname: nextName, updatedAt: new Date().toISOString() };
    aliases.forEach(id => transaction.set(profileRef(id), profile));
  });
}
