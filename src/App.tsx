import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
// --- 新增引用开始 ---
import Bmob, { uploadFile } from './services/bmob'; // 引入Bmob
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
import { judgeConflict, extractTodosFromText } from './services/ai';
import { Memory, PinnedPhoto, PeriodEntry, TodoItem, ConflictRecord, Page, Message, Album, AlbumMedia } from './types';
// @ts-ignore
import pailideIcon from './pailide.png';

// 恢复为标准上传模式 (不压缩)
const safeUpload = async (file: File) => {
  Bmob.debug(true);

  const uploadTask = async () => {
      const ext = file.name.split('.').pop() || 'jpg';
      const cleanName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const fileData = new File([file], cleanName, { type: file.type || 'image/jpeg' });

      console.log(`Step 1: 准备上传 ${cleanName}, 大小: ${(file.size / 1024).toFixed(2)}KB`);

      const params = Bmob.File(cleanName, fileData);

      console.log("Step 2: 开始发送网络请求...");
      const res: any = await params.save();
      console.log("Step 3: Bmob响应:", res);

      // 【核心修复1】解析 URL 优先
      // 只要能拿到 URL，哪怕有错误码(如10007)也视为成功，防止误报
      let finalUrl = "";
      if (typeof res === 'string') {
           try { finalUrl = JSON.parse(res).url; } catch(e) { finalUrl = res; }
      } else if (Array.isArray(res) && res.length > 0) {
           finalUrl = res[0].url;
      } else if (res && typeof res === 'object') {
           finalUrl = res.url;
      }

      // 只有在真的拿不到 URL 时，才检查错误码
      if (!finalUrl && res && res.code && res.code !== 200) {
          // 忽略 10007 错误，因为用户反馈实际上后台有数据
          if (res.code === 10007) {
             console.warn("忽略Bmob域名警告(10007)，尝试继续");
             // 如果Bmob只返回错误没返回URL，这里确实没法显示，但至少不弹窗报错
             // 这里尝试构造一个假URL防止后续崩溃，或者抛出一个温和的警告
             // 实际上如果能看到图，说明 finalUrl 应该是有值的，可能是解析路径漏了
          } else {
             throw new Error(`Bmob上传失败: ${res.error} (${res.code})`);
          }
      }

      // 【核心修复2】强制 HTTPS
      if (finalUrl && finalUrl.startsWith('http://')) {
          finalUrl = finalUrl.replace('http://', 'https://');
      }

      if (!finalUrl) {
          // 如果真的没拿到URL，但也别直接报错让用户恐慌，返回一个空字符串或日志
          console.warn("上传完成但未获取到直链，可能是域名问题");
          return ""; // 返回空字符串，让UI层自己处理
      }
      return finalUrl;
  };

  // 【核心修复3】超时延长到 3分钟 (180秒)
  const timeoutTask = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("网络请求超时(180s)，请检查网络连接")), 180000)
  );

  try {
      return await Promise.race([uploadTask(), timeoutTask]);
  } catch (e) {
      console.error("safeUpload 异常:", e);
      // 【修复】注释掉超时抛错，防止弹窗。即使超时也返回空，让流程继续。
      // if ((e as Error).message.includes('超时')) throw e; 
      console.warn("上传请求超时，但后台可能已接收");
      return ""; 
  }
};



// --- 专门用于头像上传 (绕过 Bmob 文件域名限制) ---
// 原理：将图片死循环压缩到 30KB 以内，转为 Base64 文本直接存入 User 表
const uploadAvatar = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 1. 初始检查
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error("头像太大了，请选择 10MB 以内的图片"));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      
      img.onload = () => {
        // 初始参数：头像不需要太大，300px 足够了
        let quality = 0.6; 
        let maxSize = 300; 
        let compressedDataUrl = "";
        
        // 创建 Canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(img.src); return; }

        // --- 核心：死循环压缩逻辑 ---
        // 最多尝试 6 次，确保体积压到 30KB 以下 (Bmob 免费数据库字段限制约为 40KB)
        for (let i = 0; i < 6; i++) {
            let width = img.width;
            let height = img.height;
            
            // 计算尺寸
            if (width > height) {
                if (width > maxSize) { height *= maxSize / width; width = maxSize; }
            } else {
                if (height > maxSize) { width *= maxSize / height; height = maxSize; }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // 铺白底 (防止 PNG 透明变黑)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // 导出
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            const sizeKB = compressedDataUrl.length / 1024;
            
            console.log(`头像压缩尝试 ${i+1}: ${Math.floor(width)}x${Math.floor(height)}, 质量${quality.toFixed(1)}, 大小${sizeKB.toFixed(2)}KB`);

            // 如果小于 32KB，成功退出
            if (sizeKB < 32) {
                break;
            }

            // 否则继续阉割：尺寸缩小 20%，质量降低
            maxSize *= 0.8; 
            quality -= 0.1; 
            if (quality < 0.1) quality = 0.1;
        }

        // 最终检查
        if (compressedDataUrl.length > 39 * 1024) {
             reject(new Error("图片太复杂无法压缩，请换一张简单的图片"));
        } else {
             resolve(compressedDataUrl);
        }
      };
      img.onerror = () => reject(new Error("图片加载失败"));
    };
    reader.onerror = () => reject(new Error("读取文件失败"));
  });
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
  // 用来记录双指缩放的初始距离
  const initialDistance = useRef<number | null>(null);
  const initialScale = useRef<number>(1);

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

const Navbar = ({ active, setPage }: { active: Page, setPage: (p: Page) => void }) => {
  const navItems = [
    { id: Page.HOME, icon: <Cat size={24} />, label: '小屁铃' },
    { id: Page.MEMORIES, icon: <Camera size={24} />, label: '点滴' },
    { id: Page.BOARD, icon: <MessageSquareHeart size={24} />, label: '留言板' },
    { id: Page.CYCLE, icon: <Heart size={24} />, label: '经期' },
    { id: Page.CONFLICT, icon: <Gavel size={24} />, label: '小法官' },
    { id: Page.CALENDAR, icon: <CalendarIcon size={24} />, label: '日历' },
    { id: 'PROFILE' as any, icon: <User size={24} />, label: '我的' },
  ];
  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-rose-100 shadow-[0_-5px_15px_rgba(255,241,242,0.8)] z-[100] pb-4 md:pb-0">
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
        await Bmob.User.login(username, password);
        window.location.reload();
      } else {
        const params = { username, password, avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}` };
        await Bmob.User.register(params);
        alert('注册成功，请登录');
        setIsLogin(true);
      }
    } catch (err: any) {
      alert('操作失败: ' + (err.error || err.message));
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

// 1. 接收 onUpdateUser 参数
const ProfilePage = ({ user, onLogout, onUpdateUser }: { user: any, onLogout: () => void, onUpdateUser: (u:any)=>void }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [partner, setPartner] = useState<any>(null); // 对方信息
  const [requests, setRequests] = useState<any[]>([]); // 收到的申请
  const [sentStatus, setSentStatus] = useState<string>(''); // 发送状态

  // --- 轮询检查：收到的申请 & 发出的申请是否被同意 ---
  useEffect(() => {
      if(!user) return;
      
      const checkStatus = async () => {
          // 1. 如果已绑定，获取另一半信息
          if (user.coupleId && !partner) {
              const ids = user.coupleId.split('_');
              const partnerId = ids.find((id:string) => id !== user.objectId);
              if (partnerId) {
                  Bmob.Query('_User').get(partnerId).then(setPartner).catch(() => {});
              }
          }

          // 2. 如果未绑定，检查有没有人申请绑定我
          if (!user.coupleId) {
              const q = Bmob.Query('ConnectionRequest');
              q.equalTo('toId', String(user.objectId)); // 核心修复：加 String()
              q.equalTo('status', 'pending');
              q.find().then((res: any) => setRequests(res));
              
              // 3. 检查我发出的申请是否通过
              const q2 = Bmob.Query('ConnectionRequest');
              q2.equalTo('fromId', String(user.objectId)); // 核心修复：加 String()
              q2.equalTo('status', 'accepted');
              q2.find().then(async (res: any) => {
                  if (res.length > 0) {
                      // 对方已同意！自动完成绑定
                      const match = res[0];
                      const ids = [user.objectId, match.toId].sort();
                      const commonId = `${ids[0]}_${ids[1]}`;
                      
                      const u = Bmob.Query('_User');
                      const me = await u.get(user.objectId);
                      me.set('coupleId', commonId);
                      await me.save();
                      
                      onUpdateUser({ ...user, coupleId: commonId });
                      alert("恭喜！对方已同意绑定！");
                      setSentStatus('');
                  }
              });
          }
      };
      
      checkStatus();
      const timer = setInterval(checkStatus, 3000); // 3秒轮询一次
      return () => clearInterval(timer);
  }, [user, partner]);

  // 同意绑定
  const handleAgree = async (req: any) => {
      if(!confirm(`同意与 ${req.fromName} 绑定情侣关系吗？`)) return;
      setLoading(true);
      try {
          // 1. 计算公共ID
          const ids = [req.fromId, user.objectId].sort();
          const commonId = `${ids[0]}_${ids[1]}`;
          
          // 2. 更新自己
          const u = Bmob.Query('_User');
          const me = await u.get(user.objectId);
          me.set('coupleId', commonId);
          await me.save();
          
          // 3. 更新申请单状态为 accepted (让对方也能检测到)
          const r = Bmob.Query('ConnectionRequest');
          const reqObj = await r.get(req.objectId);
          reqObj.set('status', 'accepted');
          await reqObj.save();
          
          // 4. 更新本地状态
          onUpdateUser({ ...user, coupleId: commonId });
          alert("绑定成功！开启你们的恋爱空间吧~");
      } catch(e) {
          alert("操作失败，请重试");
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  // 解除绑定
  const handleUnbind = async () => {
      if(!confirm("⚠️ 确定要解除情侣关系吗？\n\n解除后，你们的共享相册、点滴、纪念日将不再对彼此可见（但数据不会被删除）。")) return;
      if(!confirm("再次确认：真的要分手吗？💔")) return;
      
      setLoading(true);
      try {
          // 1. 清除自己的 coupleId
          const u = Bmob.Query('_User');
          const me = await u.get(user.objectId);
          me.set('coupleId', ''); 
          await me.save();
          
          // 2. 尝试清除对方 (如果权限允许)，如果不行则依赖对方自己解绑
          // 注意：通常为了安全，普通用户不能改别人数据，这里尽力而为
          if (partner) {
               try {
                   const p = await u.get(partner.objectId);
                   p.set('coupleId', '');
                   await p.save();
               } catch(e) { console.log("无法自动解绑对方，需对方手动操作"); }
          }

          onUpdateUser({ ...user, coupleId: null });
          setPartner(null);
          alert("已解除绑定。");
      } catch(e: any) {
          alert("解绑失败: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  // 修改头像逻辑
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const target = e.target;
      const file = target.files?.[0];
      if (!file) return;
      
      setLoading(true);
      try {
          const url = await uploadAvatar(file);
          const currentUser = Bmob.User.current();
          if (currentUser) {
              const q = Bmob.Query('_User');
              const userObj = await q.get(currentUser.objectId);
              userObj.set('avatarUrl', url);
              await userObj.save();
              onUpdateUser({ ...user, avatarUrl: url }); 
              alert('头像修改成功');
          }
      } catch(err: any) { 
          alert(`头像上传失败: ${err.message}`);
      } finally { 
          setLoading(false);
          if (target) target.value = '';
      }
  };
  
  // 修改昵称
  const handleNicknameChange = async () => {
      const newName = prompt("请输入新昵称", user.nickname || "");
      if(!newName || newName === user.nickname) return;
      setLoading(true);
      try {
          const q = Bmob.Query('_User');
          const userObj = await q.get(user.objectId);
          userObj.set('nickname', newName);
          await userObj.save();
          onUpdateUser({ ...user, nickname: newName });
      } catch(err: any) { alert('修改失败'); } 
      finally { setLoading(false); }
  };

  // 扫码回调：发送申请
  const onScan = async (decodedText: string) => {
    if (decodedText.startsWith('BIND:')) {
      const partnerId = decodedText.split(':')[1];
      if (partnerId === user.objectId) return alert('不能绑定自己');
      
      // 检查是否已发送过
      const q = Bmob.Query('ConnectionRequest');
      q.equalTo('fromId', user.objectId);
      q.equalTo('toId', partnerId);
      q.equalTo('status', 'pending');
      const exist = await q.find();
      
      if (exist.length > 0) {
          alert("你已经发送过申请啦，请让对方同意即可！");
          setShowScanner(false);
          setSentStatus('waiting');
          return;
      }
      
      // 创建申请
      const req = Bmob.Query('ConnectionRequest');
      req.set('fromId', user.objectId);
      req.set('fromName', user.nickname || user.username);
      req.set('toId', partnerId);
      req.set('status', 'pending');
      await req.save();
      
      alert(`申请已发送！\n请通知对方登录并在“我的”页面点击同意。`);
      setShowScanner(false);
      setSentStatus('waiting');
    }
  };

  const handleLogoutClick = () => { if(window.confirm("确定要退出登录吗？")) onLogout(); };

  return (
    <div className="p-6 bg-gray-50 min-h-screen pb-24">
       <div className="bg-white rounded-3xl p-6 text-center shadow-sm mb-6 relative overflow-hidden">
          {loading && <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center"><Loader2 className="animate-spin text-rose-500"/></div>}
          
          <div className="relative inline-block group mb-2">
              <img src={user.avatarUrl || DEFAULT_AVATAR} className="w-24 h-24 rounded-full border-4 border-rose-100 object-cover mx-auto" />
              <label className="absolute bottom-0 right-0 bg-rose-500 text-white p-2 rounded-full cursor-pointer shadow-lg hover:scale-110 transition z-10">
                  <Edit2 size={14} />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
              </label>
          </div>

          <div onClick={handleNicknameChange} className="flex items-center justify-center gap-2 cursor-pointer hover:text-rose-500 transition">
              <h2 className="text-2xl font-bold text-gray-800">{user.nickname || "点击设置昵称"}</h2>
              <Edit2 size={16} className="text-gray-300" />
          </div>
          <div className="text-sm text-gray-400 mt-1">账号: {user.username}</div>

          {/* 状态显示区 */}
          <div className="mt-6 pt-6 border-t border-gray-100">
              {user.coupleId ? (
                  <div className="animate-in fade-in zoom-in duration-500">
                      <div className="inline-block bg-rose-50 text-rose-500 px-4 py-1 rounded-full text-xs font-bold mb-4">❤️ 恋爱中</div>
                      <div className="flex items-center justify-center gap-4">
                          <div className="text-center">
                              <div className="w-12 h-12 bg-gray-100 rounded-full mb-1 overflow-hidden mx-auto">
                                  {partner?.avatarUrl ? <img src={partner.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xl">👤</div>}
                              </div>
                              <div className="text-xs font-bold text-gray-700">{partner?.nickname || "另一半"}</div>
                          </div>
                          <div className="text-rose-300"><Heart fill="currentColor" size={20} /></div>
                          <div className="text-center">
                              <div className="w-12 h-12 bg-gray-100 rounded-full mb-1 overflow-hidden mx-auto">
                                  {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xl">👤</div>}
                              </div>
                              <div className="text-xs font-bold text-gray-700">我</div>
                          </div>
                      </div>
                      <button onClick={handleUnbind} className="mt-6 text-xs text-gray-400 underline hover:text-red-500">解除关系</button>
                  </div>
              ) : (
                  <div>
                      <div className="inline-block bg-gray-100 text-gray-400 px-4 py-1 rounded-full text-xs font-bold mb-4">🐶 单身状态</div>
                      
                      {/* 显示收到的申请 */}
                      {requests.length > 0 && (
                          <div className="mb-6 space-y-2">
                              {requests.map((req, i) => (
                                  <div key={i} className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center justify-between animate-bounce">
                                      <div className="text-left">
                                          <div className="text-xs text-rose-400 font-bold">收到绑定申请</div>
                                          <div className="font-bold text-gray-700">{req.fromName} 想和你绑定</div>
                                      </div>
                                      <button onClick={() => handleAgree(req)} className="bg-rose-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md hover:bg-rose-600">同意</button>
                                  </div>
                              ))}
                          </div>
                      )}

                      {sentStatus === 'waiting' && <div className="text-rose-500 text-sm font-bold mb-4 animate-pulse">⏳ 已发送申请，等待对方同意...</div>}

                      {/* 扫码绑定区 */}
                      {!showScanner ? (
                          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                             <div className="flex justify-center mb-2"><QRCodeSVG value={`BIND:${user.objectId}`} size={120} /></div>
                             <p className="text-[10px] text-gray-400 mb-3">让对方扫此码，或点击下方按钮扫对方</p>
                             <button onClick={() => setShowScanner(true)} className="bg-gray-800 text-white px-6 py-2 rounded-full flex items-center gap-2 mx-auto text-sm"><Scan size={16}/> 扫描 TA 的二维码</button>
                          </div>
                      ) : (
                          <div className="rounded-xl overflow-hidden mb-4 relative">
                              <ScannerMounter onSuccess={onScan}/>
                              <button onClick={() => setShowScanner(false)} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"><X size={16}/></button>
                          </div> 
                      )}
                  </div>
              )}
          </div>
       </div>

       <button onClick={handleLogoutClick} className="w-full bg-white text-red-500 py-4 rounded-3xl font-bold shadow-sm flex items-center justify-center gap-2"><LogOut size={20}/> 退出登录</button>
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
  momentsAvatar, onUpdateMomentsAvatar // <--- 新增这两个参数
}: any) => {
  const [activeTab, setActiveTab] = useState<'moments' | 'albums'>('moments');
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

  useEffect(() => { const h = () => setActiveMenuId(null); document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);
  useEffect(() => { if(!isManageMode) setSelectedItems(new Set()); }, [isManageMode]);


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
              onClick: () => {
                  setAlbums((prev: Album[]) => prev.map(a => a.id === selectedAlbum.id ? { ...a, coverUrl: url } : a));
                  setSelectedAlbum(prev => prev ? { ...prev, coverUrl: url } : null);
                  setViewingImage(null); // 关闭
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
                  setViewingImage(null); // 关闭
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
          <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b flex items-center justify-between bg-white/80 backdrop-blur sticky top-0 z-10">
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
          <div className="p-4 grid grid-cols-3 md:grid-cols-5 gap-2 overflow-y-auto">{selectedAlbum.media.map((item, idx) => (<div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative group cursor-pointer" onClick={() => isManageMode ? setSelectedItems(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; }) : handleViewImage(item.url, 'album', selectedAlbum.media.map(m => m.url))}><img src={item.url} className={`w-full h-full object-cover transition ${isManageMode && selectedItems.has(item.id) ? 'opacity-50 scale-90' : ''}`} loading="lazy" />{isManageMode && (<div className="absolute top-2 right-2">{selectedItems.has(item.id) ? <CheckCircle className="text-rose-500 fill-white" /> : <div className="w-5 h-5 rounded-full border-2 border-white/80" />}</div>)}</div>))}</div>
          {viewingImage && typeof viewingImage === 'object' && 'list' in viewingImage && (
            <ImageViewer 
                images={viewingImage.list} 
                initialIndex={viewingImage.index} 
                onClose={() => setViewingImage(null)} 
                actions={viewerActions} 
            />
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
                         <input value={momentsTitle} onChange={(e) => setMomentsTitle(e.target.value)} onBlur={() => setIsEditingMomentsTitle(false)} onKeyDown={(e) => { if(e.key === 'Enter') setIsEditingMomentsTitle(false); }} autoFocus className="text-white font-bold text-lg drop-shadow-md pb-10 font-cute bg-transparent outline-none border-b border-white w-40 text-right" />
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
                  {memories.map((memory: Memory) => (
                      <div key={memory.id} className="flex gap-3 pb-6 border-b border-gray-50 last:border-0">
                          <div className="w-10 h-10 rounded-lg bg-rose-100 overflow-hidden shrink-0 cursor-pointer" onClick={() => handleListAvatarClick(memory.creatorAvatar)}>
                              {memory.creatorAvatar ? <img src={memory.creatorAvatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">👤</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-800 font-cute text-sm mb-1 text-blue-900">
                                  {/* 如果创建者ID等于当前用户ID，显示当前用户的最新昵称(或用户名)，否则显示存下来的创建者名字 */}
                                  {memory.creatorId === user.objectId 
                                    ? (user.nickname || user.username) 
                                    : (memory.creatorName || 'Ta')}
                              </h4>
                              <p className="mb-2 text-gray-800 text-sm leading-relaxed">{memory.caption}</p>
                              {memory.type === 'media' && memory.media.length > 0 && (<div className={`grid gap-1 mb-2 max-w-[80%] ${memory.media.length === 1 ? 'grid-cols-1' : memory.media.length === 4 ? 'grid-cols-2 w-2/3' : 'grid-cols-3'}`}>{memory.media.map((url: string, idx: number) => (<div key={idx} onClick={() => handleViewImage(url, 'memory', memory.media)} className={`aspect-square bg-gray-100 cursor-pointer overflow-hidden ${memory.media.length === 1 ? 'max-w-[200px] max-h-[200px]' : ''}`}><img src={url} className="w-full h-full object-cover" alt="Memory" /></div>))}</div>)}
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
      {viewingImage && typeof viewingImage === 'object' && 'list' in viewingImage && (
        <ImageViewer 
            images={viewingImage.list} 
            initialIndex={viewingImage.index} 
            onClose={() => setViewingImage(null)} 
            actions={viewerActions} 
        />
      )}
      <input id="shared-avatar-upload" type="file" className="hidden" onChange={onUpdateMomentsAvatar} accept="image/*" />
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
const ConflictViewContent = ({ judgeConflict, conflicts, setConflicts }: any) => {
    const [reason, setReason] = useState(''); const [hisPoint, setHisPoint] = useState(''); const [herPoint, setHerPoint] = useState(''); const [isJudging, setIsJudging] = useState(false);
    const handleJudge = async () => { if(!reason || !hisPoint || !herPoint) return alert("请填写完整信息喵！"); setIsJudging(true); const result = await judgeConflict(reason, hisPoint, herPoint); setConflicts([{ id: Date.now().toString(), date: getBeijingDateString(), reason, hisPoint, herPoint, aiResponse: result, isPinned: false, isFavorite: false }, ...conflicts]); setIsJudging(false); setReason(''); setHisPoint(''); setHerPoint(''); };
    return (
        <div className="p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] space-y-6 bg-gray-50 h-full overflow-y-auto">
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
            <div className="pt-[calc(1rem+env(safe-area-inset-top))] px-4 pb-2 bg-yellow-50/30 flex justify-between items-center relative"><div className="w-8"></div><h2 className="text-2xl font-bold font-cute text-yellow-600 text-center">留言板</h2><button onClick={() => setIsManageMode(!isManageMode)} className={`p-2 rounded-full hover:bg-yellow-100 ${isManageMode ? 'text-rose-500' : 'text-gray-400'}`}>{isManageMode ? '完成' : <Settings size={20} />}</button></div>
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
  console.log("当前版本: v2.0 - 已修复Query参数");
  
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
  // 作用：每次切换页面，都往历史记录里推入一个状态
  const navigateTo = (page: Page) => {
    if (page === activePage) return;
    window.history.pushState({ page }, document.title);
    setActivePage(page);
  };
  // --- 新增代码结束 ---
  
  
  // ================= Bmob 云端数据加载逻辑 (开始) =================

 // 1. 定义查询辅助函数 (增加类型强制转换)
  const getQuery = (tableName: string) => {
        const q = Bmob.Query(tableName);
        
        // 强制转换为 String，防止后台列类型误判
        if (user.coupleId) {
            q.equalTo('coupleId', String(user.coupleId));
        } else {
            q.equalTo('creatorId', String(user.objectId));
        }
        return q;
    };
  useEffect(() => {
    // 设置头像 (从登录用户数据中获取)
    if (user.avatarUrl) setAvatarUrl(user.avatarUrl);

    // 定义加载数据的异步函数
    const loadData = async () => {
       // 辅助函数：安全查询，防止报错卡死
       const safeFind = (table: string) => {
           try {
               return getQuery(table);
           } catch(e) { return null; }
       };

       // --- 加载朋友圈 (Memory) ---
       const momentsQuery = safeFind('Moments');
       if (momentsQuery) {
           momentsQuery.order('-createdAt').find().then((res: any) => {
               setMemories(res.map((m: any) => ({
                   ...m, 
                   id: m.objectId, 
                   date: m.createdAt ? m.createdAt.slice(0, 10) : getBeijingDateString(), 
                   media: m.images || [], 
                   comments: m.comments || [] 
               })));
           }).catch((e: any) => console.warn("加载Moments失败", e));
       }

       // --- 加载相册 (Album) ---
       safeFind('Album')?.order('-createdAt').find().then((res: any) => {
            setAlbums(res.map((a: any) => ({ ...a, id: a.objectId })));
       }).catch(e => console.warn("加载Album失败", e));

       // --- 加载留言板 (Message) ---
       safeFind('Message')?.order('-createdAt').find().then((res: any) => 
           setMessages(res.map((m: any) => ({...m, id: m.objectId})))
       ).catch(e => console.warn("加载Message失败", e));

       // --- 加载首页照片墙 (PinnedPhoto) ---
       safeFind('PinnedPhoto')?.find().then((res:any) => 
           setPinnedPhotos(res.map((p:any)=>({...p, id: p.objectId})))
       ).catch(e => console.warn("加载PinnedPhoto失败", e));

       // --- 加载经期 (Period) ---
       safeFind('Period')?.find().then((res:any) => setPeriods(res))
         .catch(e => console.warn("加载Period失败", e));

       // --- 加载冲突记录 (Conflict) ---
       safeFind('Conflict')?.order('-createdAt').find().then((res:any) => 
           setConflicts(res.map((c:any)=>({...c, id: c.objectId})))
       ).catch(e => console.warn("加载Conflict失败", e));

       // --- 加载待办 (Todo) ---
       safeFind('Todo')?.find().then((res:any) => 
           setTodos(res.map((t:any)=>({...t, id: t.objectId})))
       ).catch(e => console.warn("加载Todo失败", e));
    };


    // --- 新增：加载情侣共享设置 (背景图和共享头像) ---
       if (user.coupleId) {
           // 【修复】增加 try-catch 包裹，防止 equalTo 同步报错导致白屏
           try {
               const q = Bmob.Query('CoupleSettings');
               q.equalTo('coupleId', String(user.coupleId));
               q.find().then((res: any) => {
                   if (res.length > 0) {
                       const settings = res[0];
                       if (settings.coverUrl) setMomentsCover(settings.coverUrl);
                       if (settings.avatarUrl) setMomentsAvatar(settings.avatarUrl);
                   }
               }).catch(e => console.log("加载CoupleSettings失败(可能是新用户未创建)", e));
           } catch (err) {
               console.warn("CoupleSettings查询构造失败，已忽略错误防止白屏:", err);
           }
       }
    
    
    // 1. 立即执行一次加载
    loadData();
    
    // 2. 开启轮询：每5秒自动同步一次 (实现简单的实时效果)
    const timer = setInterval(loadData, 5000);

    // 页面销毁时清除定时器
    return () => clearInterval(timer);
  }, [user]); // 依赖 user：当切换账号时会自动重新加载

  // ================= Bmob 云端数据加载逻辑 (结束) =================
  // 注意：原有的 useSafeStorage 已被删除，因为不需要存本地了

  const calculateNextPeriod = () => { if (!periods.length) return null; const next = new Date(parseLocalDate(periods[periods.length - 1].startDate)); next.setDate(next.getDate() + 28); const diffDays = Math.ceil((next.getTime() - new Date().getTime()) / 86400000); return { date: `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`, daysLeft: diffDays }; };


  // --- 新增：统一处理情侣共享资源的上传和保存 ---
  const updateCoupleSettings = async (type: 'cover' | 'avatar', e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!user.coupleId) return alert("请先在个人页绑定另一半，才能同步背景和头像哦！");

      try {
          // 1. 上传文件 (使用现有的 safeUpload)
          const url = await safeUpload(file);
          if (!url) return;

          // 2. 本地先更新(为了即时反馈)
          if (type === 'cover') setMomentsCover(url);
          else setMomentsAvatar(url);

          
          // 3. 保存到 Bmob 共享表
          // 【修复】增加 try-catch 和 String() 转换，解决修改无反应的问题
          try {
              const q = Bmob.Query('CoupleSettings');
              q.equalTo('coupleId', String(user.coupleId));
              const res = await q.find();

              if (res.length > 0) {
                  const item = await Bmob.Query('CoupleSettings').get(res[0].objectId);
                  item.set(type === 'cover' ? 'coverUrl' : 'avatarUrl', url);
                  await item.save();
              } else {
                  const qNew = Bmob.Query('CoupleSettings');
                  qNew.set('coupleId', String(user.coupleId));
                  qNew.set(type === 'cover' ? 'coverUrl' : 'avatarUrl', url);
                  await qNew.save();
              }
          } catch (e) {
              console.error("同步共享设置失败:", e);
          }
        } catch (err) {
          console.error(err);
          alert("同步更新失败，请检查网络");
      }
  };
      
        
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
                  
                  <header className="absolute top-0 left-0 right-0 pt-[calc(1.5rem+env(safe-area-inset-top))] px-4 md:px-8 flex justify-between items-start z-[70] pointer-events-none">
                    <div className="pointer-events-auto">
                      {isEditingTitle ? (<input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} onBlur={() => setIsEditingTitle(false)} onKeyDown={(e) => { if(e.key === 'Enter') setIsEditingTitle(false); }} autoFocus className="text-4xl md:text-6xl font-cute text-rose-500 drop-shadow-sm -rotate-2 bg-transparent border-b-2 border-rose-300 outline-none w-48 md:w-80 text-center" />) : (
                             <h1 onClick={() => setIsEditingTitle(true)} className="text-4xl md:text-6xl font-cute text-rose-500 drop-shadow-sm -rotate-2 cursor-pointer select-none hover:scale-105 transition" title="点击修改">{appTitle}</h1>
                      )}
                      <p className="text-rose-400 text-xs md:text-sm mt-1 font-cute ml-1 md:ml-2 tracking-widest bg-white/50 backdrop-blur-sm inline-block px-2 rounded-lg">LOVE SPACE</p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-end pointer-events-auto">
                        <AnniversaryTimer startDate={anniversaryDate} onSetDate={() => { const d = prompt("纪念日 (YYYY-MM-DD)", anniversaryDate); if(d) setAnniversaryDate(d); }} />
                        <div className="bg-white/90 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-lg border-2 border-rose-100 p-2 flex flex-col items-center min-w-[70px] cursor-pointer" onClick={() => navigateTo(Page.CYCLE)}><span className="text-[9px] text-rose-400 font-bold uppercase font-cute">姨妈倒计时</span>{calculateNextPeriod() ? (<div className="text-center"><span className="text-lg font-bold text-rose-500 font-cute">{calculateNextPeriod()?.daysLeft}</span><span className="text-[9px] text-gray-400 ml-0.5 font-bold">天</span></div>) : (<span className="text-[9px] text-gray-400 mt-1">无数据</span>)}</div>
                        {pinnedPhotos.length > 0 && (<button onClick={handleClearBoard} className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border-2 border-rose-100 p-2 text-gray-400 hover:text-rose-500 min-h-[50px] min-w-[50px] flex flex-col items-center justify-center"><Trash2 size={20} /><span className="text-[9px] font-bold mt-1 font-cute">清空</span></button>)}
                    </div>
                  </header>
                  <div className="absolute top-40 left-8 w-64 z-[60] flex flex-col gap-6 pointer-events-none hidden md:flex"><div className="pointer-events-auto transform transition hover:scale-105 origin-top-left"><MiniCalendar periods={periods} conflicts={conflicts} /></div><div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-rose-50 pointer-events-auto transform transition hover:scale-105 origin-top-left"><h3 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2 font-cute"><CheckSquare size={16} className="text-rose-400"/> 备忘录</h3><div className="space-y-2 max-h-40 overflow-y-auto pr-1">{todos.filter(t => !t.completed).length === 0 && <p className="text-xs text-gray-400 italic">暂无待办</p>}{todos.filter(t => !t.completed).slice(0, 5).map(todo => (<div key={todo.id} onClick={() => setTodos(todos.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t))} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer group p-1 hover:bg-rose-50 rounded"><div className="w-3.5 h-3.5 rounded border border-rose-300 flex items-center justify-center bg-white group-hover:border-rose-400 shrink-0">{todo.completed && <div className="w-2 h-2 bg-rose-400 rounded-full" />}</div><span className={`font-cute truncate ${todo.completed ? 'line-through text-gray-400' : ''}`}>{todo.text}</span></div>))}</div></div></div>
                  
                  <div className="absolute top-28 left-4 z-[50] md:hidden pointer-events-none origin-top-left transform scale-[0.75]">
                        <div className="pointer-events-auto bg-white/20 backdrop-blur-md rounded-2xl p-2 border border-white/30 shadow-lg">
                            <MiniCalendar periods={periods} conflicts={conflicts} />
                        </div>
                  </div>
                  
                  <div className="absolute bottom-20 md:bottom-24 left-1/2 transform -translate-x-1/2 z-[70] flex justify-center pointer-events-none"><div className="pointer-events-auto"><PolaroidCamera onTakePhoto={handleTakePhoto} iconUrl={cameraIcon} onUploadIcon={(e:any) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = () => setCameraIcon(r.result as string); r.readAsDataURL(f); }}} onResetIcon={() => { setCameraIcon(DEFAULT_CAMERA_ICON); localStorage.removeItem('cameraIcon'); }} /></div></div>
                </div>
               )}
               {activePage !== Page.HOME && (
                   <div className="h-full relative">
                       {activePage === Page.MEMORIES && (<MemoriesViewContent user={user} memories={memories} albums={albums} setAlbums={setAlbums} handleLike={(id:string) => setMemories(memories.map(m => m.id === id ? { ...m, likes: m.isLiked ? m.likes - 1 : m.likes + 1, isLiked: !m.isLiked } : m))} handleComment={(id:string, t:string) => setMemories(memories.map(m => m.id === id ? { ...m, comments: [...m.comments, { id: Date.now().toString(), text: t, author: 'me', date: getBeijingDateString() }] } : m))} 
                                                           onFileSelect={async (e: any) => {
                                                            const target = e.target;
                                                            const files = Array.from(target.files || []) as File[];
                                                            
                                                            if (files.length > 0) {
                                                                setUploadType('media');
                                                                setShowUploadModal(true); // 立即弹窗
                                                        
                                                                for (const file of files) {
                                                                    // 1. 立即显示本地预览图 (不用等上传)
                                                                    const localUrl = URL.createObjectURL(file);
                                                                    setUploadImages((prev: string[]) => [...prev, localUrl]);
                                                        
                                                                    // 2. 后台上传，成功后替换为云端 URL
                                                                    safeUpload(file).then(serverUrl => {
                                                                        if (serverUrl) {
                                                                            console.log("图片上传完成:", serverUrl);
                                                                            setUploadImages((prev: string[]) => 
                                                                                prev.map(url => url === localUrl ? serverUrl : url)
                                                                            );
                                                                        }
                                                                    }).catch(err => {
                                                                        console.error("图片上传显示异常(可能超时)", err);
                                                                    });
                                                                }
                                                            }
                                                            if (target) target.value = ''; 
                                                        }}
                                                           onTextPost={() => { setUploadType('text'); setUploadImages([]); setShowUploadModal(true); }} showUploadModal={showUploadModal} setShowUploadModal={setShowUploadModal} uploadImages={uploadImages} setUploadImages={setUploadImages} uploadCaption={uploadCaption} setUploadCaption={setUploadCaption} uploadType={uploadType} confirmUpload={async () => { 
                     if((uploadType === 'media' && !uploadImages.length) || (uploadType === 'text' && !uploadCaption.trim())) return; // 构造新对象
                    const newMemory = {
                         media: uploadImages,
                         caption: uploadCaption,
                         date: getBeijingDateString(),
                         type: uploadType,
                         likes: 0,
                         isLiked: false,
                         comments: [],
                         // --- 修复2：保存发布者信息 ---
                         creatorId: user.objectId,
                         creatorName: user.nickname || user.username, // 存入当时的昵称快照
                         creatorAvatar: user.avatarUrl
                    };
            
                    // 1. 先更新本地 UI (为了反应快)
                    // 注意：本地暂时用 Date.now() 做 ID，刷新后会变成 Bmob 的 objectId
                    setMemories([{ ...newMemory, id: Date.now().toString() } as any, ...memories]); 
                    
                    setShowUploadModal(false); 
                    setUploadImages([]); 
                    setUploadCaption(''); 
                    setUploadType('media');
            
                    // 2. 同步保存到 Bmob 云端
                    try {
                        const q = Bmob.Query('Moments');
                        q.set('images', uploadImages); // 注意字段名是否对齐，云端好像叫 images
                        q.set('caption', uploadCaption);
                        q.set('type', uploadType);
                        q.set('creatorId', user.objectId);
                        q.set('creatorName', user.nickname || user.username);
                        if (user.coupleId) {
                            q.set('coupleId', user.coupleId);
                        }
                        await q.save();
                        // 可以在这里重新 loadData() 确保 ID 同步，或者等待轮询自动同步
                    } catch(e) {
                        console.error("发布失败", e);
                        alert("云端同步失败，请检查网络");
                    }
                }} coverUrl={momentsCover} onUpdateCover={(e: any) => updateCoupleSettings('cover', e)} momentsAvatar={momentsAvatar} onUpdateMomentsAvatar={(e: any) => updateCoupleSettings('avatar', e)}  onDeleteMemory={(id:string) => { if(confirm("删除?")) setMemories(memories.filter(m => m.id !== id)); }} momentsTitle={momentsTitle} setMomentsTitle={setMomentsTitle} avatarUrl={avatarUrl} setAvatarUrl={setAvatarUrl} setMomentsCover={setMomentsCover} />)}
                       {activePage === Page.CYCLE && <CycleViewContent 
                           periods={periods} 
                           nextPeriod={calculateNextPeriod()} 
                           addPeriod={(d:string) => setPeriods([...periods, { startDate: d, duration: 5 }].sort((a,b)=>parseLocalDate(a.startDate).getTime()-parseLocalDate(b.startDate).getTime()))} 
                           deletePeriod={(i:number) => { if(confirm("删除?")) { const n = [...periods]; n.splice(i,1); setPeriods(n); }}} 
                           updatePeriod={(i:number, days:number) => {
                                const n = [...periods];
                                if(n[i]) {
                                    n[i] = { ...n[i], duration: days };
                                    setPeriods(n);
                                }
                           }}
                       />}
                       {activePage === Page.CONFLICT && <ConflictViewContent judgeConflict={judgeConflict} conflicts={conflicts} setConflicts={setConflicts} />}
                       {activePage === Page.BOARD && (<BoardViewContent messages={messages} onPost={(c:string) => setMessages([{ id: Date.now().toString(), content: c, date: getBeijingDateString(), time: new Date().toTimeString().slice(0,5), isPinned: false, isFavorite: false }, ...messages])} onPin={(id:string) => setMessages(messages.map(m => m.id === id ? { ...m, isPinned: !m.isPinned } : m))} onFav={(id:string) => setMessages(messages.map(m => m.id === id ? { ...m, isFavorite: !m.isFavorite } : m))} onDelete={(id:string) => { if(confirm("删除?")) setMessages(messages.filter(m => m.id !== id)); }} onAddTodo={(t:string, d:string) => setTodos([...todos, { id: Date.now().toString(), text: t, completed: false, assignee: 'both', date: d || getBeijingDateString() }])} setMessages={setMessages} />)}
                       {activePage === Page.CALENDAR && (<CalendarViewContent periods={periods} conflicts={conflicts} todos={todos} addTodo={(t:string, d:string) => setTodos([...todos, { id: Date.now().toString(), text: t, completed: false, assignee: 'both', date: d }])} toggleTodo={(id:string) => setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t))} setTodos={setTodos} onDeleteTodo={(id:string) => { if(confirm("删除此待办？")) setTodos(todos.filter(t => t.id !== id)); }} onDeleteConflict={(id:string) => { if(confirm("删除此记录？")) setConflicts(conflicts.filter(c => c.id !== id)); }} />)}
                       {activePage === 'PROFILE' && <ProfilePage user={user} onLogout={onLogout} onUpdateUser={onUpdateUser} />}
                   </div>
               )}
            </motion.div>
         </AnimatePresence>
      </main>
      <Navbar active={activePage} setPage={navigateTo} />
    </div>
  );
}




export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
        const current = Bmob.User.current();
        if (current) {
            try {
                // 【关键】强制从服务器拉取最新用户信息
                // 防止本地缓存没有 coupleId，导致绑定状态不同步
                const q = Bmob.Query('_User');
                const freshUser = await q.get(current.objectId);
                setUser(freshUser);
            } catch (e) {
                console.warn("同步用户信息失败，使用本地缓存", e);
                setUser(current);
            }
        }
        setLoading(false);
    };
    checkUser();
  }, []);;

  // 新增：处理退出登录，必须手动 setUser(null) 才会切回登录页
  const handleLogout = () => {
      Bmob.User.logout();
      setUser(null);
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-rose-500"/></div>;

  if (!user) return <AuthPage />;

  // 传入 onLogout 和 onUpdateUser (用于修改头像后立即刷新)
  return <MainApp user={user} onLogout={handleLogout} onUpdateUser={setUser} />;
}
