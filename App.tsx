import React, { useState, useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { createPortal } from 'react-dom';
import { 
  Heart, Camera, Calendar as CalendarIcon, Zap, CheckSquare, Cat, Upload, Trash2, X,
  ChevronLeft, ChevronRight, MessageCircle, ZoomIn, ZoomOut, Palette, RotateCcw, Pin,
  Star, Plus, MessageSquareHeart, Send, Loader2, Image as ImageIcon, FolderPlus, Grid,
  ArrowLeft, Edit2, Sparkles, Gavel, ShieldCheck, Lightbulb, Clock, MoreHorizontal,
  MoreVertical, CheckCircle, Settings, Menu, User, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { judgeConflict, extractTodosFromText } from './services/ai';
import { Memory, PinnedPhoto, PeriodEntry, TodoItem, ConflictRecord, Page, Message, Album, AlbumMedia } from './types';
// @ts-ignore
import pailideIcon from './pailide.png';

// --- Helper Functions ---
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
const getBeijingDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(dateStr); 
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};
const useSafeStorage = (key: string, value: any) => {
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error(e); }
  }, [key, value]);
};

const DEFAULT_CAMERA_ICON = pailideIcon || "https://images.unsplash.com/photo-1526045431048-f857369baa09?auto=format&fit=crop&w=600&q=80";
const DEFAULT_COVER = "https://images.unsplash.com/photo-1516962215378-7fa2e137ae91?auto=format&fit=crop&w=1000&q=80";
const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";

// --- Sub Components ---

// 2. 修改：ImageViewer - 取消X按钮，点击任意处关闭，添加缩放退出动画
const ImageViewer = ({ src, onClose, actions }: { src: string; onClose: () => void; actions?: { label: string, onClick: () => void, primary?: boolean }[] }) => {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => { e.stopPropagation(); setScale(prev => prev > 1 ? 1 : 2.5); };

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 z-[999] bg-black flex items-center justify-center overflow-hidden" 
      onClick={onClose} // 点击背景关闭
    >
      <motion.img 
        src={src} 
        drag={scale > 1} 
        dragConstraints={{ left: -200*scale, right: 200*scale, top: -200*scale, bottom: 200*scale }} 
        style={{ scale }} 
        // 添加缩放动画配置
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: scale, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.2 } }}
        className="max-w-full max-h-full object-contain touch-none" 
        onClick={onClose} // 点击图片也关闭
        onDoubleClick={handleDoubleTap}
      />
      
      {actions && actions.length > 0 && (
           <div 
             className="absolute bottom-24 left-0 right-0 flex justify-center flex-wrap gap-4 pointer-events-none z-[1000]"
             onClick={(e) => e.stopPropagation()} // 阻止冒泡，防止点击按钮关闭图片
           >
               {actions.map((action, idx) => (
                   <button 
                        key={idx}
                        className={`px-6 py-2.5 rounded-full text-sm font-bold pointer-events-auto cursor-pointer flex items-center gap-2 backdrop-blur-md border border-white/20 transition active:scale-95 
                        ${action.primary 
                            ? 'bg-black/30 text-white hover:bg-black/40 shadow-lg' 
                            : 'bg-black/40 text-white hover:bg-black/60'}`} 
                        onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                    >
                       {action.label === '更换头像' || action.label === '更换封面' ? <Edit2 size={14} /> : <CheckCircle size={14} />}
                       {action.label}
                   </button>
               ))}
           </div>
      )}
      {/* 已移除 X 按钮 */}
    </motion.div>, document.body
  );
};

const Navbar = ({ active, setPage }: { active: Page, setPage: (p: Page) => void }) => {
  const navItems = [
    { id: Page.HOME, icon: <Cat size={24} />, label: '小屁铃' },
    { id: Page.MEMORIES, icon: <Camera size={24} />, label: '点滴' },
    { id: Page.BOARD, icon: <MessageSquareHeart size={24} />, label: '留言板' },
    { id: Page.CYCLE, icon: <Heart size={24} />, label: '经期' },
    { id: Page.CONFLICT, icon: <Gavel size={24} />, label: '小法官' },
    { id: Page.CALENDAR, icon: <CalendarIcon size={24} />, label: '日历' },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-rose-100 shadow-[0_-5px_15px_rgba(255,241,242,0.8)] z-[100] pb-safe safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16 max-w-2xl mx-auto px-1">
        {navItems.map((item) => (
          <button key={item.id} onClick={() => setPage(item.id)} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${active === item.id ? 'text-rose-500 scale-110' : 'text-gray-400 hover:text-rose-300'}`}>
            {item.icon} <span className="text-[10px] font-bold mt-1 font-cute transform scale-90">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

const PolaroidCamera = ({ onTakePhoto, iconUrl, onUploadIcon, onResetIcon }: any) => {
  const [flashing, setFlashing] = useState(false);
  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.camera-actions')) return;
    if (flashing) return;
    setFlashing(true);
    setTimeout(() => { setFlashing(false); onTakePhoto(); }, 150);
  };
  return (
    <div className="relative group w-32 mx-auto z-40" onClick={handleClick}>
      {flashing && createPortal(<div className="fixed inset-0 bg-white z-[9999] animate-[pulse_0.15s_ease-in-out]" />, document.body)}
      <div className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95">
        <img src={iconUrl} className="w-full drop-shadow-2xl relative z-30 object-contain max-h-32" onError={(e) => { e.currentTarget.src = DEFAULT_CAMERA_ICON; }} />
      </div>
      <div className="camera-actions absolute -right-12 bottom-0 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 scale-75 origin-bottom-left">
         <label className="bg-white text-rose-500 p-2 rounded-full shadow-md cursor-pointer"><Palette size={16} /><input type="file" accept="image/*" className="hidden" onChange={onUploadIcon} /></label>
         {iconUrl !== DEFAULT_CAMERA_ICON && (<button onClick={(e) => { e.stopPropagation(); onResetIcon(); }} className="bg-white text-gray-500 p-2 rounded-full shadow-md"><RotateCcw size={16} /></button>)}
      </div>
    </div>
  );
};

// 1. 修复：强化置顶逻辑，添加 onTouchStart 支持手机端
const DraggablePhoto = ({ pin, onUpdate, onDelete, onBringToFront, isFresh = false, date }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const displayCaption = pin.customCaption || '美好回忆';
  
  // 核心修复：处理置顶
  const handleInteractStart = () => {
      if (onBringToFront) onBringToFront(pin.id);
  };

  return (
    <motion.div 
        drag 
        dragMomentum={false} 
        onPointerDown={handleInteractStart} // 电脑端/通用
        onTouchStart={handleInteractStart}  // 手机端强制触发
        initial={isFresh ? { opacity: 0, y: 150, scale: 0.5 } : false} 
        animate={{ opacity: 1, scale: pin.scale, rotate: pin.rotation, x: pin.x, y: pin.y }} 
        whileHover={{ zIndex: 100 }} 
        whileTap={{ cursor: 'grabbing', zIndex: 101 }} 
        onDragEnd={(e, info) => onUpdate(pin.id, { x: pin.x + info.offset.x, y: pin.y + info.offset.y })} 
        className={`absolute w-44 bg-white p-3 pb-4 shadow-xl flex flex-col items-center group ${isFresh ? 'z-50' : 'z-10'}`} 
        style={{ top: '50%', left: '50%', marginTop: -110, marginLeft: -88 }}
    >
      <div className="w-full h-36 bg-gray-100 mb-2 overflow-hidden shadow-inner bg-black/5"><img src={pin.mediaUrl} className="w-full h-full object-cover pointer-events-none select-none" /></div>
      {isEditing ? (
        <input autoFocus className="w-full text-center font-cute text-gray-700 bg-rose-50 border-none focus:ring-0 text-sm p-1 rounded" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => { setIsEditing(false); onUpdate(pin.id, { customCaption: editValue }); }} onKeyDown={(e) => { if(e.key === 'Enter') { setIsEditing(false); onUpdate(pin.id, { customCaption: editValue }); }}} onClick={(e) => e.stopPropagation()} />
      ) : (
        <div className="text-center w-full" onClick={(e) => { e.stopPropagation(); setEditValue(displayCaption); setIsEditing(true); }}>
          <p className="font-cute text-gray-700 text-sm truncate px-1 cursor-text select-none">{displayCaption}</p>
          <p className="text-[10px] text-gray-400 font-sans mt-0.5">{date || 'Just now'}</p>
        </div>
      )}
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-rose-400 shadow-sm border-2 border-white z-20" />
      <div className="absolute -right-10 top-0 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity p-2">
        <button onClick={(e) => { e.stopPropagation(); onDelete(pin.id); }} className="bg-white text-rose-500 rounded-full p-2 shadow-md hover:bg-rose-500 hover:text-white"><X size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); onUpdate(pin.id, { scale: Math.min(2.5, pin.scale + 0.1) }); }} className="bg-white text-gray-600 rounded-full p-2 shadow-md"><ZoomIn size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); onUpdate(pin.id, { scale: Math.max(0.5, pin.scale - 0.1) }); }} className="bg-white text-gray-600 rounded-full p-2 shadow-md"><ZoomOut size={16} /></button>
      </div>
    </motion.div>
  );
};

const MiniCalendar = ({ periods, conflicts }: any) => {
    const today = new Date();
    const days = Array(getFirstDayOfMonth(today.getFullYear(), today.getMonth())).fill(null).concat([...Array(getDaysInMonth(today.getFullYear(), today.getMonth())).keys()].map(i => i + 1));
    return (
        <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-rose-100 w-full">
            <h4 className="text-xs font-bold text-gray-500 mb-3 font-cute flex items-center gap-2"><CalendarIcon size={14} className="text-rose-400" /> {today.getFullYear()}年{today.getMonth() + 1}月</h4>
            <div className="grid grid-cols-7 gap-1">
                {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-[10px] text-center text-gray-400 font-bold">{d}</div>)}
                {days.map((d, i) => (
                    <div key={i} className={`aspect-square rounded-full flex flex-col items-center justify-center text-[10px] font-medium transition-all ${d === today.getDate() ? 'bg-rose-500 text-white shadow-md scale-110' : 'text-gray-600 hover:bg-rose-50'}`}>
                        {d}
                        <div className="flex gap-0.5">
                             {d && periods.some((p: any) => { const s = parseLocalDate(p.startDate); const e = new Date(s); e.setDate(s.getDate()+p.duration); const c = new Date(today.getFullYear(), today.getMonth(), d); return c >= s && c < e; }) && d !== today.getDate() && <div className="w-1 h-1 rounded-full bg-red-500" />}
                             {d && conflicts.some((c: any) => { const dt = parseLocalDate(c.date); return dt.getDate() === d && dt.getMonth() === today.getMonth(); }) && d !== today.getDate() && <div className="w-1 h-1 rounded-full bg-purple-500" />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AnniversaryTimer = ({ startDate, onSetDate }: any) => {
    const [diff, setDiff] = useState({ days: 0, seconds: 0 });
    useEffect(() => {
        const calculate = () => {
            const delta = new Date().getTime() - parseLocalDate(startDate).getTime();
            if(delta < 0) return setDiff({ days: 0, seconds: 0 });
            setDiff({ days: Math.floor(delta / 86400000), seconds: new Date().getHours() * 3600 + new Date().getMinutes() * 60 + new Date().getSeconds() });
        };
        calculate(); const timer = setInterval(calculate, 1000); return () => clearInterval(timer);
    }, [startDate]);
    return (
        <div onClick={onSetDate} className="bg-white/90 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-lg border-2 border-rose-100 p-2 flex flex-col items-center min-w-[70px] md:min-w-[90px] transform hover:scale-105 transition cursor-pointer">
            <span className="text-[9px] md:text-[10px] text-rose-400 font-bold uppercase tracking-wider font-cute">在一起</span>
            <div className="text-center"><span className="text-lg md:text-2xl font-bold text-rose-500 font-cute">{diff.days}</span><span className="text-[9px] md:text-[10px] text-gray-400 ml-0.5 md:ml-1 font-bold">天</span></div>
            <div className="text-[9px] text-gray-500 font-mono">{diff.seconds}秒</div>
        </div>
    );
};
// --- Page Content Components ---

const MemoriesViewContent = ({
  memories, albums, setAlbums, handleLike, handleComment, onFileSelect, onTextPost, showUploadModal, setShowUploadModal,
  uploadImages, setUploadImages, uploadCaption, setUploadCaption, uploadType, confirmUpload, coverUrl, onUpdateCover, onDeleteMemory,
  momentsTitle, setMomentsTitle, avatarUrl, setAvatarUrl, setMomentsCover
}: any) => {
  const [activeTab, setActiveTab] = useState<'moments' | 'albums'>('moments');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewerActions, setViewerActions] = useState<{ label: string, onClick: () => void, primary?: boolean }[]>([]);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [commentInputs, setCommentInputs] = useState<{[key:string]: string}>({});
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isEditingMomentsTitle, setIsEditingMomentsTitle] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isEditingAlbumTitle, setIsEditingAlbumTitle] = useState(false);
  const [tempAlbumName, setTempAlbumName] = useState('');
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const [history, setHistory] = useState<Page[]>([]);

  useEffect(() => { const h = () => setActiveMenuId(null); document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);
  useEffect(() => { if(!isManageMode) setSelectedItems(new Set()); }, [isManageMode]);

  const handlePressStart = () => {
      pressTimer.current = setTimeout(() => {
          onTextPost();
          pressTimer.current = null;
      }, 500); 
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      if (pressTimer.current) {
          clearTimeout(pressTimer.current);
          pressTimer.current = null;
          document.getElementById('camera-file-input')?.click();
      }
  };

  const createAlbum = () => {
    if(!newAlbumName.trim()) return;
    setAlbums((prev: Album[]) => [{ id: Date.now().toString(), name: newAlbumName, coverUrl: '', createdAt: getBeijingDateString(), media: [] }, ...prev]);
    setNewAlbumName(''); setIsCreatingAlbum(false);
  };
  const handleAlbumUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedAlbum || !e.target.files) return;
      const files = Array.from(e.target.files); const newMedia: AlbumMedia[] = []; let count = 0;
      files.forEach(file => {
          const reader = new FileReader();
          reader.onloadend = () => {
              newMedia.push({ id: Date.now().toString() + Math.random(), url: reader.result as string, date: getBeijingDateString(), type: 'image' });
              count++;
              if (count === files.length) {
                  setAlbums((prev: Album[]) => prev.map(a => a.id === selectedAlbum.id ? { ...a, coverUrl: !a.coverUrl && newMedia.length > 0 ? newMedia[0].url : a.coverUrl, media: [...newMedia, ...a.media] } : a));
                  setSelectedAlbum(prev => prev ? { ...prev, coverUrl: !prev.coverUrl && newMedia.length > 0 ? newMedia[0].url : prev.coverUrl, media: [...newMedia, ...prev.media] } : null);
              }
          };
          reader.readAsDataURL(file);
      });
  };
  const batchDeletePhotos = () => {
      if(!selectedAlbum || !window.confirm(`确定要删除选中的 ${selectedItems.size} 张照片吗？`)) return;
      const updatedMedia = selectedAlbum.media.filter(m => !selectedItems.has(m.id));
      const updatedAlbum = { ...selectedAlbum, media: updatedMedia };
      if (selectedAlbum.media.find(m => m.url === selectedAlbum.coverUrl && selectedItems.has(m.id))) updatedAlbum.coverUrl = updatedMedia.length > 0 ? updatedMedia[0].url : '';
      setAlbums((prev: Album[]) => prev.map(a => a.id === selectedAlbum.id ? updatedAlbum : a));
      setSelectedAlbum(updatedAlbum); setIsManageMode(false);
  };
  
  const handleCoverClick = (e: React.MouseEvent) => {
      if (isEditingMomentsTitle) return;
      setViewingImage(coverUrl); 
      setViewerActions([{ label: '更换封面', onClick: () => { document.getElementById('cover-upload')?.click(); setViewingImage(null); } }]);
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setViewingImage(avatarUrl || DEFAULT_AVATAR);
      setViewerActions([{ 
          label: '更换头像', 
          onClick: () => { document.getElementById('avatar-upload')?.click(); setViewingImage(null); }
      }]);
  };
  
  const handleAvatarUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = () => setAvatarUrl(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handleViewImage = (url: string, context: 'album' | 'memory') => {
      setViewingImage(url);
      const actions = [];
      if (context === 'album' && selectedAlbum) {
          actions.push({
              label: '设为封面',
              onClick: () => {
                  setAlbums((prev: Album[]) => prev.map(a => a.id === selectedAlbum.id ? { ...a, coverUrl: url } : a));
                  setSelectedAlbum(prev => prev ? { ...prev, coverUrl: url } : null);
                  setViewingImage(null);
                  alert('已设为相册封面');
              }
          });
      }
      actions.push({
          label: '设为背景',
          primary: true,
          onClick: () => {
              if(confirm('将这张图片设为朋友圈背景？')) {
                  setMomentsCover(url);
                  setViewingImage(null);
              }
          }
      });
      setViewerActions(actions);
  };

  const saveAlbumName = () => {
      if (selectedAlbum && tempAlbumName.trim()) {
          const updatedAlbum = { ...selectedAlbum, name: tempAlbumName };
          setAlbums((prev: Album[]) => prev.map(a => a.id === selectedAlbum.id ? updatedAlbum : a));
          setSelectedAlbum(updatedAlbum);
      }
      setIsEditingAlbumTitle(false);
  };

  if (selectedAlbum) return (
      <div className="h-full bg-white flex flex-col pb-20">
          <div className="p-4 border-b flex items-center justify-between bg-white/80 backdrop-blur sticky top-0 z-10">
              <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedAlbum(null)} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft /></button>
                  {isEditingAlbumTitle ? (
                      <input autoFocus value={tempAlbumName} onChange={(e) => setTempAlbumName(e.target.value)} onBlur={saveAlbumName} onKeyDown={(e) => { if(e.key === 'Enter') saveAlbumName(); }} className="text-xl font-bold font-cute bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-rose-200" />
                  ) : (
                      <h2 onClick={() => { setTempAlbumName(selectedAlbum.name); setIsEditingAlbumTitle(true); }} className="text-xl font-bold font-cute cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition" title="点击重命名">{selectedAlbum.name}</h2>
                  )}
              </div>
              <div className="flex gap-2">{isManageMode ? <><button onClick={batchDeletePhotos} className="text-red-500 font-bold text-sm px-3 py-1 bg-red-50 rounded-full">删除({selectedItems.size})</button><button onClick={() => setIsManageMode(false)} className="text-gray-500 font-bold text-sm px-3 py-1">取消</button></> : <><button onClick={() => setIsManageMode(true)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><Settings size={20} /></button><label className="p-2 bg-rose-50 text-rose-500 rounded-full cursor-pointer"><Plus size={24} /><input type="file" multiple accept="image/*" className="hidden" onChange={handleAlbumUpload} /></label></>}</div>
          </div>
          <div className="p-4 grid grid-cols-3 md:grid-cols-5 gap-2 overflow-y-auto">{selectedAlbum.media.map((item, idx) => (<div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative group cursor-pointer" onClick={() => isManageMode ? setSelectedItems(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; }) : handleViewImage(item.url, 'album')}><img src={item.url} className={`w-full h-full object-cover transition ${isManageMode && selectedItems.has(item.id) ? 'opacity-50 scale-90' : ''}`} loading="lazy" />{isManageMode && (<div className="absolute top-2 right-2">{selectedItems.has(item.id) ? <CheckCircle className="text-rose-500 fill-white" /> : <div className="w-5 h-5 rounded-full border-2 border-white/80" />}</div>)}</div>))}</div>
          {viewingImage && <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} actions={viewerActions} />}
      </div>
  );

  return (
    <div className="h-full bg-white overflow-y-auto pb-24 relative">
        <div className="relative group cursor-pointer" style={{ height: '320px' }}>
             <div className="absolute inset-0 z-0" onClick={handleCoverClick}>
                 <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-black/10 pointer-events-none" />
             </div>

             <input id="cover-upload" type="file" className="hidden" onChange={onUpdateCover} accept="image/*" />
            
            <div className="absolute -bottom-8 right-4 flex items-end gap-3 z-20">
                 <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    {isEditingMomentsTitle ? (
                         <input value={momentsTitle} onChange={(e) => setMomentsTitle(e.target.value)} onBlur={() => setIsEditingMomentsTitle(false)} onKeyDown={(e) => { if(e.key === 'Enter') setIsEditingMomentsTitle(false); }} autoFocus className="text-white font-bold text-lg drop-shadow-md pb-10 font-cute bg-transparent outline-none border-b border-white w-40 text-right" />
                    ) : (
                         <div onClick={() => setIsEditingMomentsTitle(true)} className="text-white font-bold text-lg drop-shadow-md pb-10 font-cute cursor-pointer select-none" title="点击修改标题">{momentsTitle}</div>
                    )}
                 </div>
                 <div className="bg-white p-1 rounded-xl shadow-lg pointer-events-auto cursor-pointer relative z-30" onClick={handleAvatarClick}>
                    <div className="w-16 h-16 bg-rose-100 rounded-lg flex items-center justify-center overflow-hidden">
                        {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <span className="text-3xl">💑</span>}
                    </div>
                 </div>
            </div>

            <div className="absolute top-4 right-4 z-30">
                <button 
                    onMouseDown={handlePressStart}
                    onMouseUp={handlePressEnd}
                    onTouchStart={handlePressStart}
                    onTouchEnd={handlePressEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    className="bg-black/20 p-2 rounded-full text-white hover:bg-black/40 backdrop-blur-sm pointer-events-auto transition-transform active:scale-90 select-none"
                >
                    <Camera size={20} />
                </button>
                <input id="camera-file-input" type="file" multiple accept="image/*" className="hidden" onChange={onFileSelect} />
            </div>
        </div>

      <div className="mt-14 mb-4 border-b border-gray-100 pb-1 relative bg-white sticky top-0 z-30 flex justify-center">
          <button onClick={() => setActiveTab('moments')} className={`px-6 py-2 font-bold transition-all relative ${activeTab === 'moments' ? 'text-rose-500' : 'text-gray-400'}`}>瞬间 {activeTab === 'moments' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />}</button>
          <button onClick={() => setActiveTab('albums')} className={`px-6 py-2 font-bold transition-all relative ${activeTab === 'albums' ? 'text-rose-500' : 'text-gray-400'}`}>相册 {activeTab === 'albums' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />}</button>
      </div>

      <div className="px-4 pb-10 max-w-2xl mx-auto min-h-[50vh] bg-white">
          {activeTab === 'moments' ? (
              <div className="space-y-8">
                  {memories.map((memory: Memory) => (
                      <div key={memory.id} className="flex gap-3 pb-6 border-b border-gray-50 last:border-0">
                          <div className="w-10 h-10 rounded-lg bg-rose-100 overflow-hidden shrink-0 cursor-pointer" onClick={handleAvatarClick}>
                              {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">🐶</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-800 font-cute text-sm mb-1 text-blue-900">我们</h4>
                              <p className="mb-2 text-gray-800 text-sm leading-relaxed">{memory.caption}</p>
                              {memory.type === 'media' && memory.media.length > 0 && (<div className={`grid gap-1 mb-2 max-w-[80%] ${memory.media.length === 1 ? 'grid-cols-1' : memory.media.length === 4 ? 'grid-cols-2 w-2/3' : 'grid-cols-3'}`}>{memory.media.map((url: string, idx: number) => (<div key={idx} onClick={() => handleViewImage(url, 'memory')} className={`aspect-square bg-gray-100 cursor-pointer overflow-hidden ${memory.media.length === 1 ? 'max-w-[200px] max-h-[200px]' : ''}`}><img src={url} className="w-full h-full object-cover" alt="Memory" /></div>))}</div>)}
                              <div className="flex justify-between items-center mt-2 relative">
                                  <div className="flex items-center gap-3"><span className="text-xs text-gray-400">{memory.date}</span><button onClick={() => onDeleteMemory(memory.id)} className="text-xs text-blue-900 hover:underline">删除</button></div>
                                  <div className="relative"><button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === memory.id ? null : memory.id); }} className="bg-gray-50 p-1 rounded-sm text-blue-800 hover:bg-gray-100"><MoreHorizontal size={16} /></button><AnimatePresence>{activeMenuId === memory.id && (<motion.div initial={{ opacity: 0, scale: 0.9, x: 10 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 10 }} className="absolute right-8 top-0 bg-gray-800 text-white rounded-md flex items-center overflow-hidden shadow-xl z-10" onClick={(e) => e.stopPropagation()}><button onClick={() => { handleLike(memory.id); setActiveMenuId(null); }} className="flex items-center gap-1 px-4 py-2 hover:bg-gray-700 text-xs font-bold min-w-[80px] justify-center"><Heart size={14} fill={memory.isLiked ? "red" : "none"} color={memory.isLiked ? "red" : "white"} />{memory.isLiked ? '取消' : '赞'}</button><div className="w-[1px] h-4 bg-gray-600"></div><button onClick={() => { const input = prompt('请输入评论'); if(input) { handleComment(memory.id, input); setActiveMenuId(null); } }} className="flex items-center gap-1 px-4 py-2 hover:bg-gray-700 text-xs font-bold min-w-[80px] justify-center"><MessageCircle size={14} />评论</button></motion.div>)}</AnimatePresence></div>
                              </div>
                              {(memory.likes > 0 || memory.comments.length > 0) && (<div className="mt-3 bg-gray-50 rounded-sm p-2 text-xs">{memory.likes > 0 && (<div className="flex items-center gap-1 text-blue-900 font-bold border-b border-gray-200/50 pb-1 mb-1"><Heart size={12} fill="currentColor" /><span>{memory.likes} 人觉得很赞</span></div>)}{memory.comments.map((c: any) => (<div key={c.id} className="leading-5"><span className="font-bold text-blue-900">我:</span> <span className="text-gray-600 ml-1">{c.text}</span></div>))}</div>)}
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
              <div>
                  <div className="flex justify-between items-center mb-4 px-2">
                      <div onClick={() => setIsCreatingAlbum(true)} className="flex items-center gap-2 text-gray-500 cursor-pointer hover:text-rose-500"><FolderPlus size={20} /><span className="text-sm font-bold">新建相册</span></div>
                      <button onClick={() => setIsManageMode(!isManageMode)} className={`text-sm font-bold ${isManageMode ? 'text-rose-500' : 'text-gray-400'}`}>{isManageMode ? '完成' : '管理'}</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {albums.map((album: Album) => (
                          <div key={album.id} onClick={() => isManageMode ? setSelectedItems(p => { const n = new Set(p); n.has(album.id) ? n.delete(album.id) : n.add(album.id); return n; }) : setSelectedAlbum(album)} className={`aspect-square bg-white rounded-3xl shadow-sm border border-gray-100 p-2 relative group overflow-hidden cursor-pointer transition ${isManageMode && selectedItems.has(album.id) ? 'ring-2 ring-rose-500 bg-rose-50' : ''}`}>
                              {album.coverUrl ? (<img src={album.coverUrl} className="w-full h-full object-cover rounded-2xl" />) : (<div className="w-full h-full bg-gray-50 rounded-2xl flex items-center justify-center text-xs text-gray-400 border border-gray-100">暂无封面</div>)}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4 rounded-2xl pointer-events-none"><div className="text-white w-full"><h4 className="font-bold truncate text-shadow-sm">{album.name}</h4><span className="text-xs opacity-90">{album.media.length} 张照片</span></div></div>
                              {isManageMode && (<div className="absolute top-2 right-2 pointer-events-none">{selectedItems.has(album.id) ? <CheckCircle className="text-rose-500 fill-white" /> : <div className="w-5 h-5 rounded-full border-2 border-white/80 bg-black/20" />}</div>)}
                          </div>
                      ))}
                  </div>
                  {isManageMode && (<div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-gray-100 flex justify-center gap-4 z-40"><button onClick={() => { if(window.confirm(`确定删除?`)) { setAlbums((prev: Album[]) => prev.filter(a => !selectedItems.has(a.id))); setIsManageMode(false); }}} disabled={selectedItems.size === 0} className="bg-red-500 text-white px-6 py-2 rounded-full font-bold shadow-md disabled:bg-gray-300">删除选中 ({selectedItems.size})</button></div>)}
              </div>
          )}
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in">
                <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-800 font-cute">{uploadType === 'media' ? '发布照片' : '写日记'}</h3><button onClick={() => setShowUploadModal(false)}><X className="text-gray-400" /></button></div>
                {uploadType === 'media' && (<div className="grid grid-cols-3 gap-2 mb-4 max-h-60 overflow-y-auto">{uploadImages.map((img: string, i: number) => (<div key={i} className="aspect-square rounded-xl overflow-hidden relative"><img src={img} className="w-full h-full object-cover" /><button onClick={() => setUploadImages(uploadImages.filter((_:any, idx:number) => idx !== i))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X size={12} /></button></div>))}{uploadImages.length < 9 && (<label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 cursor-pointer hover:bg-gray-50"><Plus size={24} /><input type="file" multiple accept="image/*" className="hidden" onChange={onFileSelect} /></label>)}</div>)}
                <textarea value={uploadCaption} onChange={(e) => setUploadCaption(e.target.value)} placeholder="写点什么..." className="w-full bg-gray-50 rounded-xl p-3 h-24 mb-4 outline-none resize-none focus:ring-2 focus:ring-rose-100" />
                <button onClick={confirmUpload} className="w-full bg-rose-500 text-white py-3 rounded-xl font-bold hover:bg-rose-600 transition">发布</button>
            </div>
        </div>
      )}

      {isCreatingAlbum && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in">
                <h3 className="text-lg font-bold text-gray-800 font-cute mb-4">创建新相册</h3>
                <input autoFocus className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4 outline-none focus:ring-2 focus:ring-rose-100" placeholder="相册名称..." value={newAlbumName} onChange={e => setNewAlbumName(e.target.value)} />
                <div className="flex gap-2 justify-end"><button onClick={() => setIsCreatingAlbum(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">取消</button><button onClick={createAlbum} className="px-6 py-2 bg-rose-500 text-white rounded-lg font-bold shadow-md hover:bg-rose-600 transition">创建</button></div>
            </div>
        </div>
      )}
      {viewingImage && <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} actions={viewerActions} />}
      <input id="avatar-upload" type="file" className="hidden" onChange={handleAvatarUpdate} accept="image/*" />
    </div>
  );
};

const CycleViewContent = ({ periods, nextPeriod, addPeriod, deletePeriod }: any) => {
  const handleLogPeriod = () => { if(confirm(`记录今天 (${getBeijingDateString()}) 为大姨妈开始日？`)) addPeriod(getBeijingDateString()); };
  return (
    <div className="p-6 space-y-6 pb-24 h-full overflow-y-auto">
        <h2 className="text-2xl font-bold font-cute text-rose-500 text-center mb-2">经期记录</h2>
        <div className="bg-white rounded-3xl p-8 shadow-xl text-center border-2 border-rose-100 relative overflow-hidden">
             <div className="relative z-10">
                <h2 className="text-gray-500 font-bold mb-2 font-cute">距离下次大姨妈还有</h2>
                <div className="text-6xl font-black text-rose-500 my-4 font-cute">{nextPeriod ? nextPeriod.daysLeft : '?'}<span className="text-lg text-gray-400 ml-2 font-bold">天</span></div>
                {nextPeriod && <p className="text-gray-400 text-sm">预计日期: {nextPeriod.date}</p>}
                <button onClick={handleLogPeriod} className="mt-8 bg-rose-500 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-rose-200 hover:scale-105 transition-transform active:scale-95 flex items-center gap-2 mx-auto cursor-pointer z-50 relative"><Heart fill="white" size={20} /> 大姨妈来了</button>
             </div>
             <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-rose-50 rounded-full opacity-50 pointer-events-none" /><div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-rose-50 rounded-full opacity-50 pointer-events-none" />
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50">
            <h3 className="font-bold text-gray-700 mb-4 font-cute flex items-center gap-2"><RotateCcw size={18} className="text-rose-400" /> 历史记录</h3>
            <div className="space-y-3">
                {periods.slice().reverse().map((p: any, i: number) => (<div key={i} className="flex justify-between items-center p-3 bg-rose-50/50 rounded-xl group"><span className="font-bold text-gray-600">{p.startDate}</span><div className="flex items-center gap-2"><span className="text-xs text-rose-400 font-bold px-2 py-1 bg-white rounded-lg shadow-sm">持续 {p.duration} 天</span><button onClick={() => deletePeriod(periods.length - 1 - i)} className="text-gray-300 hover:text-red-500 p-1"><X size={16} /></button></div></div>))}
                {periods.length === 0 && <p className="text-center text-gray-400 text-sm py-4">还没有记录哦</p>}
            </div>
        </div>
    </div>
  );
};

const ConflictViewContent = ({ judgeConflict, conflicts, setConflicts }: any) => {
    const [reason, setReason] = useState(''); const [hisPoint, setHisPoint] = useState(''); const [herPoint, setHerPoint] = useState(''); const [isJudging, setIsJudging] = useState(false);
    const handleJudge = async () => { if(!reason || !hisPoint || !herPoint) return alert("请填写完整信息喵！"); setIsJudging(true); const result = await judgeConflict(reason, hisPoint, herPoint); setConflicts([{ id: Date.now().toString(), date: getBeijingDateString(), reason, hisPoint, herPoint, aiResponse: result, isPinned: false, isFavorite: false }, ...conflicts]); setIsJudging(false); setReason(''); setHisPoint(''); setHerPoint(''); };
    return (
        <div className="p-4 pb-24 space-y-6 bg-gray-50 h-full overflow-y-auto">
             <div className="flex flex-col items-center justify-center py-6"><div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-4xl shadow-md mb-3">🐱</div><h2 className="font-bold text-3xl font-cute text-indigo-900 tracking-wide">喵喵法官</h2><p className="text-sm text-gray-400 font-medium">公正无私 · 在线断案</p></div>
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-indigo-50"><div className="space-y-5"><div><label className="text-sm font-bold text-gray-700 ml-1 block mb-2">争吵原因</label><input className="w-full bg-gray-50 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none transition" placeholder="简单描述一下因为什么吵架..." value={reason} onChange={e => setReason(e.target.value)} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-sm font-bold text-blue-600 ml-1 block mb-2">👦 男生观点</label><textarea className="w-full bg-blue-50/50 rounded-xl p-4 text-sm h-32 resize-none focus:ring-2 focus:ring-blue-100 outline-none transition" placeholder="我觉得..." value={hisPoint} onChange={e => setHisPoint(e.target.value)} /></div><div><label className="text-sm font-bold text-rose-500 ml-1 block mb-2">👧 女生观点</label><textarea className="w-full bg-rose-50/50 rounded-xl p-4 text-sm h-32 resize-none focus:ring-2 focus:ring-rose-100 outline-none transition" placeholder="明明是..." value={herPoint} onChange={e => setHerPoint(e.target.value)} /></div></div><button onClick={handleJudge} disabled={isJudging} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition flex justify-center items-center gap-2 text-lg active:scale-[0.98]">{isJudging ? <Loader2 className="animate-spin" /> : <Gavel size={24} />}{isJudging ? '喵喵正在思考中...' : '请求喵喵裁决'}</button></div></div>
            <div className="space-y-6"><h3 className="text-center text-gray-400 text-sm font-bold tracking-widest uppercase mt-8 mb-4">- 历史判决书 -</h3>{conflicts.sort((a:any, b:any) => (a.isPinned && !b.isPinned) ? -1 : (!a.isPinned && b.isPinned) ? 1 : parseInt(b.id) - parseInt(a.id)).map((c: ConflictRecord) => (<div key={c.id} className={`bg-white rounded-3xl p-6 shadow-md border relative overflow-hidden transition-all ${c.isFavorite ? 'border-pink-300 ring-2 ring-pink-50' : 'border-gray-100'}`}>{c.isPinned && <div className="absolute top-0 right-0 p-3 text-indigo-500 transform rotate-12 bg-indigo-50 rounded-bl-xl"><Pin size={20} fill="currentColor" /></div>}<div className="flex justify-between items-center mb-4"><span className="text-xs font-bold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{c.date}</span></div><h4 className="font-bold text-gray-800 mb-6 font-cute text-xl text-center">{c.reason}</h4>{c.aiResponse && (<div className="space-y-5"><div className="space-y-2"><div className="flex justify-between text-xs font-bold px-1"><span className="text-blue-500">公猫过错 {c.aiResponse.hisFault}%</span><span className="text-rose-500">母猫过错 {c.aiResponse.herFault}%</span></div><div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner"><div style={{ width: `${c.aiResponse.hisFault}%` }} className="bg-blue-500 h-full transition-all duration-1000 ease-out" /><div style={{ width: `${c.aiResponse.herFault}%` }} className="bg-rose-500 h-full transition-all duration-1000 ease-out" /></div></div><div className="space-y-3"><div className="bg-indigo-50/80 rounded-2xl p-4 text-sm text-indigo-900 leading-relaxed border border-indigo-100"><p className="font-cute text-base mb-1">🐱 喵喵复盘:</p><p className="opacity-90">{c.aiResponse.analysis}</p></div><div className="bg-green-50/80 rounded-2xl p-4 text-sm text-green-900 leading-relaxed border border-green-100"><p className="font-cute text-base mb-1">💡 和好建议:</p><p className="opacity-90">{c.aiResponse.advice}</p></div></div></div>)}<div className="flex justify-end gap-4 mt-6 border-t border-gray-50 pt-4"><button onClick={() => setConflicts(conflicts.map((x:any) => x.id === c.id ? { ...x, isFavorite: !x.isFavorite } : x))} className={`p-2 rounded-full hover:bg-pink-50 transition ${c.isFavorite ? 'text-pink-500' : 'text-gray-300'}`}><Heart size={20} fill={c.isFavorite ? "currentColor" : "none"} /></button><button onClick={() => setConflicts(conflicts.map((x:any) => x.id === c.id ? { ...x, isPinned: !x.isPinned } : x))} className={`p-2 rounded-full hover:bg-indigo-50 transition ${c.isPinned ? 'text-indigo-500' : 'text-gray-300'}`}><Pin size={20} fill={c.isPinned ? "currentColor" : "none"} /></button><button onClick={() => { if(confirm("确定删除?")) setConflicts(conflicts.filter((x:any) => x.id !== c.id)); }} className="p-2 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition"><Trash2 size={20} /></button></div></div>))}</div>
        </div>
    );
};

const BoardViewContent = ({ messages, onPost, onPin, onFav, onDelete, onAddTodo, setMessages }: any) => {
    const [input, setInput] = useState(''); const [isManageMode, setIsManageMode] = useState(false); const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    useEffect(() => { if(!isManageMode) setSelectedItems(new Set()); }, [isManageMode]);
    const handleSend = async () => {
        if(!input.trim()) return;
        onPost(input);
        if(input.match(/今天|明天|要做|提醒/)) { const todos = await extractTodosFromText(input, getBeijingDateString()); if(todos.length) { todos.forEach(t => onAddTodo(t.text, t.date)); alert(`已添加 ${todos.length} 个待办！`); } }
        setInput('');
    };
    const batchAction = (action: 'pin' | 'fav' | 'delete') => {
        if(action === 'delete' && !confirm(`确定删除 ${selectedItems.size} 条?`)) return;
        setMessages((prev: Message[]) => action === 'delete' ? prev.filter(m => !selectedItems.has(m.id)) : prev.map(m => selectedItems.has(m.id) ? { ...m, isPinned: action==='pin'?!m.isPinned:m.isPinned, isFavorite: action==='fav'?!m.isFavorite:m.isFavorite } : m));
        if(action === 'delete') setIsManageMode(false);
    };
    return (
        <div className="flex flex-col h-full bg-yellow-50/30">
            <div className="pt-4 px-4 pb-2 bg-yellow-50/30 flex justify-between items-center relative"><div className="w-8"></div><h2 className="text-2xl font-bold font-cute text-yellow-600 text-center">留言板</h2><button onClick={() => setIsManageMode(!isManageMode)} className={`p-2 rounded-full hover:bg-yellow-100 ${isManageMode ? 'text-rose-500' : 'text-gray-400'}`}>{isManageMode ? '完成' : <Settings size={20} />}</button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40"><div className="grid grid-cols-1 gap-4">{messages.sort((a:any,b:any)=>(a.isPinned && !b.isPinned)?-1:(!a.isPinned && b.isPinned)?1:parseInt(b.id)-parseInt(a.id)).map((msg: Message) => (<div key={msg.id} onClick={() => isManageMode && setSelectedItems(p => { const n = new Set(p); n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id); return n; })} className={`p-6 rounded-2xl shadow-sm border text-base relative group transition-all ${msg.isFavorite ? 'bg-rose-50 border-rose-100' : 'bg-white border-yellow-100'} ${isManageMode && selectedItems.has(msg.id) ? 'ring-2 ring-rose-500 bg-rose-50' : ''}`}><p className="text-gray-700 font-cute mb-10 leading-relaxed whitespace-pre-wrap break-words text-lg">{msg.content}</p><div className="absolute bottom-4 left-0 right-0 px-6 flex justify-between items-center"><div className="text-xs text-gray-300 font-bold">{msg.date.slice(5)} {msg.time}</div><div className="flex gap-4"><button onClick={(e) => { e.stopPropagation(); extractTodosFromText(msg.content, getBeijingDateString()).then(t => { if(t.length) { t.forEach(i=>onAddTodo(i.text, i.date)); alert(`提取 ${t.length} 条待办`); } else alert('无待办'); }); }} className="transition text-yellow-500 hover:text-yellow-600"><Sparkles size={18} /></button><button onClick={() => onFav(msg.id)} className={`transition ${msg.isFavorite ? 'text-rose-500' : 'text-gray-300 hover:text-rose-500'}`}><Heart size={18} fill={msg.isFavorite ? "currentColor" : "none"} /></button><button onClick={() => onPin(msg.id)} className={`transition ${msg.isPinned ? 'text-blue-500' : 'text-gray-300 hover:text-blue-500'}`}><Pin size={18} fill={msg.isPinned ? "currentColor" : "none"} /></button><button onClick={() => onDelete(msg.id)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={18} /></button></div></div>{msg.isPinned && <div className="absolute top-0 right-0 p-3 text-blue-500 transform rotate-45"><Pin size={24} fill="currentColor" /></div>}{isManageMode && (<div className="absolute top-4 right-4 pointer-events-none">{selectedItems.has(msg.id) ? <CheckCircle className="text-rose-500 fill-white" /> : <div className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white" />}</div>)}</div>))}</div></div>
            {isManageMode ? (<div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-gray-100 pb-safe safe-area-inset-bottom z-40 flex justify-around"><button onClick={() => batchAction('fav')} className="flex flex-col items-center text-gray-600 hover:text-rose-500"><Heart /> <span className="text-xs mt-1">收藏</span></button><button onClick={() => batchAction('pin')} className="flex flex-col items-center text-gray-600 hover:text-blue-500"><Pin /> <span className="text-xs mt-1">置顶</span></button><button onClick={() => batchAction('delete')} className="flex flex-col items-center text-gray-600 hover:text-red-500"><Trash2 /> <span className="text-xs mt-1">删除</span></button></div>) : (<div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-gray-100 pb-safe safe-area-inset-bottom z-40"><div className="relative max-w-2xl mx-auto"><textarea className="w-full bg-gray-50 rounded-2xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-100 resize-none h-14" placeholder="写给对方的留言..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} /><button onClick={handleSend} disabled={!input.trim()} className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-rose-500 text-white rounded-xl shadow-md disabled:bg-gray-300 transition hover:scale-105 active:scale-95"><Send size={18} /></button></div></div>)}
        </div>
    );
};

const CalendarViewContent = ({ periods, conflicts, todos, addTodo, toggleTodo, onDeleteTodo, onDeleteConflict }: any) => {
    const [currentDate, setCurrentDate] = useState(new Date()); const [selectedDate, setSelectedDate] = useState(getBeijingDateString());
    const year = currentDate.getFullYear(); const month = currentDate.getMonth(); const days = Array(getFirstDayOfMonth(year, month)).fill(null).concat([...Array(getDaysInMonth(year, month)).keys()].map(i => i + 1));
    const dayTodos = todos.filter((t: TodoItem) => t.date === selectedDate); const dayConflicts = conflicts.filter((c: ConflictRecord) => c.date === selectedDate);
    
    const isPredictedPeriod = (d: string) => {
        if(periods.length === 0) return false;
        const lastPeriod = periods[periods.length - 1];
        const lastStart = parseLocalDate(lastPeriod.startDate);
        const predictedStart = new Date(lastStart);
        predictedStart.setDate(lastStart.getDate() + 28);
        const predictedEnd = new Date(predictedStart);
        predictedEnd.setDate(predictedStart.getDate() + 5); 
        const curr = parseLocalDate(d);
        return curr >= predictedStart && curr < predictedEnd;
    };
    
    const isPeriod = (d: string) => periods.some((p:any) => { const s = parseLocalDate(p.startDate); const e = new Date(s); e.setDate(s.getDate()+p.duration); const c = parseLocalDate(d); return c >= s && c < e; });
    
    return (
        <div className="h-full bg-white flex flex-col pb-20"><h2 className="text-2xl font-bold font-cute text-gray-800 text-center pt-4">专属日历</h2>
            <div className="px-6 pt-2 pb-2 flex justify-between items-center"><h2 className="text-xl font-bold font-cute text-gray-800">{year}年 {month + 1}月</h2><div className="flex gap-2"><button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 bg-gray-50 rounded-full hover:bg-rose-50 transition"><ChevronLeft size={20} /></button><button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 bg-gray-50 rounded-full hover:bg-rose-50 transition"><ChevronRight size={20} /></button></div></div>
            <div className="px-4">
                <div className="grid grid-cols-7 mb-2">{['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-center text-xs text-gray-400 font-bold py-2">{d}</div>)}</div>
                <div className="grid grid-cols-7 gap-y-2">{days.map((d, i) => { 
                    if (!d) return <div key={i} />; 
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; 
                    const isPred = isPredictedPeriod(dateStr) && !isPeriod(dateStr);
                    return (
                        <div key={i} className="flex justify-center relative"><button onClick={() => setSelectedDate(dateStr)} className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all relative ${dateStr === selectedDate ? 'bg-gray-800 text-white shadow-lg scale-110 z-10' : 'text-gray-700 hover:bg-gray-50'} ${dateStr === getBeijingDateString() && dateStr !== selectedDate ? 'text-rose-500 font-bold' : ''}`}>{d}<div className="absolute bottom-1 flex gap-0.5">{isPeriod(dateStr) && <div className={`w-1 h-1 rounded-full bg-red-500`} />}{isPred && <div className={`w-1 h-1 rounded-full bg-blue-400`} />}{todos.some((t:any) => t.date === dateStr && !t.completed) && <div className={`w-1 h-1 rounded-full bg-yellow-400`} />}{conflicts.some((c:any) => c.date === dateStr) && <div className={`w-1 h-1 rounded-full bg-purple-500`} />}</div></button></div>
                    ) })}</div>
                <div className="flex justify-center gap-4 py-2 mt-2 border-t border-gray-50">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold"><div className="w-2 h-2 rounded-full bg-red-500"></div>经期</div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold"><div className="w-2 h-2 rounded-full bg-blue-400"></div>预测</div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold"><div className="w-2 h-2 rounded-full bg-yellow-400"></div>待办</div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold"><div className="w-2 h-2 rounded-full bg-purple-500"></div>吵架</div>
                </div>
            </div>
            <div className="flex-1 bg-gray-50 mt-2 rounded-t-3xl p-6 overflow-y-auto"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-800 font-cute flex items-center gap-2"><span className="text-2xl">{selectedDate.split('-')[2]}</span><span className="text-sm text-gray-400">日事项</span></h3><button onClick={() => addTodo(prompt("添加待办事项:"), selectedDate)} className="text-rose-500 text-sm font-bold flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm"><Plus size={16} /> 添加</button></div><div className="space-y-3">
            {isPredictedPeriod(selectedDate) && !isPeriod(selectedDate) && (<div className="bg-blue-50 text-blue-500 p-3 rounded-xl text-sm font-bold flex items-center gap-2"><Sparkles size={16} fill="currentColor" /> 预计大姨妈</div>)}
            {isPeriod(selectedDate) && (<div className="bg-red-100 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2"><Heart size={16} fill="currentColor" /> 大姨妈造访中</div>)}
            {dayConflicts.map((c: ConflictRecord) => (
                <div key={c.id} className="bg-purple-50 text-purple-900 p-3 rounded-xl text-sm border border-purple-100 relative group">
                    <div className="font-bold flex items-center gap-2 mb-1"><Gavel size={14} /> 喵喵法官裁决</div>
                    {c.reason}
                    <button onClick={() => onDeleteConflict(c.id)} className="absolute top-2 right-2 text-purple-300 hover:text-purple-600"><X size={16} /></button>
                </div>
            ))}
            {dayTodos.map((todo: TodoItem) => (
                <div key={todo.id} onClick={() => toggleTodo(todo.id)} className="bg-white p-3 rounded-xl flex items-center gap-3 shadow-sm cursor-pointer active:scale-98 transition relative group">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${todo.completed ? 'border-green-500 bg-green-500' : 'border-gray-200'}`}>{todo.completed && <CheckSquare size={12} className="text-white" />}</div>
                    <span className={`text-sm flex-1 ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{todo.text}</span>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteTodo(todo.id); }} className="text-gray-300 hover:text-red-500 p-1"><X size={16} /></button>
                </div>
            ))}
            {!dayTodos.length && !dayConflicts.length && !isPeriod(selectedDate) && !isPredictedPeriod(selectedDate) && (<div className="text-center text-gray-400 text-sm py-8">今天没有安排哦 ~</div>)}</div></div>
        </div>
    );
};

// --- Main App ---
export default function App() {
  const [activePage, setActivePage] = useState<Page>(Page.HOME);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [pinnedPhotos, setPinnedPhotos] = useState<PinnedPhoto[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [periods, setPeriods] = useState<PeriodEntry[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [momentsCover, setMomentsCover] = useState<string>(DEFAULT_COVER);
  const [cameraIcon, setCameraIcon] = useState<string>(DEFAULT_CAMERA_ICON);
  const [appTitle, setAppTitle] = useState("小屁铃");
  const [momentsTitle, setMomentsTitle] = useState("我们的点滴");
  const [anniversaryDate, setAnniversaryDate] = useState("2023-01-01");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [usedPhotoIds, setUsedPhotoIds] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadImages, setUploadImages] = useState<string[]>([]);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadType, setUploadType] = useState<'text' | 'media'>('media');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [history, setHistory] = useState<Page[]>([]);

  useEffect(() => {
    const savedMemories = localStorage.getItem('memories'); if (savedMemories) { try { const parsed = JSON.parse(savedMemories); if (Array.isArray(parsed)) setMemories(parsed.map((m: any) => ({ ...m, media: m.media || (m.url ? [m.url] : []), type: m.type || (m.url ? 'media' : 'text'), comments: m.comments || [] }))); } catch (e) {} } else { setMemories([{ id: '1', media: ['https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?auto=format&fit=crop&w=400&q=80'], caption: '可爱的狗勾', date: '2023-10-01', type: 'media', likes: 2, isLiked: false, comments: [] }]); }
    try { setAlbums(JSON.parse(localStorage.getItem('albums') || '[]')); setTodos(JSON.parse(localStorage.getItem('todos') || '[]')); setPeriods(JSON.parse(localStorage.getItem('periods') || '[]')); setConflicts(JSON.parse(localStorage.getItem('conflicts') || '[]')); setPinnedPhotos(JSON.parse(localStorage.getItem('pinnedPhotos') || '[]')); setMessages(JSON.parse(localStorage.getItem('messages') || '[]')); } catch(e){}
    setCameraIcon(localStorage.getItem('cameraIcon') || DEFAULT_CAMERA_ICON); setAppTitle(localStorage.getItem('appTitle') || "小屁铃"); setMomentsTitle(localStorage.getItem('momentsTitle') || "我们的点滴"); setMomentsCover(localStorage.getItem('momentsCover') || DEFAULT_COVER); setAnniversaryDate(localStorage.getItem('anniversaryDate') || "2023-01-01"); setAvatarUrl(localStorage.getItem('avatarUrl') || '');
  }, []);

  useSafeStorage('pinnedPhotos', pinnedPhotos); useSafeStorage('albums', albums); useSafeStorage('memories', memories); useSafeStorage('todos', todos); useSafeStorage('periods', periods); useSafeStorage('conflicts', conflicts); useSafeStorage('messages', messages); useSafeStorage('cameraIcon', cameraIcon); useSafeStorage('momentsCover', momentsCover); useSafeStorage('avatarUrl', avatarUrl);
  useEffect(() => localStorage.setItem('appTitle', appTitle), [appTitle]); useEffect(() => localStorage.setItem('momentsTitle', momentsTitle), [momentsTitle]); useEffect(() => localStorage.setItem('anniversaryDate', anniversaryDate), [anniversaryDate]);

  // 处理安卓物理返回键
  useEffect(() => {
    const handleBackButton = async () => {
      // 1. 优先检查历史记录：如果有上一页，就退回去
      if (history.length > 0) {
        const newHistory = [...history];
        const prevPage = newHistory.pop(); // 取出最近的一个页面
        setHistory(newHistory); // 更新历史记录
        if (prevPage) setActivePage(prevPage); // 切换回去
      } 
      // 2. 如果没有历史记录（比如刚打开App），但不在首页，就回首页
      else if (activePage !== Page.HOME) {
        setActivePage(Page.HOME);
      } 
      // 3. 既无历史，又在首页，才退出 App
      else {
        const info = await CapacitorApp.getInfo();
        CapacitorApp.exitApp();
      }
    };

    let listenerHandle: any;
    const setupListener = async () => {
        listenerHandle = await CapacitorApp.addListener('backButton', handleBackButton);
    };
    setupListener();

    return () => {
        if (listenerHandle) listenerHandle.remove();
    };
  }, [activePage, history]); // ⚠️注意：这里依赖项一定要加上 history
  
  
  const handleTakePhoto = () => {
    const allImages = [
        ...memories.filter(m => m.type === 'media').flatMap(m => m.media.map(url => ({ 
            url, 
            caption: m.caption, 
            id: m.id, 
            source: 'memory',
            date: m.date 
        }))), 
        ...albums.flatMap(a => a.media.map(m => ({ 
            url: m.url, 
            caption: m.caption || a.name, 
            id: m.id, 
            source: 'album',
            date: m.date 
        })))
    ];

    if (!allImages.length) return alert("相册里还没有照片哦！");
    
    let available = allImages.filter(img => !usedPhotoIds.includes(img.url));
    
    if (available.length === 0) {
        if (pinnedPhotos.length === 0) {
            setUsedPhotoIds([]);
            available = allImages; 
        } else {
            return alert("全部吐完啦~ 点清空按钮重置哦！");
        }
    }


    // --- 新增：智能切换页面函数 ---
  const handlePageChange = (newPage: Page) => {
    if (newPage === activePage) return;
    // 把当前页面压入历史栈
    setHistory(prev => [...prev, activePage]); 
    setActivePage(newPage);
  };
    
    const randomImg = available[Math.floor(Math.random() * available.length)];
    setUsedPhotoIds(prev => [...prev, randomImg.url]);
    setPinnedPhotos(prev => [...prev, { 
        id: Date.now().toString(), 
        memoryId: randomImg.id, 
        source: randomImg.source as any, 
        mediaUrl: randomImg.url, 
        customCaption: randomImg.caption, 
        x: (Math.random()*40)-20, 
        y: (Math.random()*40)-20, 
        rotation: (Math.random()*10)-5, 
        scale: 1,
        date: randomImg.date 
    }]);
  };

  const handleClearBoard = () => { setPinnedPhotos([]); setUsedPhotoIds([]); };
  
  const handleBringToFront = (id: string) => {
      setPinnedPhotos(prev => {
          const index = prev.findIndex(p => p.id === id);
          if (index === -1 || index === prev.length - 1) return prev;
          const newPhotos = [...prev];
          const [moved] = newPhotos.splice(index, 1);
          newPhotos.push(moved);
          return newPhotos;
      });
  };

  return (
    <div className="font-sans text-gray-800 bg-cream min-h-[100dvh]">
      <main className="w-full h-[100dvh] bg-white relative overflow-hidden">
         <AnimatePresence mode="wait">
            <motion.div key={activePage} className="w-full h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
               {activePage === Page.HOME && (
                <div className="relative w-full h-full bg-rose-50 overflow-hidden">
                  <div className="absolute inset-0 z-0 pointer-events-none opacity-40" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fbbf24' fill-opacity='0.2'%3E%3Cpath d='M20 20c-2 0-3-2-3-3s2-3 3-3 3 2 3 3-2 3-3 3zm10 0c-2 0-3-2-3-3s2-3 3-3 3 2 3 3-2 3-3 3zm-5 5c-3 0-5-2-5-4s2-3 5-3 5 2 5 3-2 4-5 4zM70 70l-5-5 5-5 5 5-5 5zm20-20c2 0 3 2 3 3s-2 3-3 3-3-2-3-3 2-3 3-3zm-10 0c2 0 3 2 3 3s-2 3-3 3-3-2-3-3 2-3 3-3zm5 5c3 0 5 2 5 4s-2 3-5 3-5-2-5-3 2-4 5-4z'/%3E%3C/g%3E%3C/svg%3E")`, backgroundSize: '100px 100px' }} />
                  
                  <div className="absolute inset-0 z-10 overflow-hidden">{pinnedPhotos.map((pin, i) => (<DraggablePhoto key={pin.id} pin={pin} onUpdate={(id:any, data:any) => setPinnedPhotos(prev => prev.map(p => p.id === id ? {...p, ...data} : p))} onDelete={(id:any) => setPinnedPhotos(prev => prev.filter(p => p.id !== id))} onBringToFront={handleBringToFront} isFresh={i === pinnedPhotos.length - 1 && Date.now() - parseInt(pin.id) < 2000} date={pin.date} />))}</div>
                  
                  <header className="absolute top-0 left-0 right-0 pt-6 px-4 md:pt-8 md:px-8 flex justify-between items-start z-[70] pointer-events-none">
                    <div className="pointer-events-auto">
                      {isEditingTitle ? (<input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} onBlur={() => setIsEditingTitle(false)} onKeyDown={(e) => { if(e.key === 'Enter') setIsEditingTitle(false); }} autoFocus className="text-4xl md:text-6xl font-cute text-rose-500 drop-shadow-sm -rotate-2 bg-transparent border-b-2 border-rose-300 outline-none w-48 md:w-80 text-center" />) : (
                             <h1 onClick={() => setIsEditingTitle(true)} className="text-4xl md:text-6xl font-cute text-rose-500 drop-shadow-sm -rotate-2 cursor-pointer select-none hover:scale-105 transition" title="点击修改">{appTitle}</h1>
                      )}
                      <p className="text-rose-400 text-xs md:text-sm mt-1 font-cute ml-1 md:ml-2 tracking-widest bg-white/50 backdrop-blur-sm inline-block px-2 rounded-lg">LOVE SPACE</p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-end pointer-events-auto">
                        <AnniversaryTimer startDate={anniversaryDate} onSetDate={() => { const d = prompt("纪念日 (YYYY-MM-DD)", anniversaryDate); if(d) setAnniversaryDate(d); }} />
                        <div className="bg-white/90 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-lg border-2 border-rose-100 p-2 flex flex-col items-center min-w-[70px] cursor-pointer" onClick={() => setActivePage(Page.CYCLE)}><span className="text-[9px] text-rose-400 font-bold uppercase font-cute">姨妈倒计时</span>{calculateNextPeriod() ? (<div className="text-center"><span className="text-lg font-bold text-rose-500 font-cute">{calculateNextPeriod()?.daysLeft}</span><span className="text-[9px] text-gray-400 ml-0.5 font-bold">天</span></div>) : (<span className="text-[9px] text-gray-400 mt-1">无数据</span>)}</div>
                        {pinnedPhotos.length > 0 && (<button onClick={handleClearBoard} className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border-2 border-rose-100 p-2 text-gray-400 hover:text-rose-500 min-h-[50px] min-w-[50px] flex flex-col items-center justify-center"><Trash2 size={20} /><span className="text-[9px] font-bold mt-1 font-cute">清空</span></button>)}
                    </div>
                  </header>
                  <div className="absolute top-40 left-8 w-64 z-[60] flex flex-col gap-6 pointer-events-none hidden md:flex"><div className="pointer-events-auto transform transition hover:scale-105 origin-top-left"><MiniCalendar periods={periods} conflicts={conflicts} /></div><div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-rose-50 pointer-events-auto transform transition hover:scale-105 origin-top-left"><h3 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2 font-cute"><CheckSquare size={16} className="text-rose-400"/> 备忘录</h3><div className="space-y-2 max-h-40 overflow-y-auto pr-1">{todos.filter(t => !t.completed).length === 0 && <p className="text-xs text-gray-400 italic">暂无待办</p>}{todos.filter(t => !t.completed).slice(0, 5).map(todo => (<div key={todo.id} onClick={() => setTodos(todos.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t))} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer group p-1 hover:bg-rose-50 rounded"><div className="w-3.5 h-3.5 rounded border border-rose-300 flex items-center justify-center bg-white group-hover:border-rose-400 shrink-0">{todo.completed && <div className="w-2 h-2 bg-rose-400 rounded-full" />}</div><span className={`font-cute truncate ${todo.completed ? 'line-through text-gray-400' : ''}`}>{todo.text}</span></div>))}</div></div></div>
                  
                  <div className="absolute top-28 left-4 z-[50] md:hidden pointer-events-none origin-top-left transform scale-[0.6]">
                        <div className="pointer-events-auto bg-white/20 backdrop-blur-md rounded-2xl p-2 border border-white/30 shadow-lg">
                            <MiniCalendar periods={periods} conflicts={conflicts} />
                        </div>
                  </div>
                  
                  <div className="absolute bottom-20 md:bottom-24 left-1/2 transform -translate-x-1/2 z-[70] flex justify-center pointer-events-none"><div className="pointer-events-auto"><PolaroidCamera onTakePhoto={handleTakePhoto} iconUrl={cameraIcon} onUploadIcon={(e:any) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = () => setCameraIcon(r.result as string); r.readAsDataURL(f); }}} onResetIcon={() => { setCameraIcon(DEFAULT_CAMERA_ICON); localStorage.removeItem('cameraIcon'); }} /></div></div>
                </div>
               )}
               {activePage !== Page.HOME && (
                   <div className="h-full relative">
                       {activePage === Page.MEMORIES && (<MemoriesViewContent memories={memories} albums={albums} setAlbums={setAlbums} handleLike={(id:string) => setMemories(memories.map(m => m.id === id ? { ...m, likes: m.isLiked ? m.likes - 1 : m.likes + 1, isLiked: !m.isLiked } : m))} handleComment={(id:string, t:string) => setMemories(memories.map(m => m.id === id ? { ...m, comments: [...m.comments, { id: Date.now().toString(), text: t, author: 'me', date: getBeijingDateString() }] } : m))} onFileSelect={(e:any) => { const f = e.target.files; if(f?.length) { Array.from(f).slice(0, 9-uploadImages.length).forEach((file:any) => { const r = new FileReader(); r.onload = () => setUploadImages(p => [...p, r.result as string]); r.readAsDataURL(file); }); setUploadType('media'); setShowUploadModal(true); } }} onTextPost={() => { setUploadType('text'); setUploadImages([]); setShowUploadModal(true); }} showUploadModal={showUploadModal} setShowUploadModal={setShowUploadModal} uploadImages={uploadImages} setUploadImages={setUploadImages} uploadCaption={uploadCaption} setUploadCaption={setUploadCaption} uploadType={uploadType} confirmUpload={() => { if((uploadType === 'media' && !uploadImages.length) || (uploadType === 'text' && !uploadCaption.trim())) return; setMemories([{ id: Date.now().toString(), media: uploadImages, caption: uploadCaption, date: getBeijingDateString(), type: uploadType, likes: 0, isLiked: false, comments: [] }, ...memories]); setShowUploadModal(false); setUploadImages([]); setUploadCaption(''); setUploadType('media'); }} coverUrl={momentsCover} onUpdateCover={(e:any) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = () => setMomentsCover(r.result as string); r.readAsDataURL(f); }}} onDeleteMemory={(id:string) => { if(confirm("删除?")) setMemories(memories.filter(m => m.id !== id)); }} momentsTitle={momentsTitle} setMomentsTitle={setMomentsTitle} avatarUrl={avatarUrl} setAvatarUrl={setAvatarUrl} setMomentsCover={setMomentsCover} />)}
                       {activePage === Page.CYCLE && <CycleViewContent periods={periods} nextPeriod={calculateNextPeriod()} addPeriod={(d:string) => setPeriods([...periods, { startDate: d, duration: 5 }].sort((a,b)=>parseLocalDate(a.startDate).getTime()-parseLocalDate(b.startDate).getTime()))} deletePeriod={(i:number) => { if(confirm("删除?")) { const n = [...periods]; n.splice(i,1); setPeriods(n); }}} />}
                       {activePage === Page.CONFLICT && <ConflictViewContent judgeConflict={judgeConflict} conflicts={conflicts} setConflicts={setConflicts} />}
                       {activePage === Page.BOARD && (<BoardViewContent messages={messages} onPost={(c:string) => setMessages([{ id: Date.now().toString(), content: c, date: getBeijingDateString(), time: new Date().toTimeString().slice(0,5), isPinned: false, isFavorite: false }, ...messages])} onPin={(id:string) => setMessages(messages.map(m => m.id === id ? { ...m, isPinned: !m.isPinned } : m))} onFav={(id:string) => setMessages(messages.map(m => m.id === id ? { ...m, isFavorite: !m.isFavorite } : m))} onDelete={(id:string) => { if(confirm("删除?")) setMessages(messages.filter(m => m.id !== id)); }} onAddTodo={(t:string, d:string) => setTodos([...todos, { id: Date.now().toString(), text: t, completed: false, assignee: 'both', date: d || getBeijingDateString() }])} setMessages={setMessages} />)}
                       {activePage === Page.CALENDAR && (<CalendarViewContent periods={periods} conflicts={conflicts} todos={todos} addTodo={(t:string, d:string) => setTodos([...todos, { id: Date.now().toString(), text: t, completed: false, assignee: 'both', date: d }])} toggleTodo={(id:string) => setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t))} setTodos={setTodos} onDeleteTodo={(id:string) => { if(confirm("删除此待办？")) setTodos(todos.filter(t => t.id !== id)); }} onDeleteConflict={(id:string) => { if(confirm("删除此记录？")) setConflicts(conflicts.filter(c => c.id !== id)); }} />)}
                   </div>
               )}
            </motion.div>
         </AnimatePresence>
      </main>
      <Navbar active={activePage} setPage={handlePageChange} />
    </div>
  );
}
