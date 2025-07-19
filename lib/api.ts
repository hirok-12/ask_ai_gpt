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