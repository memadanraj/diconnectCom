import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Palette, Globe, Eye, Edit, Trash2, CheckCircle } from "lucide-react";

function apiFetch(url: string, init?: RequestInit) {
  const token = localStorage.getItem("commerce_token");
  return fetch(url, { ...init, headers: { ...(init?.headers ?? {}), "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

interface Theme {
  id: string; name: string; isPublished: boolean; publishedAt: string | null;
  draftJson: Record<string, unknown>; publishedJson: Record<string, unknown> | null;
  createdAt: string; updatedAt: string;
}

const SECTION_TYPE_LABELS: Record<string, string> = {
  hero: "Hero Banner", banner: "Banner", product_grid: "Product Grid",
  featured_products: "Featured Products", collections: "Collections",
  faq: "FAQ", testimonials: "Testimonials", blog: "Blog",
  video: "Video", newsletter: "Newsletter", countdown: "Countdown",
  image_gallery: "Image Gallery", carousel: "Carousel",
};

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [newName, setNewName] = useState("");
  const [editJson, setEditJson] = useState("");
  const [editJsonError, setEditJsonError] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/themes");
      if (res.ok) setThemes(await res.json());
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createTheme = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/themes", { method: "POST", body: JSON.stringify({ name: newName }) });
      if (!res.ok) throw new Error();
      toast({ title: "Theme created" });
      setShowCreate(false); setNewName("");
      load();
    } catch { toast({ title: "Failed to create theme", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const openEditTheme = (t: Theme) => {
    setEditingTheme(t);
    setEditJson(JSON.stringify(t.draftJson, null, 2));
    setEditJsonError("");
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!editingTheme) return;
    let parsed: unknown;
    try { parsed = JSON.parse(editJson); setEditJsonError(""); }
    catch { setEditJsonError("Invalid JSON — check syntax"); return; }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/themes/${editingTheme.id}`, { method: "PATCH", body: JSON.stringify({ draftJson: parsed }) });
      if (!res.ok) throw new Error();
      toast({ title: "Theme draft saved" });
      setShowEdit(false);
      load();
    } catch { toast({ title: "Failed to save theme", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const publish = async (id: string) => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/themes/${id}/publish`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "Theme published to storefront" });
      load();
    } catch { toast({ title: "Failed to publish theme", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const deleteTheme = async (t: Theme) => {
    if (t.isPublished) { toast({ title: "Cannot delete the published theme", variant: "destructive" }); return; }
    if (!confirm(`Delete theme "${t.name}"?`)) return;
    await apiFetch(`/api/themes/${t.id}`, { method: "DELETE" });
    toast({ title: "Theme deleted" });
    load();
  };

  const getSections = (theme: Theme) => {
    try { return (theme.draftJson as { sections?: { type: string }[] }).sections ?? []; }
    catch { return []; }
  };

  const getTokens = (theme: Theme) => {
    try { return (theme.draftJson as { tokens?: Record<string, string> }).tokens ?? {}; }
    catch { return {}; }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Store Themes</h1>
          <p className="text-sm text-muted-foreground">Design and publish your storefront theme</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Theme</Button>
      </div>

      {/* Theme Cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-48 animate-pulse bg-muted/20" />)}
        </div>
      ) : themes.length === 0 ? (
        <div className="py-20 text-center">
          <Palette className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No themes yet. Create one to design your storefront.</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />Create First Theme</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((t) => {
            const sections = getSections(t);
            const tokens = getTokens(t);
            return (
              <Card key={t.id} className={`relative flex flex-col ${t.isPublished ? "ring-2 ring-primary/40 border-primary/30" : ""}`}>
                {t.isPublished && (
                  <div className="absolute -top-2.5 left-4">
                    <span className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      <Globe className="h-3 w-3" />Live
                    </span>
                  </div>
                )}
                <CardHeader className="pt-6 pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <Badge variant="outline" className="text-xs">{t.isPublished ? "Published" : "Draft"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {/* Color preview */}
                  {tokens.primaryColor && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-4 w-4 rounded border" style={{ backgroundColor: tokens.primaryColor as string }} />
                      <span>Primary: {tokens.primaryColor as string}</span>
                      {tokens.secondaryColor && (
                        <>
                          <div className="h-4 w-4 rounded border" style={{ backgroundColor: tokens.secondaryColor as string }} />
                          <span>{tokens.secondaryColor as string}</span>
                        </>
                      )}
                    </div>
                  )}
                  {/* Sections */}
                  <div className="flex flex-wrap gap-1">
                    {sections.slice(0, 5).map((s, i) => (
                      <span key={i} className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {SECTION_TYPE_LABELS[s.type] ?? s.type}
                      </span>
                    ))}
                    {sections.length > 5 && <span className="text-xs text-muted-foreground">+{sections.length - 5} more</span>}
                    {sections.length === 0 && <span className="text-xs text-muted-foreground">No sections configured</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">Updated {new Date(t.updatedAt).toLocaleDateString()}</p>
                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => openEditTheme(t)}>
                      <Edit className="h-3.5 w-3.5" />Edit JSON
                    </Button>
                    {!t.isPublished ? (
                      <Button size="sm" className="flex-1 gap-1.5" onClick={() => publish(t.id)} disabled={saving}>
                        <Eye className="h-3.5 w-3.5" />Publish
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" className="flex-1 gap-1.5" disabled>
                        <CheckCircle className="h-3.5 w-3.5" />Live
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive px-2" onClick={() => deleteTheme(t)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Section Types Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Available Section Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SECTION_TYPE_LABELS).map(([key, label]) => (
              <span key={key} className="inline-flex items-center rounded border bg-card px-2.5 py-0.5 text-xs">
                <code className="text-primary mr-1.5">{key}</code>
                <span className="text-muted-foreground">{label}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Theme</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Theme Name *</Label>
              <Input placeholder="e.g. Summer Collection, Default Theme" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">A default theme structure will be pre-populated for you to customise.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createTheme} disabled={saving || !newName.trim()}>{saving ? "Creating…" : "Create Theme"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit JSON Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Theme JSON — {editingTheme?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Edit the theme JSON directly. Supports <code>tokens</code>, <code>sections</code>, and <code>settings</code> keys.</p>
            <Textarea
              value={editJson}
              onChange={(e) => { setEditJson(e.target.value); setEditJsonError(""); }}
              className="font-mono text-xs min-h-[400px]"
            />
            {editJsonError && <p className="text-xs text-destructive">{editJsonError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save Draft"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
