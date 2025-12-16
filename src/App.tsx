import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
// --- 新增引用开始 ---
import AV, { uploadFile } from './services/leancloud'; // [修改] 引入LeanCloud
import { QRCodeSVG } from 'qrcode.react';           // 引入二维码
import { Html5QrcodeScanner } from 'html5-qrcode';  // 引入扫码
// --- 新增引用结束 ---
import { 
  Heart, Camera, Calendar as CalendarIcon, Zap, CheckSquare, Cat, Upload, Trash2, X,
  ChevronLeft, ChevronRight, MessageCircle, ZoomIn, ZoomOut, Palette, RotateCcw, Pin,
  Star, Plus, MessageSquareHeart, Send, Loader2, Image as ImageIcon, FolderPlus, Grid,
  ArrowLeft, Edit2, Sparkles, Gavel, ShieldCheck, Lightbulb, Clock, MoreHorizontal,
  MoreVertical, CheckCircle, Settings, Menu, User, RefreshCw,LogOut, Scan
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { judgeConflict, extractTodosFromText,judgeJointConflict } from './services/ai';
import { Memory, PinnedPhoto, PeriodEntry, TodoItem, ConflictRecord, Page, Message, Album, AlbumMedia } from './types';
// @ts-ignore
import pailideIcon from './pailide.png';

// // 恢复为标准上传模式 (不压缩)
// const safeUpload = async (file: File) => {
//   // [修改] 直接使用 LeanCloud 的 uploadFile，并移除 Bmob.debug
//   return await uploadFile(file);
// };



// [新增/修改] 图片压缩辅助函数 (带详细日志)
const compressImage = (file: File, quality = 0.6, maxWidth = 1920): Promise<File> => {
    return new Promise((resolve) => {
        // 如果不是图片，直接返回原文件
        if (!file.type.startsWith('image/')) {
            resolve(file);
            return;
        }
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                
                // 限制最大宽度，保持比例
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        const newFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });

                        // ✅ 重点：在这里添加控制台日志
                        console.group(`📸 图片压缩日志: ${file.name}`);
                        console.log(`原始大小: ${(file.size / 1024).toFixed(2)} KB`);
                        console.log(`压缩后大小: ${(newFile.size / 1024).toFixed(2)} KB`);
                        console.log(`压缩比例: -${((1 - newFile.size / file.size) * 100).toFixed(1)}%`);
                        console.groupEnd();

                        resolve(newFile);
                    } else {
                        resolve(file); // 压缩失败返回原图
                    }
                }, 'image/jpeg', quality);
            };
        };
        reader.onerror = () => resolve(file);
    });
};

// [修改] 上传前先压缩
const safeUpload = async (file: File) => {
  try {
      // 压缩图片：质量 0.6，最大宽度 1280px (手机看足够了)
      const compressedFile = await compressImage(file, 0.6, 1280);
      return await uploadFile(compressedFile);
  } catch (e) {
      console.error("压缩失败，使用原图上传", e);
      return await uploadFile(file);
  }
};




// [新增] LeanCloud 时间格式化辅助函数
const formatDate = (date: any) => {
    if (!date) return getBeijingDateString();
    if (date instanceof Date) return date.toISOString().slice(0, 10);
    return String(date).slice(0, 10);
};
// [新增] 精确到分钟的时间格式化函数
const formatDateTime = (date: any) => {
    if (!date) return getBeijingDateString();
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
};


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
const ImageViewer = ({ images, initialIndex, onClose, actions }: { images: string[]; initialIndex: number; onClose: () => void; actions?: { label: string, onClick: () => void, primary?: boolean }[] }) => {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const initialDistance = useRef<number | null>(null);
  const initialScale = useRef<number>(1);


  if (!images || images.length === 0) return null;
  
  // ✅ 修复：如果数据异常，直接不渲染
  if (!images || images.length === 0 || !images[index]) return null;
  const currentSrc = images[index];

  // 切换图片
  const handlePrev = (e?: any) => { e?.stopPropagation(); if (index > 0) { setIndex(index - 1); setScale(1); } };
  const handleNext = (e?: any) => { e?.stopPropagation(); if (index < images.length - 1) { setIndex(index + 1); setScale(1); } };

  // 双击缩放
  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setScale(prev => prev > 1 ? 1 : 2.5);
  };

  // --- 手势处理逻辑 ---
  
  // 1. 触摸开始：如果是双指，记录初始距离
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      // 计算两点距离公式: sqrt((x2-x1)^2 + (y2-y1)^2)
      const dist = Math.hypot(touch1.pageX - touch2.pageX, touch1.pageY - touch2.pageY);
      initialDistance.current = dist;
      initialScale.current = scale;
    }
  };

  // 2. 触摸移动：计算新距离，更新缩放
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance.current) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch1.pageX - touch2.pageX, touch1.pageY - touch2.pageY);
      
      // 新缩放比例 = (当前距离 / 初始距离) * 初始缩放比例
      let newScale = (dist / initialDistance.current) * initialScale.current;
      
      // 限制缩放范围
      newScale = Math.max(1, Math.min(newScale, 4)); 
      setScale(newScale);
    }
  };

  // 3. 触摸结束：重置
  const handleTouchEnd = () => {
    initialDistance.current = null;
    if (scale < 1) setScale(1); // 修正回弹
  };

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 z-[999] bg-black flex items-center justify-center overflow-hidden touch-none" 
      onClick={onClose}
    >
      {/* 只有在未缩放且不是第一张时才允许向左滑，同理向右 */}
      <motion.img 
        key={currentSrc} // key变化触发切图动画
        src={currentSrc}
        
        // 核心：如果放大了，允许任意拖拽查看细节；如果没放大(scale=1)，只允许X轴拖拽(切图)
        drag={scale > 1 ? true : "x"} 
        dragConstraints={scale > 1 ? { left: -200*scale, right: 200*scale, top: -200*scale, bottom: 200*scale } : { left: 0, right: 0 }}
        dragElastic={0.2} // 增加一点弹性阻尼
        
        // 处理切图滑动
        onDragEnd={(e, { offset, velocity }) => {
            if (scale === 1) {
                const swipeThreshold = 50;
                if (offset.x > swipeThreshold) {
                    handlePrev();
                } else if (offset.x < -swipeThreshold) {
                    handleNext();
                }
            }
        }}

        // 绑定手势
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleTap}
        onClick={(e) => e.stopPropagation()} // 防止点击图片关闭

        animate={{ scale: scale, x: 0 }} // 切图时重置x坐标
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        
        className="max-w-full max-h-full object-contain pointer-events-auto"
        style={{ touchAction: 'none' }} // 关键：禁止浏览器默认缩放
      />
      
      {/* 左右切换按钮 (电脑端或辅助) */}
      {index > 0 && <button className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 rounded-full text-white hover:bg-white/40 z-[1001]" onClick={handlePrev}><ChevronLeft /></button>}
      {index < images.length - 1 && <button className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 rounded-full text-white hover:bg-white/40 z-[1001]" onClick={handleNext}><ChevronRight /></button>}

      {/* 图片计数器 */}
      <div className="absolute top-10 left-0 right-0 text-center pointer-events-none">
          <span className="bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-md">{index + 1} / {images.length}</span>
      </div>

      {actions && actions.length > 0 && (
           <div 
             className="absolute bottom-24 left-0 right-0 flex justify-center flex-wrap gap-4 pointer-events-none z-[1000]"
             onClick={(e) => e.stopPropagation()}
           >
               {actions.map((action, idx) => (
                   <button 
                        key={idx}
                        className={`px-6 py-2.5 rounded-full text-sm font-bold pointer-events-auto cursor-pointer flex items-center gap-2 backdrop-blur-md border border-white/20 transition active:scale-95 ${action.primary ? 'bg-black/30 text-white hover:bg-black/40 shadow-lg' : 'bg-black/40 text-white hover:bg-black/60'}`} 
                        onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                    >
                       {action.label === '更换头像' || action.label === '更换封面' ? <Edit2 size={14} /> : <CheckCircle size={14} />}
                       {action.label}
                   </button>
               ))}
           </div>
      )}
    </motion.div>, document.body
  );
};

// [修改] 增加 homeLabel 参数
const Navbar = ({ active, setPage, homeLabel }: { active: Page, setPage: (p: Page) => void, homeLabel: string }) => {
  const navItems = [
    // [修改] 使用传入的 homeLabel，如果没有则默认显示 '首页'
    { id: Page.HOME, icon: <Cat size={24} />, label: homeLabel || '首页' },
    { id: Page.MEMORIES, icon: <Camera size={24} />, label: '点滴' },
    { id: Page.BOARD, icon: <MessageSquareHeart size={24} />, label: '留言板' },
    { id: Page.CYCLE, icon: <Heart size={24} />, label: '经期' },
    { id: Page.CONFLICT, icon: <Gavel size={24} />, label: '小法官' },
    { id: Page.CALENDAR, icon: <CalendarIcon size={24} />, label: '日历' },
    { id: 'PROFILE' as any, icon: <User size={24} />, label: '我的' },
  ];
  return (
    <nav 
      // [修改] 将 bg-white/95 改为 bg-white/70，让背景半透明，从而透出 backdrop-blur-xl 的模糊效果
      className="fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-xl border-t border-rose-100 shadow-[0_-5px_15px_rgba(255,241,242,0.8)] z-[100] pb-4 md:pb-0">
      {/* 建议给内部容器也增加一点高度缓冲，或者保持原样 */}
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
  const displayCaption = pin.customCaption || '回忆';
  
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

// [修改] 增加 todos 参数接收
const MiniCalendar = ({ periods, conflicts, todos }: any) => {
    const today = new Date();
    const days = Array(getFirstDayOfMonth(today.getFullYear(), today.getMonth())).fill(null).concat([...Array(getDaysInMonth(today.getFullYear(), today.getMonth())).keys()].map(i => i + 1));

    // [新增] 预测经期辅助函数
    const isPredicted = (d: number) => {
        if (!periods || periods.length === 0) return false;
        // 简单的预测逻辑：上次经期 + 28天
        // 注意：这里假设 periods 数组最后一个是最新的
        const lastPeriod = periods[periods.length - 1];
        const lastStart = parseLocalDate(lastPeriod.startDate);
        const predictedStart = new Date(lastStart);
        predictedStart.setDate(lastStart.getDate() + 28);
        const predictedEnd = new Date(predictedStart);
        predictedEnd.setDate(predictedStart.getDate() + 5);
        
        const current = new Date(today.getFullYear(), today.getMonth(), d);
        return current >= predictedStart && current < predictedEnd;
    };

    return (
        <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-rose-100 w-full">
            <h4 className="text-xs font-bold text-gray-500 mb-3 font-cute flex items-center gap-2"><CalendarIcon size={14} className="text-rose-400" /> {today.getFullYear()}年{today.getMonth() + 1}月</h4>
            <div className="grid grid-cols-7 gap-1">
                {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-[10px] text-center text-gray-400 font-bold">{d}</div>)}
                {days.map((d, i) => (
                    <div key={i} className={`aspect-square rounded-full flex flex-col items-center justify-center text-[10px] font-medium transition-all ${d === today.getDate() ? 'bg-rose-500 text-white shadow-md scale-110' : 'text-gray-600 hover:bg-rose-50'}`}>
                        {d}
                        <div className="flex gap-0.5">
                             {/* 1. 实际经期 (红点) */}
                             {d && periods.some((p: any) => { const s = parseLocalDate(p.startDate); const e = new Date(s); e.setDate(s.getDate()+p.duration); const c = new Date(today.getFullYear(), today.getMonth(), d); return c >= s && c < e; }) && d !== today.getDate() && <div className="w-1 h-1 rounded-full bg-red-500" />}
                             
                             {/* 2. [新增] 预测经期 (蓝点) - 只有非实际经期才显示 */}
                             {d && isPredicted(d) && !periods.some((p: any) => { const s = parseLocalDate(p.startDate); const e = new Date(s); e.setDate(s.getDate()+p.duration); const c = new Date(today.getFullYear(), today.getMonth(), d); return c >= s && c < e; }) && d !== today.getDate() && <div className="w-1 h-1 rounded-full bg-blue-400" />}

                             {/* 3. [新增] 待办事项 (改为翠绿点) - 仅显示未完成的 */}
                             {d && todos && todos.some((t: any) => { const tDate = parseLocalDate(t.date); return tDate.getDate() === d && tDate.getMonth() === today.getMonth() && !t.completed; }) && d !== today.getDate() && <div className="w-1 h-1 rounded-full bg-emerald-400" />}
                             
                             {/* 4. 吵架记录 (紫点) */}
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

// === 新增组件开始 ===
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await AV.User.logIn(username, password); // [修改] LeanCloud 登录
        window.location.reload();
      } else {
        // [修改] LeanCloud 注册
        const user = new AV.User();
        user.setUsername(username);
        user.setPassword(password);
        user.set('avatarUrl', `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`);
        await user.signUp();
        
        alert('注册成功，请登录');
        setIsLogin(true);
      }
    } catch (err: any) {
      alert('操作失败: ' + (err.rawMessage || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-rose-50 p-6">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold font-cute mb-2 text-gray-800">小屁铃</h1>
        <p className="text-gray-400 text-sm mb-8">我们的专属空间 (云端版)</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 outline-none" placeholder="账号" value={username} onChange={e => setUsername(e.target.value)} required />
          <input className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 outline-none" type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} required />
          <button disabled={loading} className="w-full bg-rose-500 text-white py-3 rounded-xl font-bold hover:bg-rose-600 transition">
             {loading ? <Loader2 className="animate-spin mx-auto"/> : (isLogin ? '登录' : '注册')}
          </button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="mt-4 text-xs text-gray-400 underline">{isLogin ? '没有账号？去注册' : '已有账号？去登录'}</button>
      </div>
    </div>
  );
};

// [修改后] 重构 ProfilePage 逻辑 (请替换整个 ProfilePage 组件内的相关逻辑部分)

const ProfilePage = ({ user, onLogout, onUpdateUser }: { user: any, onLogout: () => void, onUpdateUser: (u:any)=>void }) => {
  const [loading, setLoading] = useState(false);
  const [partner, setPartner] = useState<any>(null);
  const [bindCode, setBindCode] = useState('');
  const [myCode, setMyCode] = useState('');
  const [incomingRequest, setIncomingRequest] = useState<any>(null); // 绑定申请
  const [disconnectRequest, setDisconnectRequest] = useState<any>(null); // 解绑申请
  const [timeLeft, setTimeLeft] = useState('');

  // ✅ 获取另一半信息
  useEffect(() => {
      if(!user || !user.objectId) return;
      if (user.coupleId && !partner) {
          const ids = user.coupleId.split('_');
          const partnerId = ids.find((id:string) => id !== user.objectId);
          if (partnerId) new AV.Query('_User').get(partnerId).then(p => setPartner(p.toJSON())).catch(() => {});
      }
      // 这里的逻辑B被合并到了下面的 handleRefresh 中
      if (user.display_code) setMyCode(user.display_code); 
  }, [user]);

// ✅ 核心：统一刷新/检查状态函数 (常驻按钮调用这个)
  const handleRefresh = async (showToast = false) => {
      setLoading(true);
      try {
          // 场景1: 我是单身 (检查绑定申请 & 检查是否刚才绑定的对方已确认)
          if (!user.coupleId) {
              // A. 检查是否有等待我同意的申请
              const qInbox = new AV.Query('CoupleConnection');
              qInbox.equalTo('hostId', user.objectId);
              qInbox.notEqualTo('status', 'connected'); 
              qInbox.exists('guestId');
              const resInbox = await qInbox.find();
              if (resInbox.length > 0) {
                  setIncomingRequest({ id: resInbox[0].id, guestId: resInbox[0].get('guestId') });
                  if(showToast) alert("收到绑定申请！💌");
              }

              // B. 检查我发起的申请对方是否同意 (我是Guest)
              const qOutbox = new AV.Query('CoupleConnection');
              qOutbox.equalTo('guestId', user.objectId);
              qOutbox.equalTo('status', 'connected');
              const resOutbox = await qOutbox.find();
              if (resOutbox.length > 0) {
                  // 对方已同意，更新我自己
                  const conn = resOutbox[0];
                  const hostId = conn.get('hostId');
                  const ids = [hostId, user.objectId].sort();
                  const commonId = `${ids[0]}_${ids[1]}`;
                  
                  const me = AV.User.current();
                  me.set('coupleId', commonId);
                  await me.save();
                  await conn.destroy(); // 完成使命，销毁记录
                  
                  alert("🎉 对方已同意，配对成功！");
                  onUpdateUser({ ...user, coupleId: commonId });
                  window.location.reload(); // 刷新页面
                  return;
              }
          } 
          // 场景2: 恋爱中 (检查解绑申请 & 检查我的解绑申请是否通过)
          else {
               // A. 检查是否有人申请和我分手 (status = 'disconnect_request')
               // 查找 hostId 或 guestId 是我，且状态是 disconnect_request 的记录
               const qDis = new AV.Query('CoupleConnection');
               qDis.containedIn('hostId', [user.objectId]); // 稍微简化，通常记录发起人
               qDis.equalTo('status', 'disconnected'); // 检查是否已断开
               const resDis = await qDis.find();
               
               // 如果查到状态是 disconnected，说明对方同意了我的分手申请
               if (resDis.length > 0) {
                   const me = AV.User.current();
                   me.set('coupleId', null);
                   await me.save();
                   await resDis[0].destroy();
                   alert("💔 已恢复单身");
                   onUpdateUser({ ...user, coupleId: null });
                   setPartner(null);
                   return;
               }

               // B. 检查是否收到分手申请 (对方发起的)
               // 逻辑：查找 CoupleConnection 中 guestId 是我 (或 partnerId 是发起人)
               if (partner) {
                   const qReq = new AV.Query('CoupleConnection');
                   qReq.equalTo('hostId', partner.objectId);
                   qReq.equalTo('guestId', user.objectId);
                   qReq.equalTo('status', 'disconnect_request');
                   const resReq = await qReq.find();
                   if (resReq.length > 0) {
                       setDisconnectRequest({ id: resReq[0].id });
                       if(showToast) alert("收到解除关系申请 💔");
                   } else {
                       if(showToast) alert("状态正常，暂无新消息");
                   }
               }
          }
      } catch (e) {
          console.error(e);
          if(showToast) alert("刷新失败，请检查网络");
      } finally {
          setLoading(false);
      }
  };
  

  // [新增] 同意绑定申请
// [修改] Host 同意申请
  const handleAcceptRequest = async () => {
      if (!incomingRequest) return;
      setLoading(true);
      try {
          const ids = [user.objectId, incomingRequest.guestId].sort();
          const commonId = `${ids[0]}_${ids[1]}`;

          // 1. 更新自己
          const me = AV.User.current();
          me.set('coupleId', commonId);
          me.unset('display_code'); 
          me.unset('codeExpiresAt');
          await me.save();

          // 2. [关键] 更新连接状态为 connected，让 Guest 能够检测到
          const conn = AV.Object.createWithoutData('CoupleConnection', incomingRequest.id);
          conn.set('status', 'connected');
          await conn.save();

          onUpdateUser({ ...user, coupleId: commonId });
          alert("❤️ 已同意！等待对方同步...");
          window.location.reload();
      } catch (e: any) { alert("失败: " + e.message); } finally { setLoading(false); }
  };


  // 输入口令绑定（账号2操作 - 发送申请）
const handleBindByCode = async () => {
      if (!bindCode || bindCode.length !== 6) return alert("请输入6位数字");
      setLoading(true);
      try {
          const q = new AV.Query('CoupleConnection');
          q.equalTo('passcode', 'invite_' + bindCode); 
          const results = await q.find();
          if (!results.length) { setLoading(false); return alert("口令无效"); }

          const entry = results[0];
          // [新增] 检查有效期
          if (entry.get('validUntil') && Date.now() > entry.get('validUntil')) {
             setLoading(false); return alert("口令已过期，请对方重新生成");
          }

          entry.set('guestId', user.objectId);
          await entry.save();
          alert("✅ 申请已发送！\n请通知对方在 App 中【刷新页面】并点击同意。");
      } catch (e: any) { alert("错误: " + e.message); } finally { setLoading(false); }
  };
  
  
const generateCode = async () => {
      setLoading(true);
      try {
          const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
          const expiresAt = Date.now() + 10 * 60 * 1000; // 10分钟有效期

          // 清理旧数据
          const qOld = new AV.Query('CoupleConnection');
          qOld.equalTo('hostId', user.objectId);
          const old = await qOld.find();
          await AV.Object.destroyAll(old);

          const binding = new AV.Object('CoupleConnection');
          binding.set('passcode', 'invite_' + rawCode);
          binding.set('hostId', user.objectId);
          binding.set('validUntil', expiresAt); // [新增] 有效期
          await binding.save();

          const me = AV.User.current();
          me.set('display_code', rawCode);
          me.set('codeExpiresAt', expiresAt); // [新增] 保存到用户表以便显示倒计时
          await me.save();
          
          setMyCode(rawCode);
          onUpdateUser({ ...user, display_code: rawCode, codeExpiresAt: expiresAt }); 
          alert(`口令生成成功：${rawCode}`);
      } catch (e: any) { alert("失败: " + e.message); } finally { setLoading(false); }
  };

// ✅ 发起解绑申请 (替代原来的 handleUnbind)
  const handleRequestUnbind = async () => {
      if(!partner) return alert("数据加载中，请稍后");
      if(!confirm("⚠️ 确定要申请解除关系吗？\n需要对方同意后才能生效。")) return;
      
      setLoading(true);
      try {
          // 创建一个分手申请记录
          const conn = new AV.Object('CoupleConnection');
          conn.set('hostId', user.objectId); // 我发起的
          conn.set('guestId', partner.objectId); // 给对方的
          conn.set('status', 'disconnect_request');
          await conn.save();
          alert("✅ 申请已发送，请等待对方刷新并同意。");
      } catch(e: any) {
          alert("发送失败: " + e.message);
      } finally {
          setLoading(false);
      }
  };


  // ✅ 同意解绑 (被动方操作)
  const handleAgreeDisconnect = async () => {
      if (!disconnectRequest) return;
      setLoading(true);
      try {
          // 1. 先把自己恢复单身
          const me = AV.User.current();
          me.set('coupleId', null);
          await me.save();

          // 2. 更新连接状态为 disconnected，通知发起方
          // 注意：这里我们反过来，把发起方的记录状态改为 disconnected
          const conn = AV.Object.createWithoutData('CoupleConnection', disconnectRequest.id);
          conn.set('status', 'disconnected');
          // 也可以交换 host/guest 以便对方检测，或者简单的修改状态即可
          // 我们上面的检测逻辑是：发起方检查 status='disconnected'
          await conn.save();

          alert("💔 已解除关系，恢复单身状态。");
          onUpdateUser({ ...user, coupleId: null });
          setPartner(null);
          setDisconnectRequest(null);
      } catch(e: any) {
          alert("操作失败: " + e.message);
      } finally {
          setLoading(false);
      }
  };


  
  // --- 修复：还原头像上传逻辑 ---
  const handleAvatarChange = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
   try {
      // 1. [修改] 改为 safeUpload 以启用压缩
      const url = await safeUpload(file);
      if(!url) throw new Error("上传失败");
      
      // 2. [修改] 更新当前用户
      const me = AV.User.current();
      me.set('avatarUrl', url);
      await me.save();

      // 3. 更新本地状态
      onUpdateUser({ ...user, avatarUrl: url });
      alert('头像修改成功！');
    } catch (err: any) {
      console.error(err);
      alert('头像上传失败: ' + (err.message || err));
    } finally {
      setLoading(false);
      e.target.value = ''; // 清空，允许重复选同一张
    }
  };

// 修复：还原昵称修改逻辑 (去除 Bmob)
const handleNicknameChange = async () => {
      const n = prompt("新昵称", user.nickname);
      if(n) { const me = AV.User.current(); me.set('nickname', n); await me.save(); onUpdateUser({...user, nickname: n}); }
  };
  
  // 新增：账号修改逻辑 (去除 Bmob)
const handleUsernameChange = async () => {
      const n = prompt("新账号", user.username);
      if(n) { const me = AV.User.current(); me.setUsername(n); await me.save(); alert("请重新登录"); onLogout(); }
  };
  const handleLogoutClick = () => { if(confirm("退出登录？")) onLogout(); };

return (
    <div className="p-6 bg-gray-50 h-full overflow-y-auto pb-32 relative">
       <div className="bg-white rounded-3xl p-6 text-center shadow-sm mb-6 relative overflow-hidden">
          {loading && <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center"><Loader2 className="animate-spin text-rose-500"/></div>}
          
          {/* 头像昵称区 (含小铅笔修复) */}
          <div className="relative inline-block group mb-2">
              <img src={user.avatarUrl || "https://cdn-icons-png.flaticon.com/512/4140/4140048.png"} className="w-24 h-24 rounded-full border-4 border-rose-100 object-cover mx-auto" />
              <label className="absolute bottom-0 right-0 bg-rose-500 text-white p-2 rounded-full cursor-pointer shadow-md hover:bg-rose-600 transition active:scale-90">
                  <Edit2 size={14} />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
              </label>
          </div>
          <div className="text-2xl font-bold text-gray-800 cursor-pointer" onClick={handleNicknameChange}>{user.nickname || "点击设置昵称"}</div>
          <div className="text-sm text-gray-400 mt-1 cursor-pointer" onClick={handleUsernameChange}>账号: {user.username}</div>

          {/* 常驻刷新按钮 */}
          <div className="flex justify-center mt-4">
              <button 
                onClick={() => handleRefresh(true)} 
                className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-500 rounded-full text-sm font-bold hover:bg-rose-100 transition shadow-sm border border-rose-100"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 
                刷新状态 / 消息
              </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
              {user.coupleId ? (
                  <div className="animate-in fade-in zoom-in duration-500">
                      <div className="inline-block bg-rose-50 text-rose-500 px-4 py-1 rounded-full text-xs font-bold mb-4">恋爱中</div>
                      
                      {/* 另一半信息 */}
                      <div className="flex items-center justify-center gap-4">
                          <div className="text-center"><div className="w-12 h-12 bg-gray-100 rounded-full mb-1 overflow-hidden mx-auto">{partner?.avatarUrl ? <img src={partner.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xl">👤</div>}</div><div className="text-xs font-bold text-gray-700">{partner?.nickname || "另一半"}</div></div>
                          <div className="text-rose-300"><Heart fill="currentColor" size={20} /></div>
                          <div className="text-center"><div className="w-12 h-12 bg-gray-100 rounded-full mb-1 overflow-hidden mx-auto">{user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xl">👤</div>}</div><div className="text-xs font-bold text-gray-700">我</div></div>
                      </div>

                      {/* 解绑申请卡片 */}
                      {disconnectRequest && (
                          <div className="mb-6 p-4 bg-gray-50 rounded-2xl border-2 border-gray-200 animate-pulse text-left mt-4">
                              <h3 className="text-gray-700 font-bold mb-2">对方申请解除关系</h3>
                              <p className="text-xs text-gray-500 mb-3">如果同意，双方将恢复单身状态。</p>
                              <div className="flex gap-2">
                                  <button onClick={handleAgreeDisconnect} className="flex-1 bg-red-500 text-white py-2 rounded-xl font-bold shadow-md">同意解绑</button>
                                  <button onClick={() => setDisconnectRequest(null)} className="flex-1 bg-white text-gray-500 py-2 rounded-xl font-bold shadow-sm">忽略</button>
                              </div>
                          </div>
                      )}
                      
                      <button onClick={handleRequestUnbind} className="mt-6 text-xs text-gray-400 underline hover:text-red-500">申请解除</button>
                  </div>
              ) : (
                  <div>
                      <div className="inline-block bg-gray-100 text-gray-400 px-4 py-1 rounded-full text-xs font-bold mb-6">单身🐶</div>
                      
                      {incomingRequest && (
                        <div className="mb-6 p-4 bg-rose-50 rounded-2xl border-2 border-rose-200 animate-pulse">
                            <h3 className="text-rose-600 font-bold mb-2">💌 收到绑定申请！</h3>
                            <p className="text-xs text-gray-500 mb-3">有人输入了你的口令</p>
                            <button onClick={handleAcceptRequest} className="w-full bg-rose-500 text-white py-2 rounded-xl font-bold shadow-md">同意并绑定</button>
                        </div>
                      )}

                      <div className="space-y-6">
                          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                              <h3 className="text-rose-500 font-bold text-sm mb-2">我是发起方</h3>
                              {myCode ? (
                                  <div className="text-center">
                                      <div className="text-xs text-gray-400 mb-1">把这个告诉 TA</div>
                                      <div className="flex items-center justify-center gap-3 my-2">
                                          <div className="text-3xl font-black text-gray-800 tracking-widest select-all">{myCode}</div>
                                      </div>
                                      <div className="text-xs font-bold text-rose-400 mb-2">有效期: {timeLeft}</div>
                                      <button onClick={generateCode} className="text-xs text-gray-400 underline hover:text-rose-600">重新生成</button>
                                  </div>
                              ) : (
                                  <button onClick={generateCode} className="w-full bg-rose-500 text-white py-2 rounded-xl font-bold shadow-md hover:bg-rose-600">生成绑定口令</button>
                              )}
                          </div>

                          <div className="relative flex items-center py-2"><div className="flex-grow border-t border-gray-200"></div><span className="flex-shrink-0 mx-4 text-gray-300 text-xs">或者</span><div className="flex-grow border-t border-gray-200"></div></div>

                          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                              <h3 className="text-gray-600 font-bold text-sm mb-2">我是接收方</h3>
                              <input type="tel" maxLength={6} placeholder="输入对方的6位口令" className="w-full text-center text-lg font-bold p-3 rounded-xl border border-gray-200 mb-3 outline-none focus:ring-2 focus:ring-rose-200 tracking-widest" value={bindCode} onChange={e => setBindCode(e.target.value)}/>
                              <button onClick={handleBindByCode} className="w-full bg-gray-800 text-white py-2 rounded-xl font-bold hover:bg-black">确认绑定</button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
       </div>
       <button onClick={onLogout} className="w-full bg-white text-red-500 py-4 rounded-3xl font-bold shadow-sm flex items-center justify-center gap-2"><LogOut size={20}/> 退出登录</button>
    </div>
  )
}

const ScannerMounter = ({onSuccess}: any) => {
    useEffect(() => { 
        // 初始化扫码器
        const s = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false); 
        s.render(onSuccess, (err: any) => console.warn(err)); 
        
        // 清理函数：组件卸载时停止摄像头
        return () => { 
            s.clear().catch(err => console.error("Failed to clear scanner", err)); 
        }; 
    }, []);

    // 修复背景色为白色，确保插件的文字可见，并添加圆角
    return <div id="reader" className="w-full h-full min-h-[300px] bg-white text-black rounded-xl overflow-hidden"></div>;
}
// === 新增组件结束 ===



// --- Page Content Components ---

// 1. 参数中添加 user
// 1. 在参数列表中添加 momentsAvatar 和 onUpdateMomentsAvatar
const MemoriesViewContent = ({
  user,
  memories, albums, setAlbums, handleLike, handleComment, onFileSelect, onTextPost, showUploadModal, setShowUploadModal,
  uploadImages, setUploadImages, uploadCaption, setUploadCaption, uploadType, confirmUpload, coverUrl, onUpdateCover, onDeleteMemory,
  momentsTitle, setMomentsTitle, avatarUrl, setAvatarUrl, setMomentsCover,
  momentsAvatar, onUpdateMomentsAvatar, // <--- 新增这两个参数
  notifications, onReadNotification // [新增]
  ,handleDeleteComment,
  onRefresh, // [新增] 接收刷新函数
  onUpdateMomentsTitle, // [新增] 接收保存标题的函数
  uploadStatus, setUploadStatus, // [新增] 接收进度状态
}: any) => {
  const [activeTab, setActiveTab] = useState<'moments' | 'albums'>('moments');
  const [isRefreshing, setIsRefreshing] = useState(false); // [新增] 控制刷新按钮旋转动画
  const [showMessageList, setShowMessageList] = useState(false); // [新增] 控制消息列表显示
  const [viewingImage, setViewingImage] = useState<{ list: string[], index: number } | null>(null);
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
  // [新增] 计算未读消息
  const unreadNotes = (notifications || []).filter((n:any) => !n.isRead);
  const latestNote = unreadNotes.length > 0 ? unreadNotes[0] : null;

  useEffect(() => { const h = () => setActiveMenuId(null); document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);
  useEffect(() => { if(!isManageMode) setSelectedItems(new Set()); }, [isManageMode]);


  // [新增] 处理点击消息跳转
  const handleNoteClick = (note: any) => {
      onReadNotification(note.id);
      setShowMessageList(false);
      // 延时滚动，确保页面渲染完成
      setTimeout(() => {
          const el = document.getElementById(`moment-${note.momentId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          else alert("这条朋友圈可能已被删除");
      }, 300);
  };

  
  // 2. 新增：专门处理朋友圈封面头像点击
  const handleHeaderAvatarClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setViewingImage({ list: [momentsAvatar || DEFAULT_AVATAR], index: 0 });
      setViewerActions([{ 
          label: '更换情侣头像', 
          onClick: () => { document.getElementById('shared-avatar-upload')?.click(); setViewingImage(null); }
      }]);
  };

  
  const handlePressStart = () => {
      pressTimer.current = setTimeout(() => {
          onTextPost();
          pressTimer.current = null;
      }, 300); 
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
    // --- 修复开始：解决双重触发问题 ---
      // 如果检测到是触摸结束事件 (touchend)，调用 preventDefault()
      // 这会告诉浏览器：“我已经处理了这个点击，不要再自动模拟一次鼠标点击了”
      if (e.type === 'touchend') {
          e.preventDefault();
      }
      // --- 修复结束 ---
      if (pressTimer.current) {
          clearTimeout(pressTimer.current);
          pressTimer.current = null;
          document.getElementById('camera-file-input')?.click();
      }
  };

  const createAlbum = async () => {
    if(!newAlbumName.trim()) return;
    // [修复] 移除乐观更新，改为等待云端创建完成再更新本地，确保ID真实有效，防止上传失败
    try {
        const AlbumObj = new AV.Object('Album');
        AlbumObj.set('name', newAlbumName);
        AlbumObj.set('coverUrl', '');
        AlbumObj.set('media', []);
        AlbumObj.set('writer_id', user.objectId);
        if (user.coupleId) AlbumObj.set('binding_id', user.coupleId);
        
        const saved = await AlbumObj.save();
        
        // 使用真实云端ID创建本地对象
        const newAlbum = { 
            id: saved.id, 
            name: newAlbumName, 
            coverUrl: '', 
            createdAt: getBeijingDateString(), 
            media: [], 
            writer_id: user.objectId 
        };
        
        setAlbums((prev: Album[]) => [newAlbum, ...prev]);
        setNewAlbumName(''); 
        setIsCreatingAlbum(false);
    } catch(e) { 
        console.error("创建相册失败", e); 
        alert("创建失败，请重试");
    }
  };

  
  const handleAlbumUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedAlbum || !e.target.files) return;
      const files = Array.from(e.target.files); 
      
      try {
          const confirmMsg = confirm(`准备上传 ${files.length} 张照片，是否继续？\n上传过程中请勿刷新页面。`);
          if (!confirmMsg) return;

          // [新增] 初始化进度
          setUploadStatus({ current: 0, total: files.length, isUploading: true });

          const newMediaItems: AlbumMedia[] = [];
          
          // 1. 循环上传文件
          for (const file of files) {
               try {
                   // [修改] 改为使用 safeUpload，这样才会触发压缩和日志
                   const url = await safeUpload(file); 
                   if (url) {
                       newMediaItems.push({
                           id: Date.now().toString() + Math.random().toString(36).substr(2, 9), 
                           url: url, 
                           date: getBeijingDateString(), 
                           type: 'image' 
                       });
                   }
               } catch (err) {
                   console.error("单张图片上传失败跳过", err);
               } finally {
                   // [新增] 更新进度
                   setUploadStatus((prev: any) => ({ ...prev, current: prev.current + 1 }));
               }
          }
          
          // [新增] 只有在这里不急着关闭，等下面保存完，或者直接关闭也行。
          // 这里我们为了用户体验，先不关闭，等UI更新完毕

          if (newMediaItems.length > 0) {
               // 2. 计算新状态
               // 确保 selectedAlbum.media 存在
               const currentMedia = selectedAlbum.media || [];
               
               // [修复] 核心：在合并数据前，强制清洗所有对象，只保留纯净的 JSON 数据
               // 这一步防止了因为对象中包含 SDK 内部字段导致的保存失败
               const cleanMedia = [...newMediaItems, ...currentMedia].map(m => ({
                   id: m.id,
                   url: m.url,
                   date: m.date,
                   type: m.type || 'image',
                   caption: m.caption || ''
               }));

               // 3. [关键] 先更新云端，确保数据落地
               const albumObj = AV.Object.createWithoutData('Album', selectedAlbum.id);
               albumObj.set('media', cleanMedia); // 使用清洗后的数据保存
               
               // 如果当前没封面，用第一张新图做封面

               let newCoverUrl = selectedAlbum.coverUrl;
               if (!newCoverUrl && newMediaItems.length > 0) {
                   newCoverUrl = newMediaItems[0].url;
                   albumObj.set('coverUrl', newCoverUrl);
               }

               await albumObj.save(); // 等待保存成功
               console.log("云端相册保存成功");

               // 4. 云端保存成功后，再更新本地状态
               // [修改] 这里使用 cleanMedia 更新本地
               const updatedAlbum = { ...selectedAlbum, media: cleanMedia, coverUrl: newCoverUrl };
               setAlbums((prev: Album[]) => prev.map(a => a.id === selectedAlbum.id ? updatedAlbum : a));
               setSelectedAlbum(updatedAlbum);
               
               alert(`成功上传 ${newMediaItems.length} 张照片！`);
          } else {
              alert("没有照片上传成功，请检查网络");
          }
      } catch (e: any) { 
          console.error("上传相册流程失败", e); 
          alert("保存到云端失败: " + (e.message || "未知错误")); 
      } finally {
          // [新增] 关闭进度条
          setUploadStatus({ current: 0, total: 0, isUploading: false });
          // 清空 input 防止重复选择不触发 onChange
          e.target.value = '';
      }
  };
  
  const batchDeletePhotos = async () => {
      if(!selectedAlbum || !window.confirm(`确定要删除选中的 ${selectedItems.size} 张照片吗？`)) return;
      const updatedMedia = selectedAlbum.media.filter(m => !selectedItems.has(m.id));
      
      // 更新本地
      const updatedAlbum = { ...selectedAlbum, media: updatedMedia };
      if (selectedAlbum.media.find(m => m.url === selectedAlbum.coverUrl && selectedItems.has(m.id))) {
          updatedAlbum.coverUrl = updatedMedia.length > 0 ? updatedMedia[0].url : '';
      }
      setAlbums((prev: Album[]) => prev.map(a => a.id === selectedAlbum.id ? updatedAlbum : a));
      setSelectedAlbum(updatedAlbum); setIsManageMode(false);

      // [修复] 同步云端 (直接覆盖 media 数组)
      try {
          const obj = AV.Object.createWithoutData('Album', selectedAlbum.id);
          obj.set('media', updatedMedia); 
          // 如果封面被删了，也要更新封面字段
          if (updatedAlbum.coverUrl !== selectedAlbum.coverUrl) {
              obj.set('coverUrl', updatedAlbum.coverUrl);
          }
          await obj.save();
      } catch(e) { console.error(e); alert("删除同步失败"); }
  };
  
  const handleCoverClick = (e: React.MouseEvent) => {
      if (isEditingMomentsTitle) return;
      // 修复：将其包装成列表对象
      setViewingImage({ list: [coverUrl], index: 0 });
      setViewerActions([{ label: '更换封面', onClick: () => { document.getElementById('cover-upload')?.click(); setViewingImage(null); } }]);
  };

  // 3. 原有的 handleAvatarClick (用于点击列表里别人的头像查看)
  const handleListAvatarClick = (url: string) => {
      setViewingImage({ list: [url || DEFAULT_AVATAR], index: 0 });
      setViewerActions([]); // 列表头像只查看，不给更换操作
  };
  
  const handleAvatarUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = () => setAvatarUrl(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handleViewImage = (url: string, context: 'album' | 'memory', list?: string[]) => {
      // 如果调用时没传 list（兼容旧逻辑），尝试自动查找
      let imageList: string[] = list || [url]; 
      
      // 如果没传list，且是相册模式，且有选中的相册，就用相册的图
      if (!list && context === 'album' && selectedAlbum) {
          imageList = selectedAlbum.media.map(m => m.url);
      }
      // 注意：memory 模式下，因为 memory 是列表循环的，最好在调用 handleViewImage 时直接把 memory.media 传进来
      
      const index = imageList.indexOf(url);
      setViewingImage({ list: imageList, index: index === -1 ? 0 : index });

      const actions = [];
      // ... (保留之前的 actions 逻辑，但注意 setViewingImage(null) 要适配新类型)
      // 下面这几行 actions 逻辑里的 setViewingImage(null) 保持不变即可
      if (context === 'album' && selectedAlbum) {
          actions.push({
              label: '设为封面',
              onClick: async () => {
                  setAlbums((prev: Album[]) => prev.map(a => a.id === selectedAlbum.id ? { ...a, coverUrl: url } : a));
                  setSelectedAlbum(prev => prev ? { ...prev, coverUrl: url } : null);
                  setViewingImage(null); 
                  
                  // [修复] 同步云端
                  try {
                      const obj = AV.Object.createWithoutData('Album', selectedAlbum.id);
                      obj.set('coverUrl', url);
                      await obj.save();
                      alert('已设为相册封面');
                  } catch(e) { console.error(e); }
              }
          });
      actions.push({
          label: '设为背景',
          primary: true,
          onClick: () => {
              if(confirm('将这张图片设为朋友圈背景？')) {
                  setMomentsCover(url);
                  setViewingImage(null); // 关闭
              }
          }
      });
      setViewerActions(actions);
  };
};
const saveAlbumName = async () => {
      if (selectedAlbum && tempAlbumName.trim()) {
          const updatedAlbum = { ...selectedAlbum, name: tempAlbumName };
          setAlbums((prev: Album[]) => prev.map(a => a.id === selectedAlbum.id ? updatedAlbum : a));
          setSelectedAlbum(updatedAlbum);
          
          // [修复] 同步云端
          try {
              const obj = AV.Object.createWithoutData('Album', selectedAlbum.id);
              obj.set('name', tempAlbumName);
              await obj.save();
          } catch(e) { console.error(e); }
      }
      setIsEditingAlbumTitle(false);
  };

  if (selectedAlbum) return (
      <div className="h-full bg-white flex flex-col pb-20">
          <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b flex items-center justify-between bg-white/80 backdrop-blur sticky top-0 z-10">
              <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedAlbum(null)} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft /></button>
                  {isEditingAlbumTitle ? (
                      <input autoFocus value={tempAlbumName} onChange={(e) => setTempAlbumName(e.target.value)} onBlur={saveAlbumName} onKeyDown={(e) => { if(e.key === 'Enter') saveAlbumName(); }} className="text-xl font-bold font-cute bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-rose-200" />
                  ) : (
                      <h2 onClick={() => { setTempAlbumName(selectedAlbum.name); setIsEditingAlbumTitle(true); }} className="text-xl font-bold font-cute cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition" title="点击重命名">{selectedAlbum.name}</h2>
                  )}
              </div>
              <div className="flex gap-2">{isManageMode ? <><button onClick={() => setSelectedItems(new Set(selectedAlbum.media.map(m => m.id)))} className="text-blue-500 font-bold text-sm px-3 py-1 bg-blue-50 rounded-full">全选</button><button onClick={batchDeletePhotos} className="text-red-500 font-bold text-sm px-3 py-1 bg-red-50 rounded-full">删除({selectedItems.size})</button><button onClick={() => setIsManageMode(false)} className="text-gray-500 font-bold text-sm px-3 py-1">取消</button></> : <><button onClick={() => setIsManageMode(true)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><Settings size={20} /></button><label className="p-2 bg-rose-50 text-rose-500 rounded-full cursor-pointer"><Plus size={24} /><input type="file" multiple accept="image/*" className="hidden" onChange={handleAlbumUpload} /></label></>}</div>
          </div>
          {/* 修复：增加 (selectedAlbum.media || []) 保护 */}
          <div className="p-4 grid grid-cols-3 md:grid-cols-5 gap-2 overflow-y-auto">{(selectedAlbum.media || []).map((item, idx) => (<div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative group cursor-pointer" onClick={() => isManageMode ? setSelectedItems(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; }) : handleViewImage(item.url, 'album', (selectedAlbum.media || []).map(m => m.url))}><img src={item.url} className={`w-full h-full object-cover transition ${isManageMode && selectedItems.has(item.id) ? 'opacity-50 scale-90' : ''}`} loading="lazy" />{isManageMode && (<div className="absolute top-2 right-2">{selectedItems.has(item.id) ? <CheckCircle className="text-rose-500 fill-white" /> : <div className="w-5 h-5 rounded-full border-2 border-white/80" />}</div>)}</div>))}</div>
          {viewingImage && typeof viewingImage === 'object' && 'list' in viewingImage && (
            <ImageViewer 
                images={viewingImage.list} 
                initialIndex={viewingImage.index} 
                onClose={() => setViewingImage(null)} 
                actions={viewerActions} 
            />
          )}

          {/* [修复] 添加进度条显示到相册详情页 */}
          {uploadStatus && uploadStatus.isUploading && (
            <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center touch-none">
                <div className="bg-white rounded-3xl p-8 w-72 shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-300">
                    <div className="relative w-24 h-24 mb-6">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <path className="text-gray-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                            <path className="text-rose-500 transition-all duration-300 ease-out" strokeDasharray={`${(uploadStatus.current / (uploadStatus.total || 1)) * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <span className="text-2xl font-black text-rose-500 font-cute">{Math.round((uploadStatus.current / (uploadStatus.total || 1)) * 100)}%</span>
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-700 mb-2 font-cute animate-pulse">正在上传...</h3>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">第 {uploadStatus.current} 张 / 共 {uploadStatus.total} 张</span>
                    </div>
                </div>
            </div>
          )}
      </div>
  );

  return (
    <div className="h-full bg-white overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] relative">
        <div className="relative group cursor-pointer" style={{ height: '320px' }}>
             <div className="absolute inset-0 z-0" onClick={handleCoverClick}>
                 <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-black/10 pointer-events-none" />
             </div>

             <input id="cover-upload" type="file" className="hidden" onChange={onUpdateCover} accept="image/*" />
            
            <div className="absolute -bottom-8 right-4 flex items-end gap-3 z-20">
                 <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    {isEditingMomentsTitle ? (
                         <input 
                            value={momentsTitle} 
                            onChange={(e) => setMomentsTitle(e.target.value)} 
                            // [修改] 失去焦点或回车时，调用 onUpdateMomentsTitle 保存到云端
                            onBlur={() => { setIsEditingMomentsTitle(false); if(onUpdateMomentsTitle) onUpdateMomentsTitle(momentsTitle); }} 
                            onKeyDown={(e) => { if(e.key === 'Enter') { setIsEditingMomentsTitle(false); if(onUpdateMomentsTitle) onUpdateMomentsTitle(momentsTitle); }}} 
                            autoFocus 
                            className="text-white font-bold text-lg drop-shadow-md pb-10 font-cute bg-transparent outline-none border-b border-white w-40 text-right" 
                         />
                    ) : (
                         <div onClick={() => setIsEditingMomentsTitle(true)} className="text-white font-bold text-lg drop-shadow-md pb-10 font-cute cursor-pointer select-none" title="点击修改标题">{momentsTitle}</div>
                    )}
                 </div>
                 <div className="bg-white p-1 rounded-xl shadow-lg pointer-events-auto cursor-pointer relative z-30" onClick={handleHeaderAvatarClick}>
                    <div className="w-16 h-16 bg-rose-100 rounded-lg flex items-center justify-center overflow-hidden">
                        {momentsAvatar ? <img src={momentsAvatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">👩‍❤️‍👨</div>}
                    </div>
                 </div>
            </div>

            <div className="absolute top-8 right-4 z-30">
                <button 
                    onMouseDown={handlePressStart}
                    onMouseUp={handlePressEnd}
                    onTouchStart={handlePressStart} // 新增：手机端触摸开始
                    onTouchEnd={handlePressEnd}     // 新增：手机端触摸结束
                    onContextMenu={(e) => e.preventDefault()}
                    className="bg-black/20 p-2 rounded-full text-white hover:bg-black/40 backdrop-blur-sm pointer-events-auto transition-transform active:scale-90 select-none"
                    style={{ WebkitTouchCallout: 'none', userSelect: 'none' }} // 新增：防止长按弹出系统菜单
                >
                    <Camera size={20} />
                </button>
                <input id="camera-file-input" type="file" multiple accept="image/*" className="hidden" onChange={onFileSelect} />
            </div>
        </div>

      <div className="mt-14 mb-4 border-b border-gray-100 pb-1 relative bg-white sticky top-0 z-30 flex justify-center pt-[env(safe-area-inset-top)]">
          <button onClick={() => setActiveTab('moments')} className={`px-6 py-2 font-bold transition-all relative ${activeTab === 'moments' ? 'text-rose-500' : 'text-gray-400'}`}>瞬间 {activeTab === 'moments' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />}</button>
          <button onClick={() => setActiveTab('albums')} className={`px-6 py-2 font-bold transition-all relative ${activeTab === 'albums' ? 'text-rose-500' : 'text-gray-400'}`}>相册 {activeTab === 'albums' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />}</button>
      </div>
      
      <div className="px-4 pb-10 max-w-2xl mx-auto min-h-[50vh] bg-white">
          {activeTab === 'moments' ? (
    <div className="space-y-8">
      {/* 🟢【新增】粘贴到这里，放在列表最上方，并去掉了原来的 -mt-8 样式 */}
        {unreadNotes.length > 0 && (
            <div className="flex justify-center mb-4 mt-2 cursor-pointer" onClick={() => setShowMessageList(true)}>
                <div className="bg-gray-800 text-white rounded-md px-4 py-2 flex items-center gap-2 shadow-lg text-sm font-bold animate-pulse">
                    <div className="w-8 h-8 rounded bg-gray-600 overflow-hidden">
                        <img src={latestNote.fromAvatar || DEFAULT_AVATAR} className="w-full h-full object-cover"/>
                    </div>
                    <span>{unreadNotes.length} 条新消息</span>
                </div>
            </div>
        )}
        {/* 🟢【新增结束】 */}
        {/* ✅ 修复1：防止 memories 为空导致白屏 */}
        {(memories || []).map((memory: Memory) => (
        <div key={memory.id} id={`moment-${memory.id}`} className="flex gap-3 pb-6 border-b border-gray-50 last:border-0">
            
                <div className="w-10 h-10 rounded-lg bg-rose-100 overflow-hidden shrink-0 cursor-pointer" onClick={() => handleListAvatarClick(memory.creatorAvatar)}>
                    {memory.creatorAvatar ? <img src={memory.creatorAvatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">👤</div>}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-800 font-cute text-sm mb-1 text-blue-900">
                        {memory.creatorId === user.objectId 
                          ? (user.nickname || user.username) 
                          : (memory.creatorName || 'Ta')}
                    </h4>
                    <p className="mb-2 text-gray-800 text-sm leading-relaxed">{memory.caption}</p>
                              {/* ✅ 修复2：防止 media 为空导致白屏 */}
                    {memory.type === 'media' && memory.media && memory.media.length > 0 && (
                        <div className={`grid gap-1 mb-2 max-w-[80%] ${memory.media.length === 1 ? 'grid-cols-1' : memory.media.length === 4 ? 'grid-cols-2 w-2/3' : 'grid-cols-3'}`}>
                            {(memory.media || []).map((url: string, idx: number) => (
                                <div key={idx} onClick={() => handleViewImage(url, 'memory', memory.media)} className={`aspect-square bg-gray-100 cursor-pointer overflow-hidden ${memory.media.length === 1 ? 'max-w-[200px] max-h-[200px]' : ''}`}>
                                    <img src={url} className="w-full h-full object-cover" alt="Memory" />
                                </div>
                            ))}
                        </div>
                    )}
                              <div className="flex justify-between items-center mt-2 relative">
                                  <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">{memory.date}</span>
        {/* 只有是自己发布的，才显示删除按钮 */}
        {memory.creatorId === user.objectId && (
            <button onClick={() => onDeleteMemory(memory.id)} className="text-xs text-blue-900 hover:underline">删除</button>
        )}
    </div>
                         <div className="relative"><button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === memory.id ? null : memory.id); }} className="bg-gray-50 p-1 rounded-sm text-blue-800 hover:bg-gray-100"><MoreHorizontal size={16} /></button><AnimatePresence>{activeMenuId === memory.id && (<motion.div initial={{ opacity: 0, scale: 0.9, x: 10 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 10 }} className="absolute right-8 top-0 bg-gray-800 text-white rounded-md flex items-center overflow-hidden shadow-xl z-10" onClick={(e) => e.stopPropagation()}><button onClick={() => { handleLike(memory.id); setActiveMenuId(null); }} className="flex items-center gap-1 px-4 py-2 hover:bg-gray-700 text-xs font-bold min-w-[80px] justify-center"><Heart size={14} fill={memory.isLiked ? "red" : "none"} color={memory.isLiked ? "red" : "white"} />{memory.isLiked ? '取消' : '赞'}</button><div className="w-[1px] h-4 bg-gray-600"></div><button onClick={() => { const input = prompt('请输入评论'); if(input) { handleComment(memory.id, input); setActiveMenuId(null); } }} className="flex items-center gap-1 px-4 py-2 hover:bg-gray-700 text-xs font-bold min-w-[80px] justify-center"><MessageCircle size={14} />评论</button></motion.div>)}</AnimatePresence></div>
                    </div>
                              {(memory.likes > 0 || (memory.comments && memory.comments.length > 0)) && (
                                <div className="mt-3 bg-gray-50 rounded-sm p-2 text-xs relative">
                                    {/* 小三角 */}
                                    <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-50 rotate-45 transform" />
                             {memory.likes > 0 && (
                                        <div className="flex items-start gap-1 text-blue-900 font-bold border-b border-gray-200/50 pb-1 mb-1 leading-5">
                                            <Heart size={12} fill="none" className="mt-1 shrink-0" />
                                            <span className="break-words">
                                                {/* 优先显示昵称列表，如果没有则回退到数字 */}
                                                {memory.likeNames && memory.likeNames.length > 0 
                                                    ? memory.likeNames.join(', ') 
                                                    : `${memory.likes} 人`} 觉得很赞
                                            </span>
                                        </div>
                                    )}
                             {/* 评论列表 */}
                                    {(memory.comments || []).map((c: any) => (
                                        <div 
                                            key={c.id} 
                                            className="leading-5 text-gray-600 active:bg-gray-100 p-0.5 rounded cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const input = prompt(`回复 ${c.authorName}:`);
                                                // [修改] 这里增加了第三个参数 c.authorId，告诉函数我们要回复谁
                                                if (input) handleComment(memory.id, `回复 ${c.authorName}: ${input}`, c.authorId);
                                            }}
                                            onContextMenu={(e) => {
                                                // 长按(手机) 或 右键(电脑)
                                                e.preventDefault(); 
                                                e.stopPropagation();
                                                if (c.authorId === user.objectId) {
                                                    handleDeleteComment(memory.id, c.id);
                                                }
                                            }}
                                        >
                                            <span className="font-bold text-blue-900">{c.authorName || 'Ta'}:</span> {c.text}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                ))}
            </div>
          ) : (
              <div>
                  <div className="flex justify-between items-center mb-4 px-2">
                      {isManageMode ? (
                          <button onClick={() => setSelectedItems(new Set(albums.map(a => a.id)))} className="text-sm font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full">全选</button>
                      ) : (
                          <div onClick={() => setIsCreatingAlbum(true)} className="flex items-center gap-2 text-gray-500 cursor-pointer hover:text-rose-500"><FolderPlus size={20} /><span className="text-sm font-bold">新建相册</span></div>
                      )}
                      <button onClick={() => setIsManageMode(!isManageMode)} className={`text-sm font-bold ${isManageMode ? 'text-rose-500' : 'text-gray-400'}`}>{isManageMode ? '完成' : '管理'}</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {albums.map((album: Album) => (
                          <div key={album.id} onClick={() => isManageMode ? setSelectedItems(p => { const n = new Set(p); n.has(album.id) ? n.delete(album.id) : n.add(album.id); return n; }) : setSelectedAlbum(album)} className={`aspect-square bg-white rounded-3xl shadow-sm border border-gray-100 p-2 relative group overflow-hidden cursor-pointer transition ${isManageMode && selectedItems.has(album.id) ? 'ring-2 ring-rose-500 bg-rose-50' : ''}`}>
                              {album.coverUrl ? (<img src={album.coverUrl} className="w-full h-full object-cover rounded-2xl" />) : (<div className="w-full h-full bg-gray-50 rounded-2xl flex items-center justify-center text-xs text-gray-400 border border-gray-100">暂无封面</div>)}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4 rounded-2xl pointer-events-none"><div className="text-white w-full"><h4 className="font-bold truncate text-shadow-sm">{album.name}</h4><span className="text-xs opacity-90">{(album.media || []).length} 张照片</span></div></div>
                              {isManageMode && (<div className="absolute top-2 right-2 pointer-events-none">{selectedItems.has(album.id) ? <CheckCircle className="text-rose-500 fill-white" /> : <div className="w-5 h-5 rounded-full border-2 border-white/80 bg-black/20" />}</div>)}
                          </div>
                      ))}
                  </div>
                  {isManageMode && (
                      <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-gray-100 flex justify-center gap-4 z-40">
                          <button 
                              onClick={async () => { 
                                  if(window.confirm(`确定要删除选中的 ${selectedItems.size} 个相册吗？`)) { 
                                      // 1. 本地立即删除
                                      setAlbums((prev: Album[]) => prev.filter(a => !selectedItems.has(a.id))); 
                                      setIsManageMode(false);
                                      
                                      // 2. [新增] 云端同步删除
                                      try {
                                          const promises = Array.from(selectedItems).map(id => 
                                              AV.Object.createWithoutData('Album', id).destroy()
                                          );
                                          await Promise.all(promises);
                                      } catch(e) {
                                          console.error("删除失败", e);
                                          alert("云端同步删除失败，请检查网络");
                                      }
                                  }
                              }} 
                              disabled={selectedItems.size === 0} 
                              className="bg-red-500 text-white px-6 py-2 rounded-full font-bold shadow-md disabled:bg-gray-300"
                          >
                              删除选中 ({selectedItems.size})
                          </button>
                      </div>
                  )}
              </div>
          )}
      </div>


      {/* [新增] 消息列表弹窗 */}
      <AnimatePresence>
          {showMessageList && (
              <motion.div 
                initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
                className="fixed inset-0 z-[200] bg-white flex flex-col"
              >
                  <div className="p-4 border-b flex items-center justify-between bg-white sticky top-0">
                      <h3 className="font-bold text-lg">消息列表</h3>
                      <button onClick={() => setShowMessageList(false)}><X size={24} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {notifications.length === 0 && <p className="text-center text-gray-400 mt-10">暂无消息</p>}
                      {notifications.map((note: any) => (
                          <div key={note.id} onClick={() => handleNoteClick(note)} className={`flex gap-3 p-3 rounded-xl cursor-pointer ${note.isRead ? 'bg-white' : 'bg-rose-50'}`}>
                              <img src={note.fromAvatar || DEFAULT_AVATAR} className="w-10 h-10 rounded-lg bg-gray-200 object-cover" />
                              <div className="flex-1 border-b border-gray-100 pb-2">
                                  <div className="flex justify-between">
                                      <span className="font-bold text-blue-900 text-sm">{note.fromUser}</span>
                                      <span className="text-xs text-gray-400">{formatDate(note.createdAt)}</span>
                                  </div>
                                  <div className="text-sm text-gray-700 mt-1">
                                      {note.type === 'like' ? <span className="flex items-center gap-1"><Heart size={12} fill="red" className="text-red-500"/> 赞了你的朋友圈</span> : note.content}
                                  </div>
                              </div>
                              {/* 如果能获取到缩略图更好，这里简化 */}
                              <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">查看</div>
                          </div>
                      ))}
                  </div>
              </motion.div>
          )}
      </AnimatePresence>
      
      
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
      {viewingImage && typeof viewingImage === 'object' && 'list' in viewingImage && (
        <ImageViewer 
            images={viewingImage.list} 
            initialIndex={viewingImage.index} 
            onClose={() => setViewingImage(null)} 
            actions={viewerActions} 
        />
      )}
      <input id="shared-avatar-upload" type="file" className="hidden" onChange={onUpdateMomentsAvatar} accept="image/*" />

      {/* [新增] 常驻刷新按钮：浅色方形圆角，位于右下角 */}
      <button 
        onClick={async () => {
            if (isRefreshing) return;
            setIsRefreshing(true);
            try {
                if(onRefresh) await onRefresh(); // 调用父组件传入的刷新函数
            } finally {
                setIsRefreshing(false);
            }
        }}
        className="fixed bottom-24 right-4 z-[90] bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-rose-100 text-rose-400 active:scale-90 transition-all hover:bg-rose-50"
      >
         {/* 复用 lucide-react 的 RefreshCw 图标，点击时旋转 */}
         <RefreshCw size={24} className={isRefreshing ? "animate-spin" : ""} />
      </button>
      {/* [新增] 精美上传进度条弹窗 */}
      {uploadStatus && uploadStatus.isUploading && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center touch-none">
            <div className="bg-white rounded-3xl p-8 w-72 shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-300">
                <div className="relative w-24 h-24 mb-6">
                    {/* 背景圆环 */}
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path className="text-gray-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        {/* 进度圆环 */}
                        <path 
                            className="text-rose-500 transition-all duration-300 ease-out" 
                            strokeDasharray={`${(uploadStatus.current / (uploadStatus.total || 1)) * 100}, 100`} 
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="3" 
                            strokeLinecap="round" 
                        />
                    </svg>
                    {/* 中间百分比 */}
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-2xl font-black text-rose-500 font-cute">
                            {Math.round((uploadStatus.current / (uploadStatus.total || 1)) * 100)}%
                        </span>
                    </div>
                </div>
                <h3 className="text-lg font-bold text-gray-700 mb-2 font-cute animate-pulse">正在上传...</h3>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                        第 {uploadStatus.current} 张 / 共 {uploadStatus.total} 张
                    </span>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

const CycleViewContent = ({ periods, nextPeriod, addPeriod, deletePeriod, updatePeriod }: any) => {
  const handleLogPeriod = () => { if(confirm(`记录今天 (${getBeijingDateString()}) 为大姨妈开始日？`)) addPeriod(getBeijingDateString());
};
  return (
    <div className="p-6 space-y-6 pb-[calc(6rem+env(safe-area-inset-bottom))] h-full overflow-y-auto">
        <h2 className="text-2xl font-bold font-cute text-rose-500 text-center mb-2 mt-4">经期记录</h2>
        <div className="bg-white rounded-3xl p-8 shadow-xl text-center border-2 border-rose-100 relative overflow-hidden">
             <div className="relative z-10">
                <h2 className="text-gray-500 font-bold mb-2 font-cute">距离下次大姨妈还有</h2>
                <div className="text-6xl font-black text-rose-500 my-4 font-cute">{nextPeriod 
? nextPeriod.daysLeft : '?'}<span className="text-lg text-gray-400 ml-2 font-bold">天</span></div>
                {nextPeriod && <p className="text-gray-400 text-sm">预计日期: {nextPeriod.date}</p>}
                
                {/* 按钮区域：包含大姨妈按钮和补录日期 */}
                <div className="flex flex-col items-center z-50 relative">
                    <button onClick={handleLogPeriod} className="mt-8 bg-rose-500 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-rose-200 hover:scale-105 transition-transform active:scale-95 flex items-center gap-2 mx-auto cursor-pointer"><Heart fill="white" size={20} /> 大姨妈来了</button>
                    <div 
                        className="mt-4 text-xs text-rose-400/80 font-bold cursor-pointer hover:text-rose-500 transition relative py-2 px-4 rounded-lg hover:bg-rose-50 select-none flex items-center justify-center"
                        // 2. 电脑端逻辑：点击文字区域时，手动弹出日历
                        onClick={(e) => {
                            // 查找内部的 input 元素
                            const input = e.currentTarget.querySelector('input');
                            // 只有点击的不是 input 本身（即点击的是文字）时才触发
                            if (input && e.target !== input) {
                                try { 
                                    input.showPicker(); 
                                } catch (err) { 
                                    console.log("Browser doesn't support showPicker");
                                }
                            }
                        }}
                    >
                        📅 补录其他日期
                        <input 
                            type="date" 
                            // 3. 样式核心修改：
                            // absolute inset-0 w-full h-full opacity-0 -> 手机端：全覆盖透明层，保证触摸灵敏
                            // md:static md:w-0 md:h-0 md:border-0 md:p-0 md:overflow-hidden -> 电脑端：宽高为0，变成一个不可见的点，防止鼠标划过触发
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer md:static md:w-0 md:h-0 md:border-0 md:p-0 md:overflow-hidden"
                            
                            // 4. 阻止冒泡，防止手机端点击 input 时重复触发外层 div 的 onClick
                            onClick={(e) => e.stopPropagation()}
                            
                            onChange={(e) => { 
                                const date = e.target.value; 
                                if (date) { 
                                    // 延时一下，让 UI 反应过来
                                    setTimeout(() => { 
                                        if (confirm(`确定补录 ${date} 为经期开始日？`)) { 
                                            addPeriod(date); 
                                        } 
                                    }, 100); 
                                    e.target.value = ''; 
                                } 
                            }} 
                        />
                    </div>
                </div>
             </div>
             <div className="absolute top-0 right-0 -mt-10 -mr-10 
w-40 h-40 bg-rose-50 rounded-full opacity-50 pointer-events-none" /><div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-rose-50 rounded-full opacity-50 pointer-events-none" />
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50">
            <h3 className="font-bold text-gray-700 mb-4 font-cute flex items-center gap-2"><RotateCcw size={18} className="text-rose-400" /> 历史记录</h3>
            <div className="space-y-3">
                {periods.slice().reverse().map((p: any, i: number) => (<div key={i} className="flex 
justify-between items-center p-3 bg-rose-50/50 rounded-xl group">
                    <span className="font-bold text-gray-600">{p.startDate}</span>
                    <div className="flex items-center gap-2">
                        <span 
                            onClick={() => {
                                const input = prompt("修改持续天数:", p.duration);
                                const days = parseInt(input || '0');
                                if (days > 0 && updatePeriod) updatePeriod(periods.length - 1 - i, days);
                            }}
                            className="text-xs text-rose-400 font-bold px-2 py-1 bg-white rounded-lg shadow-sm cursor-pointer hover:bg-rose-100 transition"
                            title="点击修改天数"
                        >
                            持续 {p.duration} 天
                        </span>
                        <button onClick={() => deletePeriod(periods.length - 1 - i)} className="text-gray-300 hover:text-red-500 p-1"><X size={16} /></button>
                    </div>
                </div>))}
                {periods.length === 0 && <p className="text-center text-gray-400 text-sm py-4">还没有记录哦</p>}
            </div>
        </div>
    </div>
  );
};
const ConflictViewContent = ({ user, judgeConflict, conflicts, setConflicts }: any) => {
    const [activeTab, setActiveTab] = useState<'solo' | 'joint'>('solo');
    
    // --- 独自记录 State ---
    const [reason, setReason] = useState('');
    const [hisPoint, setHisPoint] = useState('');
    const [herPoint, setHerPoint] = useState('');
    const [isJudging, setIsJudging] = useState(false);

    // --- 双人裁决 State ---
    const [jointSession, setJointSession] = useState<JointSession | null>(null);
    const [myReason, setMyReason] = useState('');
    const [myPoint, setMyPoint] = useState('');
    const [isJointLoading, setIsJointLoading] = useState(false);

    // 检查是否有进行中的双人会话
    useEffect(() => {
        if (activeTab === 'joint' && user.coupleId) {
            checkJointSession();
            const timer = setInterval(checkJointSession, 5000); // 轮询状态
            return () => clearInterval(timer);
        }
    }, [activeTab, user]);

    const checkJointSession = async () => {
        const q = new AV.Query('JointSession');
        q.equalTo('coupleId', user.coupleId);
        q.notEqualTo('status', 'resolved'); // 只找未完成的
        const res = await q.find();
        if (res.length > 0) {
            setJointSession({ ...res[0].toJSON(), id: res[0].id });
        } else {
            setJointSession(null);
        }
    };

    // 独自裁决逻辑 (保持不变，但增加 type: 'solo' 并同步云端)
const handleSoloJudge = async () => {
        if (!reason || !hisPoint || !herPoint) return alert("请填写完整信息喵！");
        setIsJudging(true);
        const result = await judgeConflict(reason, hisPoint, herPoint);
        
        const newRecord = {
            date: getBeijingDateString(),
            reason, hisPoint, herPoint,
            aiResponse: result,
            type: 'solo', 
            // [修改] 使用当前用户昵称，而不是写死的 '男方'/'女方'
            hisName: user.nickname || '我', 
            herName: '对方',
            writer_id: user.objectId,
            binding_id: user.coupleId
        };
        
        try {
            const Obj = new AV.Object('Conflict');
            Object.keys(newRecord).forEach(k => Obj.set(k, (newRecord as any)[k]));
            const saved = await Obj.save();
            setConflicts([{ ...newRecord, id: saved.id }, ...conflicts]);
        } catch(e) { console.error(e); }
        
        setIsJudging(false); setReason(''); setHisPoint(''); setHerPoint('');
    };

// [修改] 双人裁决：保存真实昵称
    const handleJointSubmit = async () => {
        if (!myReason || !myPoint) return alert("请填写完整哦");
        if (!user.coupleId) return alert("请先绑定另一半");
        
        setIsJointLoading(true);
        try {
            if (!jointSession) {
                // 我是发起人
                const session = new AV.Object('JointSession');
                session.set('coupleId', user.coupleId);
                session.set('status', 'waiting');
                session.set('initiatorId', user.objectId);
                session.set('initiatorName', user.nickname || '发起人');
                session.set('initiatorReason', myReason);
                session.set('initiatorPoint', myPoint);
                await session.save();
                await checkJointSession();
            } else {
                // 我是响应人
                if (jointSession.initiatorId === user.objectId) return alert("等待对方填写中...");
                
                const initiatorName = jointSession.initiatorName;
                const responderName = user.nickname || '响应人';

                const result = await judgeJointConflict(
                    initiatorName, jointSession.initiatorReason, jointSession.initiatorPoint,
                    responderName, myReason, myPoint
                );

                const finalRecord = {
                    date: getBeijingDateString(),
                    reason: result.mergedReason, 
                    hisPoint: jointSession.initiatorPoint,
                    herPoint: myPoint,
                    aiResponse: result,
                    type: 'joint',
                    // [新增] 保存名字用于显示
                    hisName: initiatorName, 
                    herName: responderName,
                    writer_id: user.objectId,
                    binding_id: user.coupleId
                };

                const conflictObj = new AV.Object('Conflict');
                Object.keys(finalRecord).forEach(k => conflictObj.set(k, (finalRecord as any)[k]));
                const savedConflict = await conflictObj.save();

                const sessionObj = AV.Object.createWithoutData('JointSession', jointSession.id);
                sessionObj.set('status', 'resolved');
                await sessionObj.save();

                setConflicts([{ ...finalRecord, id: savedConflict.id }, ...conflicts]);
                setJointSession(null); setMyReason(''); setMyPoint('');
                alert("裁决完成！已生成客观判决书。");
            }
        } catch (e) { console.error(e); alert("提交失败"); } finally { setIsJointLoading(false); }
    };

return (
        <div className="flex flex-col h-full bg-gray-50">
             <div className="flex bg-white shadow-sm pt-[env(safe-area-inset-top)] z-10 relative">
                {/* [修改] 添加 font-cute 类名 */}
    <button onClick={() => setActiveTab('solo')} className={`flex-1 py-7 font-bold text-base font-cute transition-colors ${activeTab === 'solo' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}>独自记录</button>
    <button onClick={() => setActiveTab('joint')} className={`flex-1 py-7 font-bold text-base font-cute transition-colors ${activeTab === 'joint' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-gray-400'}`}>双方裁决</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-24">
                {activeTab === 'solo' ? (
                    // 独自记录输入区 (保持不变)
                    <div className="bg-white rounded-3xl p-6 shadow-lg border border-indigo-50 mb-8">
                        <h3 className="text-center font-bold text-indigo-900 mb-4 font-cute">✏️ 一个人写</h3>
                        <div className="space-y-4">
                            <input className="w-full bg-gray-50 rounded-xl p-3 text-sm outline-none" placeholder="争吵原因..." value={reason} onChange={e => setReason(e.target.value)} />
                            <div className="grid grid-cols-2 gap-3">
                                <textarea className="bg-blue-50/50 rounded-xl p-3 text-xs h-24 resize-none" placeholder="男方观点..." value={hisPoint} onChange={e => setHisPoint(e.target.value)} />
                                <textarea className="bg-rose-50/50 rounded-xl p-3 text-xs h-24 resize-none" placeholder="女方观点..." value={herPoint} onChange={e => setHerPoint(e.target.value)} />
                            </div>
                            <button onClick={handleSoloJudge} disabled={isJudging} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-md flex justify-center items-center gap-2">
                                {isJudging ? <Loader2 className="animate-spin" /> : <Gavel size={20} />} 请求喵喵法官裁决
                            </button>
                        </div>
                    </div>
                ) : (
                    // [修改] 双方裁决输入区：标题修改
                    <div className="bg-white rounded-3xl p-6 shadow-lg border border-rose-50 mb-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 bg-rose-100 rounded-bl-xl text-rose-500 text-xs font-bold">✨ 双人模式</div>
                        {jointSession && jointSession.initiatorId === user.objectId ? (
                            <div className="text-center py-8">
                                <div className="animate-pulse text-4xl mb-2">⏳</div>
                                <h3 className="font-bold text-gray-700">已提交，等待 TA 来回应...</h3>
                                <p className="text-xs text-gray-400 mt-2">快去叫 Ta 打开 App 填写！</p>
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-center font-bold text-rose-500 mb-4 font-cute">
                                    {jointSession ? `回复 ${jointSession.initiatorName}` : '双方裁决'}
                                </h3>
                                <div className="space-y-4">
                                    <div><label className="text-xs font-bold text-gray-500 ml-1">争吵原因</label><input className="w-full bg-gray-50 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-rose-200" placeholder="简单说说..." value={myReason} onChange={e => setMyReason(e.target.value)} /></div>
                                    <div><label className="text-xs font-bold text-gray-500 ml-1">你的想法</label><textarea className="w-full bg-gray-50 rounded-xl p-3 text-sm h-24 resize-none focus:ring-2 focus:ring-rose-200" placeholder="其实我觉得..." value={myPoint} onChange={e => setMyPoint(e.target.value)} /></div>
                                    <button onClick={handleJointSubmit} disabled={isJointLoading} className="w-full bg-rose-500 text-white py-3 rounded-xl font-bold shadow-md flex justify-center items-center gap-2">{isJointLoading ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}{jointSession ? '提交并召唤喵喵法官' : '提交，等待对方'}</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* [修改] 历史记录卡片：包含新进度条和三段式分析 */}
                <div className="space-y-4">
                    <h3 className="text-center text-gray-300 text-xs font-bold tracking-widest uppercase">- {activeTab === 'solo' ? '独自记录' : '双方裁决'}历史 -</h3>
                    {conflicts.filter((c: any) => activeTab === 'solo' ? (c.type !== 'joint') : (c.type === 'joint')).map((c: ConflictRecord) => (
                        <div key={c.id} className={`bg-white rounded-3xl p-5 shadow-sm border ${c.type==='joint' ? 'border-rose-100 ring-1 ring-rose-50' : 'border-gray-100'}`}>
                            <div className="flex justify-between items-center mb-4 border-b border-gray-50 pb-2">
                                <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">{c.date}</span>
                                {c.type === 'joint' && <span className="text-[10px] bg-rose-100 text-rose-500 px-2 py-0.5 rounded-full font-bold">🐱 喵喵裁决书</span>}
                                <button onClick={() => { if(confirm("删除此记录?")) { setConflicts(conflicts.filter((x:any)=>x.id!==c.id)); AV.Object.createWithoutData('Conflict', c.id).destroy(); }}} className="text-gray-300"><Trash2 size={14}/></button>
                            </div>
                            <h4 className="font-bold text-gray-800 mb-4 text-center text-lg">{c.reason}</h4>
                            
                            {c.aiResponse && (
                                <div className="space-y-4">
                                    {/* [修改] 进度条：包含昵称和百分比 */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold px-1">
                                            <span className="text-blue-500 flex items-center gap-1">🔵 {c.hisName || '男方'} {c.aiResponse.hisFault}%</span>
                                            <span className="text-rose-500 flex items-center gap-1">{c.aiResponse.herFault}% {c.herName || '女方'} 🔴</span>
                                        </div>
                                        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                                            <div style={{ width: `${c.aiResponse.hisFault}%` }} className="bg-blue-400 h-full transition-all duration-1000 ease-out flex items-center justify-start pl-2 text-[8px] text-white font-bold opacity-80">锅</div>
                                            <div style={{ width: `${c.aiResponse.herFault}%` }} className="bg-rose-400 h-full transition-all duration-1000 ease-out flex items-center justify-end pr-2 text-[8px] text-white font-bold opacity-80">锅</div>
                                        </div>
                                    </div>

                                    {/* [修改] 三段式内容 */}
                                    <div className="space-y-3 mt-4">
                                        <div className="bg-orange-50/50 rounded-xl p-3 text-sm border border-orange-100">
                                            <p className="font-bold text-orange-800 text-xs mb-1 font-cute">🐱 喵喵复盘</p>
                                            <p className="text-gray-600 text-xs leading-relaxed">{c.aiResponse.analysis}</p>
                                        </div>
                                        <div className="bg-green-50/50 rounded-xl p-3 text-sm border border-green-100">
                                            <p className="font-bold text-green-800 text-xs mb-1 font-cute">🌱 喵喵和好方案</p>
                                            <p className="text-gray-600 text-xs leading-relaxed">{c.aiResponse.advice}</p>
                                        </div>
                                        <div className="bg-blue-50/50 rounded-xl p-3 text-sm border border-blue-100">
                                            <p className="font-bold text-blue-800 text-xs mb-1 font-cute">🛡️ 喵喵预防计划</p>
                                            <p className="text-gray-600 text-xs leading-relaxed">{c.aiResponse.prevention}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {conflicts.length === 0 && <p className="text-center text-gray-300 text-xs pt-4">这里空空的，说明感情很好哦 ~</p>}
                </div>
            </div>
        </div>
    );
};

const BoardViewContent = ({ user, messages, onPost, onPin, onFav, onDelete, onAddTodo, setMessages }: any) => {
    const [input, setInput] = useState(''); const [isManageMode, setIsManageMode] = useState(false); const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    useEffect(() => { if(!isManageMode) setSelectedItems(new Set()); }, [isManageMode]);
    const handleSend = async () => {
        if(!input.trim()) return;
        onPost(input);
        if(input.match(/今天|明天|要做|提醒/)) { const todos = await extractTodosFromText(input, getBeijingDateString()); if(todos.length) { todos.forEach(t => onAddTodo(t.text, t.date)); alert(`已添加 ${todos.length} 个待办！`); } }
        setInput('');
    };
    const batchAction = async (action: 'pin' | 'fav' | 'delete') => {
        if (selectedItems.size === 0) return;
        if (action === 'delete' && !confirm(`确定删除选中的 ${selectedItems.size} 条留言吗？`)) return;

        // 1. 本地立即更新 UI (乐观更新)
        setMessages((prev: Message[]) => {
            if (action === 'delete') {
                return prev.filter(m => !selectedItems.has(m.id));
            } else {
                return prev.map(m => {
                    if (selectedItems.has(m.id)) {
                        return {
                            ...m,
                            isPinned: action === 'pin' ? !m.isPinned : m.isPinned,
                            isFavorite: action === 'fav' ? !m.isFavorite : m.isFavorite
                        };
                    }
                    return m;
                });
            }
        });

        // 退出管理模式 (仅删除时)
        if (action === 'delete') {
            setIsManageMode(false);
            setSelectedItems(new Set());
        }

        // 2. [修复] 同步操作到 LeanCloud
        try {
            const idArray = Array.from(selectedItems);
            
            if (action === 'delete') {
                // 批量删除
                const objectsToDelete = idArray.map(id => AV.Object.createWithoutData('Message', id));
                await AV.Object.destroyAll(objectsToDelete);
                console.log("云端批量删除成功");
            } else {
                // 批量更新 (置顶/收藏)
                // 注意：这里需要根据当前最新的本地状态来更新，或者简单点，直接对选中的对象取反。
                // 但由于本地已经在上面 setMessages 里取反了，我们需要获取“新状态”比较麻烦。
                // 更稳妥的方式是：遍历选中的 ID，找到对应的 Message 对象，修改其属性，然后 saveAll。
                
                const objectsToUpdate: any[] = [];
                idArray.forEach(id => {
                    const msg = messages.find(m => m.id === id); // 注意：这里的 messages 是闭包里的旧值
                    if (msg) {
                        const obj = AV.Object.createWithoutData('Message', id);
                        if (action === 'pin') obj.set('isPinned', !msg.isPinned); // 取反旧值 = 新值
                        if (action === 'fav') obj.set('isFavorite', !msg.isFavorite);
                        objectsToUpdate.push(obj);
                    }
                });
                
                if (objectsToUpdate.length > 0) {
                    await AV.Object.saveAll(objectsToUpdate);
                    console.log(`云端批量${action}成功`);
                }
            }
        } catch (e) {
            console.error("批量操作同步云端失败", e);
            alert("云端同步失败，请刷新页面重试");
        }
    };
    return (
        <div className="flex flex-col h-full bg-yellow-50/30">
            <div className="pt-[calc(1rem+env(safe-area-inset-top))] px-4 pb-2 bg-yellow-50/30 flex justify-between items-center relative">
                {/* [新增] 管理模式下的全选按钮，替代原本的空 div */}
                <div className="w-8 flex items-center">
                    {isManageMode ? (
                        <button onClick={() => setSelectedItems(new Set(messages.map(m => m.id)))} className="text-xs font-bold text-gray-500 whitespace-nowrap px-2 py-1 bg-white rounded-lg shadow-sm active:scale-95">全选</button>
                    ) : (
                        <div></div>
                    )}
                </div>
                <h2 className="text-2xl font-bold font-cute text-yellow-600 text-center">留言板</h2>
                <button onClick={() => setIsManageMode(!isManageMode)} className={`p-2 rounded-full hover:bg-yellow-100 ${isManageMode ? 'text-rose-500' : 'text-gray-400'}`}>{isManageMode ? '完成' : <Settings size={20} />}</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40"><div className="grid grid-cols-1 gap-4">{messages.sort((a:any,b:any) => {
                // [修复] 留言排序：置顶优先，其余按 日期+时间 倒序排列 (解决云端ID无法排序问题)
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return (b.date + b.time).localeCompare(a.date + a.time);
            }).map((msg: Message) => (<div key={msg.id} onClick={() => isManageMode && setSelectedItems(p => { const n = new Set(p); n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id); return n; })} className={`p-6 rounded-2xl shadow-sm border text-base relative group transition-all ${msg.isFavorite ? 'bg-rose-50 border-rose-100' : 'bg-white border-yellow-100'} ${isManageMode && selectedItems.has(msg.id) ? 'ring-2 ring-rose-500 bg-rose-50' : ''}`}>


              {/* 🟢 [新增] 留言者信息头 */}
            <div className="flex items-center gap-2 mb-3 border-b border-dashed border-gray-200 pb-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden">
                    {(msg as any).authorAvatar ? <img src={(msg as any).authorAvatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs">👤</div>}
                </div>
                <span className="text-sm font-bold text-gray-600 font-cute">{(msg as any).authorName || '神秘人'}</span>
            </div>

              
              <p className="text-gray-700 font-cute mb-10 leading-relaxed whitespace-pre-wrap break-words text-lg">{msg.content}</p><div className="absolute bottom-4 left-0 right-0 px-6 flex justify-between items-center">
                <div className="text-xs text-gray-300 font-bold">{msg.date.slice(5)} {msg.time}</div>
                <div className="flex gap-4">
                    <button onClick={(e) => { e.stopPropagation(); extractTodosFromText(msg.content, getBeijingDateString()).then(t => { if(t.length) { t.forEach(i=>onAddTodo(i.text, i.date)); alert(`提取 ${t.length} 条待办`); } else alert('无待办'); }); }} className="transition text-yellow-500 hover:text-yellow-600"><Sparkles size={18} /></button>
                    <button onClick={() => onFav(msg.id)} className={`transition ${msg.isFavorite ? 'text-rose-500' : 'text-gray-300 hover:text-rose-500'}`}><Heart size={18} fill={msg.isFavorite ? "currentColor" : "none"} /></button>
                    <button onClick={() => onPin(msg.id)} className={`transition ${msg.isPinned ? 'text-blue-500' : 'text-gray-300 hover:text-blue-500'}`}><Pin size={18} fill={msg.isPinned ? "currentColor" : "none"} /></button>
                    
                    {/* 🟢 [修改] 只有作者本人才能看到删除按钮 */}
                    {(msg as any).writer_id === user.objectId && (
                        <button onClick={() => onDelete(msg.id)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={18} /></button>
                    )}
                </div>
            </div>  {msg.isPinned && <div className="absolute top-0 right-0 p-3 text-blue-500 transform rotate-45"><Pin size={24} fill="currentColor" /></div>}{isManageMode && (<div className="absolute top-4 right-4 pointer-events-none">{selectedItems.has(msg.id) ? <CheckCircle className="text-rose-500 fill-white" /> : <div className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white" />}</div>)}</div>))}</div></div>
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
        <div className="h-full bg-white flex flex-col pb-20"><h2 className="text-2xl font-bold font-cute text-gray-800 text-center pt-[calc(1rem+env(safe-area-inset-top))]">专属日历</h2>
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
const MainApp = ({ user, onLogout, onUpdateUser }: { user: any, onLogout: () => void, onUpdateUser: (u:any)=>void }) => {
  // 添加这一行，作为版本标记
  console.log("当前版本: v5.0 - 完善版");
  
  const [activePage, setActivePage] = useState<Page>(Page.HOME);
  const [uploadStatus, setUploadStatus] = useState({ current: 0, total: 0, isUploading: false });  // [新增] 上传进度状态
  const [notifications, setNotifications] = useState<any[]>([]); // [新增] 通知数据
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
  const [momentsAvatar, setMomentsAvatar] = useState<string>('');


  // --- 新增代码开始：处理物理返回键和双击退出 ---
  useEffect(() => {
    // 1. 初始化：进入 App 时，替换当前状态为 HOME，确保有一个历史状态
    window.history.replaceState({ page: Page.HOME }, document.title);

    let lastBackPressTime = 0;

    const handlePopState = (event: PopStateEvent) => {
      // 获取当前要回退到的页面状态
      const state = event.state;
      
      if (state && state.page) {
        // 如果历史记录里有页面状态，就跳转到那个页面（实现返回上一级）
        setActivePage(state.page);
      } else {
        // 如果历史记录空了（通常意味着退回到了入口），或者是 HOME 页再次返回
        // 这里的逻辑模拟“主页双击退出”
        
        const now = Date.now();
        // 如果当前是主页，且两次按键间隔小于 2秒
        if (activePage === Page.HOME && (now - lastBackPressTime < 2000)) {
           // 允许浏览器默认行为（即关闭 App/WebView）
           // 注意：在某些打包环境下，可能需要调用 navigator.app.exitApp()，但通常 history.back() 到底就退出了
           return; 
        } else if (activePage === Page.HOME) {
           // 第一次在主页按返回
           lastBackPressTime = now;
           // 重新把 Home 状态推回去，阻止 App 立即退出，并提示用户
           window.history.pushState({ page: Page.HOME }, document.title);
           // 提示用户（你可以换成更好看的 Toast 组件）
           const toast = document.createElement('div');
           toast.innerText = "再按一次退出小屁铃";
           toast.style.cssText = "position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:10px 20px;border-radius:20px;z-index:9999;font-size:14px;";
           document.body.appendChild(toast);
           setTimeout(() => document.body.removeChild(toast), 2000);
        } else {
           // 如果当前不是主页（但在历史栈底部），强制回到主页
           setActivePage(Page.HOME);
           window.history.replaceState({ page: Page.HOME }, document.title);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activePage]);

  // 封装一个切换页面的函数，替代直接 setPage
  const navigateTo = (page: Page) => {
    if (page === activePage) return;
    window.history.pushState({ page }, document.title);
    setActivePage(page);

    // [新增] 自动刷新数据：当进入这些页面时，后台静默刷新一次数据
    // [修改] 添加 Page.HOME，确保点击首页也能刷新日历和纪念日
    if ([Page.HOME, Page.CYCLE, Page.CONFLICT, Page.CALENDAR, Page.BOARD].includes(page)) {
        console.log(`[Auto Refresh] Updating data for ${page}...`);
        // 使用 loadData(false) 进行静默刷新，不会触发全屏 Loading
        loadData(false);
    }
  };
  // --- 新增代码结束 ---
  
  
  // ================= Bmob 云端数据加载逻辑 (开始) =================

// [修改] LeanCloud 查询辅助函数
  const getQuery = (className: string) => {
      const q = new AV.Query(className); 
      // 修复：确保 coupleId 是字符串才调用 split，防止崩溃
      if (user.coupleId && typeof user.coupleId === 'string') {
          const ids = user.coupleId.split('_'); 
          q.containedIn('writer_id', ids);      
      } else {
          q.equalTo('writer_id', user.objectId); 
      }
      return q;
  };
// 1. [修改] 把 loadData 提出来放在这里，方便按钮调用
  const loadData = async (isFullLoad = true) => {
       // [修复] 修改辅助函数：失败时返回 null，而不是空数组，防止网络错误导致数据清空
       const safeFind = async (query: AV.Query) => {
           try { return await query.find(); } 
           catch (e: any) { 
               if (e.code !== 101) console.warn("Load Error (keeping local data):", e); 
               return null; // 返回 null 表示本次查询失败
           }
       };

      // --- 始终刷新的数据 ---
       const momentsQuery = getQuery('Moments');
       if (momentsQuery) {
           // [修复] 增加非空判断 if (res)
           safeFind(momentsQuery.descending('createdAt').limit(50).include('likes')).then((res: any[]) => {
               if (res) { // 只有成功才更新
                   setMemories(res.map((item: any) => {
                       const m = item.toJSON();
                       const likedBy = Array.isArray(m.likedBy) ? m.likedBy : [];
                       const isLiked = likedBy.includes(user.objectId);
                       return {
                           ...m, id: item.id, date: formatDateTime(item.createdAt), media: m.images || [], comments: m.comments || [], likes: m.likes || 0, isLiked: isLiked, likeNames: m.likeNames || [], creatorId: m.creatorId || m.writer_id, creatorAvatar: m.creatorAvatar
                       };
                   }));
               }
           });
       }

       const noteQuery = new AV.Query('Notification');
       noteQuery.equalTo('toUser', user.objectId);
       noteQuery.descending('createdAt');
       noteQuery.limit(20);
       // [修复] 增加 if (res) 判断
       safeFind(noteQuery).then((res: any[]) => {
           if (res) setNotifications(res.map(n => ({ ...n.toJSON(), id: n.id })));
       });

       const msgQ = getQuery('Message');
       if(msgQ) safeFind(msgQ.descending('createdAt')).then((res: any) => {
           if (res) setMessages(res.map((m: any) => ({...m.toJSON(), id: m.id})));
       });

       const periodQ = getQuery('Period');
       if(periodQ) safeFind(periodQ).then((res:any) => {
           if (res) setPeriods(res.map((p:any) => ({...p.toJSON(), id: p.id})));
       });
         
       const conflictQ = getQuery('Conflict');
       if(conflictQ) safeFind(conflictQ.descending('createdAt')).then((res:any) => {
           if (res) setConflicts(res.map((c:any)=>({...c.toJSON(), id: c.id})));
       });

       const todoQ = getQuery('Todo');
       if(todoQ) safeFind(todoQ).then((res:any) => {
           if (res) setTodos(res.map((t:any)=>({...t.toJSON(), id: t.id})));
       });

       // [修改] 共享设置也移出来刷新，并添加纪念日同步
       if (user.coupleId) {
          const q = new AV.Query('CoupleSettings');
          q.equalTo('coupleId', String(user.coupleId));
          safeFind(q).then(res => { 
              if (res && res.length > 0) { // [修复] 增加 res 存在判断
                  const item = res[0]; 
                  if (item.get('coverUrl')) setMomentsCover(item.get('coverUrl')); 
                  if (item.get('avatarUrl')) setMomentsAvatar(item.get('avatarUrl'));
                  // [新增] 同步纪念日
                  if (item.get('anniversaryDate')) setAnniversaryDate(item.get('anniversaryDate'));
                  // [新增] 同步首页标题
                  if (item.get('appTitle')) setAppTitle(item.get('appTitle'));
                // [新增] 同步点滴页标题
                  if (item.get('momentsTitle')) setMomentsTitle(item.get('momentsTitle'));
              } 
          });
       }

    

       // --- [关键] 手动刷新时才加载的数据 (包括首页照片) ---
       if (isFullLoad) {
           const albumQuery = getQuery('Album');
           // [修复] 增加 if (res) 判断，防止相册被清空
           if(albumQuery) safeFind(albumQuery.descending('createdAt')).then((res: any) => {
               // [修复] Bug根源在此：a是SDK对象，没有.media属性，必须用 .get('media') 获取
               if (res) setAlbums(res.map((a: any) => ({ ...a.toJSON(), id: a.id, media: a.get('media') || [] })));
           });

           // [重点] 刷新首页照片
           const pinQ = getQuery('PinnedPhoto');
           if(pinQ) safeFind(pinQ).then((res:any) => {
               if (res) setPinnedPhotos(res.map((p:any)=>({...p.toJSON(), id: p.id})));
           });

          const periodQ = getQuery('Period');
          if(periodQ) safeFind(periodQ).then((res:any) => {
              if (res) setPeriods(res.map((p:any) => ({...p.toJSON(), id: p.id})));
          });
         
           const conflictQ = getQuery('Conflict');
           if(conflictQ) safeFind(conflictQ.descending('createdAt')).then((res:any) => {
               if (res) setConflicts(res.map((c:any)=>({...c.toJSON(), id: c.id})));
           });

           const todoQ = getQuery('Todo');
           if(todoQ) safeFind(todoQ).then((res:any) => {
               if (res) setTodos(res.map((t:any)=>({...t.toJSON(), id: t.id})));
           });
       }
  };

  useEffect(() => {
    if (user.avatarUrl) setAvatarUrl(user.avatarUrl);
    
    // 2. [修改] useEffect 只需要调用上面的 loadData
    loadData(true);
    // const timer = setInterval(() => loadData(false), 5000); // 轮询时不刷新首页
    // return () => clearInterval(timer);
  }, [user]);

          // [新增] 真实的云端点赞逻辑
// [新增] 真实的云端点赞逻辑 (已修复通知权限)
  const handleRealLike = async (id: string) => {
      const memory = memories.find(m => m.id === id);
      if (!memory) return;
      
      const isLiked = memory.isLiked;
      const nickname = user.nickname || user.username;
      
      // 1. 乐观更新 (本地立即显示)
      setMemories(memories.map(m => {
          if (m.id !== id) return m;
          let newLikeNames = m.likeNames || [];
          if (isLiked) {
              newLikeNames = newLikeNames.filter((n: string) => n !== nickname);
          } else {
              if (!newLikeNames.includes(nickname)) newLikeNames = [...newLikeNames, nickname];
          }
          return { ...m, likes: isLiked ? m.likes - 1 : m.likes + 1, isLiked: !isLiked, likeNames: newLikeNames };
      }));

      // 2. 云端更新
      try {
          const m = AV.Object.createWithoutData('Moments', id);
          if (isLiked) {
              m.increment('likes', -1);
              m.remove('likedBy', user.objectId);
              m.remove('likeNames', nickname); 
          } else {
              m.increment('likes', 1);
              m.addUnique('likedBy', user.objectId);
              m.addUnique('likeNames', nickname); 
              
              // [关键修复] 发送通知 (如果不是给自己点赞)
              if (memory.creatorId && memory.creatorId !== user.objectId) {
                  const note = new AV.Object('Notification');
                  note.set('type', 'like');
                  note.set('fromUser', nickname);
                  note.set('fromAvatar', user.avatarUrl);
                  note.set('toUser', memory.creatorId);
                  note.set('momentId', id);
                  note.set('isRead', false);
                  note.set('content', '觉得很赞');

                  // --- 设置 ACL 权限 (关键) ---
                  // 必须明确告诉 LeanCloud：这条消息“对方”也可以读、可以改(标记已读)
                  const acl = new AV.ACL();
                  acl.setReadAccess(user.objectId, true);  
                  acl.setWriteAccess(user.objectId, true); 
                  acl.setReadAccess(memory.creatorId, true);  
                  acl.setWriteAccess(memory.creatorId, true); 
                  note.setACL(acl);
                  // -------------------------

                  note.save(); 
              }
          }
          await m.save();
      } catch (e) { console.error("点赞失败", e); }
  };

// [新增] 真实的云端评论逻辑 (已修复通知权限)
  // [修改] 增加 targetUserId 参数，用于回复评论时通知对方
  const handleRealComment = async (id: string, text: string, targetUserId?: string) => {
      const nickname = user.nickname || user.username;
      const newComment = { 
          id: Date.now().toString(), 
          text: text, 
          authorId: user.objectId, 
          authorName: nickname,
          date: getBeijingDateString() 
      };

      setMemories(memories.map(m => m.id === id ? { ...m, comments: [...m.comments, newComment] } : m));

      try {
          const m = AV.Object.createWithoutData('Moments', id);
          m.add('comments', newComment);
          await m.save();

          // [关键修复] 发送评论通知
          const memory = memories.find(m => m.id === id);
          
          // [逻辑升级] 优先通知被回复的人 (targetUserId)，如果没有则通知朋友圈作者 (creatorId)
          // 排除掉“自己通知自己”的情况
          let notifyId = null;
          
          if (targetUserId && targetUserId !== user.objectId) {
              notifyId = targetUserId; // 优先通知被回复的人
          } else if (memory && memory.creatorId && memory.creatorId !== user.objectId) {
              notifyId = memory.creatorId; // 否则通知朋友圈主人
          }

          if (notifyId) {
              const note = new AV.Object('Notification');
              note.set('type', 'comment');
              note.set('fromUser', nickname);
              note.set('fromAvatar', user.avatarUrl);
              note.set('toUser', notifyId); // 使用计算出的通知对象
              note.set('momentId', id);
              note.set('isRead', false);
              note.set('content', text);

              // --- 设置 ACL 权限 (关键) ---
              const acl = new AV.ACL();
              acl.setReadAccess(user.objectId, true);
              acl.setWriteAccess(user.objectId, true);
              acl.setReadAccess(notifyId, true); // 对方必须可读
              acl.setWriteAccess(notifyId, true); // 对方必须可写(改状态)
              note.setACL(acl);
              // -------------------------

              note.save();
          }
      } catch (e) { console.error("评论失败", e); }
  };


  // [新增] 删除评论函数
  const handleDeleteComment = async (memoryId: string, commentId: string) => {
      const memory = memories.find(m => m.id === memoryId);
      if (!memory) return;
      const comment = memory.comments.find((c: any) => c.id === commentId);
      if (!comment) return;

      if (!confirm("确定删除这条评论吗？")) return;

      // 1. 本地乐观删除
      const newComments = memory.comments.filter((c: any) => c.id !== commentId);
      setMemories(memories.map(m => m.id === memoryId ? { ...m, comments: newComments } : m));

      // 2. 云端同步删除
      try {
          const m = AV.Object.createWithoutData('Moments', memoryId);
          m.remove('comments', comment); // 只有对象完全匹配才能删除，因本地comments直接来自云端，一般可匹配
          await m.save();
      } catch (e) {
          console.error("删除评论失败", e);
          alert("删除失败，请刷新重试");
      }
  };


  

  // --- [新增] 标记通知已读函数 ---
  const handleReadNotification = async (noteId: string) => {
      // 本地更新
      setNotifications(prev => prev.map(n => n.id === noteId ? { ...n, isRead: true } : n));
      // 云端更新
      try {
          const note = AV.Object.createWithoutData('Notification', noteId);
          note.set('isRead', true);
          await note.save();
      } catch(e) {}
  };
    

  // ================= Bmob 云端数据加载逻辑 (结束) =================
  // 注意：原有的 useSafeStorage 已被删除，因为不需要存本地了

  const calculateNextPeriod = () => { if (!periods.length) return null; const next = new Date(parseLocalDate(periods[periods.length - 1].startDate)); next.setDate(next.getDate() + 28); const diffDays = Math.ceil((next.getTime() - new Date().getTime()) / 86400000); return { date: `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`, daysLeft: diffDays }; };


  // --- 新增：统一处理情侣共享资源的上传和保存 ---
  // --- [修复] updateCoupleSettings 中的 Bmob 替换 ---
  const updateCoupleSettings = async (type: 'cover' | 'avatar', e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!user.coupleId) return alert("请先在个人页绑定另一半，才能同步背景和头像哦！");

      try {
          const url = await safeUpload(file);
          if (!url) return;

          if (type === 'cover') setMomentsCover(url);
          else setMomentsAvatar(url);

          try {
              const q = new AV.Query('CoupleSettings');
              q.equalTo('coupleId', String(user.coupleId));
              
              // [修改] 尝试查询，如果报错(表不存在)，则视为空数组，继续执行后面的创建逻辑
              let res: any[] = [];
              try {
                  res = await q.find();
              } catch (err: any) {
                  if (err.code !== 101) throw err; // 如果不是101(Class缺失)错误，则抛出
              }

              if (res.length > 0) {
                  const item = res[0];
                  item.set(type === 'cover' ? 'coverUrl' : 'avatarUrl', url);
                  await item.save();
              } else {
                  const qNew = new AV.Object('CoupleSettings');
                  qNew.set('coupleId', String(user.coupleId));
                  qNew.set(type === 'cover' ? 'coverUrl' : 'avatarUrl', url);
                  await qNew.save();
              }
          } catch (e) { console.error("同步共享设置失败:", e); }
        } catch (err) {
          console.error(err);
          alert("同步更新失败，请检查网络");
      }
  };



  // [新增] 保存首页标题到云端
  const saveAppTitle = async (title: string) => {
      if (!title.trim() || !user.coupleId) return;
      try {
           const q = new AV.Query('CoupleSettings');
           q.equalTo('coupleId', String(user.coupleId));
           const res = await q.find();
           if (res.length > 0) {
               res[0].set('appTitle', title);
               await res[0].save();
           } else {
               const newSet = new AV.Object('CoupleSettings');
               newSet.set('coupleId', String(user.coupleId));
               newSet.set('appTitle', title);
               await newSet.save();
           }
      } catch(e) { console.error("保存标题失败", e); }
  };

  // [新增] 保存点滴页标题到云端
  const saveMomentsTitle = async (title: string) => {
      if (!title.trim() || !user.coupleId) return;
      try {
           const q = new AV.Query('CoupleSettings');
           q.equalTo('coupleId', String(user.coupleId));
           const res = await q.find();
           if (res.length > 0) {
               res[0].set('momentsTitle', title);
               await res[0].save();
           } else {
               const newSet = new AV.Object('CoupleSettings');
               newSet.set('coupleId', String(user.coupleId));
               newSet.set('momentsTitle', title);
               await newSet.save();
           }
      } catch(e) { console.error("保存点滴标题失败", e); }
  };
        
// [修改] 拍照逻辑：支持云端保存
  const handleTakePhoto = async () => {
    // 1. 收集所有可用照片素材
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
    
    // 2. 筛选未使用的照片
    let available = allImages.filter(img => !usedPhotoIds.includes(img.url));
    if (available.length === 0) {
        if (pinnedPhotos.length === 0) {
            setUsedPhotoIds([]);
            available = allImages; 
        } else {
            return alert("全部吐完啦~ 点清空按钮重置哦！");
        }
    }

    const randomImg = available[Math.floor(Math.random() * available.length)];
    setUsedPhotoIds(prev => [...prev, randomImg.url]);

    // 3. 构建新照片对象
    const newPin = { 
        memoryId: randomImg.id, 
        source: randomImg.source as any, 
        mediaUrl: randomImg.url, 
        customCaption: randomImg.caption, 
        x: (Math.random()*40)-20, 
        y: (Math.random()*40)-20, 
        rotation: (Math.random()*10)-5, 
        scale: 1,
        date: randomImg.date,
        writer_id: user.objectId // [关键] 标记所有者
    };

    // 4. [关键] 乐观更新 (先显示，不等服务器)
    const tempId = Date.now().toString();
    setPinnedPhotos(prev => [...prev, { ...newPin, id: tempId }]);

    // 5. [关键] 同步保存到云端
    try {
        const Obj = new AV.Object('PinnedPhoto');
        Object.keys(newPin).forEach(k => Obj.set(k, (newPin as any)[k]));
        // 如果有对象ID绑定，也可加上
        if (user.coupleId) Obj.set('binding_id', user.coupleId);
        
        const saved = await Obj.save();
        // 保存成功后，把本地的临时ID替换成云端的真实ID (确保后续能更新/删除)
        setPinnedPhotos(prev => prev.map(p => p.id === tempId ? { ...p, id: saved.id } : p));
    } catch(e) {
        console.error("保存照片失败", e);
    }
  };

  
  // [修改] 清空逻辑：同步删除云端数据
  const handleClearBoard = async () => { 
      if(!confirm("确定清空桌面上所有照片吗？")) return;
      
      // 1. 本地清空
      const idsToDelete = pinnedPhotos.map(p => p.id);
      setPinnedPhotos([]); 
      setUsedPhotoIds([]); 

      // 2. 云端批量删除
      try {
          const objects = idsToDelete.map(id => AV.Object.createWithoutData('PinnedPhoto', id));
          await AV.Object.destroyAll(objects);
      } catch(e) {
          console.error("清空失败", e);
      }
  };
  
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
        {/* [新增] 状态栏半透明灰色底色条，z-index 设为 80 确保盖在普通内容之上，但在弹窗之下 */}
         <div className="absolute top-0 left-0 right-0 z-[80] pointer-events-none bg-black/20 md:hidden" style={{ height: 'max(env(safe-area-inset-top), 25px)' }} />
         <AnimatePresence mode="wait">
            <motion.div key={activePage} className="w-full h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
               {activePage === Page.HOME && (
                <div className="relative w-full h-full bg-rose-50 overflow-hidden">
                  <div className="absolute inset-0 z-0 pointer-events-none opacity-40" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fbbf24' fill-opacity='0.2'%3E%3Cpath d='M20 20c-2 0-3-2-3-3s2-3 3-3 3 2 3 3-2 3-3 3zm10 0c-2 0-3-2-3-3s2-3 3-3 3 2 3 3-2 3-3 3zm-5 5c-3 0-5-2-5-4s2-3 5-3 5 2 5 3-2 4-5 4zM70 70l-5-5 5-5 5 5-5 5zm20-20c2 0 3 2 3 3s-2 3-3 3-3-2-3-3 2-3 3-3zm-10 0c2 0 3 2 3 3s-2 3-3 3-3-2-3-3 2-3 3-3zm5 5c3 0 5 2 5 4s-2 3-5 3-5-2-5-3 2-4 5-4z'/%3E%3C/g%3E%3C/svg%3E")`, backgroundSize: '100px 100px' }} />
                  
                  <div className="absolute inset-0 z-10 overflow-hidden">{pinnedPhotos.map((pin, i) => (<DraggablePhoto 
    key={pin.id} 
    pin={pin} 
    onUpdate={async (id:any, data:any) => {
        // 1. 本地更新
        setPinnedPhotos(prev => prev.map(p => p.id === id ? {...p, ...data} : p));
        
        // 2. [关键] 云端同步 (仅当ID是真实云端ID时)
        if (id && id.length > 10) { 
            try {
                const p = AV.Object.createWithoutData('PinnedPhoto', id);
                // 遍历 data 中的属性并设置
                Object.keys(data).forEach(key => p.set(key, data[key]));
                await p.save(); 
            } catch(e) { console.error("更新位置失败", e); }
        }
    }} 
    onDelete={async (id:any) => {
        // 1. 本地删除
        setPinnedPhotos(prev => prev.filter(p => p.id !== id));
        // 2. [关键] 云端删除
        if (id && id.length > 10) {
            try { await AV.Object.createWithoutData('PinnedPhoto', id).destroy(); } catch(e) {}
        }
    }} 
    onBringToFront={handleBringToFront} 
    isFresh={i === pinnedPhotos.length - 1 && Date.now() - parseInt(pin.id) < 2000} 
    date={pin.date} 
/>))}</div>
                  
                  <header className="absolute top-0 left-0 right-0 pt-[calc(1.5rem+env(safe-area-inset-top))] px-4 md:px-8 flex justify-between items-start z-[70] pointer-events-none">
                    <div className="pointer-events-auto">
                      {isEditingTitle ? (
                          <input 
                            value={appTitle} 
                            onChange={(e) => setAppTitle(e.target.value)} 
                            // [修改] 失去焦点或回车时，保存到云端
                            onBlur={() => { setIsEditingTitle(false); saveAppTitle(appTitle); }} 
                            onKeyDown={(e) => { if(e.key === 'Enter') { setIsEditingTitle(false); saveAppTitle(appTitle); }}} 
                            autoFocus 
                            className="text-4xl md:text-6xl font-cute text-rose-500 drop-shadow-sm -rotate-2 bg-transparent border-b-2 border-rose-300 outline-none w-48 md:w-80 text-center" 
                          />
                      ) : (
                             <h1 onClick={() => setIsEditingTitle(true)} className="text-4xl md:text-6xl font-cute text-rose-500 drop-shadow-sm -rotate-2 cursor-pointer select-none hover:scale-105 transition" title="点击修改">{appTitle}</h1>
                      )}
                      <p className="text-rose-400 text-xs md:text-sm mt-1 font-cute ml-1 md:ml-2 tracking-widest bg-white/50 backdrop-blur-sm inline-block px-2 rounded-lg">LOVE SPACE</p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-end pointer-events-auto">
                        <AnniversaryTimer startDate={anniversaryDate} onSetDate={async () => { 
                              const d = prompt("纪念日 (YYYY-MM-DD)", anniversaryDate); 
                              if(d) { 
                                  setAnniversaryDate(d);
                                  // [新增] 同步保存到云端 CoupleSettings
                                  if (user.coupleId) {
                                       try {
                                           const q = new AV.Query('CoupleSettings');
                                           q.equalTo('coupleId', String(user.coupleId));
                                           const res = await q.find();
                                           if (res.length > 0) {
                                               res[0].set('anniversaryDate', d);
                                               await res[0].save();
                                           } else {
                                               const newSet = new AV.Object('CoupleSettings');
                                               newSet.set('coupleId', String(user.coupleId));
                                               newSet.set('anniversaryDate', d);
                                               await newSet.save();
                                           }
                                           alert("纪念日已同步");
                                       } catch(e) { console.error(e); }
                                  }
                              } 
                          }} />
                        <div className="bg-white/90 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-lg border-2 border-rose-100 p-2 flex flex-col items-center min-w-[70px] cursor-pointer" onClick={() => navigateTo(Page.CYCLE)}><span className="text-[9px] text-rose-400 font-bold uppercase font-cute">姨妈倒计时</span>{calculateNextPeriod() ? (<div className="text-center"><span className="text-lg font-bold text-rose-500 font-cute">{calculateNextPeriod()?.daysLeft}</span><span className="text-[9px] text-gray-400 ml-0.5 font-bold">天</span></div>) : (<span className="text-[9px] text-gray-400 mt-1">无数据</span>)}</div>
                        {pinnedPhotos.length > 0 && (<button onClick={handleClearBoard} className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border-2 border-rose-100 p-2 text-gray-400 hover:text-rose-500 min-h-[50px] min-w-[50px] flex flex-col items-center justify-center"><Trash2 size={20} /><span className="text-[9px] font-bold mt-1 font-cute">清空</span></button>)}
                    </div>
                  </header>
                  <div className="absolute top-40 left-8 w-64 z-[60] flex flex-col gap-6 pointer-events-none hidden md:flex"><div className="pointer-events-auto transform transition hover:scale-105 origin-top-left"><MiniCalendar periods={periods} conflicts={conflicts} todos={todos} /></div><div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-rose-50 pointer-events-auto transform transition hover:scale-105 origin-top-left"><h3 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2 font-cute"><CheckSquare size={16} className="text-rose-400"/> 备忘录</h3><div className="space-y-2 max-h-40 overflow-y-auto pr-1">{todos.filter(t => !t.completed).length === 0 && <p className="text-xs text-gray-400 italic">暂无待办</p>}{todos.filter(t => !t.completed).slice(0, 5).map(todo => (<div key={todo.id} onClick={() => setTodos(todos.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t))} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer group p-1 hover:bg-rose-50 rounded"><div className="w-3.5 h-3.5 rounded border border-rose-300 flex items-center justify-center bg-white group-hover:border-rose-400 shrink-0">{todo.completed && <div className="w-2 h-2 bg-rose-400 rounded-full" />}</div><span className={`font-cute truncate ${todo.completed ? 'line-through text-gray-400' : ''}`}>{todo.text}</span></div>))}</div></div></div>
                  
                  <div className="absolute top-28 left-4 z-[50] md:hidden pointer-events-none origin-top-left transform scale-[0.75]">
                        <div className="pointer-events-auto bg-white/20 backdrop-blur-md rounded-2xl p-2 border border-white/30 shadow-lg">
                            <MiniCalendar periods={periods} conflicts={conflicts} todos={todos} />
                        </div>
                  </div>

                  {/* 🟢 3. [新增] 首页右下角常驻刷新按钮 (只刷新照片位置等信息) */}
                  <div className="absolute bottom-24 right-6 z-[80]">
                      <button 
                          onClick={() => {
                              const btn = document.getElementById('home-refresh-btn');
                              if(btn) btn.classList.add('animate-spin'); // 添加旋转动画
                              // 调用 loadData(true) 强制刷新所有数据(包含PinnedPhoto)
                              loadData(true).then(() => {
                                  if(btn) btn.classList.remove('animate-spin'); // 停止动画
                              });
                          }} 
                          className="w-10 h-10 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-rose-100 text-rose-400 flex items-center justify-center hover:bg-white active:scale-90 transition"
                      >
                          <RefreshCw id="home-refresh-btn" size={20} />
                      </button>
                  </div>
                  
                  <div className="absolute bottom-20 md:bottom-24 left-1/2 transform -translate-x-1/2 z-[70] flex justify-center pointer-events-none"><div className="pointer-events-auto"><PolaroidCamera onTakePhoto={handleTakePhoto} iconUrl={cameraIcon} onUploadIcon={(e:any) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = () => setCameraIcon(r.result as string); r.readAsDataURL(f); }}} onResetIcon={() => { setCameraIcon(DEFAULT_CAMERA_ICON); localStorage.removeItem('cameraIcon'); }} /></div></div>
                </div>
               )}
               {activePage !== Page.HOME && (
                   <div className="h-full relative">
                       {/* [修改] 传递新的 handleRealLike 和 handleRealComment */}
                       {activePage === Page.MEMORIES && (<MemoriesViewContent 
                           uploadStatus={uploadStatus}        // [新增]
                           setUploadStatus={setUploadStatus}  // [新增]
                           user={user} memories={memories} albums={albums} setAlbums={setAlbums} 
                           handleLike={handleRealLike}
                           handleComment={handleRealComment}
                           handleDeleteComment={handleDeleteComment} // [新增] 传递删除函数
                           onRefresh={() => loadData(true)} // [新增] 传递刷新函数，true 代表全量刷新(包含相册等)
                                                           onFileSelect={async (e: any) => {
                                                            const target = e.target;
                                                            const files = Array.from(target.files || []) as File[];
                                                            
                                                            if (files.length > 0) {
                                                                setUploadType('media');
                                                                setShowUploadModal(true); 
                                                                
                                                                // [新增] 初始化进度条
                                                                setUploadStatus({ current: 0, total: files.length, isUploading: true });

                                                                  for (const file of files) {
                                                                      const localUrl = URL.createObjectURL(file);
                                                                      setUploadImages((prev: string[]) => [...prev, localUrl]);
                          
                                                                        // [修改] 改为使用 safeUpload
                                                                        safeUpload(file).then(serverUrl => {
                                                                            if (serverUrl) {
                                                                                setUploadImages((prev: string[]) => prev.map(url => url === localUrl ? serverUrl : url));
                                                                          } else {
                                                                              alert('上传失败，已从列表中移除');
                                                                              setUploadImages((prev: string[]) => prev.filter(url => url !== localUrl));
                                                                          }
                                                                      }).catch(err => {
                                                                          console.error("上传异常", err);
                                                                          setUploadImages((prev: string[]) => prev.filter(url => url !== localUrl));
                                                                      }).finally(() => {
                                                                          // [新增] 更新进度
                                                                          setUploadStatus(prev => {
                                                                              const next = prev.current + 1;
                                                                              return { ...prev, current: next, isUploading: next < prev.total };
                                                                          });
                                                                      });
                                                                  }
                                                            }
                                                            if (target) target.value = ''; 
                                                        }}
                                                           onTextPost={() => { setUploadType('text'); setUploadImages([]); setShowUploadModal(true); }} showUploadModal={showUploadModal} setShowUploadModal={setShowUploadModal} uploadImages={uploadImages} setUploadImages={setUploadImages} uploadCaption={uploadCaption} setUploadCaption={setUploadCaption} uploadType={uploadType}  
                                                           confirmUpload={async () => { 
                                                              if((uploadType === 'media' && !uploadImages.length) || (uploadType === 'text' && !uploadCaption.trim())) return;
                                                              
                                                              // 【修复1】检查图片是否还在上传中（防止存入 blob: 开头的无效本地地址）
                                                              if (uploadType === 'media' && uploadImages.some((img: string) => img.startsWith('blob:'))) {
                                                                  alert("图片正在拼命上传中...请稍等几秒后再点发布！");
                                                                  return;
                                                              }
                                                          
                                                              const newMemory = {
                                                                   media: uploadImages,
                                                                   caption: uploadCaption,
                                                                   // [修改] 使用 formatDateTime(new Date()) 获取当前精确时间
                                                                   date: formatDateTime(new Date()),
                                                                   type: uploadType,
                                                                   likes: 0,
                                                                   isLiked: false,
                                                                   comments: [],
                                                                   creatorId: user.objectId,
                                                                   creatorName: user.nickname || user.username,
                                                                   creatorAvatar: user.avatarUrl
                                                              };
                                                          
                                                              // 1. 本地先显示
                                                              setMemories([{ ...newMemory, id: Date.now().toString() } as any, ...memories]); 
                                                              
                                                              setShowUploadModal(false); 
                                                              setUploadImages([]); 
                                                              setUploadCaption(''); 
                                                              setUploadType('media');
                                                          
                                                              // 2. [修改] 同步保存到 LeanCloud
                                                                  try {
                                                                      const m = new AV.Object('Moments');
                                                                      m.set('images', uploadImages); 
                                                                      m.set('caption', uploadCaption);
                                                                      m.set('type', uploadType);
                                                                      
                                                                      m.set('writer_id', user.objectId);
                                                                      m.set('creatorId', user.objectId);
                                                                      m.set('creatorName', user.nickname || user.username);
                                                                      m.set('creatorAvatar', user.avatarUrl); // [修复] 显式保存发帖时的头像

                                                                      if (user.coupleId) {
                                                                          m.set('binding_id', user.coupleId);
                                                                      }
                                                                      await m.save();
                                                                  console.log("发布成功，已保存到云端");
                                                              } catch(e: any) {
                                                                  console.error("发布失败", e);
                                                                  // 如果失败，最好弹窗告诉用户
                                                                  alert("云端保存失败: " + (e.error || e.message) + "\n请检查网络或刷新页面");
                                                              }
                                                          }} coverUrl={momentsCover} onUpdateCover={(e: any) => updateCoupleSettings('cover', e)} momentsAvatar={momentsAvatar} onUpdateMomentsAvatar={(e: any) => updateCoupleSettings('avatar', e)}  onDeleteMemory={async (id:string) => { 
                if(!confirm("删除?")) return;
                setMemories(memories.filter(m => m.id !== id)); // 本地删
                try { await AV.Object.createWithoutData('Moments', id).destroy(); } catch(e) { console.error(e); } // 云端删
            }} notifications={notifications} onReadNotification={handleReadNotification} momentsTitle={momentsTitle} setMomentsTitle={setMomentsTitle} onUpdateMomentsTitle={saveMomentsTitle} // [新增] 传递函数
            avatarUrl={avatarUrl} setAvatarUrl={setAvatarUrl} setMomentsCover={setMomentsCover}/>)}
                       {activePage === Page.CYCLE && <CycleViewContent 
                           periods={periods} 
                           nextPeriod={calculateNextPeriod()} 
                           addPeriod={async (d:string) => {
                            // 1. 本地更新
                            const newEntry = { startDate: d, duration: 5 };
                            setPeriods([...periods, newEntry].sort((a,b)=>parseLocalDate(a.startDate).getTime()-parseLocalDate(b.startDate).getTime()));
                            // 2. 云端保存
                            try {
                                const Obj = new AV.Object('Period');
                                Obj.set('startDate', d);
                                Obj.set('duration', 5);
                                Obj.set('writer_id', user.objectId);
                                if(user.coupleId) Obj.set('binding_id', user.coupleId);
                                await Obj.save();
                                loadData(false); // 刷新获取真实ID
                            } catch(e) { console.error(e); }
                        }}
                                                   deletePeriod={async (i:number) => {
                            const target = periods[i]; // 注意: 这里periods可能包含未拥有id的本地临时数据，最好重新拉取
                            // 简化逻辑：我们假设 periods 数据是从 loadData 包含 objectId 的 (需要修改 loadData 确保 Period 包含 objectId)
                            // 但上面的 types.ts PeriodEntry 没有 id。为了严谨，我们直接用云端同步逻辑
                            if(!confirm("确定删除?")) return;
                            
                            // 重新设计: 因为原 periods 数组没有 id，我们查找云端匹配的记录删除
                            // 或者我们直接修改 loadData 让 periods 带上 id
                            // 为了不破坏太多结构，这里使用简单的查询删除
                            const q = new AV.Query('Period');
                            q.equalTo('startDate', target.startDate);
                            if (user.coupleId) q.containedIn('writer_id', user.coupleId.split('_'));
                            else q.equalTo('writer_id', user.objectId);
                            
                            const res = await q.find();
                            if(res.length > 0) await res[0].destroy();
                            
                            // 本地删除
                            const n = [...periods]; n.splice(i,1); setPeriods(n);
                        }}
                           updatePeriod={(i:number, days:number) => {
                                const n = [...periods];
                                if(n[i]) {
                                    n[i] = { ...n[i], duration: days };
                                    setPeriods(n);
                                }
                           }}
                       />}
                       {activePage === Page.CONFLICT && <ConflictViewContent user={user} judgeConflict={judgeConflict} conflicts={conflicts} setConflicts={setConflicts} />}
                       {activePage === Page.BOARD && (<BoardViewContent 
                        user={user} // [新增] 传递 user 数据
                        messages={messages} 
                        onPost={async (c:string) => {
                            // 1. 构建新留言对象
                            const newMsg = { 
                                content: c, 
                                date: getBeijingDateString(), 
                                time: new Date().toTimeString().slice(0,5), 
                                isPinned: false, 
                                isFavorite: false,
                                writer_id: user.objectId,
                                authorName: user.nickname || user.username,
                                authorAvatar: user.avatarUrl
                            };
                            
                            // [修复] 记录临时ID
                            const tempId = Date.now().toString();
                            
                            // 2. 本地乐观更新
                            setMessages([{ ...newMsg, id: tempId } as any, ...messages]);
                    
                            // 3. 云端保存
                            try {
                                const m = new AV.Object('Message');
                                Object.keys(newMsg).forEach(k => m.set(k, (newMsg as any)[k]));
                                if(user.coupleId) m.set('binding_id', user.coupleId);
                                
                                const saved = await m.save();
                                // [修复] 保存成功后，将本地消息的临时ID替换为云端真实ID，确保删除操作有效
                                setMessages((prev) => prev.map(msg => msg.id === tempId ? { ...msg, id: saved.id } : msg));
                            } catch(e) { console.error("留言保存失败", e); }
                        }}
                        // 🟢 [修改] 置顶：同步到云端
                           onPin={async (id:string) => {
                               const msg = messages.find(m => m.id === id);
                               if(!msg) return;
                               const newVal = !msg.isPinned;
                               // 1. 本地更新
                               setMessages(messages.map(m => m.id === id ? { ...m, isPinned: newVal } : m));
                               // 2. 云端保存
                               try { const obj = AV.Object.createWithoutData('Message', id); obj.set('isPinned', newVal); await obj.save(); } catch(e) { console.error(e); }
                           }}

                           // 🟢 [修改] 收藏：同步到云端
                           onFav={async (id:string) => {
                               const msg = messages.find(m => m.id === id);
                               if(!msg) return;
                               const newVal = !msg.isFavorite;
                               setMessages(messages.map(m => m.id === id ? { ...m, isFavorite: newVal } : m));
                               try { const obj = AV.Object.createWithoutData('Message', id); obj.set('isFavorite', newVal); await obj.save(); } catch(e) { console.error(e); }
                           }}

                           // 🟢 [修改] 删除：同步到云端
                           onDelete={async (id:string) => {
                               if(!confirm("确定删除这条留言吗？")) return;
                               setMessages(messages.filter(m => m.id !== id));
                               try { await AV.Object.createWithoutData('Message', id).destroy(); } catch(e) { console.error(e); }
                           }}

                           // [修改] 增加云端保存逻辑，确保日历能同步
                           onAddTodo={async (t:string, d:string) => {
                               const tempId = Date.now().toString();
                               const newItem = { id: tempId, text: t, completed: false, assignee: 'both', date: d || getBeijingDateString() };
                               
                               // 1. 本地乐观更新
                               setTodos(prev => [...prev, newItem]); 

                               // 2. 云端保存
                               try {
                                   const Obj = new AV.Object('Todo');
                                   Obj.set('text', t);
                                   Obj.set('date', newItem.date);
                                   Obj.set('completed', false);
                                   Obj.set('assignee', 'both');
                                   Obj.set('writer_id', user.objectId);
                                   if(user.coupleId) Obj.set('binding_id', user.coupleId);
                                   
                                   const saved = await Obj.save();
                                   // 3. 将本地临时ID替换为云端真实ID
                                   setTodos(prev => prev.map(item => item.id === tempId ? { ...item, id: saved.id } : item));
                               } catch(e) { console.error("AI提取待办保存失败", e); }
                           }}
                           setMessages={setMessages} 
                       />)}
                       {activePage === Page.CALENDAR && (<CalendarViewContent periods={periods} conflicts={conflicts} todos={todos} addTodo={async (t:string, d:string) => {
                            const tempId = Date.now().toString();
                            const newItem = { id: tempId, text: t, completed: false, assignee: 'both', date: d || getBeijingDateString() };
                            setTodos([...todos, newItem]); // 乐观更新
                            
                            try {
                                const Obj = new AV.Object('Todo');
                                Obj.set('text', t);
                                Obj.set('date', newItem.date);
                                Obj.set('completed', false);
                                Obj.set('assignee', 'both');
                                Obj.set('writer_id', user.objectId);
                                if(user.coupleId) Obj.set('binding_id', user.coupleId);
                                const saved = await Obj.save();
                                // 替换 ID
                                setTodos(prev => prev.map(item => item.id === tempId ? { ...item, id: saved.id } : item));
                            } catch(e) { console.error(e); }
                        }}
                        
                        toggleTodo={async (id:string) => {
                            const target = todos.find(t => t.id === id);
                            if (!target) return;
                            const newVal = !target.completed;
                            
                            setTodos(todos.map(t => t.id === id ? { ...t, completed: newVal } : t));
                            
                            try {
                                const obj = AV.Object.createWithoutData('Todo', id);
                                obj.set('completed', newVal);
                                await obj.save();
                            } catch(e) { console.error(e); }
                        }}
                        
                        onDeleteTodo={async (id:string) => {
                            if(!confirm("删除此待办？")) return;
                            setTodos(todos.filter(t => t.id !== id));
                            try { await AV.Object.createWithoutData('Todo', id).destroy(); } catch(e) { console.error(e); }
                        }}
                        
                        onDeleteConflict={async (id:string) => {
                            if(!confirm("删除此记录？")) return;
                            setConflicts(conflicts.filter(c => c.id !== id));
                            try { await AV.Object.createWithoutData('Conflict', id).destroy(); } catch(e) { console.error(e); }
                        }} />)}
                       {activePage === 'PROFILE' && <ProfilePage user={user} onLogout={onLogout} onUpdateUser={onUpdateUser} />}
                   </div>
               )}
            </motion.div>
         </AnimatePresence>
      </main>
      <Navbar active={activePage} setPage={navigateTo} homeLabel={appTitle} />
    </div>
  );
};  




export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
            const current = AV.User.current(); // [修改] LeanCloud 获取用户
            if (current) {
                try {
                    // [修改] fetch() 拉取最新数据
                    const freshUser = await current.fetch();
                    setUser(freshUser.toJSON()); // [修改] 转 JSON
                } catch (e) {
                    AV.User.logOut();
                    setUser(null);
                }
            }
            setLoading(false);
        };
    checkUser();
  }, []);;

  // 新增：处理退出登录，必须手动 setUser(null) 才会切回登录页
  const handleLogout = () => {
        AV.User.logOut(); // [修改] 登出
        setUser(null);
    };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-rose-500"/></div>;

  if (!user) return <AuthPage />;

  // 传入 onLogout 和 onUpdateUser (用于修改头像后立即刷新)
  return <MainApp user={user} onLogout={handleLogout} onUpdateUser={setUser} />;
}
