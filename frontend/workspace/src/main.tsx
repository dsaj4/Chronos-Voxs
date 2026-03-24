import React from "react";
import ReactDOM from "react-dom/client";
import { WorkspaceApp } from "./app/WorkspaceApp";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <WorkspaceApp />
  </React.StrictMode>
);
