"use client";

import { useEffect, useState } from "react";
import type { EnrollmentDocument } from "../lib/enrollment-review";
import ReviewDialog from "./ReviewDialog";

function storageUrl(path: string) {
  try {
    const url = new URL(path);
    if (url.protocol === "https:" || url.protocol === "http:") return path;
  } catch {
    return null;
  }
  return null;
}

export default function EnrollmentDocumentViewer({ document, onClose }: {
  document: EnrollmentDocument;
  onClose: () => void;
}) {
  const url = storageUrl(document.caminho);
  const isPdf = document.tipoMime === "application/pdf";
  const isImage = ["image/jpeg", "image/jpg", "image/png"].includes(document.tipoMime);
  const [pdf, setPdf] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isPdf || !url) return;
    const controller = new AbortController();
    let previewUrl: string | undefined;

    async function loadPdf(path: string) {
      try {
        const response = await fetch(path, { signal: controller.signal, credentials: "omit" });
        if (!response.ok) throw new Error("Arquivo indisponível");
        const file = await response.blob();
        if (!(await file.slice(0, 5).text()).startsWith("%PDF-")) throw new Error("PDF inválido");
        if (controller.signal.aborted) return;
        previewUrl = URL.createObjectURL(file.slice(0, file.size, "application/pdf"));
        setPdf(previewUrl);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }

    void loadPdf(url);
    return () => {
      controller.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [isPdf, url]);

  return (
    <ReviewDialog className="enrollment-review-document-dialog" title={document.nomeOriginal} onClose={onClose}>
      <div className="enrollment-review-document-content">
        {(!url || failed) && <p role="alert">Não foi possível carregar o arquivo.</p>}
        {url && !failed && (
          <>
            {isPdf && (pdf ? <iframe className="enrollment-review-pdf" title={document.nomeOriginal} src={pdf}
              onError={() => setFailed(true)} /> : <p role="status">Carregando documento…</p>)}
            {isImage && (
              // The browser loads the storage URL directly, including any signature issued by the API.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="enrollment-review-image" src={url} alt={document.nomeOriginal} onError={() => setFailed(true)} />
            )}
            {!isPdf && !isImage && <p>Abra o arquivo em outra aba para visualizar este formato.</p>}
          </>
        )}
      </div>
      <div className="profile-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
        {url && <a className="btn" href={url} target="_blank" rel="noopener noreferrer">Abrir em outra aba</a>}
      </div>
    </ReviewDialog>
  );
}
