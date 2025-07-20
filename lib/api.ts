import { v4 as uuidv4 } from 'uuid';

// Difyのチャットメッセージ送信API呼び出し関数
export async function sendDifyChatMessage(message: string, conversationId?: string, userId?: string) {
  const apiKey = process.env.NEXT_PUBLIC_DIFY_API_KEY;
  if (!apiKey) {
    throw new Error('Dify APIキーが設定されていません。');
  }

  // userIdが提供されない場合は新規生成
  const user = userId || uuidv4();

  const body: any = {
    query: message,
    user,
    inputs: {},
    response_mode: 'blocking',
  };
  if (conversationId) {
    body.conversation_id = conversationId;
  }

  const response = await fetch('https://api.dify.ai/v1/chat-messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dify APIエラー: ${error}`);
  }

  return response.json();
}

// Difyの会話一覧取得API呼び出し関数
export async function fetchDifyConversations(userId: string, limit: number = 20, lastId?: string) {
  const apiKey = process.env.NEXT_PUBLIC_DIFY_API_KEY;
  if (!apiKey) {
    throw new Error('Dify APIキーが設定されていません。');
  }

  const params = new URLSearchParams({
    user: userId,
    limit: limit.toString(),
  });
  
  if (lastId) {
    params.append('last_id', lastId);
  }

  const response = await fetch(`https://api.dify.ai/v1/conversations?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dify API会話一覧取得エラー: ${error}`);
  }

  return response.json();
}

// Difyの会話履歴メッセージ取得API呼び出し関数
export async function fetchDifyConversationMessages(conversationId: string, userId: string, limit: number = 20, firstId?: string) {
  const apiKey = process.env.NEXT_PUBLIC_DIFY_API_KEY;
  if (!apiKey) {
    throw new Error('Dify APIキーが設定されていません。');
  }

  const params = new URLSearchParams({
    conversation_id: conversationId,
    user: userId,
    limit: limit.toString(),
  });
  
  if (firstId) {
    params.append('first_id', firstId);
  }

  const response = await fetch(`https://api.dify.ai/v1/messages?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dify API会話履歴取得エラー: ${error}`);
  }

  return response.json();
} 