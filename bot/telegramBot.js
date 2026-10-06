const { Bot } = require("grammy");
const ChainAdmin = require("../models/ChainAdmin");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let bot = null;

const normalizePhone = (phone) => phone.replace(/\s+/g, "");

const startTelegramBot = () => {
  if (!BOT_TOKEN) {
    console.warn("[telegram-bot] TELEGRAM_BOT_TOKEN not set — bot not started");
    return;
  }

  bot = new Bot(BOT_TOKEN);

  bot.command("start", async (ctx) => {
    await ctx.reply("Welcome to MB Barber Management! Tap below to link your account.", {
      reply_markup: {
        keyboard: [[{ text: "📱 Share My Phone Number", request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    });
  });

  bot.on("message:contact", async (ctx) => {
    const chatId = ctx.chat.id;
    const rawPhone = ctx.message.contact.phone_number;
    const sharedPhone = normalizePhone(rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`);

    try {
      const last9 = sharedPhone.slice(-9);
      const chainAdmin = await ChainAdmin.findOne({ telegramPhone: new RegExp(`${last9}$`) });

      if (!chainAdmin) {
        await ctx.reply("We couldn't find an account with this phone number. Make sure you've entered it in Settings first, then try /start again.");
        return;
      }

      chainAdmin.telegramChatId = String(chatId);
      await chainAdmin.save();

      await ctx.reply(
        `Welcome, ${chainAdmin.name}! 🎉\n\nYour account is now linked. We'll send your shops' daily analysis here every night at 9:00 PM.`,
        { reply_markup: { remove_keyboard: true } }
      );
    } catch (err) {
      console.error("[telegram-bot] contact handling failed:", err.message);
      await ctx.reply("Something went wrong linking your account. Please try again.");
    }
  });

  bot.catch((err) => {
    console.error("[telegram-bot] error:", err.message);
  });

  bot.start();
  console.log("[telegram-bot] polling started (grammy)");
};

const sendTelegramMessage = async (chatId, text) => {
  if (!bot) throw new Error("Telegram bot not started");
  return bot.api.sendMessage(chatId, text, { parse_mode: "Markdown" });
};

module.exports = { startTelegramBot, sendTelegramMessage };