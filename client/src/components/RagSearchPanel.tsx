import { useState } from "react";
import { queryRag, type RagQueryMatch } from "../services/ragApi";

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Search failed";
};

const formatSimilarity = (value: number) => {
  return `${Math.round(value * 1000) / 10}%`;
};

const getSnippet = (value: string) => {
  return value.length > 420 ? `${value.slice(0, 417)}...` : value;
};

export function RagSearchPanel() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(DEFAULT_TOP_K);
  const [matches, setMatches] = useState<RagQueryMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = query.trim();

    if (!text || isSearching) {
      return;
    }

    setIsSearching(true);
    setErrorMessage("");

    try {
      const result = await queryRag({
        query: text,
        topK,
      });

      setMatches(result.matches);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setMatches([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className="file-panel rag-search-panel">
      <div className="file-panel-header">
        <h2>RAG Search</h2>
        <span className="file-pill">Test</span>
      </div>

      <form className="rag-search-form" onSubmit={handleSubmit}>
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Query indexed files"
          maxLength={1000}
          rows={3}
        />
        <label className="rag-topk-field">
          <span>TopK</span>
          <input
            type="number"
            min={1}
            max={MAX_TOP_K}
            value={topK}
            onChange={(event) =>
              setTopK(Math.min(MAX_TOP_K, Math.max(1, Number(event.target.value))))
            }
          />
        </label>
        <button type="submit" disabled={!query.trim() || isSearching}>
          {isSearching ? "Searching" : "Search"}
        </button>
      </form>

      {errorMessage ? <p className="file-error">{errorMessage}</p> : null}

      <div className="rag-results">
        {matches.map((match) => (
          <article className="rag-result" key={match.id}>
            <div className="rag-result-header">
              <strong title={match.fileName ?? match.fileId}>
                {match.fileName ?? match.fileId}
              </strong>
              <span>{formatSimilarity(match.similarity)}</span>
            </div>
            <div className="rag-result-meta">
              <span>chunk {match.chunkIndex}</span>
              {match.sectionTitle ? <span>{match.sectionTitle}</span> : null}
              {match.page ? <span>page {match.page}</span> : null}
            </div>
            <p>{getSnippet(match.content)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

