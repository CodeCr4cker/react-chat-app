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
  getDownloadURL 
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

export default function App() {
  // ====== States ======
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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

  // Handle file selection and preview
  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (file) {
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
  }, []);

  // Load initial user data
  async function loadUserData(uid) {
    try {
      const docSnap = await getDoc(doc(db, "users", uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.profilePhotoURL) setProfilePhotoURL(data.profilePhotoURL);
      }
    } catch (err) {
      console.error("Error loading user data", err);
    }
  }

  // ----------- Signup -----------
  async function handleSignup() {
    try {
      setError("");
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const currentUser = userCredential.user;

      // Create user profile document with username
      await setDoc(doc(db, "users", currentUser.uid), {
        username,
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
      const photoRef = ref(storage, `profilePhotos/${user.uid}/${photoFile.name}`);
      await uploadBytes(photoRef, photoFile);
      const url = await getDownloadURL(photoRef);

      await updateDoc(doc(db, "users", user.uid), { profilePhotoURL: url });
      setProfilePhotoURL(url);

      alert("Profile photo uploaded successfully!");
      setPhotoFile(null);
      setPreview(null);
    } catch (err) {
      setError("Upload failed: " + err.message);
    }
    setUploading(false);
  }

  // ----------- Friend Requests System -----------
  async function sendFriendRequest(toUsername) {
    if (!user) return;
    try {
      const q = query(collection(db, "users"), where("username", "==", toUsername));
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

      await addDoc(collection(db, "friendRequests"), {
        from: user.uid,
        to: toUserId,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setError(""); // Clear error on success
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
      
      const q = query(
        collection(db, "friendRequests"),
        where("from", "in", [user.uid, userIdToBlock]),
        where("to", "in", [user.uid, userIdToBlock])
      );
      const snaps = await getDocs(q);
      for (const docSnap of snaps.docs) {
        await deleteDoc(doc(db, "friendRequests", docSnap.id));
      }
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
  }, [user, currentChatFriend]);

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
      // Create document if it doesn't exist
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
        console.error("Error updating typing status:", err);
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
      console.error("Error updating online status:", err);
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
    try {
      const credential = EmailAuthProvider.credential(user.email, reauthPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      alert("Password updated!");
      setNewPassword("");
      setReauthPassword("");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  // ----------- UI Rendering -----------
  if (loading) return <div>Loading...</div>;

  if (!user)
    return (
      <div style={{ padding: 20 }}>
        <h2>Login or Signup</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: "block", marginBottom: 10 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: "block", marginBottom: 10 }}
        />
        <input
          type="text"
          placeholder="Username (signup only)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ display: "block", marginBottom: 10 }}
        />
        <button onClick={handleLogin} style={{ marginRight: 10 }}>
          Login
        </button>
        <button onClick={handleSignup}>Signup</button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    );

  // If logged in show main UI
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif" }}>
      {/* Sidebar - Friends, Requests, Profile */}
      <div style={{ width: 300, borderRight: "1px solid #ccc", padding: 10, overflowY: "auto" }}>
        <h3>Welcome, {user.email}</h3>
        <button onClick={handleLogout} style={{ marginBottom: 10 }}>
          Logout
        </button>

        {/* Profile Photo */}
        <div style={{ marginBottom: 20 }}>
          <img
            src={profilePhotoURL || "https://via.placeholder.com/100"}
            alt="Profile"
            style={{ width: 100, height: 100, borderRadius: "50%" }}
          />
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ marginTop: 10, display: "block" }}
          />
          {preview && (
            <img
              src={preview}
              alt="Preview"
              style={{ width: 50, height: 50, borderRadius: "50%", marginTop: 5 }}
            />
          )}
          <button onClick={handleUpload} disabled={uploading || !photoFile} style={{ marginTop: 5 }}>
            {uploading ? "Uploading..." : "Upload Photo"}
          </button>
        </div>

        {/* Password Change */}
        <div style={{ marginBottom: 20 }}>
          <h4>Change Password</h4>
          <input
            type="password"
            placeholder="Current Password"
            value={reauthPassword}
            onChange={(e) => setReauthPassword(e.target.value)}
            style={{ display: "block", marginBottom: 5 }}
          />
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ display: "block", marginBottom: 5 }}
          />
          <button onClick={changePassword}>Update Password</button>
        </div>

        {/* Friend Requests */}
        <div>
          <h4>Friend Requests</h4>
          {friendRequests.length === 0 && <p>No new requests</p>}
          {friendRequests.map((req) => (
            <div key={req.id} style={{ marginBottom: 5, borderBottom: "1px solid #ddd" }}>
              <p>From: <strong>{req.from}</strong></p>
              <button onClick={() => acceptFriendRequest(req.id, req.from)}>Accept</button>
            </div>
          ))}
        </div>

        {/* Friends List */}
        <div style={{ marginTop: 20 }}>
          <h4>Your Friends</h4>
          {friends.length === 0 && <p>No friends yet</p>}
          {friends.map((friendId) => (
            <FriendItem
              key={friendId}
              friendId={friendId}
              currentUser={user}
              openChat={setCurrentChatFriend}
              blockUser={blockUser}
              unblockUser={unblockUser}
              blockedUsers={blockedUsers}
            />
          ))}
        </div>

        {/* Add Friend */}
        <AddFriend sendFriendRequest={sendFriendRequest} />
        
        {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Chat Header */}
        <div style={{ padding: 10, borderBottom: "1px solid #ccc", backgroundColor: "#f5f5f5" }}>
          {currentChatFriend ? (
            <ChatFriendHeader friendId={currentChatFriend.uid} onlineUsers={onlineUsers} />
          ) : (
            <p>Select a friend to chat</p>
          )}
        </div>

        {/* Chat Messages */}
        <div style={{ flex: 1, padding: 10, overflowY: "auto", backgroundColor: "#eee" }}>
          {messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} currentUser={user.uid} />
          ))}
          {currentChatFriend && typingStatus[currentChatFriend.uid] && (
            <p><em>Typing...</em></p>
          )}
        </div>

        {/* Chat Input */}
        {currentChatFriend && (
          <div style={{ padding: 10, borderTop: "1px solid #ccc", backgroundColor: "#f5f5f5" }}>
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
              style={{ width: "80%", marginRight: 10 }}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Friend item component
function FriendItem({ friendId, currentUser, openChat, blockUser, unblockUser, blockedUsers }) {
  const [username, setUsername] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const userDoc = await getDoc(doc(db, "users", friendId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUsername(data.username || friendId);
          setProfilePhoto(data.profilePhotoURL || null);
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchData();
  }, [friendId]);

  const isBlocked = blockedUsers.includes(friendId);

  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 5, cursor: "pointer", opacity: isBlocked ? 0.5 : 1 }}>
      <img
        src={profilePhoto || "https://via.placeholder.com/40"}
        alt={username}
       
