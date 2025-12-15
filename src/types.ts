// === 原有的类型定义 ===

export interface Comment {
  id: string;
  text: string;
  author: 'me' | 'partner';
  date: string;
}

export interface Memory {
  id: string;
  media: string[]; // 图片 URL 数组
  caption: string; // 文字内容
  date: string;
  type: 'media' | 'text';
  likes: number;
  isLiked: boolean;
  comments: Comment[];
  // 新增：Bmob 扩展字段
  creatorId?: string;
  creatorName?: string;
  creatorAvatar?: string;
  coupleId?: string;
  createdAt?: string;
}

export interface PinnedPhoto {
  id: string;
  memoryId: string; 
  source: 'memory' | 'album'; 
  mediaUrl: string; 
  x: number;
  y: number;
  rotation: number;
  scale: number;
  customCaption?: string;
  // 新增：Bmob 扩展字段
  objectId?: string; // Bmob 的主键
  coupleId?: string;
  creatorId?: string;
}

export interface AlbumMedia {
  id: string;
  url: string;
  caption?: string;
  date: string;
  type: 'image' | 'video';
}

export interface Album {
  id: string;
  name: string;
  coverUrl: string;
  createdAt: string;
  media: AlbumMedia[];
}

export interface PeriodEntry {
  startDate: string; 
  duration: number; 
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  assignee: 'me' | 'partner' | 'both';
  date?: string; 
}

export interface ConflictRecord {
  id: string;
  date: string;
  reason: string;
  hisPoint: string;
  herPoint: string;
  // [新增] 保存双方名字，用于进度条展示
  hisName?: string; 
  herName?: string;
  
  type?: 'solo' | 'joint'; 
  aiResponse?: {
    hisFault: number;
    herFault: number;
    analysis: string; // 对应 喵喵复盘
    advice: string;   // 对应 喵喵和好方案
    prevention: string; // 对应 喵喵预防计划
  };
  isPinned?: boolean;
  isFavorite?: boolean;
}


// 新增：双人裁决会话状态
export interface JointSession {
  id: string;
  coupleId: string;
  status: 'waiting' | 'processing' | 'resolved';
  initiatorId: string;
  initiatorName: string;
  initiatorReason: string;
  initiatorPoint: string;
  responderId?: string;
  responderName?: string;
  responderReason?: string;
  responderPoint?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  content: string;
  date: string; 
  time: string; 
  isPinned: boolean;
  isFavorite: boolean;
}

export enum Page {
  HOME = 'HOME',
  MEMORIES = 'MEMORIES',
  CYCLE = 'CYCLE',
  CONFLICT = 'CONFLICT',
  CALENDAR = 'CALENDAR',
  BOARD = 'BOARD',
  PROFILE = 'PROFILE' // 新增个人页枚举
}

// === 新增 Bmob 用户相关类型 ===

// 用户信息定义
export interface UserProfile {
  objectId: string; // Bmob 的 ID 叫 objectId
  username: string;
  avatarUrl: string;
  coupleId?: string; // 绑定的另一半 ID
  gender?: string;
  mobilePhoneNumber?: string;
}

// 扩展 Message 以支持发送者
export interface ExtendedMessage extends Message {
  creator: {
    username: string;
    avatarUrl: string;
    objectId: string;
  }
}
