import { useState } from "react";
import { uploadFile } from "../services/fileApi";

type UploadState = "idle" | "uploading" | "success" | "error";

type FileUploadPanelProps = {
  onUploadComplete: () => void;
};

const allowedExtensions = new Set(["pdf", "md", "markdown"]);

const getExtension = (filename: string) => {
  return filename.split(".").pop()?.toLowerCase() ?? "";
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Upload failed";
};

export function FileUploadPanel({ onUploadComplete }: FileUploadPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("");
  const [inputKey, setInputKey] = useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    setMessage("");
    setUploadState("idle");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!allowedExtensions.has(getExtension(file.name))) {
      setSelectedFile(null);
      setUploadState("error");
      setMessage("Only PDF, MD, and Markdown files are allowed.");
      event.currentTarget.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || uploadState === "uploading") {
      return;
    }

    setUploadState("uploading");
    setMessage("Uploading...");

    try {
      await uploadFile(selectedFile);
      setSelectedFile(null);
      setInputKey((value) => value + 1);
      setUploadState("success");
      setMessage("Upload complete.");
      onUploadComplete();
    } catch (error) {
      setUploadState("error");
      setMessage(getErrorMessage(error));
    }
  };

  return (
    <section className="file-panel file-upload-panel">
      <div className="file-panel-header">
        <h2>Files</h2>
        <span className="file-pill">RAG</span>
      </div>

      <label className="file-picker">
        <input
          key={inputKey}
          type="file"
          accept=".pdf,.md,.markdown,application/pdf,text/markdown,text/x-markdown,text/plain"
          onChange={handleFileChange}
          disabled={uploadState === "uploading"}
        />
        <span>{selectedFile ? selectedFile.name : "Choose file"}</span>
      </label>

      <div className="file-upload-actions">
        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || uploadState === "uploading"}
        >
          {uploadState === "uploading" ? "Uploading" : "Upload"}
        </button>
      </div>

      {message ? (
        <p className={`file-upload-message file-upload-message-${uploadState}`}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
