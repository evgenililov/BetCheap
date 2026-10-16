// Netlify Function skeleton for a future Telegram webhook.
// Set TELEGRAM_BOT_TOKEN only in Netlify environment variables; never commit it.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  let update; try { update = JSON.parse(event.body || '{}'); } catch { return {statusCode:400,body:'Bad JSON'}; }
  const text = update?.message?.text || '';
  const chatId = update?.message?.chat?.id;
  if (!chatId) return {statusCode:200,body:'ok'};
  let reply = 'BETCHEAP compares betting prices. It does not place bets or handle money. Use /check <your bet> or /help.';
  if (text.startsWith('/start')) reply = 'Welcome to BETCHEAP. Check your bet before you place it. 18+ only. Demo bot — no live odds yet.';
  if (text.startsWith('/check')) reply = 'Demo mode: live odds are not connected yet. The production version will compare eligible prices for your market.';
  if (text.startsWith('/help')) reply = '/check <bet> — compare prices\n/help — help\n18+ • Gambling involves risk.';
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return {statusCode:200,body:JSON.stringify({demo:true,reply})};
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text:reply})});
  return {statusCode:200,body:'ok'};
};
