import React, { useState, useEffect, useRef } from "react";
import {
  initializeApp
} from "firebase/app";

import {
  getFirestore,
  collection,
  query,
  where,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  orderBy,
  limit,
  setDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";

import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject
} from "firebase/storage";

// --------- Firebase Config and Initialization ---------
const firebaseConfig = {
  apiKey: "AIzaSyBFBtuIw0HVJl-HYZ9DSP1VZqwXMJli_W8",
  authDomain: "darknet-chat-f6b5a.firebaseapp.com",
  projectId: "darknet-chat-f6b5a",
  storageBucket: "darknet-chat-f6b5a.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdefg12345",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ----------- THEME CONTEXT -----------
const ThemeContext = React.createContext();

export default function App() {
  // ====== States ======
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true = initial
  const [showSplash, setShowSplash] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [profilePhotoURL, setProfilePhotoURL] = useState(null);

  // Friend system
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);

  // Chat
  const [currentChatFriend, setCurrentChatFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  // Typing indicators
  const [typingStatus, setTypingStatus] = useState({});

  // Profile photo upload
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");

  // Online status tracking
  const [onlineUsers, setOnlineUsers] = useState([]);

  // UI states
  const [showProfileUpload, setShowProfileUpload] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);

  // Settings UI
  const [showSettings, setShowSettings] = useState(false);

  // Theme
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  // Per-chat password
  const [chatPasswords, setChatPasswords] = useState(
    JSON.parse(localStorage.getItem("chatPasswords") || "{}")
  );
  const [showChatPasswordModal, setShowChatPasswordModal] = useState(false);
  const [chatPasswordInput, setChatPasswordInput] = useState("");
  const [requirePassword, setRequirePassword] = useState(false);
  const [chatPasswordPrompt, setChatPasswordPrompt] = useState("");
  const [chatUnlockError, setChatUnlockError] = useState("");

  // Loader (Splash) for 3 seconds before login form
  useEffect(() => {
    setShowSplash(true);
    const timer = setTimeout(() => {
      setShowSplash(false);
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Handle file selection and preview
  function handlePhotoChange(e) {
    setError("");
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("File size should be less than 5MB");
        return;
      }
      setPhotoFile(file);
      setPreview(URL.createObjectURL(file));
    }
  }

  // ----------- Auth Listener -----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        await loadUserData(currentUser.uid);
        subscribeFriendRequests(currentUser.uid);
        subscribeFriends(currentUser.uid);
        subscribeBlockedUsers(currentUser.uid);
        subscribeOnlineStatus(currentUser.uid);
        setOnlineStatus(currentUser.uid, true);
      } else {
        setFriendRequests([]);
        setFriends([]);
        setBlockedUsers([]);
        setMessages([]);
        setCurrentChatFriend(null);
        setProfilePhotoURL(null);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line
  }, []);

  // Load initial user data
  async function loadUserData(uid) {
    try {
      const docSnap = await getDoc(doc(db, "users", uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.profilePhotoURL) setProfilePhotoURL(data.profilePhotoURL);
        setUsername(data.username || "");
      }
    } catch (err) {
      console.error("Error loading user data", err);
    }
  }

  // ----------- Signup -----------
  async function handleSignup() {
    try {
      setError("");
      if (!username.trim()) {
        setError("Username is required");
        return;
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const currentUser = userCredential.user;

      await setDoc(doc(db, "users", currentUser.uid), {
        username: username.trim(),
        profilePhotoURL: null,
        friends: [],
        blockedUsers: [],
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      setError(err.message);
    }
  }

  // ----------- Login -----------
  async function handleLogin() {
    try {
      setError("");
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    }
  }

  // ----------- Logout -----------
  async function handleLogout() {
    if (user) {
      await setOnlineStatus(user.uid, false);
    }
    await signOut(auth);
  }

  // ----------- Upload Profile Photo -----------
  async function handleUpload() {
    setError("");
    if (!photoFile) {
      setError("Please select a photo first.");
      return;
    }
    if (!user) {
      setError("No user logged in.");
      return;
    }
    setUploading(true);
    try {
      // Delete old photo if exists
      if (profilePhotoURL) {
        try {
          const oldPhotoRef = ref(storage, profilePhotoURL.split("/o/")[1].split("?alt=")[0].replace("%2F", "/"));
          await deleteObject(oldPhotoRef);
        } catch (e) {
          // ignore if not found
        }
      }

      const photoRef = ref(storage, `profilePhotos/${user.uid}/${Date.now()}_${photoFile.name}`);
      await uploadBytes(photoRef, photoFile);
      const url = await getDownloadURL(photoRef);

      await updateDoc(doc(db, "users", user.uid), { profilePhotoURL: url });
      setProfilePhotoURL(url);

      setPhotoFile(null);
      setPreview(null);
      setShowProfileUpload(false);
      setError("");
    } catch (err) {
      setError("Upload failed: " + err.message);
    }
    setUploading(false);
  }

  // Remove profile photo
  async function removeProfilePhoto() {
    if (!user || !profilePhotoURL) return;
    try {
      await updateDoc(doc(db, "users", user.uid), { profilePhotoURL: null });
      setProfilePhotoURL(null);
      setError("");
    } catch (err) {
      setError("Failed to remove photo: " + err.message);
    }
  }

  // ----------- Friend Requests System -----------
  async function sendFriendRequest(toUsername) {
    if (!user) return;
    try {
      setError("");
      const q = query(collection(db, "users"), where("username", "==", toUsername.trim()));
      const querySnap = await getDocs(q);
      if (querySnap.empty) {
        setError("User not found");
        return;
      }
      const toUserDoc = querySnap.docs[0];
      const toUserId = toUserDoc.id;

      if (toUserId === user.uid) {
        setError("Cannot add yourself");
        return;
      }

      const fromUserDoc = await getDoc(doc(db, "users", user.uid));
      const fromUserData = fromUserDoc.data();
      if (fromUserData.friends?.includes(toUserId)) {
        setError("Already friends");
        return;
      }
      if (fromUserData.blockedUsers?.includes(toUserId)) {
        setError("User is blocked");
        return;
      }

      // Check if request already exists
      const existingReqQuery = query(
        collection(db, "friendRequests"),
        where("from", "==", user.uid),
        where("to", "==", toUserId),
        where("status", "==", "pending")
      );
      const existingReqSnap = await getDocs(existingReqQuery);
      if (!existingReqSnap.empty) {
        setError("Friend request already sent");
        return;
      }

      await addDoc(collection(db, "friendRequests"), {
        from: user.uid,
        to: toUserId,
        fromUsername: username,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      
      alert("Friend request sent successfully!");
    } catch (err) {
      setError(err.message);
    }
  }

  // Listen to incoming friend requests
  function subscribeFriendRequests(uid) {
    const q = query(collection(db, "friendRequests"), where("to", "==", uid), where("status", "==", "pending"));
    return onSnapshot(q, (querySnapshot) => {
      const requests = [];
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      setFriendRequests(requests);
    });
  }

  // Listen to accepted friends
  function subscribeFriends(uid) {
    return onSnapshot(doc(db, "users", uid), (docSnap) => {
      if (docSnap.exists()) {
        setFriends(docSnap.data().friends || []);
      }
    });
  }

  // Listen to blocked users
  function subscribeBlockedUsers(uid) {
    return onSnapshot(doc(db, "users", uid), (docSnap) => {
      if (docSnap.exists()) {
        setBlockedUsers(docSnap.data().blockedUsers || []);
      }
    });
  }

  // Accept friend request
  async function acceptFriendRequest(requestId, fromUserId) {
    if (!user) return;
    try {
      const reqRef = doc(db, "friendRequests", requestId);
      await updateDoc(reqRef, { status: "accepted" });

      const userRef = doc(db, "users", user.uid);
      const fromUserRef = doc(db, "users", fromUserId);

      await updateDoc(userRef, { friends: arrayUnion(fromUserId) });
      await updateDoc(fromUserRef, { friends: arrayUnion(user.uid) });

      setCurrentChatFriend({ uid: fromUserId });
    } catch (err) {
      setError(err.message);
    }
  }

  // Reject friend request
  async function rejectFriendRequest(requestId) {
    try {
      await deleteDoc(doc(db, "friendRequests", requestId));
    } catch (err) {
      setError(err.message);
    }
  }

  // Block user
  async function blockUser(userIdToBlock) {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        blockedUsers: arrayUnion(userIdToBlock),
        friends: arrayRemove(userIdToBlock),
      });
      await updateDoc(doc(db, "users", userIdToBlock), {
        friends: arrayRemove(user.uid),
      });
      // Remove friend requests (bi-directional)
      const q = query(
        collection(db, "friendRequests"),
        where("from", "in", [user.uid, userIdToBlock]),
        where("to", "in", [user.uid, userIdToBlock])
      );
      const snaps = await getDocs(q);
      for (const docSnap of snaps.docs) {
        await deleteDoc(doc(db, "friendRequests", docSnap.id));
      }

      if (currentChatFriend && currentChatFriend.uid === userIdToBlock) {
        setCurrentChatFriend(null);
      }
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  // Unblock user
  async function unblockUser(userIdToUnblock) {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        blockedUsers: arrayRemove(userIdToUnblock),
      });
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  // ----------- Chat System -----------
  useEffect(() => {
    if (!user || !currentChatFriend) {
      setMessages([]);
      return;
    }
    const chatId = generateChatId(user.uid, currentChatFriend.uid);

    // If chat password is set for this chat, require password before subscribing
    if (chatPasswords[chatId]) {
      setRequirePassword(true);
      setChatPasswordPrompt(chatId);
      return;
    }
    setRequirePassword(false);

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(100));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
    // eslint-disable-next-line
  }, [user, currentChatFriend, chatPasswords]);

  async function sendMessage() {
    if (!newMessage.trim() || !currentChatFriend || !user) return;

    const chatId = generateChatId(user.uid, currentChatFriend.uid);
    const messagesRef = collection(db, "chats", chatId, "messages");

    await addDoc(messagesRef, {
      text: newMessage.trim(),
      from: user.uid,
      to: currentChatFriend.uid,
      createdAt: serverTimestamp(),
    });
    setNewMessage("");
  }

  // Delete message
  async function deleteMessage(messageId) {
    if (!currentChatFriend || !user) return;
    try {
      const chatId = generateChatId(user.uid, currentChatFriend.uid);
      await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
    } catch (err) {
      setError("Failed to delete message: " + err.message);
    }
  }

  function generateChatId(uid1, uid2) {
    return uid1 < uid2 ? uid1 + "_" + uid2 : uid2 + "_" + uid1;
  }

  // ----------- Typing Indicators -----------
  const typingTimeoutRef = useRef(null);

  async function handleTyping(e) {
    setNewMessage(e.target.value);
    if (!user || !currentChatFriend) return;

    const chatId = generateChatId(user.uid, currentChatFriend.uid);
    const typingRef = doc(db, "chats", chatId);

    try {
      await updateDoc(typingRef, {
        [`typing.${user.uid}`]: true,
      });
    } catch (err) {
      await setDoc(typingRef, {
        typing: { [user.uid]: true }
      }, { merge: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      try {
        await updateDoc(typingRef, {
          [`typing.${user.uid}`]: false,
        });
      } catch (err) {
        // ignore
      }
    }, 3000);
  }

  useEffect(() => {
    if (!user || !currentChatFriend) {
      setTypingStatus({});
      return;
    }
    const chatId = generateChatId(user.uid, currentChatFriend.uid);
    const typingDocRef = doc(db, "chats", chatId);

    const unsubscribe = onSnapshot(typingDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setTypingStatus(docSnap.data().typing || {});
      } else {
        setTypingStatus({});
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line
  }, [user, currentChatFriend]);

  // ----------- Online Status -----------
  async function setOnlineStatus(uid, isOnline) {
    try {
      const userStatusRef = doc(db, "status", uid);
      await setDoc(userStatusRef, {
        state: isOnline ? "online" : "offline",
        lastChanged: serverTimestamp(),
      });
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => {
    if (!user) return;

    const handleBeforeUnload = () => {
      setOnlineStatus(user.uid, false);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      setOnlineStatus(user.uid, false);
    };
    // eslint-disable-next-line
  }, [user]);

  function subscribeOnlineStatus(uid) {
    const statusRef = collection(db, "status");
    return onSnapshot(statusRef, (querySnapshot) => {
      const online = [];
      querySnapshot.forEach((doc) => {
        if (doc.data().state === "online") {
          online.push(doc.id);
        }
      });
      setOnlineUsers(online);
    });
  }

  // ----------- Password Change -----------
  async function changePassword() {
    if (!user) {
      setError("No user signed in");
      return;
    }
    if (!newPassword) {
      setError("Enter new password");
      return;
    }
    if (!reauthPassword) {
      setError("Enter current password");
      return;
    }
    try {
      const credential = EmailAuthProvider.credential(user.email, reauthPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      alert("Password updated successfully!");
      setNewPassword("");
      setReauthPassword("");
      setShowPasswordChange(false);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  // ----------- THEME switch -----------
  function handleThemeSwitch() {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.body.setAttribute("data-theme", newTheme);
  }

  // ----------- PER-CHAT PASSWORD -----------
  function openPasswordModal() {
    setShowChatPasswordModal(true);
    setChatPasswordInput("");
    setChatUnlockError("");
  }
  function closePasswordModal() {
    setShowChatPasswordModal(false);
    setChatPasswordInput("");
    setChatUnlockError("");
  }
  function handleSetChatPassword() {
    if (!currentChatFriend) return;
    const chatId = generateChatId(user.uid, currentChatFriend.uid);
    if (chatPasswordInput.trim() === "") return;
    const updated = { ...chatPasswords, [chatId]: chatPasswordInput };
    setChatPasswords(updated);
    localStorage.setItem("chatPasswords", JSON.stringify(updated));
    closePasswordModal();
  }
  function handleRemoveChatPassword() {
    if (!currentChatFriend) return;
    const chatId = generateChatId(user.uid, currentChatFriend.uid);
    const updated = { ...chatPasswords };
    delete updated[chatId];
    setChatPasswords(updated);
    localStorage.setItem("chatPasswords", JSON.stringify(updated));
    closePasswordModal();
  }
  function handleUnlockChat() {
    const chatId = chatPasswordPrompt;
    if (chatPasswordInput === chatPasswords[chatId]) {
      setRequirePassword(false);
      setChatPasswordPrompt("");
      setChatPasswordInput("");
      setChatUnlockError("");
    } else {
      setChatUnlockError("Incorrect password for this chat.");
    }
  }

  // ----------- UNIVERSAL HEADER -----------
  function UniversalHeader() {
    return (
      <div
        style={{
          width: "100vw",
          height: "2rem",
          background: "#219653",
          color: "white",
          fontWeight: "bold",
          fontSize: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          letterSpacing: "1px",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 1000,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
        }}
      >
        Buddy Chat
      </div>
    );
  }

  // ----------- SPLASH SCREEN -----------
  if (showSplash) {
    return (
      <div style={{
        minHeight: "100vh",
        background: theme === "dark" ? "#111" : "#e0ffe0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{ marginBottom: 20, marginTop: "-4rem" }}>
          <img src="https://img.icons8.com/color/96/000000/chat--v1.png" alt="App Icon" style={{ width: 80, height: 80 }} />
        </div>
        <h1 style={{
          color: "#219653",
          fontWeight: 900,
          fontSize: "2.2rem",
          marginBottom: 40,
          letterSpacing: "2px"
        }}>
          Buddy Chat
        </h1>
        <div className="loader" style={{ width: 70, height: 70 }}>
          <div style={{
            border: "7px solid #ddd",
            borderTop: "7px solid #219653",
            borderRadius: "50%",
            width: 70,
            height: 70,
            animation: "spin 1s linear infinite"
          }}></div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg);}
            100% { transform: rotate(360deg);}
          }
        `}</style>
      </div>
    );
  }

  // ----------- LOGIN FORM -----------
  if (loading) return null; // splash hides loading
  if (!user)
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: theme === "dark" ? "#181818" : "#f0f2f5"
      }}>
        <UniversalHeader />
        <div style={{
          marginTop: 70,
          backgroundColor: theme === "dark" ? "#23272f" : 'white',
          padding: '40px',
          borderRadius: '10px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          width: '400px'
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <img src="https://img.icons8.com/color/96/000000/chat--v1.png" alt="App Icon" style={{ width: 60, height: 60, marginBottom: 10 }} />
            <h2 style={{
              textAlign: 'center',
              marginBottom: '10px',
              color: theme === "dark" ? "#fff" : '#219653',
              fontWeight: 900,
              fontSize: 28,
              letterSpacing: 2
            }}>Buddy Chat</h2>
          </div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '15px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              fontSize: '16px',
              background: theme === "dark" ? "#353535" : undefined,
              color: theme === "dark" ? "#fff" : undefined
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '15px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              fontSize: '16px',
              background: theme === "dark" ? "#353535" : undefined,
              color: theme === "dark" ? "#fff" : undefined
            }}
          />
          <input
            type="text"
            placeholder="Username (for signup)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '20px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              fontSize: '16px',
              background: theme === "dark" ? "#353535" : undefined,
              color: theme === "dark" ? "#fff" : undefined
            }}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleLogin}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#219653',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Login
            </button>
            <button
              onClick={handleSignup}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Signup
            </button>
          </div>
          {error && <p style={{ color: "#ff5858", textAlign: 'center', marginTop: '15px' }}>{error}</p>}
        </div>
      </div>
    );

  // ----------- MAIN APP -----------
  return (
    <ThemeContext.Provider value={{ theme, handleThemeSwitch }}>
      <div style={{
        display: "flex",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
        background: theme === "dark" ? "#23272f" : "#fff"
      }}>
        <UniversalHeader />
        {/* Sidebar - Friends, Requests, Profile */}
        <div style={{
          width: 350,
          borderRight: "1px solid #ddd",
          padding: 15,
          overflowY: "auto",
          backgroundColor: theme === "dark" ? "#23272f" : "#f8f9fa",
          marginTop: "2rem"
        }}>
          {/* User Profile Section */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 20,
            padding: 15,
            backgroundColor: theme === "dark" ? "#181c21" : 'white',
            borderRadius: '10px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ position: 'relative', marginRight: 15 }}>
              <img
                src={profilePhotoURL || "https://via.placeholder.com/60"}
                alt="Profile"
                style={{ width: 60, height: 60, borderRadius: "50%", border: '3px solid #219653', background: "#fff" }}
              />
              <div style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 16,
                height: 16,
                backgroundColor: '#28a745',
                borderRadius: '50%',
                border: '2px solid white'
              }}></div>
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, color: theme === "dark" ? "#fff" : '#333' }}>{username}</h3>
              <p style={{ margin: 0, fontSize: '12px', color: theme === "dark" ? "#bbb" : '#666' }}>{user.email}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowProfileUpload(!showProfileUpload)}
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '5px',
                backgroundColor: '#219653',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              📷 Manage Photo
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '5px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              ⚙️ Settings
            </button>
            <button
              onClick={() => setShowPasswordChange(!showPasswordChange)}
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '5px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              🔐 Change Password
            </button>
            <button
              onClick={() => setShowBlockedUsers(!showBlockedUsers)}
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '5px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              🚫 Blocked Users ({blockedUsers.length})
            </button>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>

          {/* Settings Modal */}
          {showSettings && (
            <div style={{
              marginBottom: 20,
              padding: 15,
              backgroundColor: theme === "dark" ? "#181c21" : 'white',
              borderRadius: '8px',
              border: '1px solid #ddd'
            }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Settings</h4>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                <span style={{ flex: 1 }}>Theme:</span>
                <button
                  onClick={handleThemeSwitch}
                  style={{
                    padding: '6px 15px',
                    backgroundColor: theme === "dark" ? "#333" : "#eee",
                    color: theme === "dark" ? "#fff" : "#333",
                    border: "1px solid #bbb",
                    borderRadius: "5px",
                    cursor: "pointer"
                  }}
                >
                  {theme === "dark" ? "Dark" : "Light"}
                </button>
              </div>
              <div>
                <span>Password-protect current chat:</span>
                <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                  <button
                    onClick={openPasswordModal}
                    disabled={!currentChatFriend}
                    style={{
                      padding: '6px 15px',
                      backgroundColor: currentChatFriend ? "#219653" : "#ccc",
                      color: "#fff",
                      border: "none",
                      borderRadius: "5px",
                      cursor: currentChatFriend ? "pointer" : "not-allowed"
                    }}
                  >
                    Set/Remove Password
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Profile Photo Upload Section */}
          {showProfileUpload && (
            <div style={{
              marginBottom: 20,
              padding: 15,
              backgroundColor: theme === "dark" ? "#181c21" : 'white',
              borderRadius: '8px',
              border: '1px solid #ddd'
            }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Profile Photo</h4>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ width: '100%', marginBottom: 10 }}
              />
              {preview && (
                <div style={{ textAlign: 'center', marginBottom: 10 }}>
                  <img
                    src={preview}
                    alt="Preview"
                    style={{ width: 80, height: 80, borderRadius: "50%" }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !photoFile}
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: uploading ? '#ccc' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: uploading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                {profilePhotoURL && (
                  <button
                    onClick={removeProfilePhoto}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Password Change Section */}
          {showPasswordChange && (
            <div style={{
              marginBottom: 20,
              padding: 15,
              backgroundColor: theme === "dark" ? "#181c21" : 'white',
              borderRadius: '8px',
              border: '1px solid #ddd'
            }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Change Password</h4>
              <input
                type="password"
                placeholder="Current Password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  marginBottom: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  marginBottom: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              <button
                onClick={changePassword}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#219653',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Update Password
              </button>
            </div>
          )}

          {/* Blocked Users Section */}
          {showBlockedUsers && (
            <div style={{
              marginBottom: 20,
              padding: 15,
              backgroundColor: theme === "dark" ? "#181c21" : 'white',
              borderRadius: '8px',
              border: '1px solid #ddd'
            }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Blocked Users</h4>
              {blockedUsers.length === 0 ? (
                <p style={{ margin: 0, color: '#666' }}>No blocked users</p>
              ) : (
                blockedUsers.map((blockedId) => (
                  <BlockedUserItem
                    key={blockedId}
                    userId={blockedId}
                    onUnblock={() => unblockUser(blockedId)}
                  />
                ))
              )}
            </div>
          )}

          {/* Friend Requests */}
          <div style={{
            marginBottom: 20,
            padding: 15,
            backgroundColor: theme === "dark" ? "#181c21" : 'white',
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Friend Requests ({friendRequests.length})</h4>
            {friendRequests.length === 0 ? (
              <p style={{ margin: 0, color: '#666' }}>No new requests</p>
            ) : (
              friendRequests.map((req) => (
                <div key={req.id} style={{
                  marginBottom: 10,
                  padding: 10,
                  border: '1px solid #eee',
                  borderRadius: '5px',
                  backgroundColor: theme === "dark" ? "#23272f" : '#f8f9fa'
                }}>
                  <p style={{ margin: '0 0 8px 0' }}><strong>{req.fromUsername || req.from}</strong></p>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      onClick={() => acceptFriendRequest(req.id, req.from)}
                      style={{
                        flex: 1,
                        padding: '6px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => rejectFriendRequest(req.id)}
                      style={{
                        flex: 1,
                        padding: '6px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Friends List */}
          <div style={{
            marginBottom: 20,
            padding: 15,
            backgroundColor: theme === "dark" ? "#181c21" : 'white',
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Friends ({friends.length})</h4>
            {friends.length === 0 ? (
              <p style={{ margin: 0, color: '#666' }}>No friends yet</p>
            ) : (
              friends.map((friendId) => (
                <FriendItem
                  key={friendId}
                  friendId={friendId}
                  currentUser={user}
                  openChat={setCurrentChatFriend}
                  blockUser={blockUser}
                  unblockUser={unblockUser}
                  blockedUsers={blockedUsers}
                  onlineUsers={onlineUsers}
                  isCurrentChat={currentChatFriend?.uid === friendId}
                />
              ))
            )}
          </div>

          {/* Add Friend */}
          <AddFriend sendFriendRequest={sendFriendRequest} />

          {error && <p style={{
            color: "#ff5858",
            marginTop: 10,
            padding: 10,
            backgroundColor: '#ffe6e6',
            borderRadius: '5px'
          }}>{error}</p>}
        </div>

        {/* Main Chat Area */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          marginTop: "2rem",
          background: theme === "dark" ? "#23272f" : undefined
        }}>
          {/* Chat Header */}
          <div style={{
            padding: 15,
            borderBottom: "1px solid #ddd",
            backgroundColor: theme === "dark" ? "#181c21" : "#fff",
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {currentChatFriend ? (
              <ChatFriendHeader friendId={currentChatFriend.uid} onlineUsers={onlineUsers} />
            ) : (
              <div style={{ textAlign: 'center', color: '#666' }}>
                <h3>Welcome to Buddy Chat</h3>
                <p>Select a friend to start chatting</p>
              </div>
            )}
          </div>

          {/* Chat Messages */}
          <div style={{
            flex: 1,
            padding: 15,
            overflowY: "auto",
            backgroundColor: theme === "dark" ? "#181c21" : "#f8f9fa",
            backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
          }}>
            {currentChatFriend ? (
              requirePassword ? (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 50
                }}>
                  <h3>This chat is password protected.</h3>
                  <input
                    type="password"
                    placeholder="Enter chat password"
                    value={chatPasswordInput}
                    onChange={e => setChatPasswordInput(e.target.value)}
                    style={{
                      padding: 8,
                      fontSize: 16,
                      border: "1px solid #ccc",
                      borderRadius: 5,
                      marginTop: 8
                    }}
                  />
                  <button
                    onClick={handleUnlockChat}
                    style={{
                      marginTop: 10,
                      padding: "8px 15px",
                      background: "#219653",
                      color: "#fff",
                      border: "none",
                      borderRadius: 5,
                      fontSize: 16,
                      cursor: "pointer"
                    }}
                  >
                    Unlock
                  </button>
                  {chatUnlockError && <div style={{ color: "#e74c3c", marginTop: 8 }}>{chatUnlockError}</div>}
                </div>
              ) : (
                <>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <MessageItem
                        key={msg.id}
                        message={msg}
                        currentUser={user.uid}
                        onDelete={() => deleteMessage(msg.id)}
                      />
                    ))
                  )}
                  {currentChatFriend && typingStatus[currentChatFriend.uid] && (
                    <div style={{
                      padding: '10px',
                      backgroundColor: 'rgba(33,150,83,0.12)',
                      borderRadius: '15px',
                      marginBottom: '10px',
                      maxWidth: '200px'
                    }}>
                      <em style={{ color: '#219653' }}>Typing...</em>
                    </div>
                  )}
                </>
              )
            ) : (
              <div style={{
                textAlign: 'center',
                color: '#666',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>💬</div>
                <h2>Start Chatting</h2>
                <p>Choose a friend from the sidebar to begin your conversation</p>
              </div>
            )}
          </div>

          {/* Chat Input */}
          {currentChatFriend && !requirePassword && (
            <div style={{
              padding: 15,
              borderTop: "1px solid #ddd",
              backgroundColor: theme === "dark" ? "#181c21" : "#fff",
              boxShadow: '0 -2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '25px',
                    fontSize: '14px',
                    outline: 'none',
                    background: theme === "dark" ? "#23272f" : undefined,
                    color: theme === "dark" ? "#fff" : undefined
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: newMessage.trim() ? '#219653' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '25px',
                    cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px'
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Set Chat Password Modal */}
        {showChatPasswordModal && (
          <div style={{
            position: "fixed",
            left: 0, top: 0, width: "100vw", height: "100vh", zIndex: 2000,
            background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center"
          }}
            onClick={closePasswordModal}
          >
            <div style={{
              background: theme === "dark" ? "#23272f" : "#fff",
              padding: 30,
              borderRadius: 10,
              minWidth: 300,
              boxShadow: "0 2px 18px rgba(0,0,0,0.12)"
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>Set chat password</h3>
              <input
                type="password"
                placeholder="Enter password for this chat"
                value={chatPasswordInput}
                onChange={e => setChatPasswordInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 5,
                  border: "1px solid #ccc",
                  fontSize: 18,
                  marginBottom: 10
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleSetChatPassword}
                  disabled={!chatPasswordInput.trim()}
                  style={{
                    flex: 1,
                    background: "#219653",
                    color: "#fff",
                    border: "none",
                    borderRadius: 5,
                    padding: "8px 0",
                    cursor: chatPasswordInput.trim() ? "pointer" : "not-allowed"
                  }}
                >Set</button>
                <button
                  onClick={handleRemoveChatPassword}
                  style={{
                    flex: 1,
                    background: "#dc3545",
                    color: "#fff",
                    border: "none",
                    borderRadius: 5,
                    padding: "8px 0"
                  }}
                >Remove</button>
                <button
                  onClick={closePasswordModal}
                  style={{
                    flex: 1,
                    background: "#ccc",
                    color: "#23272f",
                    border: "none",
                    borderRadius: 5,
                    padding: "8px 0"
                  }}
                >Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  );
}

// ----------- FRIEND ITEM COMPONENT -----------
function FriendItem({ friendId, currentUser, openChat, blockUser, unblockUser, blockedUsers, onlineUsers, isCurrentChat }) {
  const [username, setUsername] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const userDoc = await getDoc(doc(getFirestore(), "users", friendId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUsername(data.username || friendId);
          setProfilePhoto(data.profilePhotoURL || null);
        }
      } catch (err) {
        // ignore
      }
    }
    fetchData();
  }, [friendId]);

  const isBlocked = blockedUsers.includes(friendId);
  const isOnline = onlineUsers.includes(friendId);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      marginBottom: 8,
      padding: 10,
      backgroundColor: isCurrentChat ? '#e3f2fd' : (isBlocked ? '#ffebee' : '#fff'),
      borderRadius: '8px',
      border: isCurrentChat ? '2px solid #219653' : '1px solid #eee',
      cursor: "pointer",
      opacity: isBlocked ? 0.7 : 1,
      position: 'relative'
    }}>
      <div style={{ position: 'relative', marginRight: 12 }}>
        <img
          src={profilePhoto || "https://via.placeholder.com/40"}
          alt={username}
          style={{ width: 40, height: 40, borderRadius: "50%" }}
        />
        {isOnline && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 12,
            height: 12,
            backgroundColor: '#4caf50',
            borderRadius: '50%',
            border: '2px solid white'
          }}></div>
        )}
      </div>
      <div style={{ flex: 1 }} onClick={() => !isBlocked && openChat({ uid: friendId })}>
        <div style={{ fontWeight: 'bold', color: isBlocked ? '#999' : '#333' }}>{username}</div>
        <div style={{ fontSize: '12px', color: isBlocked ? '#999' : (isOnline ? '#4caf50' : '#999') }}>
          {isBlocked ? 'Blocked' : (isOnline ? 'Online' : 'Offline')}
        </div>
      </div>
      <button
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '16px',
          cursor: 'pointer',
          padding: '5px'
        }}
      >
        ⋮
      </button>
      {showActions && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '5px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '120px'
          }}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
          {!isBlocked ? (
            <button
              onClick={() => {
                blockUser(friendId);
                setShowActions(false);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#dc3545',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              🚫 Block
            </button>
          ) : (
            <button
              onClick={() => {
                unblockUser(friendId);
                setShowActions(false);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#28a745',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              ✅ Unblock
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ----------- MESSAGE ITEM COMPONENT -----------
function MessageItem({ message, currentUser, onDelete }) {
  const isMyMessage = message.from === currentUser;
  const [showDeleteOption, setShowDeleteOption] = useState(false);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
        marginBottom: 12,
        position: 'relative'
      }}
      onMouseEnter={() => setShowDeleteOption(true)}
      onMouseLeave={() => setShowDeleteOption(false)}
    >
      <div style={{
        maxWidth: '70%',
        padding: '10px 15px',
        borderRadius: isMyMessage ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
        backgroundColor: isMyMessage ? '#219653' : '#fff',
        color: isMyMessage ? 'white' : '#333',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        position: 'relative'
      }}>
        <div style={{ wordBreak: 'break-word' }}>{message.text}</div>
        <div style={{
          fontSize: '11px',
          opacity: 0.8,
          marginTop: '4px',
          textAlign: 'right'
        }}>
          {formatTime(message.createdAt)}
        </div>
        {isMyMessage && showDeleteOption && (
          <button
            onClick={onDelete}
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Delete message"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// ----------- ADD FRIEND COMPONENT -----------
function AddFriend({ sendFriendRequest }) {
  const [friendUsername, setFriendUsername] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (friendUsername.trim()) {
      sendFriendRequest(friendUsername.trim());
      setFriendUsername("");
    }
  };

  return (
    <div style={{
      padding: 15,
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #ddd'
    }}>
      <h4 style={{ margin: '0 0 10px 0' }}>Add Friend</h4>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Enter username..."
          value={friendUsername}
          onChange={(e) => setFriendUsername(e.target.value)}
          style={{
            flex: 1,
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
        <button
          type="submit"
          disabled={!friendUsername.trim()}
          style={{
            padding: '8px 15px',
            backgroundColor: friendUsername.trim() ? '#219653' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: friendUsername.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          Add
        </button>
      </form>
    </div>
  );
}

// ----------- CHAT FRIEND HEADER COMPONENT -----------
function ChatFriendHeader({ friendId, onlineUsers }) {
  const [username, setUsername] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const userDoc = await getDoc(doc(getFirestore(), "users", friendId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUsername(data.username || friendId);
          setProfilePhoto(data.profilePhotoURL || null);
        }
      } catch (err) { }
    }
    fetchData();
  }, [friendId]);

  const isOnline = onlineUsers.includes(friendId);

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'relative', marginRight: 12 }}>
        <img
          src={profilePhoto || "https://via.placeholder.com/45"}
          alt={username}
          style={{ width: 45, height: 45, borderRadius: "50%" }}
        />
        {isOnline && (
          <div style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 12,
            height: 12,
            backgroundColor: '#4caf50',
            borderRadius: '50%',
            border: '2px solid white'
          }}></div>
        )}
      </div>
      <div>
        <h3 style={{ margin: 0, color: '#333' }}>{username}</h3>
        <p style={{ margin: 0, fontSize: '14px', color: isOnline ? '#4caf50' : '#999' }}>
          {isOnline ? 'Online' : 'Offline'}
        </p>
      </div>
    </div>
  );
}

// ----------- BLOCKED USER COMPONENT -----------
function BlockedUserItem({ userId, onUnblock }) {
  const [username, setUsername] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const userDoc = await getDoc(doc(getFirestore(), "users", userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUsername(data.username || userId);
          setProfilePhoto(data.profilePhotoURL || null);
        }
      } catch (err) { }
    }
    fetchData();
  }, [userId]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px',
      backgroundColor: '#ffebee',
      borderRadius: '5px',
      marginBottom: '8px'
    }}>
      <img
        src={profilePhoto || "https://via.placeholder.com/30"}
        alt={username}
        style={{ width: 30, height: 30, borderRadius: "50%", marginRight: 10 }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{username}</div>
      </div>
      <button
        onClick={onUnblock}
        style={{
          padding: '4px 8px',
          backgroundColor: '#4caf50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        Unblock
      </button>
    </div>
  );
}