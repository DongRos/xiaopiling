// --- Content Components ---

const MemoriesViewContent = ({
  memories, albums, setAlbums, handleLike, handleComment,
  onFileSelect, onTextPost, showUploadModal, setShowUploadModal,
  uploadImages, setUploadImages, uploadCaption, setUploadCaption,
  uploadType, confirmUpload, coverUrl, onUpdateCover, onDeleteMemory
}: any) => {
  const [activeTab, setActiveTab] = useState<'moments' | 'albums'>('moments');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [commentInputs, setCommentInputs] = useState<{[key:string]: string}>({});
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showCoverBtn, setShowCoverBtn] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // 监听滚动，模拟微信朋友圈下拉/顶部显示逻辑
  useEffect(() => {
      const container = scrollContainerRef.current;
      if(!container) return;

      const handleScroll = () => {
          if (container.scrollTop < 10) {
              setShowCoverBtn(true);
          } else {
              setShowCoverBtn(false);
          }
      };
      
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const createAlbum = () => {
    if(!newAlbumName.trim()) return;
    const newAlbum: Album = {
        id: Date.now().toString(),
        name: newAlbumName,
        coverUrl: '', // 默认为空
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
                  setAlbums((prev: Album[]) => prev.map(a => {
                      if (a.id === selectedAlbum.id) {
                          // 如果之前没有封面，上传第一张照片时自动设为封面
                          const newCover = !a.coverUrl && newMedia.length > 0 ? newMedia[0].url : a.coverUrl;
                          return { ...a, coverUrl: newCover, media: [...newMedia, ...a.media] };
                      }
                      return a;
                  }));
                  setSelectedAlbum(prev => prev ? { 
                      ...prev, 
                      coverUrl: !prev.coverUrl && newMedia.length > 0 ? newMedia[0].url : prev.coverUrl,
                      media: [...newMedia, ...prev.media] 
                  } : null);
              }
          };
          reader.readAsDataURL(file);
      });
  };

  const setAlbumCover = (url: string) => {
      if(!selectedAlbum) return;
      setAlbums((prev: Album[]) => prev.map(a => a.id === selectedAlbum.id ? { ...a, coverUrl: url } : a));
      setSelectedAlbum(prev => prev ? { ...prev, coverUrl: url } : null);
      alert("封面设置成功！");
  }

  const onCommentChange = (id: string, val: string) => {
      setCommentInputs(prev => ({...prev, [id]: val}));
  };

  const submitComment = (id: string) => {
      if(!commentInputs[id]?.trim()) return;
      handleComment(id, commentInputs[id]);
      setCommentInputs(prev => ({...prev, [id]: ''}));
      setActiveMenuId(null); 
  };

  const toggleMenu = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setActiveMenuId(activeMenuId === id ? null : id);
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
                      <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative group">
                          <img src={item.url} className="w-full h-full object-cover cursor-pointer" onClick={() => setViewingImage(item.url)} loading="lazy" />
                          <button 
                              onClick={() => setAlbumCover(item.url)}
                              className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
                          >
                              设为封面
                          </button>
                      </div>
                  ))}
              </div>
              {viewingImage && <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />}
          </div>
      )
  }

  return (
    <div ref={scrollContainerRef} className="h-full bg-white overflow-y-auto pb-24 relative">
        <div className="relative group cursor-pointer" style={{ height: '320px' }}>
             <div className="w-full h-full overflow-hidden relative">
                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" onClick={() => setViewingImage(coverUrl)} />
                <div className="absolute inset-0 bg-black/10 pointer-events-none" />
             </div>
             
             {/* 更换封面的按钮，只有在顶部时显示 (opacity控制) */}
             <div 
                className={`absolute bottom-4 right-4 z-20 transition-opacity duration-300 ${showCoverBtn ? 'opacity-100' : 'opacity-0'}`}
                onClick={(e) => { e.stopPropagation(); document.getElementById('cover-upload')?.click(); }}
             >
                <div className="bg-black/30 backdrop-blur-md p-2 rounded-md text-white hover:bg-black/50 transition cursor-pointer flex items-center gap-2">
                    <Camera size={16} />
                    <span className="text-xs font-bold">换封面</span>
                </div>
                <input id="cover-upload" type="file" className="hidden" onChange={onUpdateCover} accept="image/*" />
            </div>

            <div className="absolute -bottom-8 right-4 flex items-end gap-3 z-20 pointer-events-none">
                 <div className="text-white font-bold text-lg drop-shadow-md pb-10 font-cute">我们的点滴</div>
                 <div className="bg-white p-1 rounded-xl shadow-lg pointer-events-auto">
                    <div className="w-16 h-16 bg-rose-100 rounded-lg flex items-center justify-center overflow-hidden">
                        <span className="text-3xl">💑</span>
                    </div>
                </div>
            </div>
            
            <div className="absolute top-4 right-4 z-30">
               <button onClick={onFileSelect} className="bg-black/20 p-2 rounded-full text-white hover:bg-black/40 backdrop-blur-sm">
                   <Camera size={20} />
               </button>
               <input type="file" multiple accept="image/*" className="hidden" onChange={onFileSelect} />
            </div>
        </div>

      <div className="mt-14 mb-4 border-b border-gray-100 pb-1 relative bg-white sticky top-0 z-30 flex justify-center">
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

      <div className="px-4 pb-10 max-w-2xl mx-auto min-h-[50vh] bg-white">
          {activeTab === 'moments' ? (
              <div className="space-y-8">
                  {memories.map((memory: Memory) => (
                      <div key={memory.id} className="flex gap-3 pb-6 border-b border-gray-50 last:border-0">
                          <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center text-xl shrink-0">🐶</div>
                          
                          <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-800 font-cute text-sm mb-1 text-blue-900">我们</h4>
                              <p className="mb-2 text-gray-800 text-sm leading-relaxed">{memory.caption}</p>
                              
                              {memory.type === 'media' && memory.media.length > 0 && (
                                  <div className={`grid gap-1 mb-2 max-w-[80%] ${memory.media.length === 1 ? 'grid-cols-1' : memory.media.length === 4 ? 'grid-cols-2 w-2/3' : 'grid-cols-3'}`}>
                                      {memory.media.map((url: string, idx: number) => (
                                          <div key={idx} onClick={() => setViewingImage(url)} className={`aspect-square bg-gray-100 cursor-pointer overflow-hidden ${memory.media.length === 1 ? 'max-w-[200px] max-h-[200px]' : ''}`}>
                                              <img src={url} className="w-full h-full object-cover" alt="Memory" />
                                          </div>
                                      ))}
                                  </div>
                              )}

                              <div className="flex justify-between items-center mt-2 relative">
                                  <div className="flex items-center gap-3">
                                      <span className="text-xs text-gray-400">{memory.date}</span>
                                      <button onClick={() => onDeleteMemory(memory.id)} className="text-xs text-blue-900 hover:underline">删除</button>
                                  </div>
                                  
                                  <div className="relative">
                                      <button 
                                        onClick={(e) => toggleMenu(e, memory.id)}
                                        className="bg-gray-50 p-1 rounded-sm text-blue-800 hover:bg-gray-100"
                                      >
                                          <MoreHorizontal size={16} />
                                      </button>

                                      <AnimatePresence>
                                        {activeMenuId === memory.id && (
                                            <motion.div 
                                                initial={{ opacity: 0, scale: 0.9, x: 10 }}
                                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.9, x: 10 }}
                                                className="absolute right-8 top-0 bg-gray-800 text-white rounded-md flex items-center overflow-hidden shadow-xl z-10"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button 
                                                    onClick={() => { handleLike(memory.id); setActiveMenuId(null); }}
                                                    className="flex items-center gap-1 px-4 py-2 hover:bg-gray-700 text-xs font-bold min-w-[80px] justify-center"
                                                >
                                                    <Heart size={14} fill={memory.isLiked ? "red" : "none"} color={memory.isLiked ? "red" : "white"} />
                                                    {memory.isLiked ? '取消' : '赞'}
                                                </button>
                                                <div className="w-[1px] h-4 bg-gray-600"></div>
                                                <button 
                                                    onClick={() => {
                                                        const input = prompt('请输入评论');
                                                        if(input) { handleComment(memory.id, input); setActiveMenuId(null); }
                                                    }}
                                                    className="flex items-center gap-1 px-4 py-2 hover:bg-gray-700 text-xs font-bold min-w-[80px] justify-center"
                                                >
                                                    <MessageCircle size={14} />
                                                    评论
                                                </button>
                                            </motion.div>
                                        )}
                                      </AnimatePresence>
                                  </div>
                              </div>

                              {(memory.likes > 0 || memory.comments.length > 0) && (
                                  <div className="mt-3 bg-gray-50 rounded-sm p-2 text-xs">
                                      {memory.likes > 0 && (
                                          <div className="flex items-center gap-1 text-blue-900 font-bold border-b border-gray-200/50 pb-1 mb-1">
                                              <Heart size={12} fill="currentColor" />
                                              <span>{memory.likes} 人觉得很赞</span>
                                          </div>
                                      )}
                                      {memory.comments.map((c: any) => (
                                          <div key={c.id} className="leading-5">
                                              <span className="font-bold text-blue-900">我:</span> 
                                              <span className="text-gray-600 ml-1">{c.text}</span>
                                          </div>
                                      ))}
                                  </div>
                              )}
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
                          {album.coverUrl ? (
                              <img src={album.coverUrl} className="w-full h-full object-cover rounded-2xl" alt={album.name} />
                          ) : (
                              <div className="w-full h-full bg-gray-50 rounded-2xl flex items-center justify-center text-xs text-gray-400">暂无封面</div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                              <div className="text-white w-full">
                                  <h4 className="font-bold truncate">{album.name}</h4>
                                  <span className="text-xs opacity-80">{album.media.length} 张照片</span>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>

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
    </div>
  );
};

const CycleViewContent = ({ periods, nextPeriod, addPeriod }: any) => {
  const handleLogPeriod = () => {
      const today = getBeijingDateString();
      if(confirm(`记录今天 (${today}) 为大姨妈开始日？`)) {
          addPeriod(today);
      }
  };

  return (
    <div className="p-6 space-y-6 pb-24 h-full overflow-y-auto">
        <h2 className="text-2xl font-bold font-cute text-rose-500 text-center mb-2">经期记录</h2>
        
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

    const sortedConflicts = [...conflicts].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return parseInt(b.id) - parseInt(a.id);
    });

    return (
        <div className="p-4 pb-24 space-y-6 bg-gray-50 h-full overflow-y-auto">
             <div className="flex flex-col items-center justify-center py-6">
                 <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-4xl shadow-md mb-3">🐱</div>
                 <h2 className="font-bold text-3xl font-cute text-indigo-900 tracking-wide">喵喵法官</h2>
                 <p className="text-sm text-gray-400 font-medium">公正无私 · 在线断案</p>
             </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg border border-indigo-50">
                <div className="space-y-5">
                    <div>
                        <label className="text-sm font-bold text-gray-700 ml-1 block mb-2">争吵原因</label>
                        <input 
                            className="w-full bg-gray-50 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none transition" 
                            placeholder="简单描述一下因为什么吵架..." 
                            value={reason} 
                            onChange={e => setReason(e.target.value)} 
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-blue-600 ml-1 block mb-2">👦 男生观点</label>
                            <textarea 
                                className="w-full bg-blue-50/50 rounded-xl p-4 text-sm h-32 resize-none focus:ring-2 focus:ring-blue-100 outline-none transition" 
                                placeholder="我觉得..." 
                                value={hisPoint} 
                                onChange={e => setHisPoint(e.target.value)} 
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-rose-500 ml-1 block mb-2">👧 女生观点</label>
                            <textarea 
                                className="w-full bg-rose-50/50 rounded-xl p-4 text-sm h-32 resize-none focus:ring-2 focus:ring-rose-100 outline-none transition" 
                                placeholder="明明是..." 
                                value={herPoint} 
                                onChange={e => setHerPoint(e.target.value)} 
                            />
                        </div>
                    </div>
                    <button 
                        onClick={handleJudge}
                        disabled={isJudging}
                        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition flex justify-center items-center gap-2 text-lg active:scale-[0.98]"
                    >
                        {isJudging ? <Loader2 className="animate-spin" /> : <Gavel size={24} />}
                        {isJudging ? '喵喵正在思考中...' : '请求喵喵裁决'}
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="text-center text-gray-400 text-sm font-bold tracking-widest uppercase mt-8 mb-4">- 历史判决书 -</h3>
                {sortedConflicts.map((c: ConflictRecord) => (
                    <div key={c.id} className={`bg-white rounded-3xl p-6 shadow-md border relative overflow-hidden transition-all ${c.isFavorite ? 'border-pink-300 ring-2 ring-pink-50' : 'border-gray-100'}`}>
                        {c.isPinned && <div className="absolute top-0 right-0 p-3 text-indigo-500 transform rotate-12 bg-indigo-50 rounded-bl-xl"><Pin size={20} fill="currentColor" /></div>}
                        
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{c.date}</span>
                        </div>
                        <h4 className="font-bold text-gray-800 mb-6 font-cute text-xl text-center">{c.reason}</h4>
                        
                        {c.aiResponse && (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold px-1">
                                        <span className="text-blue-500">公猫过错 {c.aiResponse.hisFault}%</span>
                                        <span className="text-rose-500">母猫过错 {c.aiResponse.herFault}%</span>
                                    </div>
                                    <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                                        <div style={{ width: `${c.aiResponse.hisFault}%` }} className="bg-blue-500 h-full transition-all duration-1000 ease-out" />
                                        <div style={{ width: `${c.aiResponse.herFault}%` }} className="bg-rose-500 h-full transition-all duration-1000 ease-out" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="bg-indigo-50/80 rounded-2xl p-4 text-sm text-indigo-900 leading-relaxed border border-indigo-100">
                                        <p className="font-cute text-base mb-1">🐱 喵喵复盘:</p>
                                        <p className="opacity-90">{c.aiResponse.analysis}</p>
                                    </div>
                                    <div className="bg-green-50/80 rounded-2xl p-4 text-sm text-green-900 leading-relaxed border border-green-100">
                                        <p className="font-cute text-base mb-1">💡 和好建议:</p>
                                        <p className="opacity-90">{c.aiResponse.advice}</p>
                                    </div>
                                    {c.aiResponse.prevention && (
                                        <div className="bg-yellow-50/80 rounded-2xl p-4 text-sm text-yellow-900 leading-relaxed border border-yellow-100">
                                            <p className="font-cute text-base mb-1">🛡️ 预防方案:</p>
                                            <p className="opacity-90">{c.aiResponse.prevention}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-4 mt-6 border-t border-gray-50 pt-4">
                            <button onClick={() => toggleFav(c.id)} className={`p-2 rounded-full hover:bg-pink-50 transition ${c.isFavorite ? 'text-pink-500' : 'text-gray-300'}`}><Heart size={20} fill={c.isFavorite ? "currentColor" : "none"} /></button>
                            <button onClick={() => togglePin(c.id)} className={`p-2 rounded-full hover:bg-indigo-50 transition ${c.isPinned ? 'text-indigo-500' : 'text-gray-300'}`}><Pin size={20} fill={c.isPinned ? "currentColor" : "none"} /></button>
                            <button onClick={() => deleteRecord(c.id)} className="p-2 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition"><Trash2 size={20} /></button>
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

    // 修复置顶无效问题：对消息进行排序，置顶的排在前面
    const sortedMessages = [...messages].sort((a: Message, b: Message) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return parseInt(b.id) - parseInt(a.id); // 其次按时间倒序
    });

    return (
        <div className="flex flex-col h-full bg-yellow-50/30">
            <div className="pt-4 px-4 pb-2 bg-yellow-50/30">
                 <h2 className="text-2xl font-bold font-cute text-yellow-600 text-center">留言板</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                <div className="grid grid-cols-1 gap-4">
                    {sortedMessages.map((msg: Message) => (
                        <div key={msg.id} className={`p-6 rounded-2xl shadow-sm border text-base relative group transition-all ${msg.isFavorite ? 'bg-rose-50 border-rose-100' : 'bg-white border-yellow-100'}`}>
                             <p className="text-gray-700 font-cute mb-10 leading-relaxed whitespace-pre-wrap break-words text-lg">{msg.content}</p>
                             
                             <div className="absolute bottom-4 left-0 right-0 px-6 flex justify-between items-center">
                                 <div className="text-xs text-gray-300 font-bold">{msg.date.slice(5)} {msg.time}</div>
                                 <div className="flex gap-4">
                                     <button 
                                        onClick={() => onFav(msg.id)} 
                                        className={`transition ${msg.isFavorite ? 'text-rose-500' : 'text-gray-300 hover:text-rose-500'}`}
                                        title="收藏"
                                     >
                                        <Heart size={18} fill={msg.isFavorite ? "currentColor" : "none"} />
                                     </button>
                                     <button 
                                        onClick={() => onPin(msg.id)} 
                                        className={`transition ${msg.isPinned ? 'text-blue-500' : 'text-gray-300 hover:text-blue-500'}`}
                                        title="置顶"
                                     >
                                        <Pin size={18} fill={msg.isPinned ? "currentColor" : "none"} />
                                     </button>
                                     <button 
                                        onClick={() => onDelete(msg.id)} 
                                        className="text-gray-300 hover:text-red-500 transition"
                                        title="删除"
                                     >
                                        <Trash2 size={18} />
                                     </button>
                                 </div>
                             </div>

                             {msg.isPinned && <div className="absolute top-0 right-0 p-3 text-blue-500 transform rotate-45"><Pin size={24} fill="currentColor" /></div>}
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
    
    const dayTodos = todos.filter((t: TodoItem) => t.date === selectedDate);
    const dayConflicts = conflicts.filter((c: ConflictRecord) => c.date === selectedDate);
    
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
        const lastPeriod = periods[periods.length - 1];
        const lastStart = parseLocalDate(lastPeriod.startDate);
        const predictedStart = new Date(lastStart);
        predictedStart.setDate(lastStart.getDate() + 28);
        const predictedEnd = new Date(predictedStart);
        predictedEnd.setDate(predictedStart.getDate() + 5);

        const curr = parseLocalDate(dateStr);
        return curr >= predictedStart && curr < predictedEnd;
    }

    return (
        <div className="h-full bg-white flex flex-col pb-20">
            <h2 className="text-2xl font-bold font-cute text-gray-800 text-center pt-4">专属日历</h2>

            <div className="px-6 pt-2 pb-2 flex justify-between items-center">
                <h2 className="text-xl font-bold font-cute text-gray-800">{year}年 {month + 1}月</h2>
                <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-2 bg-gray-50 rounded-full hover:bg-rose-50 transition"><ChevronLeft size={20} /></button>
                    <button onClick={nextMonth} className="p-2 bg-gray-50 rounded-full hover:bg-rose-50 transition"><ChevronRight size={20} /></button>
                </div>
            </div>
            
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
                                        ${isToday && !isSelected ? 'text-rose-500 font-bold' : ''}
                                    `}
                                >
                                    {d}
                                    {/* 修复：移除日期的背景色，只保留下方的圆点标记 */}
                                    <div className="absolute bottom-1 flex gap-0.5">
                                        {inPeriod && <div className={`w-1 h-1 rounded-full bg-red-500 ${isSelected ? 'ring-1 ring-white' : ''}`} />}
                                        {isPredicted && !inPeriod && <div className={`w-1 h-1 rounded-full bg-blue-400 ${isSelected ? 'ring-1 ring-white' : ''}`} />}
                                        {hasTodo && <div className={`w-1 h-1 rounded-full bg-yellow-400 ${isSelected ? 'ring-1 ring-white' : ''}`} />}
                                        {hasConflict && <div className={`w-1 h-1 rounded-full bg-purple-500 ${isSelected ? 'ring-1 ring-white' : ''}`} />}
                                    </div>
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="bg-gray-50 py-3 px-4 flex gap-4 overflow-x-auto text-xs font-bold text-gray-500 justify-center mt-2">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div>经期</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-400"></div>预测</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-400"></div>待办</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-purple-500"></div>吵架</div>
            </div>
            
            <div className="flex-1 bg-gray-50 mt-4 rounded-t-3xl p-6 overflow-y-auto">
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
                    
                    {dayConflicts.map((c: ConflictRecord) => (
                        <div key={c.id} className="bg-purple-50 text-purple-900 p-3 rounded-xl text-sm border border-purple-100">
                             <div className="font-bold flex items-center gap-2 mb-1">
                                 <Gavel size={14} /> 喵喵法官裁决
                             </div>
                             {c.reason}
                        </div>
                    ))}

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
// --- Content Components ---

const MemoriesViewContent = ({
  memories, albums, setAlbums, handleLike, handleComment,
  onFileSelect, onTextPost, showUploadModal, setShowUploadModal,
  uploadImages, setUploadImages, uploadCaption, setUploadCaption,
  uploadType, confirmUpload, coverUrl, onUpdateCover, onDeleteMemory
}: any) => {
  const [activeTab, setActiveTab] = useState<'moments' | 'albums'>('moments');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [commentInputs, setCommentInputs] = useState<{[key:string]: string}>({});
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // 引用滚动容器以监听滚动位置
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showCoverBtn, setShowCoverBtn] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // 监听滚动：只有当页面处于顶部（下拉状态）时才显示更换封面按钮
  useEffect(() => {
      const container = scrollContainerRef.current;
      if(!container) return;

      const handleScroll = () => {
          // 当滚动条在最顶部时显示按钮
          if (container.scrollTop < 5) {
              setShowCoverBtn(true);
          } else {
              setShowCoverBtn(false);
          }
      };
      
      // 初始化状态
      handleScroll();
      
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const createAlbum = () => {
    if(!newAlbumName.trim()) return;
    const newAlbum: Album = {
        id: Date.now().toString(),
        name: newAlbumName,
        coverUrl: '', // 新建相册默认无封面
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
                  setAlbums((prev: Album[]) => prev.map(a => {
                      if (a.id === selectedAlbum.id) {
                          // 逻辑：如果当前相册没有封面，且上传了新照片，则将第一张新照片设为封面
                          const shouldSetCover = !a.coverUrl && newMedia.length > 0;
                          return { 
                              ...a, 
                              coverUrl: shouldSetCover ? newMedia[0].url : a.coverUrl,
                              media: [...newMedia, ...a.media] 
                          };
                      }
                      return a;
                  }));
                  // 同步更新当前选中的相册视图状态
                  setSelectedAlbum(prev => {
                      if (!prev) return null;
                      const shouldSetCover = !prev.coverUrl && newMedia.length > 0;
                      return { 
                          ...prev, 
                          coverUrl: shouldSetCover ? newMedia[0].url : prev.coverUrl,
                          media: [...newMedia, ...prev.media] 
                      };
                  });
              }
          };
          reader.readAsDataURL(file);
      });
  };

  const setAlbumCover = (url: string) => {
      if(!selectedAlbum) return;
      setAlbums((prev: Album[]) => prev.map(a => a.id === selectedAlbum.id ? { ...a, coverUrl: url } : a));
      setSelectedAlbum(prev => prev ? { ...prev, coverUrl: url } : null);
      alert("封面设置成功！");
  }

  const onCommentChange = (id: string, val: string) => {
      setCommentInputs(prev => ({...prev, [id]: val}));
  };

  const submitComment = (id: string) => {
      if(!commentInputs[id]?.trim()) return;
      handleComment(id, commentInputs[id]);
      setCommentInputs(prev => ({...prev, [id]: ''}));
      setActiveMenuId(null); 
  };

  const toggleMenu = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setActiveMenuId(activeMenuId === id ? null : id);
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
                      <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative group">
                          <img src={item.url} className="w-full h-full object-cover cursor-pointer" onClick={() => setViewingImage(item.url)} loading="lazy" />
                          <button 
                              onClick={() => setAlbumCover(item.url)}
                              className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
                          >
                              设为封面
                          </button>
                      </div>
                  ))}
              </div>
              {viewingImage && <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />}
          </div>
      )
  }

  return (
    <div ref={scrollContainerRef} className="h-full bg-white overflow-y-auto pb-24 relative">
        <div className="relative group cursor-pointer" style={{ height: '320px' }}>
             <div className="w-full h-full overflow-hidden relative">
                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" onClick={() => setViewingImage(coverUrl)} />
                <div className="absolute inset-0 bg-black/10 pointer-events-none" />
             </div>
             
             {/* 更换封面的按钮，只有在顶部时显示 (opacity控制 + pointer-events控制) */}
             <div 
                className={`absolute bottom-4 right-4 z-20 transition-all duration-300 ${showCoverBtn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
                onClick={(e) => { e.stopPropagation(); document.getElementById('cover-upload')?.click(); }}
             >
                <div className="bg-black/30 backdrop-blur-md p-2 rounded-md text-white hover:bg-black/50 transition cursor-pointer flex items-center gap-2">
                    <Camera size={16} />
                    <span className="text-xs font-bold">换封面</span>
                </div>
                <input id="cover-upload" type="file" className="hidden" onChange={onUpdateCover} accept="image/*" />
            </div>

            <div className="absolute -bottom-8 right-4 flex items-end gap-3 z-20 pointer-events-none">
                 <div className="text-white font-bold text-lg drop-shadow-md pb-10 font-cute">我们的点滴</div>
                 <div className="bg-white p-1 rounded-xl shadow-lg pointer-events-auto">
                    <div className="w-16 h-16 bg-rose-100 rounded-lg flex items-center justify-center overflow-hidden">
                        <span className="text-3xl">💑</span>
                    </div>
                </div>
            </div>
            
            <div className="absolute top-4 right-4 z-30">
               <button onClick={onFileSelect} className="bg-black/20 p-2 rounded-full text-white hover:bg-black/40 backdrop-blur-sm">
                   <Camera size={20} />
               </button>
               <input type="file" multiple accept="image/*" className="hidden" onChange={onFileSelect} />
            </div>
        </div>

      <div className="mt-14 mb-4 border-b border-gray-100 pb-1 relative bg-white sticky top-0 z-30 flex justify-center">
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

      <div className="px-4 pb-10 max-w-2xl mx-auto min-h-[50vh] bg-white">
          {activeTab === 'moments' ? (
              <div className="space-y-8">
                  {memories.map((memory: Memory) => (
                      <div key={memory.id} className="flex gap-3 pb-6 border-b border-gray-50 last:border-0">
                          <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center text-xl shrink-0">🐶</div>
                          
                          <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-800 font-cute text-sm mb-1 text-blue-900">我们</h4>
                              <p className="mb-2 text-gray-800 text-sm leading-relaxed">{memory.caption}</p>
                              
                              {memory.type === 'media' && memory.media.length > 0 && (
                                  <div className={`grid gap-1 mb-2 max-w-[80%] ${memory.media.length === 1 ? 'grid-cols-1' : memory.media.length === 4 ? 'grid-cols-2 w-2/3' : 'grid-cols-3'}`}>
                                      {memory.media.map((url: string, idx: number) => (
                                          <div key={idx} onClick={() => setViewingImage(url)} className={`aspect-square bg-gray-100 cursor-pointer overflow-hidden ${memory.media.length === 1 ? 'max-w-[200px] max-h-[200px]' : ''}`}>
                                              <img src={url} className="w-full h-full object-cover" alt="Memory" />
                                          </div>
                                      ))}
                                  </div>
                              )}

                              <div className="flex justify-between items-center mt-2 relative">
                                  <div className="flex items-center gap-3">
                                      <span className="text-xs text-gray-400">{memory.date}</span>
                                      <button onClick={() => onDeleteMemory(memory.id)} className="text-xs text-blue-900 hover:underline">删除</button>
                                  </div>
                                  
                                  <div className="relative">
                                      <button 
                                        onClick={(e) => toggleMenu(e, memory.id)}
                                        className="bg-gray-50 p-1 rounded-sm text-blue-800 hover:bg-gray-100"
                                      >
                                          <MoreHorizontal size={16} />
                                      </button>

                                      <AnimatePresence>
                                        {activeMenuId === memory.id && (
                                            <motion.div 
                                                initial={{ opacity: 0, scale: 0.9, x: 10 }}
                                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.9, x: 10 }}
                                                className="absolute right-8 top-0 bg-gray-800 text-white rounded-md flex items-center overflow-hidden shadow-xl z-10"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button 
                                                    onClick={() => { handleLike(memory.id); setActiveMenuId(null); }}
                                                    className="flex items-center gap-1 px-4 py-2 hover:bg-gray-700 text-xs font-bold min-w-[80px] justify-center"
                                                >
                                                    <Heart size={14} fill={memory.isLiked ? "red" : "none"} color={memory.isLiked ? "red" : "white"} />
                                                    {memory.isLiked ? '取消' : '赞'}
                                                </button>
                                                <div className="w-[1px] h-4 bg-gray-600"></div>
                                                <button 
                                                    onClick={() => {
                                                        const input = prompt('请输入评论');
                                                        if(input) { handleComment(memory.id, input); setActiveMenuId(null); }
                                                    }}
                                                    className="flex items-center gap-1 px-4 py-2 hover:bg-gray-700 text-xs font-bold min-w-[80px] justify-center"
                                                >
                                                    <MessageCircle size={14} />
                                                    评论
                                                </button>
                                            </motion.div>
                                        )}
                                      </AnimatePresence>
                                  </div>
                              </div>

                              {(memory.likes > 0 || memory.comments.length > 0) && (
                                  <div className="mt-3 bg-gray-50 rounded-sm p-2 text-xs">
                                      {memory.likes > 0 && (
                                          <div className="flex items-center gap-1 text-blue-900 font-bold border-b border-gray-200/50 pb-1 mb-1">
                                              <Heart size={12} fill="currentColor" />
                                              <span>{memory.likes} 人觉得很赞</span>
                                          </div>
                                      )}
                                      {memory.comments.map((c: any) => (
                                          <div key={c.id} className="leading-5">
                                              <span className="font-bold text-blue-900">我:</span> 
                                              <span className="text-gray-600 ml-1">{c.text}</span>
                                          </div>
                                      ))}
                                  </div>
                              )}
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
                          {album.coverUrl ? (
                              <img src={album.coverUrl} className="w-full h-full object-cover rounded-2xl" alt={album.name} />
                          ) : (
                              <div className="w-full h-full bg-gray-50 rounded-2xl flex items-center justify-center text-xs text-gray-400 border border-gray-100">暂无封面</div>
                          )}
                          {/* 修复：移除 opacity-0 group-hover:opacity-100，让名称一直显示 */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4 rounded-2xl pointer-events-none">
                              <div className="text-white w-full">
                                  <h4 className="font-bold truncate text-shadow-sm">{album.name}</h4>
                                  <span className="text-xs opacity-90">{album.media.length} 张照片</span>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>

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
    </div>
  );
};

const CycleViewContent = ({ periods, nextPeriod, addPeriod }: any) => {
  const handleLogPeriod = () => {
      const today = getBeijingDateString();
      if(confirm(`记录今天 (${today}) 为大姨妈开始日？`)) {
          addPeriod(today);
      }
  };

  return (
    <div className="p-6 space-y-6 pb-24 h-full overflow-y-auto">
        <h2 className="text-2xl font-bold font-cute text-rose-500 text-center mb-2">经期记录</h2>
        
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

    const sortedConflicts = [...conflicts].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return parseInt(b.id) - parseInt(a.id);
    });

    return (
        <div className="p-4 pb-24 space-y-6 bg-gray-50 h-full overflow-y-auto">
             <div className="flex flex-col items-center justify-center py-6">
                 <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-4xl shadow-md mb-3">🐱</div>
                 <h2 className="font-bold text-3xl font-cute text-indigo-900 tracking-wide">喵喵法官</h2>
                 <p className="text-sm text-gray-400 font-medium">公正无私 · 在线断案</p>
             </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg border border-indigo-50">
                <div className="space-y-5">
                    <div>
                        <label className="text-sm font-bold text-gray-700 ml-1 block mb-2">争吵原因</label>
                        <input 
                            className="w-full bg-gray-50 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none transition" 
                            placeholder="简单描述一下因为什么吵架..." 
                            value={reason} 
                            onChange={e => setReason(e.target.value)} 
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-blue-600 ml-1 block mb-2">👦 男生观点</label>
                            <textarea 
                                className="w-full bg-blue-50/50 rounded-xl p-4 text-sm h-32 resize-none focus:ring-2 focus:ring-blue-100 outline-none transition" 
                                placeholder="我觉得..." 
                                value={hisPoint} 
                                onChange={e => setHisPoint(e.target.value)} 
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-rose-500 ml-1 block mb-2">👧 女生观点</label>
                            <textarea 
                                className="w-full bg-rose-50/50 rounded-xl p-4 text-sm h-32 resize-none focus:ring-2 focus:ring-rose-100 outline-none transition" 
                                placeholder="明明是..." 
                                value={herPoint} 
                                onChange={e => setHerPoint(e.target.value)} 
                            />
                        </div>
                    </div>
                    <button 
                        onClick={handleJudge}
                        disabled={isJudging}
                        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition flex justify-center items-center gap-2 text-lg active:scale-[0.98]"
                    >
                        {isJudging ? <Loader2 className="animate-spin" /> : <Gavel size={24} />}
                        {isJudging ? '喵喵正在思考中...' : '请求喵喵裁决'}
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="text-center text-gray-400 text-sm font-bold tracking-widest uppercase mt-8 mb-4">- 历史判决书 -</h3>
                {sortedConflicts.map((c: ConflictRecord) => (
                    <div key={c.id} className={`bg-white rounded-3xl p-6 shadow-md border relative overflow-hidden transition-all ${c.isFavorite ? 'border-pink-300 ring-2 ring-pink-50' : 'border-gray-100'}`}>
                        {c.isPinned && <div className="absolute top-0 right-0 p-3 text-indigo-500 transform rotate-12 bg-indigo-50 rounded-bl-xl"><Pin size={20} fill="currentColor" /></div>}
                        
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{c.date}</span>
                        </div>
                        <h4 className="font-bold text-gray-800 mb-6 font-cute text-xl text-center">{c.reason}</h4>
                        
                        {c.aiResponse && (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold px-1">
                                        <span className="text-blue-500">公猫过错 {c.aiResponse.hisFault}%</span>
                                        <span className="text-rose-500">母猫过错 {c.aiResponse.herFault}%</span>
                                    </div>
                                    <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                                        <div style={{ width: `${c.aiResponse.hisFault}%` }} className="bg-blue-500 h-full transition-all duration-1000 ease-out" />
                                        <div style={{ width: `${c.aiResponse.herFault}%` }} className="bg-rose-500 h-full transition-all duration-1000 ease-out" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="bg-indigo-50/80 rounded-2xl p-4 text-sm text-indigo-900 leading-relaxed border border-indigo-100">
                                        <p className="font-cute text-base mb-1">🐱 喵喵复盘:</p>
                                        <p className="opacity-90">{c.aiResponse.analysis}</p>
                                    </div>
                                    <div className="bg-green-50/80 rounded-2xl p-4 text-sm text-green-900 leading-relaxed border border-green-100">
                                        <p className="font-cute text-base mb-1">💡 和好建议:</p>
                                        <p className="opacity-90">{c.aiResponse.advice}</p>
                                    </div>
                                    {c.aiResponse.prevention && (
                                        <div className="bg-yellow-50/80 rounded-2xl p-4 text-sm text-yellow-900 leading-relaxed border border-yellow-100">
                                            <p className="font-cute text-base mb-1">🛡️ 预防方案:</p>
                                            <p className="opacity-90">{c.aiResponse.prevention}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-4 mt-6 border-t border-gray-50 pt-4">
                            <button onClick={() => toggleFav(c.id)} className={`p-2 rounded-full hover:bg-pink-50 transition ${c.isFavorite ? 'text-pink-500' : 'text-gray-300'}`}><Heart size={20} fill={c.isFavorite ? "currentColor" : "none"} /></button>
                            <button onClick={() => togglePin(c.id)} className={`p-2 rounded-full hover:bg-indigo-50 transition ${c.isPinned ? 'text-indigo-500' : 'text-gray-300'}`}><Pin size={20} fill={c.isPinned ? "currentColor" : "none"} /></button>
                            <button onClick={() => deleteRecord(c.id)} className="p-2 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition"><Trash2 size={20} /></button>
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

    // 修复置顶：在渲染前对数据进行排序，置顶(isPinned)的排在前面
    const sortedMessages = [...messages].sort((a: Message, b: Message) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return parseInt(b.id) - parseInt(a.id);
    });

    return (
        <div className="flex flex-col h-full bg-yellow-50/30">
            <div className="pt-4 px-4 pb-2 bg-yellow-50/30">
                 <h2 className="text-2xl font-bold font-cute text-yellow-600 text-center">留言板</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                <div className="grid grid-cols-1 gap-4">
                    {sortedMessages.map((msg: Message) => (
                        <div key={msg.id} className={`p-6 rounded-2xl shadow-sm border text-base relative group transition-all ${msg.isFavorite ? 'bg-rose-50 border-rose-100' : 'bg-white border-yellow-100'}`}>
                             <p className="text-gray-700 font-cute mb-10 leading-relaxed whitespace-pre-wrap break-words text-lg">{msg.content}</p>
                             
                             <div className="absolute bottom-4 left-0 right-0 px-6 flex justify-between items-center">
                                 <div className="text-xs text-gray-300 font-bold">{msg.date.slice(5)} {msg.time}</div>
                                 <div className="flex gap-4">
                                     <button 
                                        onClick={() => onFav(msg.id)} 
                                        className={`transition ${msg.isFavorite ? 'text-rose-500' : 'text-gray-300 hover:text-rose-500'}`}
                                        title="收藏"
                                     >
                                        <Heart size={18} fill={msg.isFavorite ? "currentColor" : "none"} />
                                     </button>
                                     <button 
                                        onClick={() => onPin(msg.id)} 
                                        className={`transition ${msg.isPinned ? 'text-blue-500' : 'text-gray-300 hover:text-blue-500'}`}
                                        title="置顶"
                                     >
                                        <Pin size={18} fill={msg.isPinned ? "currentColor" : "none"} />
                                     </button>
                                     <button 
                                        onClick={() => onDelete(msg.id)} 
                                        className="text-gray-300 hover:text-red-500 transition"
                                        title="删除"
                                     >
                                        <Trash2 size={18} />
                                     </button>
                                 </div>
                             </div>

                             {msg.isPinned && <div className="absolute top-0 right-0 p-3 text-blue-500 transform rotate-45"><Pin size={24} fill="currentColor" /></div>}
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
    
    const dayTodos = todos.filter((t: TodoItem) => t.date === selectedDate);
    const dayConflicts = conflicts.filter((c: ConflictRecord) => c.date === selectedDate);
    
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
        const lastPeriod = periods[periods.length - 1];
        const lastStart = parseLocalDate(lastPeriod.startDate);
        const predictedStart = new Date(lastStart);
        predictedStart.setDate(lastStart.getDate() + 28);
        const predictedEnd = new Date(predictedStart);
        predictedEnd.setDate(predictedStart.getDate() + 5);

        const curr = parseLocalDate(dateStr);
        return curr >= predictedStart && curr < predictedEnd;
    }

    return (
        <div className="h-full bg-white flex flex-col pb-20">
            <h2 className="text-2xl font-bold font-cute text-gray-800 text-center pt-4">专属日历</h2>

            <div className="px-6 pt-2 pb-2 flex justify-between items-center">
                <h2 className="text-xl font-bold font-cute text-gray-800">{year}年 {month + 1}月</h2>
                <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-2 bg-gray-50 rounded-full hover:bg-rose-50 transition"><ChevronLeft size={20} /></button>
                    <button onClick={nextMonth} className="p-2 bg-gray-50 rounded-full hover:bg-rose-50 transition"><ChevronRight size={20} /></button>
                </div>
            </div>
            
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
                                        ${isToday && !isSelected ? 'text-rose-500 font-bold' : ''}
                                    `}
                                >
                                    {d}
                                    {/* 修复：移除日期的背景色，只保留下方的圆点标记 */}
                                    <div className="absolute bottom-1 flex gap-0.5">
                                        {inPeriod && <div className={`w-1 h-1 rounded-full bg-red-500 ${isSelected ? 'ring-1 ring-white' : ''}`} />}
                                        {isPredicted && !inPeriod && <div className={`w-1 h-1 rounded-full bg-blue-400 ${isSelected ? 'ring-1 ring-white' : ''}`} />}
                                        {hasTodo && <div className={`w-1 h-1 rounded-full bg-yellow-400 ${isSelected ? 'ring-1 ring-white' : ''}`} />}
                                        {hasConflict && <div className={`w-1 h-1 rounded-full bg-purple-500 ${isSelected ? 'ring-1 ring-white' : ''}`} />}
                                    </div>
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="bg-gray-50 py-3 px-4 flex gap-4 overflow-x-auto text-xs font-bold text-gray-500 justify-center mt-2">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div>经期</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-400"></div>预测</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-400"></div>待办</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-purple-500"></div>吵架</div>
            </div>
            
            <div className="flex-1 bg-gray-50 mt-4 rounded-t-3xl p-6 overflow-y-auto">
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
                    
                    {dayConflicts.map((c: ConflictRecord) => (
                        <div key={c.id} className="bg-purple-50 text-purple-900 p-3 rounded-xl text-sm border border-purple-100">
                             <div className="font-bold flex items-center gap-2 mb-1">
                                 <Gavel size={14} /> 喵喵法官裁决
                             </div>
                             {c.reason}
                        </div>
                    ))}

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
