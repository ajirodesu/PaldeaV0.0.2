import moment from 'moment-timezone';

/**
 * Command Configuration
 * Fetches settings dynamically from global.paldea.cmdset (loaded from json/cmdset.json)
 */
const CONFIG = {
  // Safe access to timezone, defaulting to Asia/Manila
  get timezone() { 
    return global.paldea?.settings?.timezone || 'Asia/Manila'; 
  },

  // Growth rate remains constant (20%) unless you add it to cmdset later
  growthRate: 0.20,

  // Helper to get reward values from cmdset
  get baseReward() {
    const dailyConfig = global.paldea?.cmdset?.envCommands?.daily;
    // Tries 'rewardFirstDay' first, falls back to 'rewardDay1', then safe defaults
    return dailyConfig?.rewardFirstDay || dailyConfig?.rewardDay1 || { coin: 100, exp: 10 };
  }
};

/**
 * Command Metadata
 */
export const meta = {
  name: 'daily',
  version: '1.2.2',
  aliases: ['claim', 'gift'],
  description: 'Claim your daily attendance reward.',
  author: 'NTKhang',
  category: 'Economy',
  type: 'anyone',
  cooldown: 5,
  guide: ['', 'info'],
};

/**
 * Helper: Calculate reward for a specific day index (1-7)
 */
function calculateReward(dayIndex) {
  // Logic: ((currentDay == 0 ? 7 : currentDay) - 1)
  const power = (dayIndex === 0 ? 7 : dayIndex) - 1;
  const base = CONFIG.baseReward; // Fetched from cmdset.json

  const coin = Math.floor(base.coin * Math.pow(1 + CONFIG.growthRate, power));
  const exp = Math.floor(base.exp * Math.pow(1 + CONFIG.growthRate, power));

  return { coin, exp };
}

/**
 * Main Execution
 */
export async function onStart({ msg, args, response, usersData, isRegistered }) {
  try {
    // 1. Check Registration
    if (!(await isRegistered())) return;

    // === INFO SUB-COMMAND ===
    if (args[0]?.toLowerCase() === 'info') {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      let infoMsg = '📅 **Daily Reward Schedule**\n\n';

      for (let i = 1; i <= 7; i++) {
        const { coin, exp } = calculateReward(i);
        const dayName = days[i - 1];
        infoMsg += `▫️ **${dayName}**: $${coin} | ${exp} EXP\n`;
      }
      return response.reply(infoMsg);
    }

    // === CLAIM LOGIC ===
    const senderID = msg.from.id;
    const currentDateTime = moment.tz(CONFIG.timezone).format("DD/MM/YYYY");
    const date = new Date();
    const currentDay = date.getDay(); // 0 (Sun) to 6 (Sat)

    // 2. Database Fetch
    const userData = await usersData.get(senderID);

    // 3. Validation: Check if already claimed
    if (userData.data?.lastTimeGetReward === currentDateTime) {
      return response.reply('📅 **Already Claimed**\nYou have already received your gift today. Come back tomorrow!');
    }

    // 4. Calculate Rewards
    const { coin: getCoin, exp: getExp } = calculateReward(currentDay);

    // 5. Database Update
    const currentData = userData.data || {};
    currentData.lastTimeGetReward = currentDateTime;

    await usersData.set(senderID, {
      money: (userData.money || 0) + getCoin,
      exp: (userData.exp || 0) + getExp,
      data: currentData
    });

    // 6. Success Response
    return response.reply(
      `🎁 **Daily Reward Received**\n\n` +
      `💰 **Money:** +$${getCoin}\n` +
      `🆙 **Experience:** +${getExp} EXP\n` +
      `_Streak maintained!_`
    );

  } catch (error) {
    console.error(`[Daily Error] ${error.message}`, error);
    return response.reply('⚠️ **System Error**: Could not process daily reward.');
  }
}
