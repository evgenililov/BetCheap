import implementation from '../lib/telegram-publish-background-handler.js';
import adapter from '../lib/telegram-request.js';
export default request => adapter(request, implementation.handler);
