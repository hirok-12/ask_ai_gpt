'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Plus, User } from 'lucide-react';
import { sendDifyChatMessage, fetchDifyConversations, fetchDifyConversationMessages } from '@/lib/api';
import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  difyConversationId?: string; // Dify側の会話ID
}

// 英語のタイトルを日本語に変換する関数
const translateToJapanese = (title: string | null | undefined): string => {
  if (!title) return '';
  
  // よくある英語のタイトルを日本語に変換
  const translations: { [key: string]: string } = {
    'New Chat': '新しいチャット',
    'Untitled': '無題のチャット',
    'Untitled Chat': '無題のチャット',
    'Chat': 'チャット',
    'Conversation': '会話',
    'New Conversation': '新しい会話',
    'Troubleshooting Internet': 'インターネットのトラブルシューティング',
    'Detect Error': 'エラー検出',
    'Error Detection': 'エラー検出',
    'Debug': 'デバッグ',
    'Debugging': 'デバッグ中',
    'Test': 'テスト',
    'Testing': 'テスト中',
    'Help': 'ヘルプ',
    'Welcome': 'ようこそ',
    'Hello': 'こんにちは',
    'Question': '質問',
    'Answer': '回答',
    'Solution': '解決策',
    'Problem': '問題',
    'Issue': '課題',
  };
  
  // 完全一致の場合
  if (translations[title]) {
    return translations[title];
  }
  
  // 部分一致の場合（例: "Chat 1", "Conversation 2"など）
  for (const [eng, jpn] of Object.entries(translations)) {
    if (title.startsWith(eng)) {
      return title.replace(eng, jpn);
    }
  }
  
  // 省略形の場合（例: "Troubleshooting Interne..."）
  if (title.endsWith('...')) {
    const withoutEllipsis = title.slice(0, -3);
    for (const [eng, jpn] of Object.entries(translations)) {
      if (eng.toLowerCase().startsWith(withoutEllipsis.toLowerCase())) {
        return jpn + '...';
      }
    }
  }
  
  // 翻訳が見つからない場合は元のタイトルを返す
  return title;
};

export default function ChatInterface() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  

  // ユーザーIDをlocalStorageで永続化
  useEffect(() => {
    let storedUserId = localStorage.getItem('dify_user_id');
    if (!storedUserId) {
      storedUserId = uuidv4();
      localStorage.setItem('dify_user_id', storedUserId);
    }
    setUserId(storedUserId);
  }, []);

  // ページロード時に会話一覧を取得
  useEffect(() => {
    if (userId) {
      loadConversations();
    }
  }, [userId]);

  // 会話一覧を取得する関数
  const loadConversations = async () => {
    if (!userId) return;
    
    setIsLoadingConversations(true);
    try {
      const response = await fetchDifyConversations(userId);
      if (response.data && response.data.length > 0) {
        // Difyから取得した会話をローカル形式に変換
        const loadedChats: Chat[] = response.data.map((conv: any) => ({
          id: conv.id,
          title: conv.name || '無題のチャット',
          messages: [], // メッセージは後で個別に読み込む
          difyConversationId: conv.id,
        }));
        setChats(loadedChats);
        
        // 各会話の最初のメッセージを取得してタイトルとして設定
        for (const chat of loadedChats) {
          try {
            const msgResponse = await fetchDifyConversationMessages(chat.difyConversationId!, userId, 1);
            if (msgResponse.data && msgResponse.data.length > 0) {
              const firstMsg = msgResponse.data[0];
              if (firstMsg.query) {
                setChats((prev) =>
                  prev.map((c) =>
                    c.id === chat.id
                      ? { ...c, title: firstMsg.query.slice(0, 50) }
                      : c
                  )
                );
              }
            }
          } catch (error) {
            console.error('タイトル取得エラー:', error);
          }
        }
      }
    } catch (error) {
      console.error('会話一覧の取得エラー:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // 会話の履歴メッセージを取得する関数
  const loadConversationMessages = async (conversationId: string) => {
    if (!userId) return;
    
    console.log('Loading messages for conversation:', conversationId);
    setIsLoadingMessages(true);
    try {
      const response = await fetchDifyConversationMessages(conversationId, userId);
      console.log('API Response:', response);
      
      if (response.data && response.data.length > 0) {
        // メッセージを時系列順に並び替え（古い順）
        const messages: Message[] = [];
        
        // APIレスポンスからユーザーとアシスタントのメッセージを構築
        response.data.reverse().forEach((msg: any) => {
          // ユーザーのメッセージ
          if (msg.query) {
            messages.push({
              id: msg.id + '_query',
              text: msg.query,
              sender: 'user',
              timestamp: new Date(msg.created_at),
            });
          }
          // アシスタントのメッセージ
          if (msg.answer) {
            messages.push({
              id: msg.id + '_answer',
              text: msg.answer,
              sender: 'assistant',
              timestamp: new Date(msg.created_at),
            });
          }
        });
        
        console.log('Processed messages:', messages);
        
        // 最初のユーザーメッセージをタイトルとして使用
        const firstUserMessage = messages.find(msg => msg.sender === 'user');
        const newTitle = firstUserMessage ? firstUserMessage.text.slice(0, 50) : '無題のチャット';
        
        // 該当のチャットにメッセージを設定
        setChats((prev) =>
          prev.map((chat) =>
            chat.difyConversationId === conversationId
              ? { ...chat, messages, title: newTitle }
              : chat
          )
        );
      } else {
        console.log('No messages found in conversation');
      }
    } catch (error) {
      console.error('会話履歴の取得エラー:', error);
      alert('会話履歴の取得に失敗しました。');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // 現在のチャット
  const activeChat = chats.find((c) => c.id === activeChatId);
  const messages = activeChat ? activeChat.messages : [];

  // 新しいチャットを開始
  const handleNewChat = () => {
    if (!userId) return;
    
    // APIキーの確認
    const apiKey = process.env.NEXT_PUBLIC_DIFY_API_KEY;
    if (!apiKey) {
      alert('Dify APIキーが設定されていません。環境変数NEXT_PUBLIC_DIFY_API_KEYを設定してください。');
      return;
    }
    
    // ローカルで新しいチャットを作成
    const newChat: Chat = {
      id: uuidv4(), // ローカルでユニークなIDを生成
      title: '新しいチャット',
      messages: [],
    };
    
    setChats((prev) => [...prev, newChat]);
    setActiveChatId(newChat.id);
  };

  // チャット送信
  const handleSend = async () => {
    if (!inputValue.trim() || !activeChatId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: [...chat.messages, userMessage],
              // 最初のメッセージならタイトルに設定
              title:
                chat.messages.length === 0
                  ? userMessage.text.slice(0, 50)
                  : chat.title,
            }
          : chat
      )
    );
    setInputValue('');
    setIsTyping(true);

    try {
      // 現在のチャットを取得
      const currentChat = chats.find(chat => chat.id === activeChatId);
      
      // Difyにメッセージを送信（初回の場合はconversationIdなし）
      const res = await sendDifyChatMessage(userMessage.text, currentChat?.difyConversationId, userId!);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: res.answer || res.content || '（返答がありません）',
        sender: 'assistant',
        timestamp: new Date(),
      };
      
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id === activeChatId) {
            return {
              ...chat,
              messages: [...chat.messages, assistantMessage],
              // 初回メッセージの場合、Difyから返された会話IDを保存
              difyConversationId: chat.difyConversationId || res.conversation_id
            };
          }
          return chat;
        })
      );
    } catch (error: any) {
      const assistantMessage: Message = {
        id: (Date.now() + 2).toString(),
        text: `エラー: ${error.message}`,
        sender: 'assistant',
        timestamp: new Date(),
      };
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? { ...chat, messages: [...chat.messages, assistantMessage] }
            : chat
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-60 bg-gray-200 text-gray-800 flex flex-col">
        <div className="p-4">
          <Button
            variant="outline"
            className="w-full justify-start bg-transparent border-gray-400 text-gray-800 hover:bg-gray-300 hover:text-gray-900"
            onClick={handleNewChat}
          >
            <Plus className="w-4 h-4 mr-2" />
            新しいチャット
          </Button>
        </div>
        {/* チャット履歴一覧 */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="p-4 text-center text-gray-500">読み込み中...</div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`px-4 py-2 cursor-pointer hover:bg-gray-300 ${
                  chat.id === activeChatId ? 'bg-gray-300 font-bold' : ''
                }`}
                onClick={async () => {
                  console.log('Chat clicked:', chat);
                  setActiveChatId(chat.id);
                  // 会話履歴がまだ読み込まれていない場合は読み込む
                  if (chat.difyConversationId && chat.messages.length === 0) {
                    console.log('Loading messages for Dify conversation:', chat.difyConversationId);
                    await loadConversationMessages(chat.difyConversationId);
                  } else if (!chat.difyConversationId) {
                    console.log('No Dify conversation ID found for this chat');
                  } else {
                    console.log('Messages already loaded:', chat.messages.length);
                  }
                }}
              >
                <span className="truncate block max-w-full">{chat.title}</span>
              </div>
            ))
          )}
        </div>
        <div className="p-4 border-t border-gray-300">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white">
              <User className="w-5 h-5" />
            </div>
            <span className="text-sm">ゲストユーザー</span>
          </div>
        </div>
      </div>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoadingMessages ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-gray-500">メッセージを読み込み中...</div>
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.sender === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          )}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-gray-200 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
        {/* Input Area */}
        <div className="p-4 border-t bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="質問してみましょう"
                  className="pr-12 py-3 text-base border-2 border-gray-200 focus:border-gray-400 rounded-lg"
                  disabled={!activeChatId}
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || !activeChatId}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 p-0 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}