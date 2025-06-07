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

  // UI states
  const [showProfileUpload, setShowProfileUpload] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);

  // Handle file selection and preview
  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (file) {
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

      // Create user profile document with username
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

  // ----------- UI Rendering -----------
  if (loading) return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>Loading...</div>;

  if (!user)
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: '#f0f2f5'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '10px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          width: '400px'
        }}>
          <h2 style={{textAlign: 'center', marginBottom: '30px', color: '#333'}}>Welcome to ChatApp</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px', 
              marginBottom: '15px', 
              border: '1px solid #ddd',
              borderRadius: '5px',
              fontSize: '16px'
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px', 
              marginBottom: '15px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              fontSize: '16px'
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
              fontSize: '16px'
            }}
          />
          <div style={{display: 'flex', gap: '10px'}}>
            <button 
              onClick={handleLogin} 
              style={{ 
                flex: 1,
                padding: '12px',
                backgroundColor: '#007bff',
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
          {error && <p style={{ color: "red", textAlign: 'center', marginTop: '15px' }}>{error}</p>}
        </div>
      </div>
    );

  // If logged in show main UI
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif" }}>
      {/* Sidebar - Friends, Requests, Profile */}
      <div style={{ width: 350, borderRight: "1px solid #ddd", padding: 15, overflowY: "auto", backgroundColor: "#f8f9fa" }}>
        {/* User Profile Section */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: 20, 
          padding: 15,
          backgroundColor: 'white',
          borderRadius: '10px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{position: 'relative', marginRight: 15}}>
            <img
              src={profilePhotoURL || "https://via.placeholder.com/60"}
              alt="Profile"
              style={{ width: 60, height: 60, borderRadius: "50%", border: '3px solid #007bff' }}
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
          <div style={{flex: 1}}>
            <h3 style={{margin: 0, color: '#333'}}>{username}</h3>
            <p style={{margin: 0, fontSize: '12px', color: '#666'}}>{user.email}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{marginBottom: 20}}>
          <button 
            onClick={() => setShowProfileUpload(!showProfileUpload)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              marginBottom: '5px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            📷 Manage Photo
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

        {/* Profile Photo Upload Section */}
        {showProfileUpload && (
          <div style={{ 
            marginBottom: 20, 
            padding: 15, 
            backgroundColor: 'white', 
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <h4 style={{margin: '0 0 10px 0'}}>Profile Photo</h4>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ width: '100%', marginBottom: 10 }}
            />
            {preview && (
              <div style={{textAlign: 'center', marginBottom: 10}}>
                <img
                  src={preview}
                  alt="Preview"
                  style={{ width: 80, height: 80, borderRadius: "50%" }}
                />
              </div>
            )}
            <div style={{display: 'flex', gap: '5px'}}>
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
            backgroundColor: 'white', 
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <h4 style={{margin: '0 0 10px 0'}}>Change Password</h4>
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
                backgroundColor: '#007bff',
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
            backgroundColor: 'white', 
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <h4 style={{margin: '0 0 10px 0'}}>Blocked Users</h4>
            {blockedUsers.length === 0 ? (
              <p style={{margin: 0, color: '#666'}}>No blocked users</p>
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
          backgroundColor: 'white', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h4 style={{margin: '0 0 10px 0'}}>Friend Requests ({friendRequests.length})</h4>
          {friendRequests.length === 0 ? (
            <p style={{margin: 0, color: '#666'}}>No new requests</p>
          ) : (
            friendRequests.map((req) => (
              <div key={req.id} style={{ 
                marginBottom: 10, 
                padding: 10,
                border: '1px solid #eee',
                borderRadius: '5px',
                backgroundColor: '#f8f9fa'
              }}>
                <p style={{margin: '0 0 8px 0'}}><strong>{req.fromUsername || req.from}</strong></p>
                <div style={{display: 'flex', gap: '5px'}}>
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
          backgroundColor: 'white', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h4 style={{margin: '0 0 10px 0'}}>Friends ({friends.length})</h4>
          {friends.length === 0 ? (
            <p style={{margin: 0, color: '#666'}}>No friends yet</p>
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
        
        {error && <p style={{ color: "red", marginTop: 10, padding: 10, backgroundColor: '#ffe6e6', borderRadius: '5px' }}>{error}</p>}
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Chat Header */}
        <div style={{ 
          padding: 15, 
          borderBottom: "1px solid #ddd", 
          backgroundColor: "#fff",
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {currentChatFriend ? (
            <ChatFriendHeader friendId={currentChatFriend.uid} onlineUsers={onlineUsers} />
          ) : (
            <div style={{textAlign: 'center', color: '#666'}}>
              <h3>Welcome to ChatApp</h3>
              <p>Select a friend to start chatting</p>
            </div>
          )}
        </div>

        {/* Chat Messages */}
        <div style={{ 
          flex: 1, 
          padding: 15, 
          overflowY: "auto", 
          backgroundColor: "#f8f9fa",
          backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
        }}>
          {currentChatFriend ? (
            <>
              {messages.length === 0 ? (
                <div style={{textAlign: 'center', color: '#666', marginTop: '50px'}}>
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
                  backgroundColor: 'rgba(0,123,255,0.1)',
                  borderRadius: '15px',
                  marginBottom: '10px',
                  maxWidth: '200px'
                }}>
                  <em style={{color: '#007bff'}}>Typing...</em>
                </div>
              )}
            </>
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
              <div style={{fontSize: '48px', marginBottom: '20px'}}>💬</div>
              <h2>Start Chatting</h2>
              <p>Choose a friend from the sidebar to begin your conversation</p>
            </div>
          )}
        </div>

        {/* Chat Input */}
        {currentChatFriend && (
          <div style={{ 
            padding: 15, 
            borderTop: "1px solid #ddd", 
            backgroundColor: "#fff",
            boxShadow: '0 -2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{display: 'flex', gap: '10px'}}>
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
                  outline: 'none'
                }}
              />
              <button 
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                style={{
                  padding: '12px 20px',
                  backgroundColor: newMessage.trim() ? '#007bff' : '#ccc',
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
    </div>
  );
}

// Friend item component
function FriendItem({ friendId, currentUser, openChat, blockUser, unblockUser, blockedUsers, onlineUsers, isCurrentChat }) {
  const [username, setUsername] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [showActions, setShowActions] = useState(false);

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
  const isOnline = onlineUsers.includes(friendId);

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      marginBottom: 8, 
      padding: 10,
      backgroundColor: isCurrentChat ? '#e3f2fd' : (isBlocked ? '#ffebee' : '#fff'),
      borderRadius: '8px',
      border: isCurrentChat ? '2px solid #2196f3' : '1px solid #eee',
      cursor: "pointer",
      opacity: isBlocked ? 0.7 : 1,
      position: 'relative'
    }}>
      <div style={{position: 'relative', marginRight: 12}}>
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
      <div style={{flex: 1}} onClick={() => !isBlocked && openChat({ uid: friendId })}>
        <div style={{fontWeight: 'bold', color: isBlocked ? '#999' : '#333'}}>{username}</div>
        <div style={{fontSize: '12px', color: isBlocked ? '#999' : (isOnline ? '#4caf50' : '#999')}}>
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

// Message item component
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
        backgroundColor: isMyMessage ? '#007bff' : '#fff',
        color: isMyMessage ? 'white' : '#333',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        position: 'relative'
      }}>
        <div style={{wordBreak: 'break-word'}}>{message.text}</div>
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

// Add friend component
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
      <h4 style={{margin: '0 0 10px 0'}}>Add Friend</h4>
      <form onSubmit={handleSubmit} style={{display: 'flex', gap: '8px'}}>
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
            backgroundColor: friendUsername.trim() ? '#007bff' : '#ccc',
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

// Chat friend header component
function ChatFriendHeader({ friendId, onlineUsers }) {
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

  const isOnline = onlineUsers.includes(friendId);

  return (
    <div style={{display: 'flex', alignItems: 'center'}}>
      <div style={{position: 'relative', marginRight: 12}}>
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
        <h3 style={{margin: 0, color: '#333'}}>{username}</h3>
        <p style={{margin: 0, fontSize: '14px', color: isOnline ? '#4caf50' : '#999'}}>
          {isOnline ? 'Online' : 'Offline'}
        </p>
      </div>
    </div>
  );
}

// Blocked user item component
function BlockedUserItem({ userId, onUnblock }) {
  const [username, setUsername] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUsername(data.username || userId);
          setProfilePhoto(data.profilePhotoURL || null);
        }
      } catch (err) {
        console.error(err);
      }
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
      <div style={{flex: 1}}>
        <div style={{fontWeight: 'bold', fontSize: '14px'}}>{username}</div>
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
                
