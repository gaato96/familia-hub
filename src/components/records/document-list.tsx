"use client";

import { Camera, FileText, ImageIcon, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { relativeDayLabel } from "@/lib/dates";
import { DOCUMENT_CATEGORIES } from "@/lib/records/queries";
import { removeUploadedFile, uploadDocument } from "@/lib/records/upload";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { DocumentCategory, DocumentRow } from "@/types/database";

/**
 * Documentos, con la subida desde la cámara.
 *
 * El visor abre en una pestaña nueva con una URL firmada de 60 segundos en
 * lugar de mostrar el archivo embebido. Es a propósito: un `<img>` con una URL
 * firmada queda en el DOM y en el historial de red, y el archivo puede ser un
 * PDF que el navegador ya sabe mostrar mejor que nosotros.
 */
export function DocumentList({
  documents,
  memberId,
  familyId,
  onChanged,
}: {
  documents: DocumentRow[];
  /** null = documentos de la casa. */
  memberId: string | null;
  familyId: string;
  onChanged: () => void;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  async function open(doc: DocumentRow) {
    setOpening(doc.id);

    const { data, error } = await createClient()
      .storage.from("family-docs")
      .createSignedUrl(doc.storage_path, 60);

    setOpening(null);

    if (error || !data) {
      toast.error("No se pudo abrir el archivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(doc: DocumentRow) {
    // Primero la fila, después el archivo. Al revés, si el delete de la fila
    // falla, queda un documento listado que ya no se puede abrir — peor que
    // un archivo huérfano que nadie ve.
    const { error } = await createClient().from("documents").delete().eq("id", doc.id);

    if (error) {
      toast.error("No se pudo borrar.");
      return;
    }
    await removeUploadedFile(doc.storage_path);
    onChanged();
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => setUploadOpen(true)}>
        <Upload /> Subir un papel
      </Button>

      {documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-8" />}
          title="Todavía no hay papeles"
          hint="Sacale una foto al DNI, al carnet de vacunas o a una receta."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-app bg-surface shadow-card">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                {doc.mime_type.startsWith("image/") ? (
                  <ImageIcon className="size-5" />
                ) : (
                  <FileText className="size-5" />
                )}
              </span>

              <button
                type="button"
                onClick={() => open(doc)}
                disabled={opening === doc.id}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium text-fg">{doc.title}</span>
                <span className="block truncate text-xs text-muted">
                  {labelFor(doc.category)}
                  {doc.expires_on ? (
                    <span className="text-warning">
                      {" "}
                      · vence {relativeDayLabel(doc.expires_on)}
                    </span>
                  ) : null}
                </span>
              </button>

              <button
                type="button"
                onClick={() => remove(doc)}
                aria-label={`Borrar ${doc.title}`}
                className="grid size-9 shrink-0 place-items-center rounded-full text-muted/40 hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent title="Subir un papel">
          <UploadForm
            memberId={memberId}
            familyId={familyId}
            onDone={() => {
              setUploadOpen(false);
              onChanged();
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function UploadForm({
  memberId,
  familyId,
  onDone,
}: {
  memberId: string | null;
  familyId: string;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>(memberId ? "salud" : "vivienda");
  const [expiresOn, setExpiresOn] = useState("");
  const [pending, setPending] = useState(false);

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    setFile(picked);
    // Prellenar el título con el nombre del archivo sin extensión: en la
    // mayoría de los casos alcanza y evita un campo más que llenar.
    if (picked && !title) setTitle(picked.name.replace(/\.[^.]+$/, "").slice(0, 120));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    setPending(true);

    let uploaded: Awaited<ReturnType<typeof uploadDocument>> | null = null;

    try {
      uploaded = await uploadDocument({ file, familyId, memberId });

      const { error } = await createClient().from("documents").insert({
        member_id: memberId,
        title: title.trim() || file.name,
        category,
        storage_path: uploaded.storagePath,
        mime_type: uploaded.mimeType,
        size_bytes: uploaded.sizeBytes,
        expires_on: expiresOn || null,
      });

      if (error) throw new Error(error.message);

      onDone();
    } catch (error) {
      // Si el archivo subió pero la fila falló, se borra el archivo: si no,
      // queda ocupando espacio sin que nadie pueda verlo ni eliminarlo.
      if (uploaded) await removeUploadedFile(uploaded.storagePath);
      toast.error(error instanceof Error ? error.message : "No se pudo subir.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Archivo</Label>
        <label className="flex cursor-pointer items-center gap-3 rounded-app border border-dashed border-border-strong p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
            <Camera className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-fg">
              {file ? file.name : "Sacar foto o elegir archivo"}
            </span>
            <span className="block text-xs text-muted">
              {file
                ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                : "Fotos o PDF, hasta 15 MB"}
            </span>
          </span>
          <input
            type="file"
            // `capture` hace que en el celular abra la cámara directamente en
            // vez del explorador de archivos, que es el caso de uso real.
            capture="environment"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            onChange={pick}
            className="sr-only"
            required
          />
        </label>
      </div>

      <div>
        <Label htmlFor="docTitle">Qué es</Label>
        <Input
          id="docTitle"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="DNI frente"
        />
      </div>

      <fieldset>
        <Label>Categoría</Label>
        <div className="flex flex-wrap gap-1.5">
          {DOCUMENT_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              aria-pressed={category === c.value}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                category === c.value
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border text-muted",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="expiresOn">Vence el (opcional)</Label>
        <Input
          id="expiresOn"
          type="date"
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !file}>
        {pending ? "Subiendo..." : "Guardar"}
      </Button>
    </form>
  );
}

function labelFor(category: DocumentCategory): string {
  return DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}
