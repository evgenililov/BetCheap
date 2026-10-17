import implementation from '../lib/telegram-admin-handler.js';
import adapter from '../lib/telegram-request.js';
export default request => adapter(request, implementation.handler);
