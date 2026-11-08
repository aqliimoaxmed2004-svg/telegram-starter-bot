
import { InlineKeyboard } from "grammy";
import fs from "node:fs/promises";
import path from "node:path";

const CHANNEL = "@VEXORAMOVIES";
const DATA_DIR = path.join(process.cwd(), "data");
const FILES_DB = path.join(DATA_DIR, "movies.json");
const LINKS_DB = path.join(DATA_DIR, "links.json");

async function readDB(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return [];
  }
}

async function saveDB(file, data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

function getTitle(msg) {
  return (msg.caption || msg.text || "Filim cusub")
    .trim().split("\n")[0];
}

export function registerCommands(bot) {

  // Kaydinta filimada cusub ee Channel-ka
  bot.on("channel_post", async (ctx) => {
    const msg = ctx.channelPost;
    const movies = await readDB(FILES_DB);

    if (!movies.some(m => m.message_id === msg.message_id)) {
      movies.unshift({
        title: getTitle(msg),
        message_id: msg.message_id,
        date: msg.date
      });

      await saveDB(FILES_DB, movies.slice(0, 1000));
    }
  });

  bot.command("start", async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text("🔎 Raadi Filim", "search")
      .row()
      .text("🆕 Filimada cusub", "latest")
      .row()
      .text("🔗 Filimada Links", "links");

    await ctx.reply(
      `🎬 KU SOO DHAWOOW VEXORA MOVIES!\n\n` +
      `Salaan ${ctx.from.first_name}!\n\n` +
      `/search Magaca Filimka\n` +
      `/latest - Filimada cusub\n` +
      `/links - Links-ka filimada\n` +
      `/help - Caawimaad`,
      { reply_markup: keyboard }
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "🎬 VEXORA MOVIES\n\n" +
      "/start - Bilow\n" +
      "/search Avatar - Raadi filim\n" +
      "/latest - Filimada cusub\n" +
      "/links - Links filimaan\n"
    );
  });

  async function searchMovie(ctx, query) {
    if (!query) {
      return ctx.reply("❗ Qor magaca filimka.");
    }

    const movies = await readDB(FILES_DB);

    const results = movies.filter(m =>
      m.title.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);

    if (!results.length) {
      return ctx.reply("😔 Filimka lama helin.");
    }

    await ctx.reply(`🎬 Waxaan helay ${results.length} filim:`);

    for (const movie of results) {
      try {
        await ctx.api.copyMessage(
          ctx.chat.id,
          CHANNEL,
          movie.message_id
        );
      } catch {
        await ctx.reply(movie.title);
      }
    }
  }

  bot.command("search", async (ctx) => {
    await searchMovie(ctx, String(ctx.match || "").trim());
  });

  bot.command("latest", async (ctx) => {
    const movies = await readDB(FILES_DB);

    if (!movies.length) {
      return ctx.reply("Weli filimaan cusub lama hayo.");
    }

    await ctx.reply("🆕 FILIMADA CUSUB:");

    for (const movie of movies.slice(0, 5)) {
      try {
        await ctx.api.copyMessage(
          ctx.chat.id,
          CHANNEL,
          movie.message_id
        );
      } catch {
        await ctx.reply(movie.title);
      }
    }
  });

  bot.command("links", async (ctx) => {
    const links = await readDB(LINKS_DB);

    if (!links.length) {
      return ctx.reply("Weli links lama darin.");
    }

    for (const item of links.slice(0, 20)) {
      const keyboard = new InlineKeyboard()
        .url("▶️ Daawo Filimka", item.url);

      await ctx.reply(`🎬 ${item.title}`, {
        reply_markup: keyboard
      });
    }
  });

  bot.command("addlink", async (ctx) => {
    const member = await ctx.api.getChatMember(
      CHANNEL,
      ctx.from.id
    );

    if (!["creator", "administrator"].includes(member.status)) {
      return ctx.reply("⛔ Admin kaliya ayaa isticmaali kara.");
    }

    const parts = String(ctx.match || "")
      .split("|").map(x => x.trim());

    const [title, url] = parts;

    if (!title || !url || !/^https:\/\/\S+$/i.test(url)) {
      return ctx.reply(
        "Isticmaal:\n/addlink Avatar | https://example.com"
      );
    }

    const links = await readDB(LINKS_DB);
    links.unshift({ title, url });

    await saveDB(LINKS_DB, links);

    await ctx.reply("✅ Link-ga waa lagu daray!");
  });

  bot.on("message:text", async (ctx) => {
    const query = ctx.message.text.trim();

    if (query.startsWith("/")) return;

    await searchMovie(ctx, query);
  });

  bot.callbackQuery("search", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("🔎 Ii qor magaca filimka.");
  });

  bot.callbackQuery("latest", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.api.sendMessage(
      ctx.chat.id,
      "Isticmaal /latest si aad u aragto filimada cusub."
    );
  });

  bot.callbackQuery("links", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.api.sendMessage(ctx.chat.id, "Isticmaal /links.");
  });
}
