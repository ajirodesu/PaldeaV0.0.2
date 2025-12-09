export const meta = {
  name: 'balance',
  version: '1.2.1',
  aliases: ['bal', 'money', 'cash'],
  description: 'View your current balance or check another user\'s balance.',
  author: 'NTKhang',
  category: 'Economy',
  type: 'anyone',
  cooldown: 5,
  guide: ['', '<reply to user>'],
};

// [UPDATED] Added isRegistered to arguments
export async function onStart({ msg, response, usersData, isRegistered, matches }) {
  try {
    const targetUser = msg.reply_to_message?.from || msg.from;
    const targetId = targetUser.id;
    const isSelf = targetId === msg.from.id;

    // 1. Check Registration Logic
    if (isSelf) {
      // If checking self, use the automated helper
      if (!(await isRegistered())) return;
    }

    // 2. Database Fetch
    const userData = await usersData.get(targetId);

    // 3. Check Target Registration (if checking someone else)
    if (!isSelf && !userData.registered) {
      return response.reply(`⚠️ **User Not Found**\n\n**${targetUser.first_name}** has not registered yet.`);
    }

    const money = userData?.money || 0;
    const formattedMoney = new Intl.NumberFormat('en-US').format(money);

    const responseText = isSelf
      ? `💰 **Your Balance**\nYou currently have **$${formattedMoney}**`
      : `💰 **User Balance**\n**${targetUser.first_name}** currently has **$${formattedMoney}**`;

    return response.reply(responseText);

  } catch (error) {
    console.error(`[Balance Error] ${error.message}`);
    return response.reply('⚠️ **System Error**: Could not retrieve balance data.');
  }
}
