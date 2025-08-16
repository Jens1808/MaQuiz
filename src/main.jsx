import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // Falls du Tailwind oder eigenes CSS nutzt
import { createClient } from "@supabase/supabase-js";

// Supabase Setup
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
