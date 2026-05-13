const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
} = require("firebase/firestore");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const SOURCE_GROUP_ID = "family";
const TARGET_GROUP_ID = "我的家-1778634352592";

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const sourcePlacesRef = collection(
    db,
    "groups",
    SOURCE_GROUP_ID,
    "places"
  );

  const snapshot = await getDocs(sourcePlacesRef);

  if (snapshot.empty) {
    console.log("family 裡面沒有地點資料，不需要搬移。");
    return;
  }

  console.log(`準備複製 ${snapshot.size} 筆地點資料...`);
  console.log(`來源：groups/${SOURCE_GROUP_ID}/places`);
  console.log(`目標：groups/${TARGET_GROUP_ID}/places`);

  for (const placeDoc of snapshot.docs) {
    const data = placeDoc.data();

    await setDoc(
      doc(db, "groups", TARGET_GROUP_ID, "places", placeDoc.id),
      {
        ...data,
        migratedFrom: SOURCE_GROUP_ID,
        migratedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(`已複製：${data.name || placeDoc.id}`);
  }

  console.log("搬移完成。請到新地圖群確認地點是否正常顯示。");
}

main().catch((error) => {
  console.error("搬移失敗：", error);
  process.exit(1);
});