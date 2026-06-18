import { addDoc, collection } from "firebase/firestore";
import { db } from "./firebase";

export async function sendNotification(
  toUserId: string,
  type: string,
  title: string,
  body: string,
) {
  await addDoc(collection(db, "notifications", toUserId, "items"), {
    type,
    title,
    body,
    read: false,
    createdAt: new Date().toISOString(),
  });
}
