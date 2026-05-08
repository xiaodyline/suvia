import { useState } from "react";
import { Chat } from "./components/Chat";
import { FileList } from "./components/FileList";
import { FileUploadPanel } from "./components/FileUploadPanel";
import { RagSearchPanel } from "./components/RagSearchPanel";
import "./App.css";

function App() {
  const [fileRefreshKey, setFileRefreshKey] = useState(0);

  const refreshFiles = () => {
    setFileRefreshKey((value) => value + 1);
  };

  return (
    <div className="app-shell">
      <aside className="file-sidebar">
        <FileUploadPanel onUploadComplete={refreshFiles} />
        <FileList refreshKey={fileRefreshKey} />
        <RagSearchPanel />
      </aside>
      <Chat />
    </div>
  );
}

export default App
