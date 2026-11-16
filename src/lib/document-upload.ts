export function uploadFileName(name: string): string {
  const safeName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return safeName || "documento";
}

export function documentUploadBody(
  inscricaoID: string,
  usuarioID: string,
  categoria: string,
  file: File,
): FormData {
  const body = new FormData();
  body.append("inscricaoID", inscricaoID);
  body.append("usuarioID", usuarioID);
  body.append("categorias", categoria);
  // O controller local ainda lê o campo singular.
  body.append("categoria", categoria);
  body.append("file", file, uploadFileName(file.name));
  return body;
}
