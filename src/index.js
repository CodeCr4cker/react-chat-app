// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Tailwind or your custom CSS
import { BrowserRouter } from 'react-router-dom';
import { AboutUsProvider } from "./AboutUsContext";
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <AboutUsProvider>
    <App />
  </AboutUsProvider>
);

