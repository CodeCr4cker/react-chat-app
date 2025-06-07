import React, { useState, useEffect, useRef } from "react";

const initialUsers = [
  { name: "Alice", avatar: "https://via.placeholder.com/40" },
  { name: "Bob", avatar: "https://via.placeholder.com/40" },
  { name: "Charlie", avatar: "https://via.placeholder.com/40" },
];

export default function ChatApp() {
  // Theme state
  const [darkMode, setDarkMode] = useState(true);

  // Sidebar visibility
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // Current user profile
  const [username, setUsername] = useState(
    localStorage.getItem("username") || "Username"
  );
  const [profilePic, setProfilePic] = useState(
    localStorage.getItem("profilePic") || "https://via.placeholder.com/100"
  );

  // Current chat state
  const [currentChat, setCurrentChat] = useState(null);

  // Chat messages for current chat
  const [messages, setMessages] = useState([]);

  // Input message text
  const [messageText, setMessageText] = useState("");

  // Modal state
  const [activeModal, setActiveModal] = useState(null);

  // Passwords for chats stored in localStorage with keys 'chatPassword:<username>'
  // We'll load/set/check from localStorage directly

  // Refs
  const chatBoxRef = useRef(null);

  // Effect: Save username & profilePic to localStorage
  useEffect(() => {
    localStorage.setItem("username", username);
  }, [username]);
  useEffect(() => {
    localStorage.setItem("profilePic", profilePic);
  }, [profilePic]);

  // Effect: Load messages when currentChat changes
  useEffect(() => {
    if (currentChat) {
      const storedMessages = JSON.parse(
        localStorage.getItem("messages:" + currentChat) || "[]"
      );
      setMessages(storedMessages);
      // Scroll chat to bottom after slight delay
      setTimeout(() => {
        if (chatBoxRef.current)
          chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
      }, 100);
    } else {
      setMessages([]);
    }
  }, [currentChat]);

  // Handle theme toggle
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  // Save message to localStorage and state
  function sendMessage() {
    if (!messageText.trim() || !currentChat) return;
    const newMessages = [...messages, { text: messageText.trim(), type: "sent" }];
    localStorage.setItem("messages:" + currentChat, JSON.stringify(newMessages));
    setMessages(newMessages);
    setMessageText("");
    setTimeout(() => {
      if (chatBoxRef.current)
        chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }, 100);
  }

  // Handle opening a chat with password check
  function openChat(user) {
    const pwd = localStorage.getItem("chatPassword:" + user);
    if (pwd) {
      const entered = prompt(`Enter password for ${user}:`);
      if (entered !== pwd) {
        alert("Incorrect password");
        return;
      }
    }
    setCurrentChat(user);
    setSidebarVisible(false);
  }

  // Handle saving password for chat friend
  function saveChatPassword(user, pwd) {
    if (user && pwd) {
      localStorage.setItem("chatPassword:" + user, pwd);
      alert(`Password set for ${user}`);
    }
  }

  // Handle profile picture change
  function onProfilePicChange(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setProfilePic(ev.target.result);
      reader.readAsDataURL(file);
    }
  }

  // Handle username change in profile modal
  const [profileUsernameInput, setProfileUsernameInput] = useState(username);
  const [profileEmailInput, setProfileEmailInput] = useState("");

  function saveProfile() {
    if (profileUsernameInput.trim()) {
      setUsername(profileUsernameInput.trim());
    }
    setActiveModal(null);
  }

  // Settings modal states
  const [passwordUserInput, setPasswordUserInput] = useState("");
  const [chatPasswordInput, setChatPasswordInput] = useState("");

  // Password change in settings (simulate)
  const [accountPasswordInput, setAccountPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");

  function changePassword() {
    // In this demo, store your app password in localStorage "accountPassword"
    const savedPwd = localStorage.getItem("accountPassword") || "";
    if (!savedPwd) {
      alert("No password set yet for your account. Set one by entering new password.");
      if (newPasswordInput.trim()) {
        localStorage.setItem("accountPassword", newPasswordInput.trim());
        alert("Password saved.");
        setNewPasswordInput("");
      }
      return;
    }
    if (accountPasswordInput !== savedPwd) {
      alert("Current password incorrect");
      return;
    }
    if (!newPasswordInput.trim()) {
      alert("Enter new password");
      return;
    }
    localStorage.setItem("accountPassword", newPasswordInput.trim());
    alert("Password changed.");
    setAccountPasswordInput("");
    setNewPasswordInput("");
  }

  // Account deletion (confirm password)
  function deleteAccount() {
    const savedPwd = localStorage.getItem("accountPassword") || "";
    const entered = prompt("Enter your account password to delete:");
    if (entered !== savedPwd) {
      alert("Incorrect password. Account deletion aborted.");
      return;
    }
    // Clear everything stored by this app
    localStorage.clear();
    alert("Account deleted. Reloading page...");
    window.location.reload();
  }

  return (
    <>
      <style>{`
        :root {
          --bg-color: #f0f0f0;
          --text-color: #333;
          --sidebar-bg: #fff;
          --accent-color: #6200ea;
        }
        [data-theme="dark"] {
          --bg-color: #121212;
          --text-color: #f0f0f0;
          --sidebar-bg: #1e1e1e;
        }
        body,html,#root {
          margin:0; padding:0; height:100%;
          font-family: Arial, sans-serif;
          background-color: var(--bg-color);
          color: var(--text-color);
          overflow: hidden;
        }
        .app-container {
          display: flex;
          height: 100vh;
          overflow: hidden;
        }
        .sidebar {
          width: 250px;
          background-color: var(--sidebar-bg);
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          border-right: 1px solid #ccc;
          transition: transform 0.3s ease;
          transform: translateX(${sidebarVisible ? "0" : "-100%"});
          position: relative;
          z-index: 10;
        }
        .menu-btn {
          position: absolute;
          top: 10px;
          left: 10px;
          font-size: 1.5rem;
          background: none;
          border: none;
          color: var(--text-color);
          cursor: pointer;
          z-index: 20;
        }
        .profile-pic {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          object-fit: cover;
          margin-bottom: 10px;
          border: 2px solid var(--accent-color);
        }
        .username {
          margin: 10px 0;
          font-size: 1.2rem;
          font-weight: bold;
          user-select: none;
        }
        .sidebar button {
          width: 100%;
          margin: 5px 0;
          padding: 10px;
          background-color: var(--accent-color);
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 600;
          user-select: none;
        }
        .content {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          padding: 20px;
          width: 100%;
          padding-left: 3rem;
          position: relative;
          overflow: hidden;
        }
        .chat-room {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 10px;
          overflow: hidden;
          background-color: var(--sidebar-bg);
          box-shadow: 0 0 8px rgba(0,0,0,0.1);
          color: var(--text-color);
        }
        .chat-header {
          display: ${currentChat ? "flex" : "none"};
          align-items: center;
          justify-content: space-between;
          padding: 10px;
          background: var(--sidebar-bg);
          border-bottom: 1px solid #ccc;
          user-select: none;
        }
        .chat-list {
          display: ${currentChat ? "none" : "flex"};
          flex-direction: column;
          gap: 10px;
          margin-bottom: 10px;
          overflow-y: auto;
          flex-grow: 1;
        }
        .chat-list button {
          padding: 10px;
          background-color: var(--sidebar-bg);
          border: 1px solid #ccc;
          border-radius: 5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-color);
          user-select: none;
          transition: background-color 0.2s ease;
        }
        .chat-list button:hover {
          background-color: var(--accent-color);
          color: white;
        }
        .chat-list img {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--accent-color);
        }
        .chat-box {
          flex-grow: 1;
          overflow-y: auto;
          padding-right: 10px;
          display: flex;
          flex-direction: column;
          margin-bottom: 5px;
          scrollbar-width: thin;
          scrollbar-color: var(--accent-color) transparent;
        }
        .chat-box::-webkit-scrollbar {
          width: 8px;
        }
        .chat-box::-webkit-scrollbar-thumb {
          background-color: var(--accent-color);
          border-radius: 4px;
        }
        .message.sent {
          align-self: flex-end;
          background-color: var(--accent-color);
          color: white;
          border-bottom-right-radius: 2px;
        }
        .message.received {
          align-self: flex-start;
          background-color: #333;
          color: white;
          border-bottom-left-radius: 2px;
        }
        .message {
          padding: 10px;
          margin: 8px 0;
          border-radius: 10px;
          max-width: 70%;
          word-wrap: break-word;
          user-select: text;
          font-size: 0.9rem;
        }
        .input-box {
          display: ${currentChat ? "flex" : "none"};
          gap: 10px;
          margin-top: 10px;
          align-items: center;
        }
        .input-box input {
          flex-grow: 1;
          padding: 10px;
          border-radius: 5px;
          border: 1px solid #ccc;
          font-size: 1rem;
          outline: none;
          user-select: text;
        }
        .input-box button {
          background-color: var(--accent-color);
          border: none;
          color: white;
          padding: 10px 15px;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 600;
          user-select: none;
          transition: background-color 0.3s ease;
        }
        .input-box button:hover {
          background-color: #4b00b5;
        }
        .emoji-panel {
          display: none;
          background: #333;
          color: white;
          padding: 10px;
          border-radius: 5px;
          margin-top: 5px;
          user-select: none;
        }
        /* Modal styles */
        .modal {
          display: none;
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.5);
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .modal.active {
          display: flex;
          animation: fadeIn 0.3s ease forwards;
        }
        @keyframes fadeIn {
          from {opacity: 0;}
          to {opacity: 1;}
        }
        .modal-content {
          background-color: var(--sidebar-bg);
          padding: 20px;
          border-radius: 8px;
          width: 320px;
          position: relative;
          box-shadow: 0 0 15px rgba(0,0,0,0.3);
          color: var(--text-color);
          max-height: 80vh;
          overflow-y: auto;
        }
        .modal-content input {
          width: 100%;
          padding: 8px;
          margin: 8px 0;
          border-radius: 5px;
          border: 1px solid #ccc;
          font-size: 1rem;
          outline: none;
        }
        .modal-content label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9rem;
          user-select: none;
        }
        .close-btn {
          position: absolute;
          top: 10px;
          right: 15px;
          font-weight: bold;
          cursor: pointer;
          font-size: 18px;
          user-select: none;
          color: var(--accent-color);
        }
        .modal-content button {
          width: 100%;
          margin-top: 10px;
          padding: 10px;
          background-color: var(--accent-color);
          color: white;
          border: none;
          border-radius: 5px;
          font-weight: 600;
          cursor: pointer;
          user-select: none;
          transition: background-color 0.3s ease;
        }
        .modal-content button:hover {
          background-color: #4b00b5;
        }
        /* Back button */
        #backBtn {
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          color: var(--accent-color);
          font-weight: 600;
          user-select: none;
        }
      `}</style>

      <div className="app-container">
        <button
          className="menu-btn"
          onClick={() => setSidebarVisible((v) => !v)}
          aria-label="Toggle menu"
        >
          &#9776;
        </button>

        <aside className="sidebar" aria-label="Sidebar menu">
          <img
            src={profilePic}
            alt="Profile"
            className="profile-pic"
            draggable={false}
          />
          <div className="username">{username}</div>
          <button onClick={() => setActiveModal("settingsModal")}>Settings</button>
          <button onClick={() => setActiveModal("profileModal")}>Profile</button>
        </aside>

        <main className="content" aria-label="Main chat content">
          <div className="chat-room">
            <div className="chat-header">
              <button id="backBtn" onClick={() => setCurrentChat(null)}>
                &#8592; Back
              </button>
              <div id="chatWith">Chat with {currentChat}</div>
            </div>

            <div className="chat-list" role="list">
              {initialUsers.map((user) => (
                <button
                  key={user.name}
                  onClick={() => openChat(user.name)}
                  data-user={user.name}
                >
                  <img src={user.avatar} alt={`${user.name} avatar`} />
                  {user.name}
                </button>
              ))}
            </div>

            <div className="chat-box" ref={chatBoxRef} role="log" aria-live="polite">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`message ${msg.type}`}
                  aria-label={msg.type === "sent" ? "Sent message" : "Received message"}
                >
                  {msg.text}
                </div>
              ))}
            </div>

            <div className="input-box">
              {/* Emoji button placeholder - can add emoji picker here */}
              {/* <button id="emojiBtn">Emoji</button> */}
              <input
                type="text"
                id="messageInput"
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                aria-label="Type your message"
              />
              <button id="sendBtn" onClick={sendMessage}>
                Send
              </button>
            </div>
          </div>
        </main>

        {/* Settings Modal */}
        <div
          className={`modal ${activeModal === "settingsModal" ? "active" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settingsTitle"
          onClick={(e) => {
            if (e.target.classList.contains("modal")) setActiveModal(null);
          }}
        >
          <div className="modal-content">
            <span className="close-btn" onClick={() => setActiveModal(null)}>
              &times;
            </span>
            <h2 id="settingsTitle">Settings</h2>

            <h3>Set Chat Password</h3>
            <label>
              Friend username:
              <input
                type="text"
                placeholder="Friend's username"
                value={passwordUserInput}
                onChange={(e) => setPasswordUserInput(e.target.value)}
              />
            </label>
            <label>
              Password:
              <input
                type="password"
                placeholder="Chat password"
                value={chatPasswordInput}
                onChange={(e) => setChatPasswordInput(e.target.value)}
              />
            </label>
            <button
              onClick={() => {
                saveChatPassword(passwordUserInput.trim(), chatPasswordInput);
                setPasswordUserInput("");
                setChatPasswordInput("");
              }}
            >
              Save Chat Password
            </button>

            <hr />

            <h3>Change Account Password</h3>
            <label>
              Current Password:
              <input
                type="password"
                placeholder="Current password"
                value={accountPasswordInput}
                onChange={(e) => setAccountPasswordInput(e.target.value)}
              />
            </label>
            <label>
              New Password:
              <input
                type="password"
                placeholder="New password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
              />
            </label>
            <button onClick={changePassword}>Change Password</button>

            <hr />

            <button
              style={{ backgroundColor: "#b00020" }}
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure? This will delete your account and all data."
                  )
                ) {
                  deleteAccount();
                }
              }}
            >
              Delete Account
            </button>

            <hr />

            <label>
              Dark Mode:
              <input
                type="checkbox"
                checked={darkMode}
                onChange={() => setDarkMode((v) => !v)}
              />
            </label>
          </div>
        </div>

        {/* Profile Modal */}
        <div
          className={`modal ${activeModal === "profileModal" ? "active" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="profileTitle"
          onClick={(e) => {
            if (e.target.classList.contains("modal")) setActiveModal(null);
          }}
        >
          <div className="modal-content">
            <span className="close-btn" onClick={() => setActiveModal(null)}>
              &times;
            </span>
            <h2 id="profileTitle">Profile</h2>

            <label>
              Username:
              <input
                type="text"
                value={profileUsernameInput}
                onChange={(e) => setProfileUsernameInput(e.target.value)}
              />
            </label>

            <label>
              Change Profile Picture:
              <input
                type="file"
                accept="image/*"
                onChange={onProfilePicChange}
              />
            </label>

            <button onClick={saveProfile}>Save Profile</button>
          </div>
        </div>
      </div>
    </>
  );
}