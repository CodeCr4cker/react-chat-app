import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD5ndtL_f3JZk6NTOMX1DlIGqO6roZWIkQ",
  authDomain: "buddy-chat-ced44.firebaseapp.com",
  projectId: "buddy-chat-ced44",
  storageBucket: "buddy-chat-ced44.firebasestorage.app",
  messagingSenderId: "623200679884",
  appId: "1:623200679884:web:26c1c05ae0439f3709cf69",
  measurementId: "G-1TX2VDCD4F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);

// Initialize Analytics if supported
isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});

export { app, auth, db, storage, rtdb };
