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
      
      <input id="cover-upload" type="file" className="hidden" onChange={onUpdateCover} accept="image/*" />
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
                                 <button onClick={(e) => { e.stopPropagation(); onFav(msg.id); }} className={`${msg.isFavorite ? 'text-rose-500' : 'text-gray-300 hover:text-rose-500'}`}><Heart size={14} fill={msg.isFavorite ? "currentColor" : "none"} /></button>
                                 <button onClick={(e) => { e.stopPropagation(); onPin(msg.id); }} className={`${msg.isPinned ? 'text-blue-500' : 'text-gray-300 hover:text-blue-500'}`}><Pin size={14} fill={msg.isPinned ? "currentColor" : "none"} /></button>
                                 <button onClick={(e) => { e.stopPropagation(); onDelete(msg.id); }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
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
            <div className="px-6 pt-4 pb-2 flex justify-between items-center">
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
                                        ${isToday && !isSelected ? 'bg-rose-50 text-rose-500' : ''}
                                        ${inPeriod && !isSelected ? 'bg-red-50 text-red-500 border border-red-100' : ''}
                                        ${isPredicted && !inPeriod && !isSelected ? 'bg-blue-50 text-blue-400 border border-blue-100' : ''}
                                    `}
                                >
                                    {d}
                                    <div className="absolute bottom-1 flex gap-0.5">
                                        {hasTodo && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-yellow-400'}`} />}
                                        {hasConflict && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-purple-400'}`} />}
                                        {isPredicted && !inPeriod && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-400'}`} />}
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
