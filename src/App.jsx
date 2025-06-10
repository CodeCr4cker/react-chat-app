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
  writeBatch
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

// ----------- LOADER COMPONENT (before login) -----------
const LoaderScreen = ({ onEnd }) => {
  useEffect(() => {
    const t = setTimeout(onEnd, 3000);
    return () => clearTimeout(t);
  }, [onEnd]);
  return (
    <div style={{
      minHeight: "100vh",
      background: "#000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        <img
          src="/images/logo.jpeg"
          alt="App Icon"
          style={{
            width: 80,
            height: 80,
            marginBottom: 25,
            marginTop: -40
          }}
        />
        <div style={{ fontWeight: 900, color: "#219653", fontSize: 32, marginBottom: 30, letterSpacing: 2 }}>
          Buddy Chat
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="loader-bar" style={{
            width: 180,
            height: 10,
            background: "#222",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 3px 14px rgba(33, 150, 83, 0.15)"
          }}>
            <div className="loader-bar-inner" style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg,#219653,#6ee7b7)",
              animation: "loaderBarAnim 3s linear"
            }} />
          </div>
        </div>
        <style>{`
        @keyframes loaderBarAnim {
          from { width: 0%; }
          to   { width: 100%; }
        }
        `}</style>
      </div>
    </div>
  );
};

export default function App() {
  // ====== States ======
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Loader before login
  const [showLoader, setShowLoader] = useState(true);

  // User data
  const [username, setUsername] = useState("");
  const [usernameEdit, setUsernameEdit] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [userId, setUserId] = useState("");
  const [profilePhotoURL, setProfilePhotoURL] = useState(null);

  // Auth (remove email from login/signup)
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Chat system
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [meetingRoomChats, setMeetingRoomChats] = useState([]);

  // Chat logic
  const [currentChatFriend, setCurrentChatFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [newMedia, setNewMedia] = useState(null);

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
  const [showSettings, setShowSettings] = useState(false);
  const [showAboutUs, setShowAboutUs] = useState(false);
  const [blockUserInput, setBlockUserInput] = useState("");

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

  // Responsive UI
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 800);

  // Chat wallpaper
  const [chatWallpaper, setChatWallpaper] = useState(localStorage.getItem("chatWallpaper") || "");

  // Username availability for signup/username change
  const [usernameAvailability, setUsernameAvailability] = useState("");

  // ====== Responsive ======
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 800);
      if (window.innerWidth > 800) setShowSidebar(true);
      if (window.innerWidth <= 800 && currentChatFriend) setShowSidebar(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [currentChatFriend]);

  // ====== Loader before login ======
  useEffect(() => {
    if (!showLoader) setLoading(false);
  }, [showLoader]);

  // ====== File selection and preview for profile photo ======
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
        setUserId(currentUser.uid);
        subscribeMeetingRoomChats(currentUser.uid);
      } else {
        setFriendRequests([]);
        setFriends([]);
        setBlockedUsers([]);
        setMessages([]);
        setCurrentChatFriend(null);
        setProfilePhotoURL(null);
        setMeetingRoomChats([]);
        setUserId("");
      }
    });
    return () => unsubscribe();
  }, []);

  // ----------- Ensure Unique Username -----------
  async function isUsernameTaken(name, excludeUid) {
    const q = query(collection(db, "users"), where("username", "==", name.trim()));
    const querySnap = await getDocs(q);
    if (excludeUid) {
      // If there is a match, but it is not the current user
      return !querySnap.empty && querySnap.docs[0].id !== excludeUid;
    }
    return !querySnap.empty;
  }

  // Live check username availability in signup/username change
  useEffect(() => {
    let active = true;
    if (!usernameInput.trim()) return setUsernameAvailability("");
    isUsernameTaken(usernameInput, user?.uid).then(isTaken => {
      if (active) setUsernameAvailability(isTaken ? "taken" : "available");
    });
    return () => { active = false; };
  }, [usernameInput, user]);

  // Load initial user data
  async function loadUserData(uid) {
    try {
      const docSnap = await getDoc(doc(db, "users", uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.profilePhotoURL) setProfilePhotoURL(data.profilePhotoURL);
        setUsername(data.username || "");
        setUsernameInput(data.username || "");
        setUserId(data.userId || uid);
      }
    } catch (err) {
      console.error("Error loading user data", err);
    }
  }

  // ----------- Signup (unique username) -----------
  async function handleSignup() {
    setError("");
    if (!usernameInput.trim()) {
      setError("Username is required");
      return;
    }
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    if (await isUsernameTaken(usernameInput)) {
      setError("Username already taken, try another.");
      return;
    }
    const pseudoEmail = `${usernameInput.trim().toLowerCase()}@buddychat.fake`;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, pseudoEmail, password);
      const currentUser = userCredential.user;
      await setDoc(doc(db, "users", currentUser.uid), {
        username: usernameInput.trim(),
        profilePhotoURL: null,
        friends: [],
        blockedUsers: [],
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      setUserId(currentUser.uid);
    } catch (err) {
      setError(err.message);
    }
  }

  // ----------- Login (no email, only username+password) -----------
  async function handleLogin() {
    setError("");
    if (!usernameInput.trim()) {
      setError("Username is required");
      return;
    }
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    const pseudoEmail = `${usernameInput.trim().toLowerCase()}@buddychat.fake`;
    try {
      await signInWithEmailAndPassword(auth, pseudoEmail, password);
    } catch (err) {
      setError("Invalid username or password.");
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
  async function uploadProfilePhoto(file) {
    setError("");
    if (!file) {
      setError("Please select a photo first.");
      return;
    }
    if (!user) {
      setError("No user logged in.");
      return;
    }
    setUploading(true);
    try {
      if (profilePhotoURL) {
        try {
          const match = profilePhotoURL.match(/\/o\/(.+)\?/);
          if (match) {
            const storagePath = decodeURIComponent(match[1]);
            const oldPhotoRef = ref(storage, storagePath);
            await deleteObject(oldPhotoRef);
          }
        } catch (e) { }
      }
      const photoRef = ref(storage, `profilePhotos/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(photoRef, file);
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
      const fromUserData = fromUserDoc.data() || {};
      if ((fromUserData.friends || []).includes(toUserId)) {
        setError("Already friends");
        return;
      }
      if ((fromUserData.blockedUsers || []).includes(toUserId)) {
        setError("User is blocked");
        return;
      }
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

  function subscribeFriends(uid) {
    return onSnapshot(doc(db, "users", uid), (docSnap) => {
      if (docSnap.exists()) {
        setFriends(docSnap.data().friends || []);
      }
    });
  }

  function subscribeBlockedUsers(uid) {
    return onSnapshot(doc(db, "users", uid), (docSnap) => {
      if (docSnap.exists()) {
        setBlockedUsers(docSnap.data().blockedUsers || []);
      }
    });
  }

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
      if (isMobile) setShowSidebar(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function rejectFriendRequest(requestId) {
    try {
      await deleteDoc(doc(db, "friendRequests", requestId));
    } catch (err) {
      setError(err.message);
    }
  }

  // ----------- Block User by Username -----------
  async function blockUserByUsername() {
    setError("");
    if (!blockUserInput.trim()) {
      setError("Enter a username to block.");
      return;
    }
    if (blockUserInput.trim() === username) {
      setError("You cannot block yourself.");
      return;
    }
    const q = query(collection(db, "users"), where("username", "==", blockUserInput.trim()));
    const querySnap = await getDocs(q);
    if (querySnap.empty) {
      setError("User not found");
      return;
    }
    const toBlockId = querySnap.docs[0].id;
    await blockUser(toBlockId);
    setBlockUserInput("");
  }

  // ----------- Block/Unblock User by UID -----------
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
        if (isMobile) setShowSidebar(true);
      }
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
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

  function subscribeMeetingRoomChats(uid) {
    return onSnapshot(doc(db, "users", uid), (docSnap) => {
      if (docSnap.exists()) {
        const allFriends = docSnap.data().friends || [];
        setMeetingRoomChats(allFriends);
      }
    });
  }

  useEffect(() => {
    if (!user || !currentChatFriend) {
      setMessages([]);
      return;
    }
    const chatId = generateChatId(user.uid, currentChatFriend.uid);
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
  }, [user, currentChatFriend, chatPasswords]);

  async function sendMessage() {
    if ((!newMessage.trim() && !newMedia) || !currentChatFriend || !user) return;
    if (newMedia) {
      setError("Photo/video upload is currently disabled.");
      return;
    }
    const chatId = generateChatId(user.uid, currentChatFriend.uid);
    const messagesRef = collection(db, "chats", chatId, "messages");
    await addDoc(messagesRef, {
      text: newMessage.trim(),
      mediaUrl: null,
      mediaType: null,
      from: user.uid,
      to: currentChatFriend.uid,
      createdAt: serverTimestamp(),
    });
    setNewMessage("");
    setNewMedia(null);
  }

  async function deleteMessage(messageId, message, onlySelf = false) {
    if (!currentChatFriend || !user) return;
    try {
      const chatId = generateChatId(user.uid, currentChatFriend.uid);
      const msgRef = doc(db, "chats", chatId, "messages", messageId);
      if (onlySelf) {
        let deletedIds = JSON.parse(localStorage.getItem("deletedMsgIds") || "[]");
        if (!deletedIds.includes(messageId)) {
          deletedIds.push(messageId);
          localStorage.setItem("deletedMsgIds", JSON.stringify(deletedIds));
        }
        setMessages(msgs => msgs.filter(m => m.id !== messageId));
      } else {
        if (message.from !== user.uid) return;
        await deleteDoc(msgRef);
      }
    } catch (err) {
      setError("Failed to delete message: " + err.message);
    }
  }

  async function cleanChat() {
    if (!user || !currentChatFriend) return;
    const chatId = generateChatId(user.uid, currentChatFriend.uid);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const msgsSnap = await getDocs(msgsRef);
    const batch = writeBatch(db);
    msgsSnap.forEach(docu => {
      batch.delete(docu.ref);
    });
    await batch.commit();
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
      } catch (err) { }
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
  }, [user, currentChatFriend]);

  // ----------- Online Status -----------
  async function setOnlineStatus(uid, isOnline) {
    try {
      const userStatusRef = doc(db, "status", uid);
      await setDoc(userStatusRef, {
        state: isOnline ? "online" : "offline",
        lastChanged: serverTimestamp(),
      });
    } catch (err) {}
  }

  useEffect(() => {
    if (!user) return;
    const handleBeforeUnload = () => { setOnlineStatus(user.uid, false); };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      setOnlineStatus(user.uid, false);
    };
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

  // ----------- Change Username with uniqueness -----------
  async function handleChangeUsername(newUsername) {
    if (!user) return;
    if (!newUsername.trim()) return;
    if (await isUsernameTaken(newUsername, user.uid)) {
      setError("Username already taken, try another.");
      return;
    }
    try {
      await updateDoc(doc(db, "users", user.uid), { username: newUsername });
      setUsername(newUsername);
      setUsernameInput(newUsername);
      setUsernameEdit(false);
      alert("Username updated successfully!");
    } catch (err) {
      setError("Failed to change username: " + err.message);
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

  // ----------- CHAT WALLPAPER SETTING -----------
  function handleChatWallpaperChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      setChatWallpaper(ev.target.result);
      localStorage.setItem("chatWallpaper", ev.target.result);
    };
    reader.readAsDataURL(file);
  }
  function removeChatWallpaper() {
    setChatWallpaper("");
    localStorage.removeItem("chatWallpaper");
  }

  // ----------- LOADER SCREEN (Replaces Splash Video) -----------
  if (!user && showLoader) {
    return <LoaderScreen onEnd={() => setShowLoader(false)} />;
  }
  if (loading) return null;

  // ----------- LOGIN FORM (username only, no email) -----------
  if (!user)
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: theme === "dark" ? "#181818" : "#f0f2f5"
      }}>
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100vw",
          height: 0
        }}>
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
        </div>
        <div style={{
          marginTop: 100,
          backgroundColor: theme === "dark" ? "#23272f" : 'white',
          padding: '40px',
          borderRadius: '10px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          width: '400px'
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <img src="/images/logo.jpeg" alt="App Icon" style={{ width: 60, height: 60, marginBottom: 10 }} />
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
            type="text"
            placeholder="Username"
            value={usernameInput}
            autoComplete="username"
            onChange={(e) => setUsernameInput(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '5px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              fontSize: '16px',
              background: theme === "dark" ? "#353535" : undefined,
              color: theme === "dark" ? "#fff" : undefined
            }}
          />
          {/* Show username availability */}
          {usernameAvailability === "taken" && (
            <div style={{ color: "#e74c3c", fontSize: 13, marginBottom: 8 }}>
              Username already exists!
            </div>
          )}
          {usernameAvailability === "available" && usernameInput.trim() && (
            <div style={{ color: "#219653", fontSize: 13, marginBottom: 8 }}>
              Username available!
            </div>
          )}
          <input
            type="password"
            placeholder="Password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
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
      <div className="main-app" style={{
        display: "flex",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
        background: theme === "dark" ? "#23272f" : "#fff",
      }}>
        <UniversalHeader />

        {/* Sidebar and Menu at Top (under header) */}
        <div style={{ position: "fixed", top: "2rem", left: 0, zIndex: 3200, width: "100vw", background: "none" }}>
          <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
            {isMobile && !showSidebar && (
              <button
                className="mobile-menu-btn"
                onClick={() => setShowSidebar(true)}
                style={{
                  marginLeft: 12,
                  marginTop: 6,
                  zIndex: 3200,
                  background: "#219653",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: 44,
                  height: 44,
                  fontSize: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
                  cursor: "pointer"
                }}
                aria-label="Open menu"
              >☰</button>
            )}
          </div>
        </div>

        {/* Friend List & Meeting Room OUTSIDE of sidebar (new, always visible) */}
        <div style={{
          width: isMobile ? "100vw" : 320,
          background: theme === "dark" ? "#181c21" : "#f8f9fa",
          borderRight: isMobile ? "none" : "1px solid #ddd",
          paddingTop: "2rem",
          display: isMobile && showSidebar ? "block" : isMobile ? "none" : "block",
          zIndex: 3001,
          position: isMobile ? "fixed" : "relative",
          left: 0,
          top: isMobile ? "2rem" : 0,
          height: isMobile ? "calc(100vh - 2rem)" : "auto",
          overflowY: "auto"
        }}>
          <div style={{ padding: 16 }}>
            {/* User Info */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <img
                src={profilePhotoURL || "/images/logo.jpeg"}
                alt="Profile"
                style={{ width: 54, height: 54, borderRadius: "50%", objectFit: "cover", border: "3px solid #219653" }}
              />
              <div style={{ marginLeft: 10 }}>
                <div style={{ fontWeight: 900, color: "#219653", fontSize: 18 }}>
                  {usernameEdit ? (
                    <>
                      <input
                        value={usernameInput}
                        onChange={e => setUsernameInput(e.target.value)}
                        style={{ fontSize: 16, borderRadius: 4, border: "1px solid #bbb" }}
                      />
                      <button onClick={() => handleChangeUsername(usernameInput)} style={{ fontSize: 11, marginLeft: 2 }}>✔</button>
                      <button onClick={() => { setUsernameEdit(false); setUsernameInput(username); }} style={{ fontSize: 11, marginLeft: 2 }}>✖</button>
                    </>
                  ) : (
                    <>
                      {username}
                      <button onClick={() => setUsernameEdit(true)} style={{ fontSize: 11, marginLeft: 5 }}>✎</button>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#666" }}>ID: <strong>{userId}</strong></div>
              </div>
            </div>
            {/* Settings/About buttons */}
            <div style={{ marginBottom: 15, marginTop: 12 }}>
              <button onClick={() => setShowSettings(true)} style={{ marginRight: 8, background: "#219653", color: "#fff", border: "none", borderRadius: 5, padding: "5px 13px", fontSize: 13 }}>⚙️</button>
              <button onClick={() => setShowAboutUs(true)} style={{ background: "#0d6efd", color: "#fff", border: "none", borderRadius: 5, padding: "5px 13px", fontSize: 13 }}>ℹ️</button>
            </div>
            <AddFriend sendFriendRequest={sendFriendRequest} />
            <div style={{ marginTop: 10 }}>
              <h4 style={{ margin: "13px 0 6px 0" }}>Meeting Room</h4>
              {meetingRoomChats.length === 0 ? (
                <p style={{ margin: 0, color: '#666' }}>No chats yet</p>
              ) : (
                meetingRoomChats.map((friendId) => (
                  <MeetingRoomFriendItem
                    key={friendId}
                    friendId={friendId}
                    currentUser={user}
                    openChat={fid => {
                      setCurrentChatFriend(fid);
                      if (isMobile) setShowSidebar(false);
                    }}
                    onlineUsers={onlineUsers}
                    isCurrentChat={currentChatFriend?.uid === friendId}
                    theme={theme}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* SIDEBAR (menu, friend requests, blocked list, etc) */}
        {(showSidebar || !isMobile) && (
          <div className="sidebar" style={{
            width: isMobile ? "80vw" : 250,
            maxWidth: 400,
            borderRight: "1px solid #ddd",
            padding: 15,
            overflowY: "auto",
            backgroundColor: theme === "dark" ? "#23272f" : "#f8f9fa",
            marginTop: "2rem",
            position: isMobile ? "fixed" : "initial",
            left: isMobile ? 0 : undefined,
            top: "2rem",
            bottom: 0,
            zIndex: 3000,
            height: isMobile ? "calc(100vh - 2rem)" : "auto",
            boxShadow: isMobile && showSidebar ? "2px 0 18px rgba(0,0,0,0.21)" : "none"
          }}>
            {/* Always show close cross button */}
            <div style={{ textAlign: "right", marginBottom: 10 }}>
              <button
                onClick={() => setShowSidebar(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 28,
                  cursor: "pointer",
                  color: "#219653",
                  position: "absolute",
                  right: 10,
                  top: 10,
                  zIndex: 4000
                }}
                aria-label="Close menu"
              >×</button>
            </div>
            {/* Friend Requests */}
            {friendRequests.length > 0 && (
              <div style={{ marginBottom: 15 }}>
                <h4>Friend Requests</h4>
                {friendRequests.map(req => (
                  <div key={req.id} style={{ background: "#fff", borderRadius: 7, padding: 8, marginBottom: 6 }}>
                    <b>{req.fromUsername || req.from}</b>
                    <button onClick={() => acceptFriendRequest(req.id, req.from)} style={{ marginLeft: 9, background: "#219653", color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 12 }}>Accept</button>
                    <button onClick={() => rejectFriendRequest(req.id)} style={{ marginLeft: 5, background: "#dc3545", color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 12 }}>Reject</button>
                  </div>
                ))}
              </div>
            )}
            {/* Removed Blocked users and Logout from sidebar - now in Settings */}
          </div>
        )}

        {/* Main Chat Area */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          marginTop: "2rem",
          background: theme === "dark" ? "#23272f" : undefined,
          minHeight: 0
        }}>
          {currentChatFriend ? (
            <>
              {/* Chat Header */}
              <div style={{
                padding: 13,
                borderBottom: "1px solid #ddd",
                backgroundColor: theme === "dark" ? "#181c21" : "#fff",
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: "flex",
                alignItems: "center",
                position: "relative"
              }}>
                <ChatFriendHeader
                  friendId={currentChatFriend.uid}
                  onlineUsers={onlineUsers}
                  showBackButton
                  onBack={() => setCurrentChatFriend(null)}
                  theme={theme}
                />
                {/* 3-dot for wallpaper and clean chat, hidden on mobile */}
                <div style={{ marginLeft: "auto", position: "relative", display: isMobile ? "none" : "block" }}>
                  <WallpaperMenu
                    chatWallpaper={chatWallpaper}
                    handleChatWallpaperChange={handleChatWallpaperChange}
                    removeChatWallpaper={removeChatWallpaper}
                    cleanChat={cleanChat}
                  />
                  <button
                    onClick={openPasswordModal}
                    style={{ marginLeft: 8, background: "#eee", color: "#219653", border: "none", borderRadius: 6, padding: "5px 11px", fontSize: 13, cursor: "pointer" }}
                  >🔑</button>
                </div>
              </div>
              {/* Chat Messages */}
              <div style={{
                flex: 1,
                padding: 15,
                overflowY: "auto",
                backgroundColor: theme === "dark" ? "#181c21" : "#f8f9fa",
                backgroundImage: chatWallpaper
                  ? `url(${chatWallpaper})`
                  : theme === "dark"
                    ? undefined
                    : 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
                backgroundSize: chatWallpaper ? 'cover' : '20px 20px',
                backgroundPosition: chatWallpaper ? 'center center' : '0 0, 0 10px, 10px -10px, -10px 0px',
                transition: "background-image 0.3s"
              }}>
                {requirePassword ? (
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
                      messages
                        .filter(msg => {
                          let deletedIds = JSON.parse(localStorage.getItem("deletedMsgIds") || "[]");
                          return !deletedIds.includes(msg.id);
                        })
                        .map((msg) => (
                          <MessageItem
                            key={msg.id}
                            message={msg}
                            currentUser={user.uid}
                            onDelete={() =>
                              msg.from === user.uid && new Date() - (msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt)) > 60000
                                ? deleteMessage(msg.id, msg, true)
                                : deleteMessage(msg.id, msg, false)
                            }
                            canDelete={msg.from === user.uid}
                            isSelfMsg={msg.from === user.uid}
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
                )}
              </div>
              {/* Chat Input */}
              {!requirePassword && (
                <div style={{
                  padding: 15,
                  borderTop: "1px solid #ddd",
                  backgroundColor: theme === "dark" ? "#181c21" : "#fff",
                  boxShadow: '0 -2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {/* Select and preview image/video, with rudimentary "edit" before send */}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      id="chat-media-upload"
                      style={{ display: "none" }}
                      onChange={e => {
                        if (e.target.files[0]) setNewMedia(e.target.files[0]);
                      }}
                    />
                    <label htmlFor="chat-media-upload" style={{
                      cursor: "pointer",
                      padding: '8px',
                      background: '#eee',
                      borderRadius: '50%',
                      marginRight: 6,
                      fontSize: 22
                    }}>
                      📷
                    </label>
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
                      disabled={(!newMessage.trim() && !newMedia)}
                      style={{
                        padding: '12px 20px',
                        backgroundColor: (newMessage.trim() || newMedia) ? '#219653' : '#ccc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '25px',
                        cursor: (newMessage.trim() || newMedia) ? 'pointer' : 'not-allowed',
                        fontSize: '14px'
                      }}
                    >
                      Send
                    </button>
                    {newMedia && (
                      <div style={{ marginLeft: 6, position: "relative" }}>
                        {newMedia.type.startsWith("image/") ? (
                          <img src={URL.createObjectURL(newMedia)} alt="preview" style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover" }} />
                        ) : (
                          <video src={URL.createObjectURL(newMedia)} style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover" }} muted />
                        )}
                        <span
                          onClick={() => setNewMedia(null)}
                          style={{
                            position: "absolute", right: -7, top: -7,
                            background: "#dc3545", color: "#fff", borderRadius: "50%",
                            width: 16, height: 16, fontSize: 12,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer"
                          }}>×</span>
                      </div>
                    )}
                  </div>
                  {/* --- Advanced: Show edit UI for image/video before sending --- */}
                  {newMedia && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Preview:</strong>
                      <div>
                        {newMedia.type.startsWith("image/") ? (
                          <img src={URL.createObjectURL(newMedia)} alt="preview" style={{ width: 120, borderRadius: 10 }} />
                        ) : (
                          <video src={URL.createObjectURL(newMedia)} style={{ width: 120, borderRadius: 10 }} controls muted />
                        )}
                        {/* TODO: Add crop (for image), mute/compress (for video) UI before upload */}
                        {/* For now, just preview. */}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: 15, borderBottom: "1px solid #ddd", backgroundColor: theme === "dark" ? "#181c21" : "#fff" }}>
              <div style={{ textAlign: 'center', color: '#666' }}>
                <h3>Meeting Room</h3>
                <p>Select a chat from the friend/meeting panel to start chatting</p>
              </div>
            </div>
          )}

          {/* Settings Modal */}
          {showSettings && (
            <div style={{
              position: "fixed",
              left: 0, top: 0, width: "100vw", height: "100vh", zIndex: 5001,
              background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center"
            }}
              onClick={() => setShowSettings(false)}
            >
              <div style={{
                background: theme === "dark" ? "#23272f" : "#fff",
                padding: 30,
                borderRadius: 12,
                minWidth: 330,
                boxShadow: "0 2px 18px rgba(0,0,0,0.12)",
                maxWidth: 370,
                position: "relative"
              }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, marginBottom: 15 }}>Settings</h3>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
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
                <button
                  onClick={() => { setShowProfileUpload(!showProfileUpload); setShowSettings(false); }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#219653',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    marginBottom: 8
                  }}
                >
                  📷 Profile Photo
                </button>
                <button
                  onClick={() => { setShowPasswordChange(!showPasswordChange); setShowSettings(false); }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    marginBottom: 8
                  }}
                >
                  🔐 Change Password
                </button>
                <button
                  onClick={openPasswordModal}
                  disabled={!currentChatFriend}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: currentChatFriend ? "#219653" : "#ccc",
                    color: "#fff",
                    border: "none",
                    borderRadius: "5px",
                    cursor: currentChatFriend ? "pointer" : "not-allowed",
                    marginBottom: 8
                  }}
                >
                  Set/Remove Chat Password
                </button>
                {/* Blocked Users Button */}
                <button
                  onClick={() => { setShowBlockedUsers(true); setShowSettings(false); }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    marginBottom: 8
                  }}
                >
                  🚫 Blocked Users ({blockedUsers.length})
                </button>
                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#219653',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    marginBottom: 8
                  }}
                >
                  Logout
                </button>
                {/* Block user by username */}
                <h4 style={{marginTop: "20px"}}>Block User</h4>
                <form onSubmit={e => { e.preventDefault(); blockUserByUsername(); }}>
                  <input
                    type="text"
                    placeholder="Username to block"
                    value={blockUserInput}
                    onChange={e => setBlockUserInput(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 8,
                      marginBottom: 6,
                      border: "1px solid #ddd",
                      borderRadius: 4,
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      padding: 8,
                      backgroundColor: "#dc3545",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer"
                    }}
                  >
                    Block User
                  </button>
                </form>
                <button
                  onClick={() => setShowSettings(false)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#ccc',
                    color: '#23272f',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                {/* Show error for block user */}
                {error && (
                  <div style={{ color: "#e74c3c", marginTop: 8, textAlign: "center" }}>
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Profile Upload */}
          {showProfileUpload && (
            <div style={{
              position: "fixed",
              left: 0, top: 0, width: "100vw", height: "100vh", zIndex: 5002,
              background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center"
            }}
              onClick={() => setShowProfileUpload(false)}
            >
              <div style={{
                background: theme === "dark" ? "#23272f" : "#fff",
                padding: 30,
                borderRadius: 10,
                minWidth: 300,
                boxShadow: "0 2px 18px rgba(0,0,0,0.12)"
              }} onClick={e => e.stopPropagation()}>
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
                    onClick={() => uploadProfilePhoto(photoFile)}
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
            </div>
          )}

          {/* Change Password */}
          {showPasswordChange && (
            <div style={{
              position: "fixed",
              left: 0, top: 0, width: "100vw", height: "100vh", zIndex: 5002,
              background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center"
            }}
              onClick={() => setShowPasswordChange(false)}
            >
              <div style={{
                background: theme === "dark" ? "#23272f" : "#fff",
                padding: 30,
                borderRadius: 10,
                minWidth: 300,
                boxShadow: "0 2px 18px rgba(0,0,0,0.12)"
              }} onClick={e => e.stopPropagation()}>
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
            </div>
          )}

          {/* Blocked Users */}
          {showBlockedUsers && (
            <div style={{
              position: "fixed",
              left: 0, top: 0, width: "100vw", height: "100vh", zIndex: 5002,
              background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center"
            }}
              onClick={() => setShowBlockedUsers(false)}
            >
              <div style={{
                background: theme === "dark" ? "#23272f" : "#fff",
                padding: 30,
                borderRadius: 10,
                minWidth: 300,
                boxShadow: "0 2px 18px rgba(0,0,0,0.12)"
              }} onClick={e => e.stopPropagation()}>
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
            </div>
          )}

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

          {/* ABOUT US MODAL */}
          {showAboutUs && (
            <div style={{
              position: "fixed",
              left: 0, top: 0, width: "100vw", height: "100vh", zIndex: 5000,
              background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center"
            }}
              onClick={() => setShowAboutUs(false)}
            >
              <div style={{
                background: theme === "dark" ? "#23272f" : "#fff",
                padding: 32,
                borderRadius: 14,
                minWidth: 320,
                boxShadow: "0 6px 44px rgba(0,0,0,0.24)",
                textAlign: "center",
                maxWidth: 350
              }} onClick={e => e.stopPropagation()}>
                <img
                  src="/images/About.jpg"
                  alt="Developer"
                  style={{
                    width: 90, height: 90, borderRadius: "50%", marginBottom: 15, border: "3px solid #219653", objectFit: "cover"
                  }}
                  onError={e => { e.target.src = "\images\logo.jpeg"; }}
                />
                <h2 style={{ margin: "0 0 12px 0", color: "#219653" }}>Developer</h2>
                <p style={{ color: theme === "dark" ? "#eee" : "#23272f" }}>
                  Hi! I'm <strong>Divyanshu Pandey</strong>, passionate about building privacy-first, modern and user-friendly web apps. <br /><br />
                  This chat app was built with ❤️ love.<br /><br />
                </p>
                <button
                  onClick={() => setShowAboutUs(false)}
                  style={{
                    marginTop: 13,
                    background: "#219653",
                    color: "#fff",
                    border: "none",
                    padding: "8px 25px",
                    borderRadius: 7,
                    fontSize: 16,
                    cursor: "pointer"
                  }}
                >Close</button>
              </div>
            </div>
          )}
        </div>
        {/* Media queries for responsive */}
        <style>{`
          @media (max-width: 800px) {
            .sidebar {
              width: 80vw !important;
              max-width: 400px;
              min-width: 240px;
            }
            .main-app {
              flex-direction: row;
            }
            .sidebar {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </ThemeContext.Provider>
  );
}

// ----------- Universal Header -----------
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

// ----------- Meeting Room Friend Item -----------
function MeetingRoomFriendItem({ friendId, currentUser, openChat, onlineUsers, isCurrentChat, theme }) {
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
      } catch (err) {}
    }
    fetchData();
  }, [friendId]);
  const isOnline = onlineUsers.includes(friendId);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 8,
        padding: 10,
        backgroundColor: isCurrentChat ? '#e3f2fd' : (theme === "dark" ? "#23272f" : "#fff"),
        borderRadius: '8px',
        border: isCurrentChat ? '2px solid #219653' : '1px solid #eee',
        cursor: "pointer",
        opacity: 1,
        position: 'relative'
      }}
      onClick={() => openChat({ uid: friendId })}
    >
      <div style={{ position: 'relative', marginRight: 12 }}>
        <img
          src={profilePhoto || "/images/logo.jpeg"}
          alt={username}
          style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
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
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 'bold', color: '#333' }}>{username}</div>
        <div style={{ fontSize: '12px', color: isOnline ? '#4caf50' : '#999' }}>
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>
    </div>
  );
}

// ----------- MESSAGE ITEM COMPONENT -----------
function MessageItem({ message, currentUser, onDelete, canDelete, isSelfMsg }) {
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

  let canDeleteNow = canDelete;
  if (isSelfMsg && message.createdAt) {
    const now = new Date();
    const msgTime = message.createdAt.toDate ? message.createdAt.toDate() : new Date(message.createdAt);
    if (now - msgTime > 60000) canDeleteNow = false;
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: message.from === currentUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
        position: 'relative'
      }}
      onMouseEnter={() => setShowDeleteOption(true)}
      onMouseLeave={() => setShowDeleteOption(false)}
    >
      <div style={{
        maxWidth: '70%',
        padding: '10px 15px',
        borderRadius: message.from === currentUser ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
        backgroundColor: message.from === currentUser ? '#219653' : '#fff',
        color: message.from === currentUser ? 'white' : '#333',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        position: 'relative'
      }}>
        {message.mediaUrl && message.mediaType === "image" && (
          <div style={{ marginBottom: 6 }}>
            <img
              src={message.mediaUrl}
              alt="chat-img"
              style={{ maxWidth: 190, maxHeight: 250, borderRadius: 10, objectFit: "cover", marginBottom: 3 }}
            />
            <div>
              <a
                href={message.mediaUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  color: "#219653",
                  textDecoration: "underline",
                  marginTop: 2
                }}
              >Download Image</a>
            </div>
          </div>
        )}
        {message.mediaUrl && message.mediaType === "video" && (
          <div style={{ marginBottom: 6 }}>
            <video src={message.mediaUrl} controls style={{ maxWidth: 190, maxHeight: 250, borderRadius: 10, objectFit: "cover" }} />
            <div>
              <a
                href={message.mediaUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  color: "#219653",
                  textDecoration: "underline",
                  marginTop: 2
                }}
              >Download Video</a>
            </div>
          </div>
        )}
        <div style={{ wordBreak: 'break-word' }}>{message.text}</div>
        <div style={{
          fontSize: '11px',
          opacity: 0.8,
          marginTop: '4px',
          textAlign: 'right'
        }}>
          {formatTime(message.createdAt)}
        </div>
        {showDeleteOption && canDelete && (
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
    <form onSubmit={handleSubmit} style={{
      display: 'flex', gap: '8px', marginTop: 6, marginBottom: 10
    }}>
      <input
        type="text"
        placeholder="Add friend by username"
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
  );
}

// ----------- CHAT FRIEND HEADER COMPONENT -----------
function ChatFriendHeader({ friendId, onlineUsers, showBackButton, onBack, theme }) {
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
      {showBackButton && (
        <button
          onClick={onBack}
          style={{
            marginRight: 15,
            fontSize: 22,
            background: "transparent",
            border: "none",
            color: "#219653",
            cursor: "pointer",
            fontWeight: "bold"
          }}
          aria-label="Back"
        >←</button>
      )}
      <div style={{ position: 'relative', marginRight: 12 }}>
        <img
          src={profilePhoto || "/images/logo.jpeg"}
          alt={username}
          style={{ width: 45, height: 45, borderRadius: "50%", objectFit: "cover" }}
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
        src={profilePhoto || "/images/About.jpg"}
        alt={username}
        style={{ width: 30, height: 30, borderRadius: "50%", marginRight: 10, objectFit: "cover" }}
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

// ----------- WALLPAPER MENU COMPONENT (3-dots) -----------
function WallpaperMenu({ chatWallpaper, handleChatWallpaperChange, removeChatWallpaper, cleanChat }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowMenu(m => !m)}
        style={{
          background: "transparent",
          border: "none",
          fontSize: 22,
          color: "#219653",
          padding: "2px 8px",
          cursor: "pointer",
        }}
        aria-label="Chat menu"
      >⋮</button>
      {showMenu && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "110%",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            zIndex: 1001,
            minWidth: 180,
            padding: 12
          }}
          onMouseLeave={() => setShowMenu(false)}
        >
          <label style={{ display: "block", marginBottom: 6, cursor: "pointer", color: "#219653" }}>
            Set Chat Wallpaper
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={e => {
                handleChatWallpaperChange(e);
                setShowMenu(false);
              }}
            />
          </label>
          {chatWallpaper && (
            <button
              onClick={() => {
                removeChatWallpaper();
                setShowMenu(false);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#dc3545",
                cursor: "pointer",
                display: "block",
                marginTop: 5
              }}
            >Remove Wallpaper</button>
          )}
          {cleanChat && (
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to clean this chat? This will delete all messages.")) {
                  cleanChat();
                  setShowMenu(false);
                }
              }}
              style={{
                background: "none",
                border: "none",
                color: "#dc3545",
                cursor: "pointer",
                display: "block",
                marginTop: 5
              }}
            >🧹 Clean Chat</button>
          )}
        </div>
      )}
    </div>
  );
}