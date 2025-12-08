export interface Comment {
  id: string;
  text: string;
  author: 'me' | 'partner';
  date: string;
}

export interface Memory {
  id: string;
  media: string[]; // Array of URLs. Empty if text-only.
  caption: string; // The text content
  date: string;
  type: 'media' | 'text'; // 'media' includes images/videos, 'text' is text-only
  likes: number;
  isLiked: boolean;
  comments: Comment[];
}

export interface PinnedPhoto {
  id: string;
  memoryId: string; // Can link to a Memory or an AlbumMedia
  source: 'memory' | 'album'; // Track where this came from
  mediaUrl: string; // Direct link to the specific image
  x: number;
  y: number;
  rotation: number;
  scale: number;
  customCaption?: string;
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
  startDate: string; // ISO string
  duration: number; // days
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  assignee: 'me' | 'partner' | 'both';
  date?: string; // YYYY-MM-DD
}

export interface ConflictRecord {
  id: string;
  date: string;
  reason: string;
  hisPoint: string;
  herPoint: string;
  aiResponse?: {
    hisFault: number;
    herFault: number;
    analysis: string;
    advice: string;
    prevention: string; // New field for preventing future fights
  };
  isPinned?: boolean;
  isFavorite?: boolean;
}

export interface Message {
  id: string;
  content: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  isPinned: boolean;
  isFavorite: boolean;
}

export enum Page {
  HOME = 'HOME',
  MEMORIES = 'MEMORIES',
  CYCLE = 'CYCLE',
  CONFLICT = 'CONFLICT',
  CALENDAR = 'CALENDAR',
  BOARD = 'BOARD'
}