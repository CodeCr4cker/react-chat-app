// utils/generateUserCode.js
import { doc, getDoc, setDoc } from "firebase/firestore";

export const generateUserCode = async (username, db) => {
  const base = username.slice(0, 5).toUpperCase();
  let code;
  let exists = true;

  const generateSuffix = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  while (exists) {
    const suffix = generateSuffix();
    code = `${base}-${suffix}`;
    const docRef = await getDoc(doc(db, 'userCodes', code));
    exists = docRef.exists();
  }

  await setDoc(doc(db, 'userCodes', code), { username });
  return code;
};
