import { useCallback, useEffect, useState } from "react";
import {
  getFileDownloadUrl,
  listFiles,
  type UploadedFile,
} from "../services/fileApi";
import { getRagFileStatus, startRagIndex, type RagIndexTask } from "../services/ragApi";

type FileListProps = {
  refreshKey: number;
};

const formatSize = (sizeBytes: number) => {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (value: string) => {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Failed to load files";
};

export function FileList({ refreshKey }: FileListProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      setFiles(await listFiles());
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles, refreshKey]);

  useEffect(() => {
    if (!files.some((file) => file.status === "indexing")) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadFiles();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [files, loadFiles]);

  const handleBuildIndex = async (file: UploadedFile) => {
    setActiveFileId(file.id);
    setActionMessage("");

    try {
      const result = await startRagIndex(file.id);
      setActionMessage(formatTaskMessage(result.task));
      await loadFiles();
    } catch (error) {
      setActionMessage(getErrorMessage(error));
    } finally {
      setActiveFileId(null);
    }
  };

  const handleCheckStatus = async (file: UploadedFile) => {
    setActiveFileId(file.id);
    setActionMessage("");

    try {
      const result = await getRagFileStatus(file.id);
      setActionMessage(
        result.task ? formatTaskMessage(result.task) : "No index task found."
      );
      await loadFiles();
    } catch (error) {
      setActionMessage(getErrorMessage(error));
    } finally {
      setActiveFileId(null);
    }
  };

  return (
    <section className="file-panel file-list-panel">
      <div className="file-panel-header">
        <h2>Uploaded</h2>
        <button type="button" className="file-refresh-button" onClick={loadFiles}>
          Refresh
        </button>
      </div>

      {isLoading ? <p className="file-muted">Loading...</p> : null}
      {errorMessage ? <p className="file-error">{errorMessage}</p> : null}
      {actionMessage ? <p className="file-action-message">{actionMessage}</p> : null}

      {!isLoading && !errorMessage && files.length === 0 ? (
        <p className="file-muted">No files yet.</p>
      ) : null}

      {files.length > 0 ? (
        <div className="file-table-wrapper">
          <table className="file-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Status</th>
                <th>Uploaded</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id}>
                  <td className="file-name-cell" title={file.originalName}>
                    {file.originalName}
                  </td>
                  <td>{file.fileExt.toUpperCase()}</td>
                  <td>{formatSize(file.sizeBytes)}</td>
                  <td>
                    <span className={`file-status file-status-${file.status}`}>
                      {file.status}
                    </span>
                  </td>
                  <td>{formatDate(file.createdAt)}</td>
                  <td>
                    <a className="file-download-link" href={getFileDownloadUrl(file.id)}>
                      Download
                    </a>
                    <button
                      type="button"
                      className="file-inline-button"
                      onClick={() => void handleBuildIndex(file)}
                      disabled={activeFileId === file.id || file.status === "indexing"}
                    >
                      {getIndexButtonText(file)}
                    </button>
                    <button
                      type="button"
                      className="file-inline-button file-inline-button-secondary"
                      onClick={() => void handleCheckStatus(file)}
                      disabled={activeFileId === file.id}
                    >
                      Status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

const getIndexButtonText = (file: UploadedFile) => {
  if (file.status === "indexing") {
    return "Indexing";
  }

  return file.status === "ready" || file.status === "failed"
    ? "Rebuild"
    : "Build";
};

const formatTaskMessage = (task: RagIndexTask) => {
  const base = `Index ${task.status}. Chunks: ${task.chunkCount}.`;

  if (task.status === "failed" && task.errorMessage) {
    return `${base} ${task.errorMessage}`;
  }

  return base;
};
