/**
 * Command Metadata
 */
export const meta = {
  name: 'register',
  version: '1.0.0',
  description: 'Register yourself in the global database to start using bot features.',
  author: 'AjiroDesu',
  category: 'System',
  type: 'anyone',
  cooldown: 10,
  guide: ['(Run to sign up)']
};

export async function onStart({ msg, response, matches }) {
  const userId = msg.from.id;

  // 1. Check if already exists
  const user = await global.db.users.get(userId);

  if (user.registered) {
    return response.reply('✅ **You are already registered!**\nYou can use all commands.');
  }

  try {
    // 2. Create the account
    await global.db.users.set(userId, {
      registered: true,
      money: 1000, // [BONUS] Give them a nice starting amount
      exp: 0,
      data: { joinedDate: new Date().toISOString() }
    });

    // [FIX] Added backslashes (\) before the inner backticks
    return response.reply(
      '📝 **Registration Complete!**\n\n' +
      '🎉 Welcome to Paldea!\n' +
      'You have received a **$1,000** starter bonus.\n\n' +
      `Try checking your \`${matches}balance\` or claiming your \`${matches}daily\` reward.`
    );
  } catch (error) {
    console.error(error);
    return response.reply('⚠️ **Registration Failed**: Database error.');
  }
}
