import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  addDoc,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  updateDoc,
  getDocs,
} from "firebase/firestore";
import app, { auth, db } from "./firebase";

export default function App() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [friendUsernameInput, setFriendUsernameInput] = useState("");
  const [friendUser, setFriendUser] = useState(null);
  const [friendNotFound, setFriendNotFound] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatId, setChatId] = useState(null);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    console.log("Firebase app instance:", app);
  }, []);

  const friendsBlockedByFriend = useCallback(
    async (friendUid) => {
      if (!friendUid || !user) return false;
      const q = query(
        collection(db, "blocked"),
        where("blockedBy", "==", friendUid),
        where("blocked", "==", user.uid)
      );
      const querySnap = await getDocs(q);
      return !querySnap.empty;
    },
    [user]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoadingAuth(false);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setUser({ uid: currentUser.uid, ...userDoc.data() });
        } else {
          signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribeRequests = onSnapshot(
      collection(db, "friendRequests"),
      (snapshot) => {
        const requests = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((req) => req.to === user.uid && req.status === "pending");
        setFriendRequests(requests);
      }
    );

    const unsubscribeFriends = onSnapshot(
      collection(db, "friends"),
      (snapshot) => {
        const userFriends = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((f) => f.users.includes(user.uid));
        setFriends(userFriends);
      }
    );

    const unsubscribeBlocked = onSnapshot(
      collection(db, "blocked"),
      (snapshot) => {
        const blocked = snapshot.docs
          .map((doc) => doc.data())
          .filter((b) => b.blockedBy === user.uid);
        setBlockedUsers(blocked.map((b) => b.blocked));
      }
    );

    return () => {
      unsubscribeRequests();
      unsubscribeFriends();
      unsubscribeBlocked();
    };
  }, [user]);

  useEffect(() => {
    if (!chatId) return;

    async function checkBlockedAndSubscribe() {
      if (
        blockedUsers.includes(friendUser?.uid) ||
        (friendUser?.uid && (await friendsBlockedByFriend(friendUser.uid)))
      ) {
        setMessages([]);
        return;
      }

      const messagesRef = collection(db, "chats", chatId, "messages");
      const q = query(messagesRef, orderBy("createdAt"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(msgs);
      });

      return unsubscribe;
    }

    let unsubscribePromise = checkBlockedAndSubscribe();

    return () => {
      unsubscribePromise.then((unsub) => {
        if (typeof unsub === "function") unsub();
      });
    };
  }, [chatId, blockedUsers, friendUser, friendsBlockedByFriend]);

  useEffect(() => {
    if (!user || !friends.length) return;

    const newFriendUid = friends
      .map((f) => f.users.find((uid) => uid !== user.uid))
      .find((uid) => uid && (!friendUser || friendUser.uid !== uid));

    if (newFriendUid) {
      startChatWithFriend(newFriendUid);
    }
  }, [friends]);

  function getChatId(userA, userB) {
    return [userA, userB].sort().join("_");
  }

  async function handleSignUp() {
    if (!email || !password || !username) {
      alert("Fill all fields");
      return;
    }

    const usernameQuery = query(
      collection(db, "users"),
      where("username", "==", username)
    );
    const querySnapshot = await getDocs(usernameQuery);
    if (!querySnapshot.empty) {
      alert("Username already taken");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await setDoc(doc(db, "users", userCredential.user.uid), {
        username,
        email,
      });
      alert("Sign up success! Please login now.");
      setIsLogin(true);
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) {
      alert("Fill both password fields");
      return;
    }

    try {
      const userCred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, userCred);
      await updatePassword(auth.currentUser, newPassword);
      alert("Password updated!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      alert("Error updating password: " + err.message);
    }
  }

  async function findFriend() {
    if (!friendUsernameInput) return;

    const q = query(
      collection(db, "users"),
      where("username", "==", friendUsernameInput)
    );
    const querySnap = await getDocs(q);
    if (querySnap.empty) {
      setFriendUser(null);
      setFriendNotFound(true);
      return;
    }
    const friendDoc = querySnap.docs[0];
    setFriendUser({ uid: friendDoc.id, ...friendDoc.data() });
    setFriendNotFound(false);
  }

  async function startChatWithFriend(friendUid) {
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, "users", friendUid));
      if (!userDoc.exists()) {
        alert("Friend user data not found");
        return;
      }
      const friendData = { uid: friendUid, ...userDoc.data() };
      setFriendUser(friendData);
      const id = getChatId(user.uid, friendUid);
      setChatId(id);
    } catch (err) {
      alert("Error starting chat: " + err.message);
    }
  }

  async function sendMessage() {
    if (!chatInput.trim() || !chatId || !user) return;

    const messagesRef = collection(db, "chats", chatId, "messages");
    await addDoc(messagesRef, {
      text: chatInput.trim(),
      sender: user.uid,
      createdAt: serverTimestamp(),
    });
    setChatInput("");
  }

  async function acceptRequest(reqId, fromUid) {
    try {
      await updateDoc(doc(db, "friendRequests", reqId), { status: "accepted" });
      await setDoc(doc(db, "friends", [user.uid, fromUid].sort().join("_")), {
        users: [user.uid, fromUid],
      });
      alert("Friend request accepted!");
    } catch (err) {
      alert("Error accepting friend request: " + err.message);
    }
  }

  async function declineRequest(reqId) {
    try {
      await updateDoc(doc(db, "friendRequests", reqId), { status: "declined" });
      alert("Friend request declined.");
    } catch (err) {
      alert("Error declining friend request: " + err.message);
    }
  }

  async function blockUser(uidToBlock) {
    if (!user) return;
    try {
      await addDoc(collection(db, "blocked"), {
        blockedBy: user.uid,
        blocked: uidToBlock,
      });
      alert("User blocked.");
    } catch (err) {
      alert("Error blocking user: " + err.message);
    }
  }

  async function unblockUser(uidToUnblock) {
    if (!user) return;
    try {
      const q = query(
        collection(db, "blocked"),
        where("blockedBy", "==", user.uid),
        where("blocked", "==", uidToUnblock)
      );
      const querySnap = await getDocs(q);
      querySnap.forEach(async (docu) => {
        await updateDoc(doc(db, "blocked", docu.id), { deleted: true });
      });
      alert("User unblocked.");
    } catch (err) {
      alert("Error unblocking user: " + err.message);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loadingAuth) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20, maxWidth: 700, margin: "0 auto" }}>
      {!user ? (
        <>
          <h2>{isLogin ? "Login" : "Sign Up"}</h2>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <br />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <br />
          {!isLogin && (
            <>
              <input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <br />
            </>
          )}
          <button onClick={isLogin ? () => signInWithEmailAndPassword(auth, email, password) : handleSignUp}>
            {isLogin ? "Login" : "Sign Up"}
          </button>
          <p
            onClick={() => setIsLogin(!isLogin)}
            style={{ cursor: "pointer", color: "blue" }}
          >
            {isLogin ? "Create new account" : "Already have an account? Login"}
          </p>
        </>
      ) : (
        <>
          <h2>Welcome, {user.username}!</h2>
          <button onClick={() => signOut(auth)}>Logout</button>

          <h3>Change Password</h3>
          <input
            placeholder="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <br />
          <input
            placeholder="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <br />
          <button onClick={changePassword}>Change Password</button>

          <h3>Find Friend</h3>
          <input
            placeholder="Friend's username"
            value={friendUsernameInput}
            onChange={(e) => setFriendUsernameInput(e.target.value)}
          />
          <button onClick={findFriend}>Search</button>
          {friendNotFound && <p>Friend not found</p>}
          {friendUser && (
            <div>
              <p>
                Username:{" "}
                <b
                  style={{ cursor: "pointer", color: "blue" }}
                  onClick={() => startChatWithFriend(friendUser.uid)}
                >
                  {friendUser.username}
                </b>
              </p>
              {!friends.some((f) => f.users.includes(friendUser.uid)) && (
                <button
                  onClick={async () => {
                    await addDoc(collection(db, "friendRequests"), {
                      from: user.uid,
                      to: friendUser.uid,
                      status: "pending",
                    });
                    alert("Friend request sent.");
                  }}
                >
                  Send Friend Request
                </button>
              )}
            </div>
          )}

          <h3>Friend Requests</h3>
          {friendRequests.length === 0 && <p>No pending friend requests.</p>}
          <ul>
            {friendRequests.map((req) => (
              <li key={req.id}>
                From: {req.from}{" "}
                <button onClick={() => acceptRequest(req.id, req.from)}>
                  Accept
                </button>{" "}
                <button onClick={() => declineRequest(req.id)}>Decline</button>
              </li>
            ))}
          </ul>

          <h3>Friends List</h3>
          {friends.length === 0 && <p>No friends yet.</p>}
          <ul>
            {friends.map((f) => {
              const friendUid = f.users.find((uid) => uid !== user.uid);
              return (
                <li key={friendUid}>
                  <b
                    style={{ cursor: "pointer", color: "blue" }}
                    onClick={() => startChatWithFriend(friendUid)}
                  >
                    {friendUid}
                  </b>{" "}
                  <button onClick={() => blockUser(friendUid)}>Block</button>
                </li>
              );
            })}
          </ul>

          {friendUser && chatId && (
            <div style={{ marginTop: 20 }}>
              <h3>Chatting with {friendUser.username}</h3>
              <div
                style={{
                  border: "1px solid #ccc",
                  height: 300,
                  overflowY: "scroll",
                  padding: 10,
                  marginBottom: 10,
                }}
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      textAlign: msg.sender === user.uid ? "right" : "left",
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        backgroundColor:
                          msg.sender === user.uid ? "#dcf8c6" : "#fff",
                        padding: 5,
                        borderRadius: 5,
                        display: "inline-block",
                        maxWidth: "70%",
                        wordWrap: "break-word",
                      }}
                    >
                      {msg.text}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <input
                type="text"
                value={chatInput}
                placeholder="Type your message..."
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <h3>Blocked Users</h3>
            {blockedUsers.length === 0 && <p>No users blocked.</p>}
            <ul>
              {blockedUsers.map((blockedUid) => (
                <li key={blockedUid}>
                  UID: {blockedUid}{" "}
                  <button onClick={() => unblockUser(blockedUid)}>Unblock</button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
