"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; username: string | null; role: "admin" | "member" };
type Item = {
  id: string; title: string; description: string | null; kind: "mod" | "skin";
  source: "official" | "community"; status: "pending" | "approved";
  file_name: string; storage_path: string; owner_id: string;
  created_at: string;
};

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<"all" | "mod" | "skin" | "pending">("all");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"mod" | "skin">("mod");
  const [file, setFile] = useState<File | null>(null);
  const [uploadSource, setUploadSource] = useState<"official" | "community">("community");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const configured = !!supabase;

  async function loadItems(currentProfile: Profile | null) {
    if (!supabase) return;
    let query = supabase.from("items").select("*").order("created_at", { ascending: false });
    if (currentProfile?.role !== "admin") query = query.eq("status", "approved");
    const { data, error } = await query;
    if (error) setMessage(error.message);
    else setItems((data || []) as Item[]);
  }

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const { data: p } = await supabase!.from("profiles").select("*").eq("id", data.session.user.id).single();
        setProfile(p as Profile);
        await loadItems(p as Profile);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        const { data: p } = await supabase!.from("profiles").select("*").eq("id", nextSession.user.id).single();
        setProfile(p as Profile);
        await loadItems(p as Profile);
      } else { setProfile(null); setItems([]); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const visibleItems = useMemo(() => items.filter(item => {
    if (tab === "pending") return profile?.role === "admin" && item.status === "pending";
    if (tab === "mod" || tab === "skin") return item.kind === tab && item.status === "approved";
    return item.status === "approved";
  }), [items, tab, profile]);

  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage("");
    const result = authMode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { username } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    setMessage(result.error?.message || (authMode === "signup"
      ? "Pendaftaran berhasil. Jika verifikasi email aktif, cek email untuk mengonfirmasi akun."
      : "Login berhasil."));
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session || !profile || !file) return;
    if (uploadSource === "official" && profile.role !== "admin") {
      setMessage("Hanya admin yang boleh mengunggah karya resmi."); return;
    }
    setBusy(true); setMessage("");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${session.user.id}/${Date.now()}-${safeName}`;
    const { error: storageError } = await supabase.storage.from("minecraft-files").upload(path, file, { upsert: false });
    if (storageError) { setBusy(false); setMessage(storageError.message); return; }
    const status = uploadSource === "official" ? "approved" : "pending";
    const { error } = await supabase.from("items").insert({
      title, description, kind, source: uploadSource, status,
      file_name: file.name, storage_path: path, owner_id: session.user.id
    });
    setBusy(false);
    if (error) {
      await supabase.storage.from("minecraft-files").remove([path]);
      setMessage(error.message);
    } else {
      setTitle(""); setDescription(""); setFile(null);
      setMessage(status === "pending" ? "Upload terkirim dan menunggu persetujuan admin." : "Karya resmi berhasil diterbitkan.");
      await loadItems(profile);
    }
  }

  async function approve(id: string) {
    if (!supabase || profile?.role !== "admin") return;
    const { error } = await supabase.from("items").update({ status: "approved" }).eq("id", id);
    setMessage(error?.message || "Upload komunitas disetujui.");
    await loadItems(profile);
  }

  async function removeItem(item: Item) {
    if (!supabase) return;
    const { error } = await supabase.from("items").delete().eq("id", item.id);
    if (!error) await supabase.storage.from("minecraft-files").remove([item.storage_path]);
    setMessage(error?.message || "Upload dihapus.");
    await loadItems(profile);
  }

  async function download(item: Item) {
    if (!supabase) return;
    const { data } = supabase.storage.from("minecraft-files").getPublicUrl(item.storage_path);
    window.open(data.publicUrl, "_blank", "noopener,noreferrer");
  }

  if (!configured) return <main className="setup"><div className="panel"><div className="logo">⛏</div><h1>Skin Minecraft and Mods</h1><p>Website sudah disiapkan. Hubungkan Supabase untuk mengaktifkan akun, upload, dan download.</p><ol><li>Buat project gratis di Supabase.</li><li>Jalankan SQL dari file <code>supabase/schema.sql</code>.</li><li>Salin <code>.env.example</code> menjadi <code>.env.local</code> dan isi URL serta anon key Supabase.</li><li>Jalankan <code>npm install</code>, lalu <code>npm run dev</code>.</li></ol></div></main>;

  if (!session) return <main className="auth"><form className="authCard" onSubmit={authenticate}>
    <div className="logo">⛏</div><p className="eyebrow">MINECRAFT CREATOR COMMUNITY</p>
    <h1>{authMode === "login" ? "Selamat datang kembali!" : "Gabung komunitas!"}</h1>
    <p className="muted">Login diperlukan untuk melihat dan mengunduh koleksi komunitas.</p>
    {authMode === "signup" && <input placeholder="Nama pengguna" value={username} onChange={e => setUsername(e.target.value)} required />}
    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
    <input type="password" placeholder="Password (minimal 6 karakter)" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
    <button disabled={busy}>{busy ? "Memproses..." : authMode === "login" ? "Login" : "Buat akun"}</button>
    <p className="switch">{authMode === "login" ? "Belum punya akun?" : "Sudah punya akun?"} <a onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>{authMode === "login" ? "Daftar" : "Login"}</a></p>
    {message && <p className="notice">{message}</p>}
  </form></main>;

  return <main>
    <header className="topbar"><a className="brand" href="#"><span className="brandIcon">⛏</span><span>SKIN MINECRAFT <b>AND MODS</b></span></a>
      <div className="account"><span>{profile?.username || session.user.email}</span><span className="role">{profile?.role === "admin" ? "ADMIN" : "MEMBER"}</span><button className="small ghost" onClick={() => supabase?.auth.signOut()}>Keluar</button></div>
    </header>
    <section className="hero"><div className="heroText"><span className="eyebrow">CREATORS • PLAYERS • COMMUNITY</span><h1>Temukan karya<br/><em>kreator Minecraft.</em></h1><p>Jelajahi mod, add-on, dan skin. Bagikan karyamu dan bangun komunitas bersama.</p><a className="heroButton" href="#upload">Bagikan karya <span>↗</span></a></div><div className="heroArt"><div className="cube">▦</div><div className="floating">MINECRAFT<br/>BEDROCK</div></div></section>
    <section className="content">
      <div className="sectionHead"><div><span className="eyebrow">THE COLLECTION</span><h2>Jelajahi koleksi</h2></div><span className="count">{items.filter(i => i.status === "approved").length} KARYA</span></div>
      <nav className="tabs"><button className={tab==="all"?"active":""} onClick={()=>setTab("all")}>Semua</button><button className={tab==="mod"?"active":""} onClick={()=>setTab("mod")}>Mods</button><button className={tab==="skin"?"active":""} onClick={()=>setTab("skin")}>Skins</button>{profile?.role==="admin" && <button className={tab==="pending"?"active":""} onClick={()=>setTab("pending")}>Menunggu persetujuan</button>}</nav>
      {visibleItems.length === 0 ? <div className="empty"><div>◇</div><h3>Belum ada karya di sini</h3><p>Jadilah yang pertama membagikan karya Minecraft.</p></div> : <div className="cards">{visibleItems.map(item=><article className="item" key={item.id}><div className={`itemVisual ${item.kind}`}><span>{item.kind==="mod"?"⬡":"◈"}</span><small>{item.kind.toUpperCase()}</small></div><div className="itemBody"><div className="itemMeta"><span>{item.source==="official"?"✦ OFFICIAL":"COMMUNITY"}</span>{item.status==="pending"&&<b>MENUNGGU</b>}</div><h3>{item.title}</h3><p>{item.description || "Karya komunitas Minecraft."}</p><div className="itemFoot"><span>{item.file_name}</span><div>{item.status==="approved"&&<button className="download" onClick={()=>download(item)}>Download ↓</button>}{profile?.role==="admin"&&item.status==="pending"&&<button className="download" onClick={()=>approve(item.id)}>Setujui</button>}{(profile?.role==="admin"||item.owner_id===session.user.id)&&<button className="delete" onClick={()=>removeItem(item)} title="Hapus">×</button>}</div></div></div></article>)}</div>}
    </section>
    <section className="uploadSection" id="upload"><div><span className="eyebrow">SHARE YOUR CREATION</span><h2>Bagikan karya kamu.</h2><p>Upload mod atau skin Minecraft untuk komunitas.</p><div className="rules"><b>Aturan upload</b><span>• Upload komunitas akan diperiksa admin.</span><span>• Upload resmi hanya bisa dilakukan admin.</span><span>• Pastikan kamu memiliki hak untuk membagikan file.</span></div></div>
      <form className="uploadCard" onSubmit={upload}><h3>Upload karya baru</h3><label>Nama karya<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Contoh: Ninja Clone Add-on" required /></label><label>Deskripsi<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ceritakan tentang karya ini..." rows={3}/></label><div className="two"><label>Kategori<select value={kind} onChange={e=>setKind(e.target.value as any)}><option value="mod">Mod / Add-on</option><option value="skin">Skin</option></select></label><label>Jenis upload<select value={uploadSource} onChange={e=>setUploadSource(e.target.value as any)}><option value="community">Komunitas</option>{profile?.role==="admin"&&<option value="official">Resmi (Admin)</option>}</select></label></div><label className="filePick">Pilih file Minecraft<input type="file" accept=".mcaddon,.mcpack,.mcworld,.mcstructure,.zip,.png,.jpg,.jpeg" onChange={e=>setFile(e.target.files?.[0] || null)} required/><span>{file ? file.name : "Pilih .mcaddon, .mcpack, .mcworld, .png..."}</span></label><button disabled={busy}>{busy?"Mengunggah...":"Kirim karya →"}</button></form>
    </section>
    <footer><span>⛏ SKIN MINECRAFT AND MODS</span><span>Dibuat untuk para kreator Minecraft.</span></footer>
    {message&&<div className="toast" onClick={()=>setMessage("")}>{message}　×</div>}
  </main>;
}
