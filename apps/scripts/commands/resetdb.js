import path from 'path';
import { pathToFileURL } from 'url';

export const meta = {
  name: 'resetdb',
  version: '1.0.1',
  description: 'Wipe and reset the entire database (Developer Only).',
  author: 'AjiroDesu',
  category: 'developer',
  type: 'developer', 
  guide: ['']
};

export async function onStart({ response }) {
  // Send confirmation panel
  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Confirm Reset', callback_data: JSON.stringify({ command: 'resetdb', args: ['confirm'] }) },
        { text: '❌ Cancel', callback_data: JSON.stringify({ command: 'resetdb', args: ['cancel'] }) }
      ]
    ]
  };

  return response.reply(
    '⚠️ **DANGER ZONE** ⚠️\n\n' +
    'Are you sure you want to **RESET** the database?\n' +
    'This will delete ALL user money, exp, and group settings permanently.\n' +
    '**This action cannot be undone.**',
    { reply_markup: keyboard }
  );
}

/**
 * Handle Button Clicks
 */
export async function onCallback({ callbackQuery, args, response }) {
  const action = args[0];
  const target = callbackQuery.message;

  // 1. Handle Cancel
  if (action === 'cancel') {
    await response.edit('text', target, '🛡️ **Operation Cancelled**\nThe database remains safe.');
    return;
  }

  // 2. Handle Confirm
  if (action === 'confirm') {
    // Dynamic Import Helper
    const importLocal = async (relativePath) => {
      const modulePath = path.resolve(process.cwd(), relativePath);
      return import(pathToFileURL(modulePath).href);
    };

    try {
      // Visual feedback
      await response.edit('text', target, '⏳ **Resetting Database...**\nPlease wait.');

      // [FIX] Dynamic Imports using CWD
      const { db } = await importLocal('core/system/database.js');
      const { default: log } = await importLocal('core/utility/log.js');

      // Perform the DB Reset
      await db.reset();

      // Log the action
      if (log && log.paldea) {
        log.database(`reset triggered by user ID ${callbackQuery.from.id}`);
      } else if (log && log.warn) {
        log.warn(`reset triggered by user ID ${callbackQuery.from.id}`);
      }

      // Success Message
      await response.edit('text', target, '✅ **Database Reset Complete**\nAll tables have been dropped and schema re-applied.');

    } catch (error) {
      // Import log for error handling if the try block failed before log was imported
      try {
        const { default: log } = await importLocal('core/utility/log.js');
        log.error(`[ResetDB Error] ${error.message}`);
      } catch (e) {
        console.error('[ResetDB Error]', error); // Fallback
      }

      await response.edit('text', target, `❌ **Error during reset:**\n${error.message}`);
    }
  }
}
