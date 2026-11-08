
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
  return (msg.caption || msg.text || "").trim().split("\n")[0]
    || "Filim cusub";
}

export function registerCommands(bot) {
  // Kaydi filimada cusub ee Channel-ka
  bot.on("channel_post", async (ctx) => {
    const msg = ctx.channelPost;
    const title = getTitle(msg);
    const movies = await readDB(FILES_DB);

    if (!movies.some(m => m.message_id === msg.message_id)) {
      movies.unshift({
        title,
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
      .text("🔗 Daawo Filimada", "links");

    await ctx.reply(
      `🎬 KU SOO DHAWOOW VEXORA MOVIES!\n\n` +
      `Salaan ${ctx.from.first_name}!\n\n` +
      `Halkan waxaad ka raadin kartaa filimada.\n\n` +
      `🔎 /search Magaca Filimka\n` +
      `🆕 /latest\n` +
      `🔗 /links\n` +
      `❓ /help`,
      { reply_markup: keyboard }
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "🎬 VEXORA MOVIES HELP\n\n" +
      "/start - Bilow\n" +
      "/search Magaca - Raadi filim\n" +
      "/latest - Filimada cusub\n" +
      "/links - Links-ka filimada\n\n" +
      "Qor magaca filimka si aad u raadiso."
    );
  });

  async function searchMovie(ctx, query) {
    if (!query) {
      return ctx.reply("❗ Geli magaca filimka.\nTusaale: /search Avatar");
    }

    const movies = await readDB(FILES_DB);
    const matches = movies.filter(m =>
      m.title.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);

    if (!matches.length) {
      return ctx.reply(
        `😔 Filimka "${query}" lama helin.\n` +
        "Hubi higgaadda ama mar kale isku day."
      );
    }

    await ctx.reply(`🎬 Waxaan helay ${matches.length} natiijo:`);
    for (const movie of matches) {
      try {
        await ctx.api.copyMessage(
          ctx.chat.id,
          CHANNEL,
          movie.message_id
        );
      } catch {
        await ctx.reply(`🎥 ${movie.title}`);
      }
    }
  }

  bot.command("search", async (ctx) => {
    const query = ctx.match.trim();
    await searchMovie(ctx, query);
  });

  bot.command("latest", async (ctx) => {
    const movies = await readDB(FILES_DB);
    const latest = movies.slice(0, 5);

    if (!latest.length) {
      return ctx.reply("Weli filimaan cusub lama kaydin.");
    }

    await ctx.reply("🆕 FILIMADA UGU DAMBEEYAY:");
    for (const movie of latest) {
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
      return ctx.reply("Weli links filimaan laguma darin.");
    }

    for (const item of links.slice(0, 20)) {
      const keyboard = new InlineKeyboard()
        .url("▶️ Daawo Filimka", item.url);

      await ctx.reply(`🎬 ${item.title}`, {
        reply_markup: keyboard
      });
    }
  });

  // Admin-ka Channel-ka ayaa ku dari kara links
  bot.command("addlink", async (ctx) => {
    const member = await ctx.api.getChatMember(
      CHANNEL,
      ctx.from.id
    );

    if (!["creator", "administrator"].includes(member.status)) {
      return ctx.reply("⛔ Kaliya Admin-ka Channel-ka ayaa isticmaali kara.");
    }

    const parts = ctx.match.split("|").map(x => x.trim());
    const [title, url] = parts;

    if (!title || !url || !/^https:\/\/\S+$/i.test(url)) {
      return ctx.reply(
        "Isticmaal sidan:\n/addlink Avatar | https://example.com/movie"
      );
    }

    const links = await readDB(LINKS_DB);
    links.unshift({ title, url });
    await saveDB(LINKS_DB, links);

    await ctx.reply("✅ Link-ga filimka waa lagu daray!");
  });

  // Qofku haddii uu magaca filimka si toos ah u qoro
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();

    if (text.startsWith("/")) return;

    await searchMovie(ctx, text);
  });

  bot.callbackQuery("search", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("🔎 Ii qor magaca filimka aad rabto.");
  });

  bot.callbackQuery("latest", async (ctx) => {
    await ctx.answerCallbackQuery();
    const movies = await readDB(FILES_DB);

    if (!movies.length) {
      return ctx.reply("Weli filimaan lama helin.");
    }

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

  bot.callbackQuery("links", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.api.sendMessage(ctx.chat.id, "Isticmaal /links si aad u aragto links-ka.");
  });
}
