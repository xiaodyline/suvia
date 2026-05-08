import { useCallback, useEffect, useState } from "react";
import {
  getFileDownloadUrl,
  listFiles,
  type UploadedFile,
} from "../services/fileApi";

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
