import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Heart, 
  Camera, 
  Calendar as CalendarIcon, 
  Zap, 
  CheckSquare, 
  Cat, 
  Upload, 
  Trash2, 
  X,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  ZoomIn,
  ZoomOut,
  Palette,
  RotateCcw,
  Pin,
  Star,
  Plus,
  MessageSquareHeart,
  Send,
  Loader2,
  Image as ImageIcon,
  FolderPlus,
  Grid,
  ArrowLeft,
  Edit2,
  Sparkles,
  Gavel,
  ShieldCheck,
  Lightbulb
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { judgeConflict, extractTodosFromText, JudgeResult } from './services/ai';
import { Memory, PinnedPhoto, PeriodEntry, TodoItem, ConflictRecord, Page, Message, Album, AlbumMedia } from './types';

// --- Helper Functions ---

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

// Gets 'YYYY-MM-DD' string based on Beijing/Local Time, avoiding UTC shifts
const getBeijingDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Parse a YYYY-MM-DD string into a Local Date object (00:00:00)
// This fixes the "off by one day" bug caused by new Date("YYYY-MM-DD") defaulting to UTC
const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(dateStr); // Fallback
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

// Safe LocalStorage Hook
const useSafeStorage = (key: string, value: any) => {
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.warn(`Storage quota exceeded for ${key}. Data will not persist after refresh.`);
      } else {
        console.error(`Error saving ${key} to localStorage`, e);
      }
    }
  }, [key, value]);
};

const DEFAULT_CAMERA_ICON = "https://images.unsplash.com/photo-1526045431048-f857369baa09?auto=format&fit=crop&w=600&q=80";
const DEFAULT_COVER = "https://images.unsplash.com/photo-1516962215378-7fa2e137ae91?auto=format&fit=crop&w=1000&q=80";

// --- Components ---

// 1. Image Viewer
const ImageViewer = ({ src, onClose, onAction, actionLabel }: { src: string; onClose: () => void; onAction?: () => void; actionLabel?: string }) => {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const startDist = useRef<number>(0);
  const startScale = useRef<number>(1);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        startDist.current = dist;
        startScale.current = scale;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        const newScale = startScale.current * (dist / startDist.current);
        setScale(Math.max(1, Math.min(newScale, 4)));
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
      }
    };
  }, [scale]);

  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      setScale(prev => prev > 1 ? 1 : 2.5);
  };

  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onAction) onAction();
  };

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] bg-black flex items-center justify-center overflow-hidden"
      onClick={onClose}
      ref={containerRef}
    >
      <motion.img
        src={src}
        drag={scale > 1}
        dragConstraints={{ left: -200 * scale, right: 200 * scale, top: -200 * scale, bottom: 200 * scale }}
        style={{ scale }}
        className="max-w-full max-h-full object-contain touch-none"
        onClick={handleClick}
        onDoubleClick={handleDoubleTap}
      />
      
      {onAction && actionLabel && (
           <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none">
               <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); onAction(); }}>
                   {actionLabel}
               </div>
           </div>
      )}

      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-4 pointer-events-none">
          <button className="pointer-events-auto bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition" onClick={onClose}>
            <X size={24}/>
          </button>
      </div>
    </motion.div>,
    document.body
  );
};

// 2. Navigation
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
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${
              active === item.id ? 'text-rose-500 scale-110' : 'text-gray-400 hover:text-rose-300'
            }`}
          >
            {item.icon}
            <span className="text-[10px] font-bold mt-1 font-cute transform scale-90">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

// 3. Polaroid Camera
const PolaroidCamera = ({ 
  onTakePhoto, 
  iconUrl, 
  onUploadIcon, 
  onResetIcon 
}: { 
  onTakePhoto: () => void;
  iconUrl: string;
  onUploadIcon: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetIcon: () => void;
}) => {
  const [flashing, setFlashing] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.camera-actions')) return;
    if (flashing) return;
    setFlashing(true);
    setTimeout(() => {
      setFlashing(false);
      onTakePhoto();
    }, 150);
  };

  return (
    <div className="relative group w-32 mx-auto z-40" onClick={handleClick}>
      {flashing && createPortal(
          <div className="fixed inset-0 bg-white z-[9999] animate-[pulse_0.15s_ease-in-out]" />,
          document.body
      )}
      <div className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95">
        <img 
          src={iconUrl} 
          alt="Polaroid Camera"
          className="w-full drop-shadow-2xl relative z-30 object-contain max-h-32"
        />
      </div>
      <div className="camera-actions absolute -right-12 bottom-0 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 scale-75 origin-bottom-left">
         <label className="bg-white text-rose-500 p-2 rounded-full shadow-md cursor-pointer hover:bg-rose-50 transition-colors" title="更换相机图标">
             <Palette size={16} />
             <input type="file" accept="image/*" className="hidden" onChange={onUploadIcon} />
         </label>
         {iconUrl !== DEFAULT_CAMERA_ICON && (
             <button 
                onClick={(e) => { e.stopPropagation(); onResetIcon(); }}
                className="bg-white text-gray-500 p-2 rounded-full shadow-md cursor-pointer hover:bg-gray-50 transition-colors" 
                title="恢复默认图标"
             >
                 <RotateCcw size={16} />
             </button>
         )}
      </div>
    </div>
  );
};

// 4. Draggable Photo
interface DraggablePhotoProps {
  pin: PinnedPhoto;
  onUpdate: (id: string, changes: Partial<PinnedPhoto>) => void;
  onDelete: (id: string) => void;
  isFresh?: boolean;
  date?: string; // Add date prop
}

const DraggablePhoto: React.FC<DraggablePhotoProps> = ({ pin, onUpdate, onDelete, isFresh = false, date }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const displayCaption = pin.customCaption || '美好回忆';

  const startEditing = () => {
    setEditValue(displayCaption);
    setIsEditing(true);
  };

  const finishEditing = () => {
    setIsEditing(false);
    onUpdate(pin.id, { customCaption: editValue });
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(pin.id, { scale: Math.min(2.5, pin.scale + 0.1) });
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(pin.id, { scale: Math.max(0.5, pin.scale - 0.1) });
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={isFresh ? { opacity: 0, y: 150, scale: 0.5, rotate: 0 } : false}
      animate={{ 
        opacity: 1, 
        scale: pin.scale, 
        rotate: pin.rotation, 
        x: pin.x, 
        y: pin.y 
      }}
      transition={{ type: "spring", stiffness: 120, damping: 20 }}
      whileHover={{ zIndex: 50 }}
      whileTap={{ cursor: 'grabbing', zIndex: 60 }}
      onDragEnd={(e, info) => {
         onUpdate(pin.id, { x: pin.x + info.offset.x, y: pin.y + info.offset.y });
      }}
      className={`absolute w-44 bg-white p-3 pb-4 shadow-xl flex flex-col items-center group ${isFresh ? 'z-20' : 'z-10'}`}
      style={{ 
        top: '50%', 
        left: '50%',
        marginTop: -110, 
        marginLeft: -88,
      }} 
    >
      <div className="w-full h-36 bg-gray-100 mb-2 overflow-hidden shadow-inner bg-black/5">
        <img src={pin.mediaUrl} alt="Memory" className="w-full h-full object-cover pointer-events-none select-none" />
      </div>
      
      {isEditing ? (
        <input 
          autoFocus
          className="w-full text-center font-cute text-gray-700 bg-rose-50 border-none focus:ring-0 text-sm p-1 rounded"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={finishEditing}
          onKeyDown={(e) => {
            if(e.key === 'Enter') finishEditing();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="text-center w-full" onDoubleClick={(e) => { e.stopPropagation(); startEditing(); }}>
          <p className="font-cute text-gray-700 text-sm truncate px-1 cursor-text">{displayCaption}</p>
          <p className="text-[10px] text-gray-400 font-sans mt-0.5">{date || 'Just now'}</p>
        </div>
      )}
      
      {/* Pin graphic */}
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-rose-400 shadow-sm border-2 border-white z-20" />
      
      {/* Action Buttons */}
      <div className="absolute -right-10 top-0 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity p-2">
        <button onClick={(e) => { e.stopPropagation(); onDelete(pin.id); }} className="bg-white text-rose-500 rounded-full p-2 shadow-md hover:bg-rose-500 hover:text-white transition-colors"><X size={16} /></button>
        <button onClick={handleZoomIn} className="bg-white text-gray-600 rounded-full p-2 shadow-md hover:bg-blue-500 hover:text-white transition-colors"><ZoomIn size={16} /></button>
        <button onClick={handleZoomOut} className="bg-white text-gray-600 rounded-full p-2 shadow-md hover:bg-blue-500 hover:text-white transition-colors"><ZoomOut size={16} /></button>
      </div>
    </motion.div>
  );
};

// 5. Mini Calendar (Dashboard)
const MiniCalendar = ({ periods, conflicts }: { periods: PeriodEntry[], conflicts: ConflictRecord[] }) => {
    const today = new Date();
    const daysInMonth = getDaysInMonth(today.getFullYear(), today.getMonth());
    const firstDay = getFirstDayOfMonth(today.getFullYear(), today.getMonth());
    const days = Array(firstDay).fill(null).concat([...Array(daysInMonth).keys()].map(i => i + 1));

    return (
        <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-rose-100 w-full">
            <h4 className="text-xs font-bold text-gray-500 mb-3 font-cute flex items-center gap-2">
                <CalendarIcon size={14} className="text-rose-400" /> {today.getFullYear()}年{today.getMonth() + 1}月
            </h4>
            <div className="grid grid-cols-7 gap-1">
                {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-[10px] text-center text-gray-400 font-bold">{d}</div>)}
                {days.map((d, i) => {
                    if (!d) return <div key={i} />;
                    
                    const isPeriod = periods.some(p => {
                       const start = parseLocalDate(p.startDate);
                       const end = new Date(start); 
                       end.setDate(start.getDate() + p.duration);
                       const curr = new Date(today.getFullYear(), today.getMonth(), d);
                       return curr >= start && curr < end;
                    });
                    const isConflict = conflicts.some(c => {
                       const date = parseLocalDate(c.date);
                       return date.getDate() === d && date.getMonth() === today.getMonth();
                    });
                    
                    return (
                        <div key={i} className={`aspect-square rounded-full flex items-center justify-center text-[10px] font-medium transition-all
                            ${d === today.getDate() ? 'bg-rose-500 text-white shadow-md scale-110' : 'text-gray-600 hover:bg-rose-50'}
                            ${isPeriod && d !== today.getDate() ? 'bg-red-500 text-white' : ''}
                            ${isConflict && d !== today.getDate() ? 'ring-1 ring-indigo-200 bg-indigo-50' : ''}
                        `}>
                            {d}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

// --- Content Components ---

const MemoriesViewContent = ({
  memories, albums, setAlbums, handleLike, handleComment,
  onFileSelect, onTextPost, showUploadModal, setShowUploadModal,
  uploadImages, setUploadImages, uploadCaption, setUploadCaption,
  uploadType, confirmUpload, coverUrl, onUpdateCover
}: any) => {
  const [activeTab, setActiveTab] = useState<'moments' | 'albums'>('moments');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [commentInputs, setCommentInputs] = useState<{[key:string]: string}>({});
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const createAlbum = () => {
    if(!newAlbumName.trim()) return;
    const newAlbum: Album = {
        id: Date.now().toString(),
        name: newAlbumName,
        coverUrl: 'https://images.unsplash.com/photo-1534972195531-d756b9bfa9f2?auto=format&fit=crop&w=400&q=80',
        createdAt: getBeijingDateString(),
        media: []
    };
    setAlbums((prev: Album[]) => [newAlbum, ...prev]);
    setNewAlbumName('');
    setIsCreatingAlbum(false);
  };

  const handleAlbumUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedAlbum || !e.target.files) return;
      const files = Array.from(e.target.files);
      const newMedia: AlbumMedia[] = [];
      
      let processedCount = 0;
      files.forEach(file => {
          const reader = new FileReader();
          reader.onloadend = () => {
              newMedia.push({
                  id: Date.now().toString() + Math.random(),
                  url: reader.result as string,
                  date: getBeijingDateString(),
                  type: 'image'
              });
              processedCount++;
              if (processedCount === files.length) {
                  setAlbums((prev: Album[]) => prev.map(a => 
                      a.id === selectedAlbum.id ? { ...a, media: [...newMedia, ...a.media] } : a
                  ));
                  setSelectedAlbum(prev => prev ? { ...prev, media: [...newMedia, ...prev.media] } : null);
              }
          };
          reader.readAsDataURL(file);
      });
  };

  const onCommentChange = (id: string, val: string) => {
      setCommentInputs(prev => ({...prev, [id]: val}));
  };

  const submitComment = (id: string) => {
      if(!commentInputs[id]?.trim()) return;
      handleComment(id, commentInputs[id]);
      setCommentInputs(prev => ({...prev, [id]: ''}));
  };

  // Camera Button Logic
  const handlePressStart = () => {
      pressTimer.current = setTimeout(() => {
          // Long press triggered
          onTextPost();
          pressTimer.current = null;
      }, 500);
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
      if (pressTimer.current) {
          clearTimeout(pressTimer.current);
          pressTimer.current = null;
          // If less than 500ms, it's a click -> Open image select
          document.getElementById('camera-upload')?.click();
      }
      // e.preventDefault(); // Removed to allow scrolling interaction on parent
  };

  if (selectedAlbum) {
      return (
          <div className="h-full bg-white flex flex-col pb-20">
              <div className="p-4 border-b flex items-center gap-4 bg-white/80 backdrop-blur sticky top-0 z-10">
                  <button onClick={() => setSelectedAlbum(null)} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft /></button>
                  <h2 className="text-xl font-bold font-cute flex-1">{selectedAlbum.name}</h2>
                  <label className="p-2 bg-rose-50 text-rose-500 rounded-full cursor-pointer hover:bg-rose-100">
                      <Plus size={24} />
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleAlbumUpload} />
                  </label>
              </div>
              <div className="p-4 grid grid-cols-3 gap-2 overflow-y-auto">
                  {selectedAlbum.media.length === 0 && <div className="col-span-3 text-center text-gray-400 py-10">相册是空的，上传第一张照片吧！</div>}
                  {selectedAlbum.media.map((item, idx) => (
                      <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer" onClick={() => setViewingImage(item.url)}>
                          <img src={item.url} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                  ))}
              </div>
              {viewingImage && <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />}
          </div>
      )
  }

  return (
    <div className="min-h-full bg-white pb-24 relative">
        {/* Cover Image Header - No longer absolute/drag */}
        <div className="relative h-72 w-full group cursor-pointer" onClick={() => document.getElementById('cover-upload')?.click()}>
            <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="text-white font-bold border border-white px-4 py-1 rounded-full backdrop-blur-md">更换封面</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />
            
            {/* Header Content on Cover */}
            <div className="absolute top-4 right-4 z-20" onClick={(e) => e.stopPropagation()}>
                <button 
                    className="bg-white/20 backdrop-blur-md p-2 rounded-xl text-white hover:bg-white/30 active:scale-95 transition"
                    onMouseDown={handlePressStart}
                    onMouseUp={handlePressEnd}
                    onTouchStart={handlePressStart}
                    onTouchEnd={handlePressEnd}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <Camera size={24} />
                </button>
                <input id="camera-upload" type="file" multiple accept="image/*" className="hidden" onChange={onFileSelect} />
            </div>
            
            <div className="absolute bottom-4 left-4 text-white pointer-events-none">
                <h2 className="text-3xl font-bold font-cute shadow-black drop-shadow-md">我们的点滴</h2>
            </div>

            {/* Avatar & Info */}
            <div className="absolute -bottom-6 right-8 flex gap-4 z-20 pointer-events-none">
                <div className="bg-white p-1 rounded-xl shadow-lg transform rotate-3">
                    <div className="w-16 h-16 bg-rose-100 rounded-lg flex items-center justify-center overflow-hidden">
                        <span className="text-2xl">💑</span>
                    </div>
                </div>
            </div>
        </div>

      {/* Navigation */}
      <div className="flex justify-center mt-12 mb-6 border-b border-gray-100 pb-1 relative bg-white sticky top-0 z-30">
          <button 
              onClick={() => setActiveTab('moments')}
              className={`px-6 py-2 font-bold transition-all relative ${activeTab === 'moments' ? 'text-rose-500' : 'text-gray-400'}`}
          >
              瞬间
              {activeTab === 'moments' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />}
          </button>
          <button 
              onClick={() => setActiveTab('albums')}
              className={`px-6 py-2 font-bold transition-all relative ${activeTab === 'albums' ? 'text-rose-500' : 'text-gray-400'}`}
          >
              相册
              {activeTab === 'albums' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />}
          </button>
      </div>

      {/* Content */}
      <div className="px-4 md:px-8 max-w-4xl mx-auto min-h-[50vh] bg-white">
          {activeTab === 'moments' ? (
              <div className="space-y-8">
                  {memories.map((memory: Memory) => (
                      <div key={memory.id} className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-gray-50">
                          <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-lg">🐶</div>
                              <div>
                                  <h4 className="font-bold text-gray-800 font-cute">我们</h4>
                                  <span className="text-xs text-gray-400">{memory.date}</span>
                              </div>
                          </div>
                          <p className="mb-4 text-gray-700 leading-relaxed font-cute">{memory.caption}</p>
                          {memory.type === 'media' && memory.media.length > 0 && (
                              <div className={`grid gap-2 mb-4 ${memory.media.length === 1 ? 'grid-cols-1' : memory.media.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                  {memory.media.map((url: string, idx: number) => (
                                      <div key={idx} onClick={() => setViewingImage(url)} className="aspect-square rounded-2xl overflow-hidden cursor-pointer">
                                          <img src={url} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" alt="Memory" />
                                      </div>
                                  ))}
                              </div>
                          )}
                          <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                              <div className="flex gap-4">
                                  <button onClick={() => handleLike(memory.id)} className={`flex items-center gap-1.5 text-sm font-bold transition ${memory.isLiked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-400'}`}>
                                      <Heart size={18} fill={memory.isLiked ? "currentColor" : "none"} />
                                      {memory.likes}
                                  </button>
                                  <div className="flex items-center gap-1.5 text-sm font-bold text-gray-400">
                                      <MessageCircle size={18} />
                                      {memory.comments.length}
                                  </div>
                              </div>
                          </div>
                          
                          {/* Comments List */}
                          {memory.comments.length > 0 && (
                              <div className="mt-3 bg-gray-50 rounded-xl p-3 space-y-1">
                                  {memory.comments.map((c: any) => (
                                      <div key={c.id} className="text-xs">
                                          <span className="font-bold text-gray-600">我:</span> <span className="text-gray-500">{c.text}</span>
                                      </div>
                                  ))}
                              </div>
                          )}

                          {/* Add Comment */}
                          <div className="mt-3 flex gap-2">
                              <input 
                                  className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-rose-200"
                                  placeholder="评论..."
                                  value={commentInputs[memory.id] || ''}
                                  onChange={(e) => onCommentChange(memory.id, e.target.value)}
                                  onKeyDown={(e) => { if(e.key === 'Enter') submitComment(memory.id); }}
                              />
                              <button 
                                  onClick={() => submitComment(memory.id)}
                                  disabled={!commentInputs[memory.id]?.trim()}
                                  className="text-rose-500 disabled:text-gray-300 p-1.5 hover:bg-rose-50 rounded-lg transition"
                              >
                                  <Send size={16} />
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div 
                      onClick={() => setIsCreatingAlbum(true)} 
                      className="aspect-square bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-100 hover:border-rose-300 hover:text-rose-400 transition cursor-pointer"
                  >
                      <FolderPlus size={32} className="mb-2" />
                      <span className="font-cute text-sm">新建相册</span>
                  </div>
                  {albums.map((album: Album) => (
                      <div key={album.id} onClick={() => setSelectedAlbum(album)} className="aspect-square bg-white rounded-3xl shadow-sm border border-gray-100 p-2 relative group overflow-hidden cursor-pointer">
                          <img src={album.coverUrl} className="w-full h-full object-cover rounded-2xl" alt={album.name} />
                          <div className="absolute inset-0 bg-black/40 flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="text-white">
                                  <h4 className="font-bold">{album.name}</h4>
                                  <span className="text-xs opacity-80">{album.media.length} 张照片</span>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800 font-cute">
                        {uploadType === 'media' ? '发布照片' : '写日记'}
                    </h3>
                    <button onClick={() => setShowUploadModal(false)}><X className="text-gray-400" /></button>
                </div>
                
                {uploadType === 'media' && (
                    <div className="grid grid-cols-3 gap-2 mb-4 max-h-60 overflow-y-auto">
                        {uploadImages.map((img: string, i: number) => (
                            <div key={i} className="aspect-square rounded-xl overflow-hidden relative">
                                <img src={img} className="w-full h-full object-cover" />
                                <button onClick={() => setUploadImages(uploadImages.filter((_:any, idx:number) => idx !== i))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X size={12} /></button>
                            </div>
                        ))}
                        {uploadImages.length < 9 && (
                            <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 cursor-pointer hover:bg-gray-50">
                                <Plus size={24} />
                                <input type="file" multiple accept="image/*" className="hidden" onChange={onFileSelect} />
                            </label>
                        )}
                    </div>
                )}

                <textarea 
                    value={uploadCaption}
                    onChange={(e) => setUploadCaption(e.target.value)}
                    placeholder="写点什么..."
                    className="w-full bg-gray-50 rounded-xl p-3 h-24 mb-4 outline-none resize-none focus:ring-2 focus:ring-rose-100"
                />

                <button onClick={confirmUpload} className="w-full bg-rose-500 text-white py-3 rounded-xl font-bold hover:bg-rose-600 transition">
                    发布
                </button>
            </div>
        </div>
      )}

      {/* Create Album Modal */}
      {isCreatingAlbum && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in">
                <h3 className="text-lg font-bold text-gray-800 font-cute mb-4">创建新相册</h3>
                <input 
                    autoFocus
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4 outline-none focus:ring-2 focus:ring-rose-100"
                    placeholder="相册名称..."
                    value={newAlbumName}
                    onChange={e => setNewAlbumName(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                    <button onClick={() => setIsCreatingAlbum(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">取消</button>
                    <button onClick={createAlbum} className="px-6 py-2 bg-rose-500 text-white rounded-lg font-bold shadow-md hover:bg-rose-600 transition">创建</button>
                </div>
            </div>
        </div>
      )}

      {viewingImage && <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />}
      
      <input id="cover-upload" type="file" className="hidden" onChange={onUpdateCover} accept="image/*" />
    </div>
  );
};

const CycleViewContent = ({ periods, nextPeriod, addPeriod }: any) => {
  const handleLogPeriod = () => {
      // Use today's date
      const today = getBeijingDateString();
      if(confirm(`记录今天 (${today}) 为大姨妈开始日？`)) {
          addPeriod(today);
      }
  };

  return (
    <div className="p-6 space-y-6 pb-24 h-full overflow-y-auto">
        <div className="bg-white rounded-3xl p-8 shadow-xl text-center border-2 border-rose-100 relative overflow-hidden">
             <div className="relative z-10">
                <h2 className="text-gray-500 font-bold mb-2 font-cute">距离下次大姨妈还有</h2>
                <div className="text-6xl font-black text-rose-500 my-4 font-cute">
                    {nextPeriod ? nextPeriod.daysLeft : '?'}
                    <span className="text-lg text-gray-400 ml-2 font-bold">天</span>
                </div>
                {nextPeriod && <p className="text-gray-400 text-sm">预计日期: {nextPeriod.date}</p>}
                
                <button 
                    onClick={handleLogPeriod}
                    className="mt-8 bg-rose-500 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-rose-200 hover:scale-105 transition-transform active:scale-95 flex items-center gap-2 mx-auto cursor-pointer z-50 relative"
                >
                    <Heart fill="white" size={20} />
                    大姨妈来了
                </button>
             </div>
             {/* Decor */}
             <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-rose-50 rounded-full opacity-50 pointer-events-none" />
             <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-rose-50 rounded-full opacity-50 pointer-events-none" />
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50">
            <h3 className="font-bold text-gray-700 mb-4 font-cute flex items-center gap-2">
                <RotateCcw size={18} className="text-rose-400" /> 历史记录
            </h3>
            <div className="space-y-3">
                {periods.slice().reverse().map((p: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-rose-50/50 rounded-xl">
                        <span className="font-bold text-gray-600">{p.startDate}</span>
                        <span className="text-xs text-rose-400 font-bold px-2 py-1 bg-white rounded-lg shadow-sm">持续 {p.duration} 天</span>
                    </div>
                ))}
                {periods.length === 0 && <p className="text-center text-gray-400 text-sm py-4">还没有记录哦</p>}
            </div>
        </div>
    </div>
  );
};

const ConflictViewContent = ({ judgeConflict, conflicts, setConflicts }: any) => {
    const [reason, setReason] = useState('');
    const [hisPoint, setHisPoint] = useState('');
    const [herPoint, setHerPoint] = useState('');
    const [isJudging, setIsJudging] = useState(false);

    const handleJudge = async () => {
        if(!reason || !hisPoint || !herPoint) return alert("请填写完整信息喵！");
        setIsJudging(true);
        const result = await judgeConflict(reason, hisPoint, herPoint);
        const newRecord: ConflictRecord = {
            id: Date.now().toString(),
            date: getBeijingDateString(),
            reason, hisPoint, herPoint,
            aiResponse: result,
            isPinned: false,
            isFavorite: false
        };
        setConflicts([newRecord, ...conflicts]);
        setIsJudging(false);
        setReason(''); setHisPoint(''); setHerPoint('');
    };

    const togglePin = (id: string) => {
        setConflicts(conflicts.map((c: ConflictRecord) => c.id === id ? { ...c, isPinned: !c.isPinned } : c));
    };

    const toggleFav = (id: string) => {
        setConflicts(conflicts.map((c: ConflictRecord) => c.id === id ? { ...c, isFavorite: !c.isFavorite } : c));
    };

    const deleteRecord = (id: string) => {
        if(window.confirm("确定要删除这条记录吗？喵？")) {
            setConflicts(conflicts.filter((c: ConflictRecord) => c.id !== id));
        }
    };

    // Sort: Pinned first, then by date desc
    const sortedConflicts = [...conflicts].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return parseInt(b.id) - parseInt(a.id);
    });

    return (
        <div className="p-4 pb-24 space-y-6 bg-gray-50 min-h-full overflow-y-auto">
            <div className="bg-white rounded-3xl p-6 shadow-md border border-indigo-50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-2xl">🐱</div>
                    <div>
                        <h2 className="font-bold text-xl font-cute text-indigo-900">喵喵法官</h2>
                        <p className="text-xs text-gray-400">专治各种不服</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 ml-1 block mb-1">吵架原因</label>
                        <input className="w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="比如：谁去洗碗..." value={reason} onChange={e => setReason(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-blue-500 ml-1 block mb-1">公猫观点</label>
                            <textarea className="w-full bg-blue-50/50 rounded-xl p-3 text-sm h-24 resize-none focus:ring-2 focus:ring-blue-100 outline-none" placeholder="我觉得..." value={hisPoint} onChange={e => setHisPoint(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-rose-500 ml-1 block mb-1">母猫观点</label>
                            <textarea className="w-full bg-rose-50/50 rounded-xl p-3 text-sm h-24 resize-none focus:ring-2 focus:ring-rose-100 outline-none" placeholder="明明是..." value={herPoint} onChange={e => setHerPoint(e.target.value)} />
                        </div>
                    </div>
                    <button 
                        onClick={handleJudge}
                        disabled={isJudging}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition flex justify-center items-center gap-2"
                    >
                        {isJudging ? <Loader2 className="animate-spin" /> : <Gavel size={20} />}
                        {isJudging ? '喵喵思考中...' : '请喵喵裁决'}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {sortedConflicts.map((c: ConflictRecord) => (
                    <div key={c.id} className={`bg-white rounded-3xl p-5 shadow-sm border relative overflow-hidden transition-all ${c.isFavorite ? 'border-pink-200 bg-pink-50/30' : 'border-gray-100'}`}>
                        {c.isPinned && <div className="absolute top-0 right-0 p-2 text-indigo-500 transform rotate-12"><Pin size={16} fill="currentColor" /></div>}
                        
                        <div className="flex justify-between items-start mb-3 pr-6">
                            <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-md">{c.date}</span>
                            <div className="flex gap-1">
                                {c.aiResponse && (
                                    <>
                                        <span className="text-xs font-bold text-blue-500">公猫过错 {c.aiResponse.hisFault}%</span>
                                        <span className="text-gray-300">|</span>
                                        <span className="text-xs font-bold text-rose-500">母猫过错 {c.aiResponse.herFault}%</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <h4 className="font-bold text-gray-800 mb-2 font-cute">{c.reason}</h4>
                        {c.aiResponse && (
                            <div className="space-y-2 mt-3">
                                <div className="bg-indigo-50 rounded-xl p-3 text-sm text-indigo-900 leading-relaxed relative">
                                    <p className="font-cute">🐱 <span className="font-bold">复盘:</span> {c.aiResponse.analysis}</p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-3 text-sm text-green-900 leading-relaxed">
                                    <p className="font-cute">💡 <span className="font-bold">建议:</span> {c.aiResponse.advice}</p>
                                </div>
                                {c.aiResponse.prevention && (
                                    <div className="bg-yellow-50 rounded-xl p-3 text-sm text-yellow-900 leading-relaxed">
                                        <p className="font-cute">🛡️ <span className="font-bold">预防:</span> {c.aiResponse.prevention}</p>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Actions */}
                        <div className="flex justify-end gap-3 mt-4 border-t border-gray-100 pt-3">
                            <button onClick={() => toggleFav(c.id)} className={`${c.isFavorite ? 'text-pink-500' : 'text-gray-400 hover:text-pink-500'}`}><Heart size={18} fill={c.isFavorite ? "currentColor" : "none"} /></button>
                            <button onClick={() => togglePin(c.id)} className={`${c.isPinned ? 'text-indigo-500' : 'text-gray-400 hover:text-indigo-500'}`}><Pin size={18} fill={c.isPinned ? "currentColor" : "none"} /></button>
                            <button onClick={() => deleteRecord(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const BoardViewContent = ({ messages, onPost, onPin, onFav, onDelete, onAddTodo }: any) => {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSend = async () => {
        if(!input.trim()) return;
        
        onPost(input);
        
        if(input.includes('今天') || input.includes('明天') || input.includes('要做') || input.includes('提醒')) {
            setIsProcessing(true);
            const todos = await extractTodosFromText(input, getBeijingDateString());
            if(todos.length > 0) {
                todos.forEach(t => onAddTodo(t.text, t.date));
                alert(`自动识别并添加了 ${todos.length} 个待办事项喵！`);
            }
            setIsProcessing(false);
        }
        
        setInput('');
    };

    return (
        <div className="flex flex-col h-full bg-yellow-50/30">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                <div className="grid grid-cols-2 gap-3">
                    {messages.map((msg: Message) => (
                        <div key={msg.id} className={`p-4 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl shadow-sm border text-sm relative group transition hover:scale-[1.02] ${msg.isFavorite ? 'bg-rose-50 border-rose-100' : 'bg-white border-yellow-100'}`}>
                             <p className="text-gray-700 font-cute mb-6 leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                             <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => onFav(msg.id)} className={`${msg.isFavorite ? 'text-rose-500' : 'text-gray-300 hover:text-rose-500'}`}><Heart size={14} fill={msg.isFavorite ? "currentColor" : "none"} /></button>
                                 <button onClick={() => onPin(msg.id)} className={`${msg.isPinned ? 'text-blue-500' : 'text-gray-300 hover:text-blue-500'}`}><Pin size={14} fill={msg.isPinned ? "currentColor" : "none"} /></button>
                                 <button onClick={() => onDelete(msg.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                             </div>
                             <div className="absolute bottom-2 left-3 text-[10px] text-gray-300 font-bold">{msg.date.slice(5)} {msg.time}</div>
                             {msg.isPinned && <div className="absolute -top-2 -right-2 text-blue-500 transform rotate-12"><Pin size={16} fill="currentColor" /></div>}
                        </div>
                    ))}
                </div>
            </div>
            <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-gray-100 pb-safe safe-area-inset-bottom z-40">
                <div className="relative max-w-2xl mx-auto">
                    <textarea 
                        className="w-full bg-gray-50 rounded-2xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-100 resize-none h-14"
                        placeholder="写给对方的留言..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-rose-500 text-white rounded-xl shadow-md disabled:bg-gray-300 transition hover:scale-105 active:scale-95"
                    >
                        {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CalendarViewContent = ({ periods, conflicts, todos, addTodo, toggleTodo, setTodos }: any) => {
    // Simple Calendar Implementation
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(getBeijingDateString());
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); 
    
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = Array(firstDay).fill(null).concat([...Array(daysInMonth).keys()].map(i => i + 1));
    
    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    
    const handleDateClick = (day: number) => {
        const d = String(day).padStart(2, '0');
        const m = String(month + 1).padStart(2, '0');
        setSelectedDate(`${year}-${m}-${d}`);
    };
    
    // Derived data for selected date
    const dayTodos = todos.filter((t: TodoItem) => t.date === selectedDate);
    const dayConflicts = conflicts.filter((c: ConflictRecord) => c.date === selectedDate);
    
    // Helpers
    const isPeriodDay = (dateStr: string) => {
        return periods.some((p: PeriodEntry) => {
           const start = parseLocalDate(p.startDate);
           const end = new Date(start); 
           end.setDate(start.getDate() + p.duration);
           const curr = parseLocalDate(dateStr);
           return curr >= start && curr < end;
        });
    }

    const isPredictedPeriodDay = (dateStr: string) => {
        if(periods.length === 0) return false;
        // Simple prediction: last period + 28 days
        const lastPeriod = periods[periods.length - 1];
        const lastStart = parseLocalDate(lastPeriod.startDate);
        const predictedStart = new Date(lastStart);
        predictedStart.setDate(lastStart.getDate() + 28);
        const predictedEnd = new Date(predictedStart);
        predictedEnd.setDate(predictedStart.getDate() + 5);

        const curr = parseLocalDate(dateStr);
        // Only show prediction if it's in the future compared to last recorded period
        return curr >= predictedStart && curr < predictedEnd;
    }

    return (
        <div className="h-full bg-white flex flex-col pb-20">
            {/* Legend */}
            <div className="bg-gray-50 py-3 px-4 flex gap-4 overflow-x-auto text-xs font-bold text-gray-500 justify-center">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div>经期</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-400"></div>预测</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-400"></div>待办</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-pink-400"></div>吵架</div>
            </div>

            {/* Header */}
            <div className="px-6 pt-4 pb-2 flex justify-between items-center">
                <h2 className="text-xl font-bold font-cute text-gray-800">{year}年 {month + 1}月</h2>
                <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-2 bg-gray-50 rounded-full hover:bg-rose-50 transition"><ChevronLeft size={20} /></button>
                    <button onClick={nextMonth} className="p-2 bg-gray-50 rounded-full hover:bg-rose-50 transition"><ChevronRight size={20} /></button>
                </div>
            </div>
            
            {/* Calendar Grid */}
            <div className="px-4">
                <div className="grid grid-cols-7 mb-2">
                    {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-center text-xs text-gray-400 font-bold py-2">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-y-2">
                    {days.map((d, i) => {
                        if (!d) return <div key={i} />;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isSelected = dateStr === selectedDate;
                        const isToday = dateStr === getBeijingDateString();
                        const hasTodo = todos.some((t: TodoItem) => t.date === dateStr && !t.completed);
                        const hasConflict = conflicts.some((c: ConflictRecord) => c.date === dateStr);
                        const inPeriod = isPeriodDay(dateStr);
                        const isPredicted = isPredictedPeriodDay(dateStr);
                        
                        return (
                            <div key={i} className="flex justify-center relative">
                                <button 
                                    onClick={() => handleDateClick(d)}
                                    className={`
                                        w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all relative
                                        ${isSelected ? 'bg-gray-800 text-white shadow-lg scale-110 z-10' : 'text-gray-700 hover:bg-gray-50'}
                                        ${isToday && !isSelected ? 'bg-rose-50 text-rose-500' : ''}
                                        ${inPeriod && !isSelected ? 'bg-red-50 text-red-500 border border-red-100' : ''}
                                        ${isPredicted && !inPeriod && !isSelected ? 'bg-blue-50 text-blue-400 border border-blue-100' : ''}
                                    `}
                                >
                                    {d}
                                    {/* Indicators */}
                                    <div className="absolute bottom-1 flex gap-0.5">
                                        {hasTodo && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-yellow-400'}`} />}
                                        {hasConflict && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-pink-400'}`} />}
                                        {isPredicted && !inPeriod && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-400'}`} />}
                                    </div>
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
            
            {/* Details Section */}
            <div className="flex-1 bg-gray-50 mt-6 rounded-t-3xl p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800 font-cute flex items-center gap-2">
                         <span className="text-2xl">{selectedDate.split('-')[2]}</span>
                         <span className="text-sm text-gray-400">日事项</span>
                    </h3>
                    <button onClick={() => addTodo(prompt("添加待办事项:"), selectedDate)} className="text-rose-500 text-sm font-bold flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm">
                        <Plus size={16} /> 添加
                    </button>
                </div>
                
                <div className="space-y-3">
                    {/* Period Status */}
                    {isPeriodDay(selectedDate) && (
                        <div className="bg-red-100 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
                             <Heart size={16} fill="currentColor" /> 大姨妈造访中
                        </div>
                    )}
                    {isPredictedPeriodDay(selectedDate) && !isPeriodDay(selectedDate) && (
                        <div className="bg-blue-50 text-blue-500 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
                             <Sparkles size={16} fill="currentColor" /> 预计大姨妈
                        </div>
                    )}
                    
                    {/* Conflict List */}
                    {dayConflicts.map((c: ConflictRecord) => (
                        <div key={c.id} className="bg-pink-50 text-pink-900 p-3 rounded-xl text-sm border border-pink-100">
                             <div className="font-bold flex items-center gap-2 mb-1">
                                 <Gavel size={14} /> 喵喵法官裁决
                             </div>
                             {c.reason}
                        </div>
                    ))}

                    {/* Todos List */}
                    {dayTodos.map((todo: TodoItem) => (
                        <div key={todo.id} onClick={() => toggleTodo(todo.id)} className="bg-white p-3 rounded-xl flex items-center gap-3 shadow-sm cursor-pointer active:scale-98 transition">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${todo.completed ? 'border-green-500 bg-green-500' : 'border-gray-200'}`}>
                                {todo.completed && <CheckSquare size={12} className="text-white" />}
                            </div>
                            <span className={`text-sm ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{todo.text}</span>
                        </div>
                    ))}
                    
                    {dayTodos.length === 0 && dayConflicts.length === 0 && !isPeriodDay(selectedDate) && !isPredictedPeriodDay(selectedDate) && (
                        <div className="text-center text-gray-400 text-sm py-8">今天没有安排哦 ~</div>
                    )}
                </div>
            </div>
        </div>
    );
};