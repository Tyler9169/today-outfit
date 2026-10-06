"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Plus, Shirt, Trash2, Upload } from "lucide-react";
import { Photo } from "@/components/wardrobe-photo";
import { BackupTools, OutfitTools } from "@/components/wardrobe-tools";
import { OfflineStatus } from "@/components/offline-status";
import { recognizePhoto } from "@/lib/recognize-photo";
import { categories, deleteClothing, getClothes, saveClothing, type Category, type Clothing } from "@/lib/wardrobe";

export default function Home() {
  const [anchor, setAnchor] = useState<Clothing | null>(null);
  const localVision = false;
  const [items, setItems] = useState<Clothing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [category, setCategory] = useState<Category | "">("");
  const [color, setColor] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionMessage, setRecognitionMessage] = useState("");
  const recognitionController = useRef<AbortController | null>(null);
  const photoVersion = useRef(0);
  const edited = useRef({ category: false, color: false });

  useEffect(() => () => { recognitionController.current?.abort(); }, []);

  async function identify(image: HTMLImageElement, version: number) {
    recognitionController.current?.abort();
    const controller = new AbortController();
    recognitionController.current = controller;
    setRecognizing(true);
    setRecognitionMessage("正在识别类别和颜色…你也可以直接手动填写。");
    try {
      const result = await recognizePhoto(image, controller.signal);
      if (controller.signal.aborted || version !== photoVersion.current) return;
      if (!edited.current.category && result.category) setCategory(result.category);
      if (!edited.current.color && result.color) setColor(result.color);
      setRecognitionMessage(result.category && result.color
        ? "识别完成，请核对类别和颜色；你的手动修改已保留。"
        : "部分信息无法确定，请手动补全类别和颜色。");
    } catch (error) {
      if (controller.signal.aborted || version !== photoVersion.current) return;
      setRecognitionMessage(error instanceof Error && error.name !== "TimeoutError"
        ? error.message : "识别超时，请重试或手动填写。");
    } finally {
      if (version === photoVersion.current && !controller.signal.aborted) setRecognizing(false);
    }
  }

  async function retryRecognition() {
    if (!photo || recognizing) return;
    const version = photoVersion.current;
    const url = URL.createObjectURL(photo);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      if (version === photoVersion.current) await identify(image, version);
    } catch { if (version === photoVersion.current) setRecognitionMessage("无法读取照片，请重新上传。"); }
    finally { URL.revokeObjectURL(url); }
  }

  async function load() {
    setLoading(true);
    setLoadError("");
    try { setItems(await getClothes()); }
    catch { setLoadError("衣橱读取失败，请检查浏览器是否允许本地存储，然后重试。"); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    getClothes()
      .then((stored) => { if (active) setItems(stored); })
      .catch(() => { if (active) setLoadError("衣橱读取失败，请检查浏览器是否允许本地存储，然后重试。"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function selectPhoto(file: File | undefined) {
    if (!file) return;
    const version = ++photoVersion.current;
    recognitionController.current?.abort();
    setRecognizing(false);
    setRecognitionMessage("");
    setCategory("");
    setColor("");
    edited.current = { category: false, color: false };
    setError("");
    setNotice("");
    setPhoto(null);
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件。");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("照片不能超过 20 MB，请选择较小的照片。");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      if (version === photoVersion.current) {
        setPhoto(file);
        if (localVision) void identify(image, version);
      }
    } catch {
      if (fileInput.current?.files?.[0] === file) {
        setError("这张照片无法预览，请换用 JPG、PNG 或 WebP 图片。");
        fileInput.current.value = "";
      }
    } finally { URL.revokeObjectURL(url); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    setError("");
    setNotice("");
    if (!photo || !category || !color.trim()) {
      setError("请上传可预览的照片，并填写类别和颜色。");
      return;
    }
    ++photoVersion.current;
    recognitionController.current?.abort();
    setRecognizing(false);
    setRecognitionMessage("");
    lock.current = true;
    setSaving(true);
    try {
      const item: Clothing = { id: crypto.randomUUID(), photo, category, color: color.trim(), createdAt: Date.now() };
      await saveClothing(item);
      setItems((current) => [item, ...current]);
      setPhoto(null);
      setCategory("");
      setColor("");
      if (fileInput.current) fileInput.current.value = "";
      setNotice("已保存到你的衣橱。");
    } catch {
      setError("保存失败，可能是本地存储空间不足或浏览器限制。照片和填写内容已保留，请重试。");
    } finally { lock.current = false; setSaving(false); }
  }

  async function remove(item: Clothing) {
    if (lock.current) return;
    lock.current = true;
    setDeleting(item.id);
    setNotice("");
    setError("");
    try {
      await deleteClothing(item.id);
      if (anchor?.id === item.id) setAnchor(null);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotice(`已删除${item.color}${item.category}。`);
    } catch { setError("删除失败，衣服仍保留在衣橱中，请重试。"); }
    finally { lock.current = false; setDeleting(null); }
  }

  return (
    <main className="wardrobe min-h-screen bg-[#f7f7f2] text-[#283c35]">
      <header className="border-b border-[#dce2d8] bg-[#fcfcf8]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-5 sm:px-8">
          <span className="rounded-xl bg-[#e8eddf] p-2.5"><Shirt size={22} aria-hidden="true" /></span>
          <span className="text-lg font-semibold tracking-wide">我的衣橱</span>
          <span className="ml-auto text-xs text-[#647166]">每一件，都好好收藏</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <p className="mb-3 text-xs font-semibold tracking-[.2em] text-[#718366]">MY WARDROBE</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">把喜欢的衣服，收进衣橱。</h1>
        <p className="mt-4 text-sm leading-6 text-[#647166]">拍一张照片，记下类别与颜色，让每一件衣服都有自己的位置。</p>
        <OfflineStatus />
        {!loading && !loadError && <><OutfitTools items={items} anchor={anchor} /><BackupTools items={items} reload={load} disabled={saving || deleting !== null} /></>}
        <div className="mt-9 grid items-start gap-8 lg:grid-cols-[340px_1fr]">
          <section className="rounded-2xl border border-[#dce2d8] bg-[#fcfcf8] p-5 sm:p-6" aria-labelledby="add-title">
            <h2 id="add-title" className="flex items-center gap-2 text-lg font-semibold"><Plus size={20} aria-hidden="true" />添加衣服</h2>
            <p className="mt-2 text-xs text-[#647166]">照片、类别和颜色均为必填</p>
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <p role="status" aria-live="polite" className="mt-4 text-sm text-[#405a35]">{notice}</p>
            <form onSubmit={save} noValidate className="mt-5 space-y-5">
              <fieldset disabled={saving} className="space-y-5">
                <div>
                  <label htmlFor="photo" className="mb-2 block text-sm font-medium">衣服照片</label>
                  <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#aab99e] bg-[#f0f2e9] focus-within:ring-2 focus-within:ring-[#526d43]">
                    {photo ? <Photo photo={photo} alt="待保存的衣服照片" className="h-full w-full object-contain" /> : <div className="text-center"><Camera className="mx-auto mb-3 text-[#718366]" size={30} aria-hidden="true" /><p className="text-sm font-medium">点击上传衣服照片</p><p className="mt-2 text-xs text-[#647166]">支持常见图片格式，最大 20 MB</p></div>}
                    <input ref={fileInput} id="photo" type="file" accept="image/*" required aria-label={photo ? "更换衣服照片" : "上传衣服照片"} onChange={(event) => void selectPhoto(event.target.files?.[0])} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    {photo && <span className="pointer-events-none absolute bottom-3 rounded-full bg-white/95 px-3 py-1.5 text-xs shadow-sm">点击更换照片</span>}
                  </div>
                </div>
                <div className="text-xs leading-5 text-[#647166]">
                  <p>{localVision ? "照片仅由这台 Mac 的本地模型识别，不发送到云端。" : "手动填写类别和颜色，无需联网。"}</p>
                  <p role="status" aria-live="polite" className="mt-2">{recognitionMessage}</p>
                  {photo && localVision && <button type="button" disabled={recognizing} onClick={() => void retryRecognition()} className="mt-1 min-h-11 underline disabled:opacity-50">{recognizing ? "正在识别…" : "重新识别"}</button>}
                </div>
                <div><label htmlFor="category" className="mb-2 block text-sm font-medium">类别</label><select id="category" value={category} required onChange={(event) => { edited.current.category = true; setCategory(event.target.value as Category | ""); }} className="wardrobe-input"><option value="">选择衣服类别</option>{categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></div>
                <div><label htmlFor="color" className="mb-2 block text-sm font-medium">颜色</label><input id="color" value={color} onChange={(event) => { edited.current.color = true; setColor(event.target.value); }} maxLength={30} required placeholder="例如：米白色、深蓝色" className="wardrobe-input" /></div>
              </fieldset>
              <button disabled={saving || loading || Boolean(loadError) || deleting !== null} type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#405a35] px-4 font-medium text-white transition hover:bg-[#31482a] disabled:cursor-not-allowed disabled:opacity-50"><Upload size={17} aria-hidden="true" />{saving ? "正在保存…" : "保存到衣橱"}</button>
            </form>
            <p className="mt-4 text-xs leading-5 text-[#647166]">衣橱保存在当前浏览器，刷新后仍可查看。照片不发送至云端；清除浏览器数据会移除本地衣橱。</p>
          </section>
          <section aria-labelledby="list-title" aria-busy={loading}>
            <div className="mb-5 flex items-center justify-between"><h2 id="list-title" className="text-xl font-semibold">我的收藏</h2><span className="rounded-full bg-[#e8eddf] px-3 py-1 text-sm">{items.length} 件衣服</span></div>
            {loading ? <p role="status" className="py-20 text-center text-[#647166]">正在打开衣橱…</p> : loadError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p>{loadError}</p><button onClick={() => void load()} className="mt-3 min-h-11 underline">重新读取</button></div> : items.length === 0 ? <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-[#cdd7c4] px-6 py-12 text-center"><span className="mb-5 rounded-full bg-[#e8eddf] p-5"><Shirt size={36} strokeWidth={1.3} aria-hidden="true" /></span><h3 className="text-lg font-medium">衣橱空空，期待第一件收藏</h3><p className="mt-3 text-sm leading-6 text-[#647166]">从一件喜欢的衣服开始，<br />上传照片，慢慢整理属于你的衣橱。</p><button onClick={() => fileInput.current?.click()} className="mt-5 min-h-11 rounded-lg px-4 text-sm font-medium underline underline-offset-4">添加第一件衣服</button></div> : <ul className="grid grid-cols-2 gap-3 sm:gap-5">{items.map((item) => <li key={item.id} className="min-w-0 overflow-hidden rounded-2xl border border-[#dce2d8] bg-[#fcfcf8]"><div className="aspect-[4/5] bg-[#edf0e7]"><Photo photo={item.photo} alt={`${item.color}${item.category}`} className="h-full w-full object-contain" /></div><div className="p-3 sm:p-4"><span className="text-xs text-[#647166]">{item.category}</span><h3 className="mt-1 break-words text-base font-medium">{item.color}</h3><button className="small-button mt-2" onClick={() => setAnchor(item)}>围绕这件搭配</button><button type="button" onClick={() => void remove(item)} disabled={deleting !== null || saving} aria-label={`删除${item.color}${item.category}`} className="mt-2 flex min-h-11 items-center gap-1.5 text-xs text-[#647166] hover:text-red-700 disabled:opacity-50"><Trash2 size={14} aria-hidden="true" />{deleting === item.id ? "正在删除…" : "删除"}</button></div></li>)}</ul>}
          </section>
        </div>
      </div>
    </main>
  );
}
