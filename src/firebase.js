import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBFBtuIw0HVJl-HYZ9DSP1VZqwXMJli_W8",
  authDomain: "darknet-chat-f6b5a.firebaseapp.com",
  projectId: "darknet-chat-f6b5a",
  storageBucket: "darknet-chat-f6b5a.appspot.com",
  messagingSenderId: "485072993943",
  appId: "1:485072993943:web:262edab82d07a87b4733d2",
  measurementId: "G-2WL2PC8N6H",
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Analytics only if supported (browser environment)
isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});

export default app;
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
export default app;
