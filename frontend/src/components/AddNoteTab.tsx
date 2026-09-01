import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { Loader2, Save, AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { addNote, type AddNoteResponse } from "@/lib/api";

export function AddNoteTab() {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<AddNoteResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setContent(String(reader.result ?? ""));
      setTitle((t) => (t.trim() === "" ? file.name.replace(/\.(md|txt)$/i, "") : t));
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || !title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const res = await addNote(title.trim(), content, folder.trim() || undefined);
      if (res.error) throw new Error(res.error);
      setSaved(res);
      setTitle("");
      setFolder("");
      setContent("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="note-title">Title</Label>
          <Input
            id="note-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekly sync notes"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="note-folder">Folder (optional)</Label>
          <Input
            id="note-folder"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="meetings"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="note-file" className="flex items-center gap-2">
            <Upload className="size-3.5 text-muted-foreground" /> Or upload a file (.md or .txt)
          </Label>
          <Input
            id="note-file"
            ref={fileRef}
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
            onChange={onFile}
            className="cursor-pointer file:mr-3 file:text-muted-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="note-content">Content</Label>
          <Textarea
            id="note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note, or upload a file above…"
            className="min-h-64 leading-relaxed"
          />
        </div>

        <Button type="submit" disabled={saving || !title.trim() || !content.trim()} className="h-11">
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving
            </>
          ) : (
            <>
              <Save className="size-4" /> Save Note
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-foreground">{error}</p>
        </div>
      )}

      {saved && (
        <div className="space-y-3 rounded-xl border border-success/40 bg-success/10 p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" /> Saved as {saved.note.path} — {saved.chunksCreated}{" "}
            chunks indexed
          </p>
          {saved.note.tags?.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Tags</span>
              {saved.note.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {saved.note.links?.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Links</span>
              {saved.note.links.map((l) => (
                <span
                  key={l}
                  className="rounded-full border border-info/40 bg-info/10 px-2.5 py-0.5 text-xs text-info"
                >
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
