/**
 * Command Metadata
 * View detailed database information for yourself or other users.
 */
export const meta = {
  name: 'userdb',
  aliases: ['whois', 'uinfo', 'profile'],
  version: '1.2.3',
  description: 'View user profile and database status',
  author: 'ST (Modified by Paldea)',
  category: 'Database',
  type: 'anyone',
  cooldown: 5,
  guide: ['', '<reply>', '<@username>', '<id>']
};

/**
 * Main Execution
 */
export async function onStart({ msg, args, response, usersData, bot, isRegistered }) {
  try {
    let targetUserId = null;
    let targetUserObj = null;

    // --- 1. Target Detection Logic ---

    // A. Priority 1: Reply to message
    if (msg.reply_to_message?.from) {
      targetUserId = msg.reply_to_message.from.id;
      targetUserObj = msg.reply_to_message.from;
    }
    // B. Priority 2: Text Mention (e.g. clicked name)
    else if (msg.entities) {
      const mention = msg.entities.find(e => e.type === 'text_mention');
      if (mention && mention.user) {
        targetUserId = mention.user.id;
        targetUserObj = mention.user;
      }
    }

    // If no target found yet, check Args
    if (!targetUserId && args.length > 0) {
      const input = args[0];

      // C. Priority 3: @Username
      if (input.startsWith('@')) {
        try {
          const chat = await bot.getChat(input);
          targetUserId = chat.id;
          targetUserObj = chat;
        } catch (e) {
          return response.reply(`❌ **User Not Found**\nCould not resolve username \`${input}\`.`);
        }
      } 
      // D. Priority 4: Numeric ID
      else if (/^\d+$/.test(input)) {
        targetUserId = parseInt(input);
        try {
          const chat = await bot.getChat(targetUserId);
          targetUserObj = chat;
        } catch (e) {
          targetUserObj = { id: targetUserId, first_name: 'Unknown' };
        }
      }
    }

    // E. Priority 5: Self (Default)
    if (!targetUserId) {
      targetUserId = msg.from.id;
      targetUserObj = msg.from;
    }

    // --- [NEW] Registration Check ---
    // If the user is checking themselves, enforce registration.
    // This sends the "Access Denied / Register Now" prompt if they aren't registered.
    if (targetUserId === msg.from.id) {
      if (!(await isRegistered())) return;
    }

    // --- 2. Database Fetch ---
    const userData = await usersData.get(targetUserId);

    if (!userData) {
      return response.reply("❌ **Database Error**\nCould not retrieve user data.");
    }

    // --- 3. Formatting Data ---
    const { 
      id, 
      money = 0, 
      exp = 0, 
      level = 1, 
      username: dbUsername, 
      first_name: dbFirstName, 
      last_name: dbLastName,
      registered, 
      banned,
      dm_approved,
      created_at 
    } = userData;

    // Name Logic
    const tgFirstName = targetUserObj?.first_name || dbFirstName || 'Unknown';
    const tgLastName = targetUserObj?.last_name || dbLastName || '';
    const fullName = `${tgFirstName} ${tgLastName}`.trim();

    const tgUsername = targetUserObj?.username 
      ? `@${targetUserObj.username}` 
      : (dbUsername ? `@${dbUsername}` : 'None');

    const joinedDate = created_at ? new Date(created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    }) : 'Unknown';

    // Status Icons
    const statusIcons = [];
    if (banned) statusIcons.push('🚫 Banned');
    if (!registered) statusIcons.push('⚠️ Unregistered');
    else statusIcons.push('✅ Registered');
    if (dm_approved) statusIcons.push('📨 DM Approved');

    const statusText = statusIcons.join(' | ');

    // --- 4. Construct Response ---
    const infoText = 
      `📊 **User Database Profile**\n\n` +
      `👤 **Identity**\n` +
      `• Name: ${fullName}\n` +
      `• Username: ${tgUsername}\n` +
      `• ID: \`${id}\`\n\n` +

      `🔰 **Status**\n` +
      `• ${statusText}\n\n` +

      `💳 **Economy & Stats**\n` +
      `• Level: **${level}**\n` +
      `• Money: **$${parseInt(money).toLocaleString()}**\n` +
      `• Exp: **${parseInt(exp).toLocaleString()}**\n\n` +

      `📅 **History**\n` +
      `• Joined: ${joinedDate}`;

    await response.reply(infoText);

  } catch (error) {
    console.error('Error in userdb command:', error);
    response.reply(`❌ **System Error**\n${error.message}`);
  }
}
