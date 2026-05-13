const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
} = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyA8ZEL-HPZ_uruCIP61cXI9ud_wCVh8uF0",
  authDomain: "map-memory-3fe67.firebaseapp.com",
  projectId: "map-memory-3fe67",
  storageBucket: "map-memory-3fe67.firebasestorage.app",
  messagingSenderId: "877823101224",
  appId: "1:877823101224:web:7d6a1f0fb335954781e81d",
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
    console.log("family 裡面沒有地點資料");
    return;
  }

  console.log(`找到 ${snapshot.size} 筆地點`);
  console.log("開始搬移...");

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

    console.log(`已搬移：${data.name || placeDoc.id}`);
  }

  console.log("全部搬移完成");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});