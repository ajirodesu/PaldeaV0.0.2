/**
 * @fileoverview Core Command Handler
 * Handles parsing, permissions, cooldowns, and execution execution.
 */

const SYMBOLS = {
  usage: "▫️", 
  error: "❌", 
  warning: "⚠️", 
  cooldown: "⏳", 
  guide: "📄", 
  unknown: "❓",
  maintenance: "🚧",
  lock: "🔒"
};

/**
 * Checks if a user has the required permission level.
 */
const checkPermission = async (bot, msg, level) => {
  const { settings } = global.paldea;
  const senderId = String(msg.from.id);
  const chatType = msg.chat.type;

  const isDev = settings.developers.includes(senderId);
  const isVip = isDev || settings.vip.includes(senderId);

  switch (level) {
    case 'developer': return isDev;
    case 'vip':       return isVip;
    case 'group':     return ['group', 'supergroup'].includes(chatType);
    case 'private':   return chatType === 'private';
    case 'administrator':
      if (chatType === 'private') return false;
      if (isDev) return true;
      try {
        const member = await bot.getChatMember(msg.chat.id, senderId);
        return ['creator', 'administrator'].includes(member.status);
      } catch { return false; }
    case 'anyone':
    default: return true;
  }
};

/**
 * Manages command cooldowns.
 */
const handleCooldown = (context, command) => {
  const { msg, response, cooldowns } = context;
  if (!command.cooldown) return false;

  const key = `${msg.from.id}_${command.name}`;
  const now = Date.now();
  const duration = command.cooldown * 1000;

  if (cooldowns.has(key)) {
    const expiration = cooldowns.get(key) + duration;
    if (now < expiration) {
      const left = ((expiration - now) / 1000).toFixed(1);
      response.reply(`${SYMBOLS.cooldown} Wait **${left}s** before using this again.`);
      return true;
    }
  }

  cooldowns.set(key, now);
  setTimeout(() => cooldowns.delete(key), duration);
  return false;
};

/**
 * Main Command Execution Logic
 */
export async function handleCommand({ bot, msg, response, log, userId }) {
  if (!msg.text || msg.from.is_bot) return;

  const { settings, commands, cooldowns } = global.paldea;
  const { prefix, subprefix } = settings;
  const body = msg.text.trim();
  const isDev = settings.developers.includes(String(msg.from.id));

  // 1. Prefix Detection
  const allPrefixes = [prefix, ...(subprefix || [])];
  const matchedPrefix = allPrefixes.find(p => body.startsWith(p));

  // 2. System Online Check
  if (matchedPrefix && body === matchedPrefix) {
    return response.reply(`🟢 **System Online.**\nType \`${matchedPrefix}help\` to see commands.`);
  }

  // 3. Command Parsing
  let commandName, args;
  let isPrefixed = !!matchedPrefix;

  if (isPrefixed) {
    const parts = body.slice(matchedPrefix.length).trim().split(/\s+/);
    commandName = parts[0].toLowerCase();
    args = parts.slice(1);
  } else {
    const parts = body.split(/\s+/);
    commandName = parts[0].toLowerCase();
    args = parts.slice(1);
  }

  // 4. Command Resolution
  const command = commands.get(commandName) || 
                  [...commands.values()].find(cmd => cmd.aliases?.includes(commandName));

  // 5. Unknown Command
  if (!command) {
    if (isPrefixed) {
      if (commandName === "start") return; 
      return response.reply(`${SYMBOLS.unknown} **Unknown Command**\n\`${commandName}\` not found.`);
    }
    return;
  }

  // 6. Maintenance Mode
  if (settings.maintenance) {
    const ignoredCommands = settings.maintenanceIgnore || [];
    const isWhitelisted = ignoredCommands.includes(command.name) || 
                          (command.aliases && command.aliases.some(a => ignoredCommands.includes(a)));

    if (!isDev && !isWhitelisted) {
      return response.reply(`${SYMBOLS.maintenance} **System Under Maintenance**\nPlease try again later.`);
    }
  }

  // 7. Helpers: Usage & isRegistered
  const usage = async () => {
    if (!command.guide) return;
    const p = command.prefix === false ? "" : (matchedPrefix || prefix);
    const guides = (Array.isArray(command.guide) ? command.guide : [command.guide])
      .map(g => `\`${p}${command.name} ${g}\``)
      .join('\n');

    return await response.reply(
      `${SYMBOLS.usage} **Usage Guide:**\n\n${guides}\n\n${SYMBOLS.guide} ${command.description || "No description."}`
    );
  };

  /**
   * [NEW] Checks if the user is registered in the database.
   * If NOT registered, it automatically replies with a warning.
   * Usage inside command: if (!(await isRegistered())) return;
   */
  const isRegistered = async () => {
    const user = await global.db.users.get(msg.from.id);
    if (!user.registered) {
      await response.reply(
        `${SYMBOLS.lock} **Access Denied**\n\n` +
        `You are not registered in the system.\n` +
        `Please use \`${matchedPrefix}register\` to sign up and access this feature.`
      );
      return false; // User is NOT registered
    }
    return true; // User IS registered
  };

  try {
    // 8. Prefix Enforcement
    const requiresPrefix = command.prefix ?? true; 
    if (requiresPrefix === true && !isPrefixed) return; 
    if (requiresPrefix === false && isPrefixed) return; 

    // 9. Permission Check
    const level = command.type || command.access || 'anyone';
    if (!(await checkPermission(bot, msg, level))) {
      if (level === 'developer') return; 
      if (level === 'administrator' && msg.chat.type === 'private') {
        return response.reply(`${SYMBOLS.warning} This command cannot be used in private chats.`);
      }
      return response.reply(`${SYMBOLS.warning} Access Restricted: **${level.toUpperCase()}**`);
    }

    // 10. Cooldown Check
    if (!isDev && handleCooldown({ msg, response, cooldowns }, command)) return;

    const fullName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : "");
    log.commands(`${command.name} called by ${fullName}`);

    // 11. Execution
    await command.onStart({ 
      bot, 
      msg, 
      args, 
      response, 
      usage,
      isRegistered, // [NEW] Passed to command
      usersData: global.db.users,   // Convenience
      groupsData: global.db.groups, // Convenience
      commandName, 
      matches: matchedPrefix 
    });

  } catch (error) {
    log.error(`[${commandName}] Runtime Error: ${error.message}`);
    await response.reply(`${SYMBOLS.error} **System Error:**\n\`${error.message}\``);
  }
}
